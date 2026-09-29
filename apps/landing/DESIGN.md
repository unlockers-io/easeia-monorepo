---
name: Easeia Landing
description: "The incumbent Swiss annual-report system."
colors:
  primary: "oklch(0.12 0 0)"
  background: "oklch(0.985 0 0)"
  muted: "oklch(0.955 0 0)"
  muted-foreground: "oklch(0.4 0 0)"
  border: "oklch(0.85 0 0)"
  destructive: "oklch(0.55 0.21 27)"
  success: "oklch(0.52 0.15 150)"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "3rem"
    fontWeight: 900
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4286
    letterSpacing: "normal"
rounded:
  square: "0px"
spacing:
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.square}"
    height: "32px"
    padding: "0 10px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    rounded: "{rounded.square}"
    height: "32px"
    padding: "0 10px"
  input:
    textColor: "{colors.primary}"
    rounded: "{rounded.square}"
    height: "36px"
    padding: "4px 12px"
---

# Design System: Easeia Landing

## Overview

**Creative North Star: "Annual Report"**

A Swiss annual report for a practical publishing tool: one grotesk, strong black rules, clear numbered sections and near-white paper. The existing logo, flat report figures and real dashboard captures carry the identity. Product imagery uses disclosed synthetic .example data.

**Key Characteristics:**

- Numbered report sections and figure captions.
- Heavy, tightly set headings with restrained body copy.
- Square controls and authentic product screenshots.

## Colors

The frontmatter records the shared source values from `../../packages/ui/src/styles/globals.css`; both apps import that stylesheet. These app documents describe its use, not a separate palette.

### Primary

Ink (`primary`) supplies headings, rules and primary actions.

### Neutral

Paper (`background`) is also the card surface. Pale gray (`muted`) supplies quiet fills; secondary text uses `muted-foreground`, and fine divisions use `border`.

### State

Red (`destructive`) marks failures and invalid fields; green (`success`) can identify published state.

**The State Color Rule.** Use chromatic color to communicate state; keep the surrounding report neutral.

## Typography

Schibsted Grotesk is the display and body face, loaded through `next/font` as `--font-sans-face`. Headings are heavy and tightly tracked; body text stays regular. The display grows from the frontmatter base to (4.5rem) at `md` and (5.25rem) at `lg`. Section headlines grow to (2.75rem) at `md`. Introductory copy uses a maximum measure of (46ch). Technical code alone uses the monospace stack.

## Layout

The centered report uses the Tailwind `xl` container (1280px), horizontal padding of (24px), and (32px) at `md`. Numbered sections stack on small screens, then form a twelve-column grid at `md`: four columns for the section heading and eight for its content. Wide sections use all twelve. Section padding grows from (64px) to (80px); the repeated rhythm uses the spacing scale above. The hero uses a seven/five split.

Screenshots scale to their container and link to the original image. The API example scrolls within its own region. The sticky header switches from desktop links to a native disclosure menu below `md`; comparison columns stack below `lg`.

## Elevation & Depth

Report surfaces are flat, separated by ink rules, fine borders and quiet tonal fills. Primary structural rules are (4px); ordinary dividers are (1px). The shared input retains a small `shadow-xs` treatment and focus rings; these are control states, not a raised-card vocabulary.

## Shapes

Shared radius tokens resolve to square corners. Preserve straight report edges, rectangular controls and sharp rules. True circles remain appropriate for graph nodes and status dots; the square token does not replace those geometries.

## Components

- **Buttons:** primary ink fill, outline inversion on hover, and compact semibold labels. Default height and padding are in frontmatter; the large variant is (36px) high. Shared buttons use a visible three-pixel focus ring, reduced opacity when disabled, and a one-pixel active translation for ordinary actions.
- **Fields:** square one-pixel input borders, a three-pixel focus ring, descriptive labels, and destructive invalid state. Text is (16px) below `md` and (14px) above it. Keep help, pending, error and success messages beside the relevant action.
- **Navigation:** an opaque sticky header with a heavy lower rule. Desktop links become ink and underline on hover; the mobile disclosure is bordered and its links gain a muted hover fill.
- **Report panels:** figures and comparison panels use top rules and internal row divisions. Numbered headings and figure captions provide functional report wayfinding. Status marks are compact uppercase text, with words carrying the meaning.
- **API example:** reversed ink/paper presentation, monospace request text, a named keyboard-scrollable region, and a contrasting inset focus outline (2px, offset −4px).
- **Product images:** use the actual captures in `public/screenshots/`, with accessible descriptions, demo-data captions and a link to the full image.

Use brief control transitions. The shared reduced-motion media query disables practical CSS motion; do not add ornamental animation. Component source examples and extension values live in `.impeccable/design.json`.

## Do's and Don'ts

### Do:

- Do reuse the shared palette and Schibsted Grotesk.
- Do use numbered sections for report wayfinding and captions to identify figures.
- Do show real dashboard captures with disclosed fictional .example data.
- Do preserve visible focus on controls and horizontally scrollable code.

### Don't:

- Don’t replace the confirmed identity with decorative gradients, rounded marketing cards or an unrelated display face.
- Don’t present synthetic examples as customer evidence.
- Don’t imply that Cloud is purchasable or has confirmed pricing.
