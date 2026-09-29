---
name: Easeia Admin
description: "The incumbent Swiss annual-report system."
colors:
  primary: "oklch(0.12 0 0)"
  background: "oklch(0.985 0 0)"
  muted: "oklch(0.955 0 0)"
  muted-foreground: "oklch(0.4 0 0)"
  border: "oklch(0.85 0 0)"
  destructive: "oklch(0.55 0.21 27)"
  success: "oklch(0.52 0.15 150)"
  warning: "oklch(0.6 0.16 72)"
typography:
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.5556
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4286
    letterSpacing: "normal"
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3333
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

# Design System: Easeia Admin

## Overview

**Creative North Star: "Annual Report"**

The working annual report: a compact numbered navigation rail, strong page rules, large key figures and dense operational tables. Schibsted Grotesk and neutral paper keep the existing admin coherent; status color helps an operator interpret state.

**Key Characteristics:**

- Numbered navigation and section rules.
- Large tabular figures beside compact operational detail.
- Square shared controls and semantic status color.

## Colors

The frontmatter records the shared source values from `../../packages/ui/src/styles/globals.css`; both apps import that stylesheet. These app documents describe its use, not a separate palette.

### Primary

Ink (`primary`) supplies headings, rules and primary actions.

### Neutral

Paper (`background`) is also the card surface. Pale gray (`muted`) supplies quiet fills; secondary text uses `muted-foreground`, and fine divisions use `border`.

### State

Red (`destructive`) marks failures, green (`success`) marks successful state where used, and amber (`warning`) identifies warnings. Some positive states intentionally remain neutral, including published post badges and overview statistics.

**The State Color Rule.** Use chromatic color to communicate state; keep the surrounding report neutral.

## Typography

Schibsted Grotesk is the display and body face, loaded through `next/font` as `--font-sans-face`. Page headings are black weight and tightly tracked; section titles are bold. Tables and controls use compact body text. Statistics use tabular numerals: ordinary values (1.875rem), minor values (1.75rem), and lead values (3rem), growing to (3.5rem) at `lg`. Lead values occupy two tracks when the grid expands.

## Layout

The dashboard has a maximum width of (1480px). At `md` it uses a sticky (208px) rail and a flexible main column with (40px) horizontal padding. Below `md`, navigation becomes a horizontal scrolling strip above the content, with (16px) content padding and (44px) navigation targets. Main content keeps `min-width: 0` so tables and graph surfaces can fit their column.

The report rhythm combines (40px) section gaps, heavy page rules and fine row dividers. Statistic strips start at two columns, become three at `md`, and expand at `lg`. Graph filters wrap in normal flow above the canvas so they do not cover nodes.

## Elevation & Depth

Report surfaces are flat, separated by ink rules, fine borders and quiet tonal fills. Primary structural rules are (4px); ordinary dividers are (1px). The shared input retains a small `shadow-xs` treatment and focus rings; these are control states, not a raised-card vocabulary. Dialogs use a translucent, blurred backdrop and a thin ring; the graph legend retains a subtle shadow and translucent surface over the canvas.

## Shapes

Shared radius tokens resolve to square corners. Preserve straight report edges, rectangular controls and sharp rules. True circles remain appropriate for graph nodes and status dots; the square token does not replace those geometries.

## Components

- **Buttons:** primary ink fill, outline inversion on hover, and compact semibold labels. Default height and padding are in frontmatter; the large variant is (36px) high. Shared buttons use a visible three-pixel focus ring, reduced opacity when disabled, and a one-pixel active translation for ordinary actions.
- **Fields:** square one-pixel input borders, a three-pixel focus ring, descriptive labels, and destructive invalid state. Text is (16px) below `md` and (14px) above it. Keep help, pending, error and success messages beside the relevant action.
- **Navigation:** numbered rail links use muted text at rest and bold ink for the active page. On mobile, the active link gains an inset underline and the numerical index is hidden.
- **Badges:** compact uppercase text in a square (20px) container. Published is ink, scheduled is muted, draft is outlined, and failure or overdue is destructive; retain explicit labels and their SVG icons.
- **Report cards:** the shared Card uses a top ink rule with (16px) spacing, or (12px) in its small variant. SectionHead and StatGrid provide unboxed alternatives with aligned numbers and rules.
- **Graph:** controls occupy a wrapping strip above the canvas; neutral nodes and weighted edges communicate site/link type. Keep the existing compact legend and map controls within the graph.

Use brief control transitions. The shared reduced-motion media query disables practical CSS motion; do not add ornamental animation. Component source examples and extension values live in `.impeccable/design.json`.

## Do's and Don'ts

### Do:

- Do reuse @repo/ui controls, palette and Schibsted Grotesk.
- Do keep report sections, statistics and tables aligned with the existing admin grid.
- Do accompany status color with a readable label or icon.
- Do keep graph filters in normal document flow above the canvas.

### Don't:

- Don’t introduce decorative brand colors or a separate visual identity for new dashboard pages.
- Don’t turn every report section into a raised card.
- Don’t imply per-user roles in an instance with shared full-admin access.
