---
name: Thrive Financial
description: AI-powered forensic analysis workspace for divorce financial proceedings.
colors:
  purple-void: "#7c3aed"
  purple-bright: "#9c5bff"
  gold-burnished: "#C89A3A"
  gold-bright: "#E8B84E"
  rose-alert: "#f472b6"
  income-positive: "#15803d"
  expense-negative: "#c41c1c"
  bg-abyss: "#0A0514"
  surface-raised: "#100820"
  card-base: "#160C2C"
  card-alt: "#1C1138"
  text-primary: "#EDE8F8"
  text-muted: "#9A88C0"
  text-dim: "#5A4A78"
typography:
  display:
    fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.65rem, 5vw, 5.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(1.9rem, 3vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.2em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.gold-burnished}"
    textColor: "{colors.bg-abyss}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.625rem"
  button-primary-hover:
    backgroundColor: "{colors.gold-bright}"
    textColor: "{colors.bg-abyss}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.625rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.625rem"
  card:
    backgroundColor: "{colors.card-base}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
---

# Design System: Thrive Financial

> Current navigation and review periods: [Current views and workflows](CURRENT_WORKFLOWS.md) (reviewed October 27, 2026).

## Current compact navigation and loading states

Novice dashboards use Summary/Detailed controls and persistent scope/date context. Detailed source reviews expand on request, with financial PDF actions beside the dashboard controls. Investigate keeps its six steps visible as a desktop row or mobile grid, while its title scrolls. Loading indicators use organization colors, visible status text and reduced-motion behavior. Preparing, Waiting on records and Checked/clear remain distinct states. Portalled review drawers specify light/dark foreground colors. Exact labels and breakpoints are in [current workflows](CURRENT_WORKFLOWS.md).

## 1. Overview

**Creative North Star: "The Vault Report"**

A sealed forensic dossier: tamper-evident, source-linked, designed to survive scrutiny. The aesthetic of documents that outlast the proceedings they document. This system does not comfort. It certifies. Every surface carries the same discipline as evidence submitted under oath: nothing decorates that doesn't prove something, every value traces to a source, every elevated element earns its prominence.

The palette is a deep-space purple void with two accents: burnished gold for primary actions and certifications (the seal at the bottom of the affidavit), and spectral violet for ambient state and structure (the ink that saturates the page). Text is near-white with a faint lavender cast, never stark. The typographic system pairs Cormorant Garamond for display and section headers (the weight of a stamped legal instrument) with Outfit for body and data (clinical legibility under pressure). The pairing is not romantic; it is authoritative.

This system explicitly rejects gray-on-gray legal document software aesthetics. There is no Westlaw density, no Clio neutrality, no CMS information-architecture layering that buries the findings under navigation. The data is the hero; the surface is a deliberate frame, not a neutral container.

**Key Characteristics:**
- Dark-first: deep purple voids, never light neutral backgrounds in the brand register
- Two-accent discipline: gold for primary actions, spectral purple for ambient states
- Serif display + sans body: Cormorant Garamond headers read like certified instruments; Outfit body delivers forensic clarity
- Structured depth: black structural shadows plus colored halos that track interaction state
- Evidence-first hierarchy: conclusions link to sources; prominence follows evidentiary weight
- Noise suppression: a 2% fractal noise texture on the body background prevents pure-digital flatness

## 2. Colors: The Deep Purple Noir Palette

Two distinct color registers carry this system: a cold, deep purple noir for surfaces and structure, and a warm burnished gold reserved strictly for primary calls to action and categorical labels.

### Primary
- **Spectral Purple** (`#7c3aed`): The structural accent. Used on borders, hover-state backgrounds (at 8-12% opacity), focus rings, and active nav states. At full opacity it appears on interactive highlights and status badges only. Its rarity at full saturation is the point.
- **Spectral Purple Bright** (`#9c5bff`): Hover and pressed state of the spectral purple; also used as the primary brand color in dark-mode interactive contexts (ring, link hover).

