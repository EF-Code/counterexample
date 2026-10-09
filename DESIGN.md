# Counterexample design system

## 0. Research Log
- Embedded references: shortlisted Vercel, Linear, Sentry. Selected minimalist execution
  guidance plus Vercel's Geist typography, restrained chrome, and explicit workflow hierarchy.
- Lazyweb: one developer-debugging query; one CommandBar debugger screenshot viewed.
  Harvested side-by-side context and execution-preview grammar, not pixels or branding.
- Image concepts: skipped because no image-generation tool is available in this session.
- Product facts come from the working backend and the user's successful live inference.

## 1. Atmosphere & Identity
An evidence workbench in a normally lit engineering workspace. White surfaces and charcoal
type let red violations and green bounded-control results carry meaning. The signature is a
single event rail beside two receipts: the same retry, two different financial outcomes.
No generic marketing hero, decorative charts, fake terminal window, or invented customers.

## 2. Color
Tokens: `--canvas: #fafafa`, `--surface: #ffffff`, `--ink: #171717`,
`--muted: #595959`, `--line: #e5e5e5`, `--hover: #333333`,
`--red: #9f2f2d`, `--red-soft: #fdebec`, `--green: #346538`,
`--green-soft: #edf3ec`, `--blue: #0068d6`, `--blue-soft: #ebf5ff`,
`--amber: #765500`, `--amber-soft: #fbf3db`, `--disabled: #ececec`.
Every status has text in addition to color. Blue denotes live interpretation and focus;
amber denotes review/limits; red and green denote execution outcomes, not confidence scores.

## 3. Typography
Self-host Geist Sans 400/500/600 and Geist Mono 400. Sans is for prose and controls;
mono only for code, model IDs, event identifiers, and numerical measurements.
Scale tokens: `--text-xs: 12px`, `--text-sm: 14px`, `--text-md: 16px`,
`--text-lg: 20px`, `--text-xl: 24px`, `--text-display: 40px`.
Body line-height 1.55; headings 1.15, tracking -0.03em. No body text below 14px.
Numbers use tabular figures. Long identifiers wrap rather than widening the page.

## 4. Spacing & Layout
4px base. Tokens `--s1: 4px`, `--s2: 8px`, `--s3: 12px`, `--s4: 16px`,
`--s5: 20px`, `--s6: 24px`, `--s8: 32px`, `--s10: 40px`, `--s12: 48px`.
Max workbench width 1240px; header height 72px; desktop composer width 340px.
Document owns vertical scrolling. At 960px, composer and evidence stack. At 600px,
receipt comparison stacks; mobile gutter 16px, desktop 32px. All grid tracks permit shrinking.

## 5. Components
- **Button:** native button, 44px minimum target, 6px radius, primary/secondary variants;
  hover, focus-visible, active, disabled and busy states. Busy text names the operation.
- **Badge:** inline textual state with optional status dot, 4px radius and semantic tint.
- **Panel:** semantic section with heading, restrained border, 12px radius, 24px padding.
  Empty, loading and error states use real recovery actions, never fabricated data.
- **Promise composer:** labeled textarea, explicit transmission-consent checkbox,
  interpretation submit and offline-demo action. Input edits invalidate prior approval.
- **Review block:** prose meaning, code property, model/usage provenance and explicit approval.
  Unsupported results have no approval or run control.
- **Event rail:** ordered list with numbered steps, action, response and committed-charge count.
  Full/reduced views are native buttons with aria-pressed, not simulated interactive divs.
- **Receipt:** definition list showing charge count and total; vulnerable/reference labels.
  Reference label explicitly says hand-authored. Empty evidence has explanatory copy.
- **Disclosure:** native details/summary for bounded search and limitations.
- **Primitive showcase:** `/primitives.html` exercises reusable states before screen composition.
- **Curated repair panel:** a separate full-width section below the existing workbench.
  Default-disabled setup state, gated-ready state, proposal/verification pending states,
  review with source provenance and diff, explicit approval, verified/rejected result, and error recovery.
  It never claims to repair arbitrary user repositories or the text of an edited promise.
- **Source comparison:** two shrinking columns, stacking below 768px. Labeled before/candidate
  code uses the mono family, 14px text, pre-wrap and overflow-wrap; model prose stays text.
- **Native select:** labeled proposal-source selection, 44px minimum target, existing control
  radius/line/surface tokens, keyboard/focus/disabled states. Reference is the safe default.
- **Repair approval:** a native checkbox tied to the displayed proposal; approval is invalidated
  by input/session changes. No candidate runs automatically after proposal generation.

## 6. Motion & Interaction
Micro timing 120ms ease-out; content replacement 180ms ease-out. Only opacity/transform
animate. Signature interaction: switch full trace to reduced trace, stripping irrelevant events.
No ambient motion or entrances that hide content. Reduced motion removes transitions.
Keyboard focus stays visible; a status live-region announces operations and failures.
The tokens stylesheet uses priority overrides only for the native hidden attribute and
reduced-motion preferences, so component styling cannot expose hidden content or restore motion.

## 7. Depth & Surface
Borders-only layout with a slight canvas/surface tonal distinction. No elevation shadows,
gradients, neon, or glass. This is an operational tool, not a cinematic promotional surface.
Corners: buttons 6px, panels 12px. The event rail is geometry, never a raster substitute.

## 8. Accessibility Constraints & Accepted Debt
Target WCAG 2.2 AA: body contrast 4.5:1, focus rings, native controls, explicit labels,
44px targets, keyboard completion, text alternatives for statuses, reduced-motion support.
No intentional accessibility debt. Real screen-reader/disabled-user validation and deployed
performance are not claimed; local browser checks are recorded separately.
