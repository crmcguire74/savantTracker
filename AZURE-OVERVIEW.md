# Moving the Initiatives Tracker to Azure

A plain-language summary. No technical background needed.

---

## What we have today

A tracker holding our 2026 enterprise initiatives: 4 pillars, 28 initiatives,
43 projects. Who owns each one, whether it is on track, what is blocking it,
and what leadership needs to decide.

It currently lives inside a Claude conversation. That works, but it depends on
having the link, and it sits outside our own systems.

## What we want

The same tracker, running on Savant's own Microsoft Azure account. Three
things change:

1. It lives on our infrastructure, not a vendor's.
2. You sign in with your normal Savant account. No new password.
3. Only people we choose can open it, and only some of them can change it.

Nothing about how the tracker looks or works changes. Same screens, same data.

---

## How people will use it

Open a link. Sign in with your Savant account the same way you sign in to
Outlook or Teams. The tracker appears.

Two levels of access:

- **Editors** update projects, change status, log issues.
- **Viewers** see everything and change nothing.

Leadership typically gets Viewer. Project and delivery owners get Editor.
Access is managed by IT the same way they manage any other group, so adding
or removing someone takes seconds and does not involve us.

Anyone not on the list gets a message telling them to request access. They
cannot see the data.

---

## Where the data lives

In a Microsoft database inside Savant's Azure account, in the region IT
already uses. It is backed up continuously and can be restored to any point
in the last seven days.

Two deliberate protections:

- The tracker is not reachable from the public internet. You have to be on
  the Savant network or VPN. Someone with the link and a stolen password
  still cannot open it from a coffee shop.
- The database has no password to steal. The application proves who it is
  using its own Microsoft identity instead. There is no connection string
  sitting in a file for someone to find.

That second point is worth a moment. Most small internal apps keep a database
password in a config file somewhere. This one does not have one, because
there is nothing to have.

---

## What it costs

Roughly $28 a month. About $340 a year.

| Item | Monthly |
|---|---|
| Web server | $13 |
| Database | under $1 |
| Private network connections | $14 |
| Sign-in | already covered by our Microsoft licensing |

If the tracker becomes something leadership relies on week to week, a sturdier
web server is about $124 a month and adds redundancy. Start small. Upgrading
later is a setting, not a rebuild.

---

## Who does what

**Our Azure administrator**, roughly two hours:
runs four prepared scripts that create everything, sets up sign-in, assigns
the two access groups.

**Someone in IT identity**, fifteen minutes:
approves creating the sign-in registration. This is a different permission
from creating Azure resources, so it may be a different person.

**Our network team**, a conversation:
confirms the office network and VPN can reach the new environment before we
close it to the public internet. This is the one step where getting ahead of
ourselves causes a problem.

**Chris**, about an hour:
publishes the application, loads the existing data, tests that everything
works before anyone else is told about it.

Elapsed time is a few days, mostly waiting on people rather than on work.

---

## What could go wrong

**We lock ourselves out.** The step that makes the tracker private assumes the
office network can reach it. If that plumbing is not in place, nobody can get
in, including us. It reverses with one command, and we confirm with the
network team beforehand. Low risk, quick fix, worth naming.

**Sign-in stops working in two years.** A security credential expires on a
fixed date. When it lapses, sign-in breaks and the error message does not
explain why. The setup prints the date. It goes in a shared calendar. Renewal
takes one command.

**Brief interruptions during updates.** Publishing a change restarts the
application for a few seconds. At this size nobody notices.

---

## The decision

Approve about $28 a month and a few hours of admin time, in exchange for the
tracker living on our own infrastructure, behind our own sign-in, visible only
to people we choose, inside our network.

The technical work is already built and tested. What is left is provisioning
and permissions.

---

*Technical detail, including every command and a troubleshooting guide, is in
the companion document AZURE-DEPLOYMENT.md.*