### Secondary
- **Gold Burnished** (`#C89A3A`): The certification seal. Reserved exclusively for primary buttons and uppercase category labels. When you see this gold, the interface is asking you to commit or confirming something verified.
- **Gold Bright** (`#E8B84E`): Hover and italic-emphasis variant of the burnished gold. Used in `<em>` display type to mark key phrases, and on button hover to indicate active state.

### Tertiary
- **Forensic Rose** (`#f472b6`): Risk and alert signals only. Never decorative. Never used for positive or neutral states.
- **Income Green** (`#15803d`): Positive monetary values in data tables and forensic summaries.
- **Expense Red** (`#c41c1c`): Negative monetary values and outflow indicators. Paired with label text, never color alone.

### Neutral
- **Abyss** (`#0A0514`): Page background. The deepest surface. Nothing goes beneath this.
- **Surface Raised** (`#100820`): Elevated surfaces (nav backgrounds, section backgrounds nested inside the page).
- **Card Base** (`#160C2C`): Standard card background. The most common container surface.
- **Card Alt** (`#1C1138`): Alternative card for visual separation inside card grids without nesting.
- **Text Primary** (`#EDE8F8`): Primary text. Faint lavender cast; never pure white.
- **Text Muted** (`#9A88C0`): Supporting copy, metadata, secondary labels.
- **Text Dim** (`#5A4A78`): Tertiary information, placeholder text, disabled states.

### Named Rules
**The Two-Accent Rule.** Gold and spectral purple serve different semantic jobs. Gold means "act" or "certified." Purple means "structure" or "interactive ambient." Never substitute one for the other. A purple primary button is wrong. A gold border accent is wrong.

**The Opacity Discipline Rule.** The spectral purple at 8-12% opacity (rgba(124, 58, 237, 0.08-0.12)) is a hover-state background, not a brand wash. Use it as a state signal, not as a color fill. Full-opacity purple on large surfaces is prohibited outside status badges and icons.

## 3. Typography

**Display Font:** Cormorant Garamond (with Georgia, 'Times New Roman', serif fallback)
**Body Font:** Outfit (with system-ui, sans-serif fallback)

**Character:** Cormorant Garamond carries institutional weight, the typographic register of legal instruments and forensic reports: high contrast strokes, tight leading, credentialed. Outfit provides the clinical legibility of data-dense interfaces without warmth or whimsy. Together they separate claims (serif: what was found) from data (sans: the exact figures).

### Hierarchy
- **Display** (600, clamp(2.65rem, 5vw, 5.5rem), 1.05): Hero headlines and page-level section titles. Cormorant Garamond. Italic `<em>` children shift to weight 400 with gold-bright color to mark key phrases inside display headings.
- **Headline** (600, clamp(1.9rem, 3vw, 3rem), 1.1): Section headings, module titles, content area headers. Cormorant Garamond. Letter-spacing -0.01em.
- **Title** (600, 1.125rem, 1.3): Card headings, sidebar section labels, panel titles. Outfit. Not display type.
- **Body** (400, 1rem, 1.65): All running prose. Outfit. Cap at 68ch max-width. Line-height 1.65 for forensic-document readability.
- **Label** (600, 0.6875rem, tight, 0.2em, UPPERCASE): Category tags, overlines, status chips. Outfit. Always gold (`#C89A3A`) or muted (`#9A88C0`). Never display font. Never below 11px rendered.

### Named Rules
**The Display-Data Split Rule.** Cormorant Garamond is for claims and section titles. Outfit is for data, labels, navigation, and interactive elements. Never use display font on buttons, inputs, nav links, data cells, or labels. If an element serves the data, it uses Outfit.

**The Label Voice Rule.** Labels are UPPERCASE Outfit in gold or muted only. No lowercase labels at 0.6875rem. The uppercase + wide letter-spacing is the system's categorical signal; abandoning it in any label breaks the visual code.

