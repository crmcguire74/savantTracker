#!/usr/bin/env python3
"""Normalize the live Claude-artifact tracker data into a versioned app file.

Reads the raw `tracker/state` and `tracker/log` documents exported from the
artifact database and writes src/data/snapshot.json in APP_FILE format v1.

Schema drift handled here:
  - projects carried `updatedBy` (a display name) in the live data while the
    published app reads `updatedById` (an opaque user id). Both are preserved:
    the name lands in `updatedByName`, the id in `updatedById`.
  - `decisionOutcome` was added after most rows were written; defaults to "".
  - every optional field is filled so the TypeScript model has no holes.
"""
import json
import sys
from datetime import datetime, timezone

RAW = sys.argv[1]
OUT = sys.argv[2]

PROJECT_DEFAULTS = {
    "initiativeId": "", "title": "", "businessOwner": "", "executionOwner": "",
    "projectManager": "", "scope": "", "trending": "stable", "phase": "",
    "planLink": "", "startDate": "", "originalEndDate": "", "forecastEndDate": "",
    "nextMilestone": "", "nextMilestoneDate": "", "keyRisk": "", "decisionNeeded": "",
    "decisionOutcome": "", "rag": "green", "progress": 0, "updatedAt": "",
    "updatedById": "", "updatedByName": "",
}
INITIATIVE_DEFAULTS = {
    "pillarId": "", "title": "", "businessOwner": "", "executionOwner": "",
    "startQuarter": "", "endQuarter": "",
}
PILLAR_DEFAULTS = {"title": "", "owner": ""}
ISSUE_DEFAULTS = {"title": "", "severity": "medium", "status": "open"}
LOG_DEFAULTS = {
    "projectId": "", "projectTitle": "", "field": "", "fieldKey": "",
    "oldValue": "", "newValue": "", "editedById": "", "editedByName": "",
    "timestamp": "",
}

VALID_RAG = {"green", "amber", "red"}
VALID_TREND = {"improving", "stable", "declining"}
VALID_SEVERITY = {"low", "medium", "high"}
VALID_STATUS = {"open", "resolved"}


def fill(row, defaults):
    out = dict(defaults)
    for key, value in row.items():
        if key in defaults or key == "id":
            out[key] = value
    out["id"] = row.get("id", "")
    return out


def normalize_project(raw):
    row = dict(raw)
    # `updatedBy` held a display name in older writes.
    legacy_name = row.pop("updatedBy", None)
    project = fill(row, PROJECT_DEFAULTS)
    if isinstance(legacy_name, str) and legacy_name and not project["updatedByName"]:
        project["updatedByName"] = legacy_name
    if project["rag"] not in VALID_RAG:
        project["rag"] = "green"
    if project["trending"] not in VALID_TREND:
        project["trending"] = "stable"
    try:
        project["progress"] = max(0, min(100, int(project["progress"] or 0)))
    except (TypeError, ValueError):
        project["progress"] = 0
    issues = []
    for raw_issue in raw.get("issues") or []:
        issue = fill(raw_issue, ISSUE_DEFAULTS)
        if issue["severity"] not in VALID_SEVERITY:
            issue["severity"] = "medium"
        if issue["status"] not in VALID_STATUS:
            issue["status"] = "open"
        issues.append(issue)
    project["issues"] = issues
    return project


def main():
    with open(RAW + "/state.json") as handle:
        state = json.load(handle)
    with open(RAW + "/log.json") as handle:
        log_doc = json.load(handle)

    pillars = [fill(p, PILLAR_DEFAULTS) for p in state.get("pillars", [])]
    initiatives = [fill(i, INITIATIVE_DEFAULTS) for i in state.get("initiatives", [])]
    projects = [normalize_project(p) for p in state.get("projects", [])]

    pillar_ids = {p["id"] for p in pillars}
    initiative_ids = {i["id"] for i in initiatives}
    orphan_initiatives = [i["id"] for i in initiatives if i["pillarId"] not in pillar_ids]
    orphan_projects = [p["id"] for p in projects if p["initiativeId"] not in initiative_ids]

    entries = []
    for raw_entry in log_doc.get("entries", []):
        entry = fill(raw_entry, LOG_DEFAULTS)
        entry["oldValue"] = "" if entry["oldValue"] is None else str(entry["oldValue"])
        entry["newValue"] = "" if entry["newValue"] is None else str(entry["newValue"])
        entries.append(entry)

    payload = {
        "app": "savant-strategic-initiatives-tracker",
        "formatVersion": 1,
        "exportedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "claude-artifact-db",
        "settings": {"staleThresholdDays": 30},
        "state": {
            "quarter": state.get("quarter", ""),
            "pillars": pillars,
            "initiatives": initiatives,
            "projects": projects,
        },
        "log": entries,
    }

    with open(OUT, "w") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"pillars={len(pillars)} initiatives={len(initiatives)} "
          f"projects={len(projects)} issues={sum(len(p['issues']) for p in projects)} "
          f"log={len(entries)}")
    print(f"orphan initiatives={orphan_initiatives or 'none'}")
    print(f"orphan projects={orphan_projects or 'none'}")
    named = sum(1 for p in projects if p["updatedByName"])
    print(f"projects carrying a legacy editor name={named}")


main()