## 4. Elevation

This system uses a hybrid elevation model: deep black structural shadows that carry no hue, plus colored halos that encode interactive state. Surfaces at rest are flat to their layer. Shadows appear on hover, focus, and promoted elements to indicate state, not decoration.

### Shadow Vocabulary
- **Ambient Low** (`0 2px 12px rgba(0, 0, 0, 0.5)`): Resting state for small elevated elements. Opaque black, no hue. Used on dropdowns, tooltips.
- **Ambient Mid** (`0 8px 32px rgba(0, 0, 0, 0.6)`): Card hover state. Structural depth that lifts without glowing.
- **Ambient High** (`0 20px 60px rgba(0, 0, 0, 0.7)`): Modals, promoted hero panels. Maximum structural shadow.
- **Spectral Halo** (`0 20px 60px -10px rgba(124, 58, 237, 0.35)`): Purple glow applied to panels and cards with brand-significant content. The halo is identity, not decoration. Used on featured cards, hero panels.
- **Gold Halo** (`0 8px 32px -8px rgba(200, 154, 58, 0.3)`): Primary button active/hover. Confirms that the gold action has been recognized.

### Named Rules
**The State-Only Shadow Rule.** Shadows appear in response to state (hover, focus, promoted), never applied statically to decorative containers. A resting card has no shadow. A hovered card has `Ambient Mid`. An interactive hero panel earns `Spectral Halo` only if it carries brand significance.

**The Halo Rarity Rule.** The spectral purple halo (`Spectral Halo`) is reserved for featured/hero contexts. It cannot appear on ordinary data cards or repeating list items. If every card has the halo, the halo means nothing.

## 5. Components

### Buttons
The primary CTA is a gold certification seal. The outline button is a spectral invitation. The ghost button fades into the surface.

- **Shape:** Gently rounded (8px, `{rounded.md}`). Not pill-shaped; not sharp-cornered. The curve is functional, not playful.
- **Primary:** Gold gradient background (`linear-gradient(135deg, #C89A3A, #E8B84E)`), abyss-dark text (`#0A0514`), padding 0.75rem 1.625rem, weight 700. Hover: brighter gradient, gold halo shadow, translateY(-1px).
- **Outline:** Purple-tinted background (rgba(124, 58, 237, 0.08)), full-opacity purple border at reduced opacity (rgba(124, 58, 237, 0.35)), text-primary. Hover: tint to 0.15, border to full `#7c3aed`, soft purple glow.
- **Ghost:** Near-transparent background (rgba(255,255,255,0.04)), white border at 0.08 opacity, text-muted. Hover: background to 0.07, border to 0.15, text lifts to text-primary.
- **Focus:** All buttons receive a 2px offset ring in spectral purple (`#7c3aed`) on focus-visible. No outline suppression.

### Cards
Cards are forensic containers: they hold evidence, not decoration.

- **Corner Style:** 16px radius (`{rounded.lg}`) on standard cards; 20px on featured/hero cards.
- **Background:** Card Base (`#160C2C`) as default; Card Alt (`#1C1138`) for differentiation within a grid.
- **Border:** 1px solid rgba(124, 58, 237, 0.10) at rest; 1px solid rgba(124, 58, 237, 0.22) on hover.
- **Shadow Strategy:** No shadow at rest. Ambient Mid shadow on hover, optionally combined with Spectral Halo for brand-significant cards.
- **Hover Lift:** translateY(-3px) on hover, 0.25s ease.
- **Internal Padding:** 1.5rem standard; 2rem for featured cards.
- **Nested cards are prohibited.** A card inside a card creates visual debt; use background tints or ruled separation instead.

### Inputs / Fields
- **Style:** 1px border in purple at 0.22 opacity, Card Base background, 8px radius. Same radius as buttons.
- **Focus:** Border shifts to full spectral purple (`#7c3aed`), soft inset glow (box-shadow: 0 0 0 3px rgba(124,58,237,0.15)).
- **Error state:** Border shifts to `#dc2626`, background tint rgba(220, 38, 38, 0.07). Label turns error red.
- **Disabled:** Opacity 0.5, cursor not-allowed. Background unchanged (no gray-out).

### Navigation
- **Link style:** Outfit 0.8125rem, weight 500, letter-spacing 0.03em, text-muted default.
- **Hover:** text-primary, purple hover background at 12% opacity.
- **Active:** text-primary, purple active background at 12% opacity, no side-stripe border.
- **Active signal is background tint, never a left-border stripe.** A colored border-left on nav items is prohibited.

### Labels / Chips
- **Style:** Outfit 0.6875rem, weight 600, uppercase, letter-spacing 0.2em. Gold (`#C89A3A`) for category labels; text-muted for metadata labels.
- **Chip background:** For status chips, use a 6px radius (`{rounded.sm}`) container with matching color at 10% opacity as background. Example: risk chip = rose at rgba(244, 114, 182, 0.10) background with `#f472b6` text.
- **No gradient text on labels.** Color is solid.

### Forensic Label (Signature Component)
The gold uppercase overline is the system's most distinctive typographic element. It appears above display and headline text to pre-classify the section: "CASE OVERVIEW", "RISK INDICATORS", "SOURCE DOCUMENTS". Always gold. Always uppercase Outfit at 0.6875rem with 0.2em letter-spacing. Never skipped in branded contexts.

## 6. Accessibility

WCAG 2.1 AA. All interactive elements keyboard-accessible, screen-reader labeled, and meeting 4.5:1 contrast minimum for normal text, 3:1 for large text. Reduced-motion variants for all animations. Color is never the sole signal — financial status indicators pair color with shape or label (see the Named Rules under Colors and Do's/Don'ts below).

## 7. Do's and Don'ts

### Do:
- **Do** use Cormorant Garamond exclusively for display and headline text, and Outfit for all functional elements (buttons, labels, nav, data).
- **Do** keep gold (`#C89A3A` and `#E8B84E`) reserved for primary CTAs and category overlines only. Its rarity is its authority.
- **Do** apply shadows as state responses: none at rest, Ambient Mid on hover, Spectral Halo on promoted hero panels.
- **Do** pair color with shape or label for all financial-status indicators. A red number must also have a minus sign or "expense" label. Color is never the sole signal.
- **Do** use active nav state as a background-tint only (rgba(124, 58, 237, 0.12)). The active element is distinguished by fill, not by a side stripe.
- **Do** keep body text at 65-68ch maximum line length and 1.65 line-height. Financial copy is read under pressure.

### Don't:
- **Don't** use gray-on-gray surfaces, neutral white backgrounds, or Westlaw/Clio information-density patterns. This system's surfaces are deep purple void; there are no warm white or cream backgrounds in the brand register.
- **Don't** introduce border-left or border-right greater than 1px as a colored accent stripe on cards, list items, nav items, or alerts. Active states use background tints; categorization uses full borders or background fills.
- **Don't** use gradient text (background-clip: text with a gradient). All text is a single solid color. Emphasis lives in weight, scale, and gold vs. muted distinction.
- **Don't** apply the Spectral Halo (purple glow shadow) to repeating data cards or list items. It is reserved for hero and featured contexts where brand significance is intentional.
- **Don't** write copy in the interface that sounds like legal counsel ("you should", "we recommend", "this constitutes"). The product distinguishes what the numbers show from what to do about it.
- **Don't** use Cormorant Garamond on buttons, labels, nav links, inputs, or data cells. Display font is for claims and titles; sans-serif is for everything that serves the data.
- **Don't** apply identical card grid layouts (same-sized cards with icon + heading + text repeated uniformly). Feature hierarchy must vary within grids: use size, background-tint weight, or border treatment to establish prominence.
