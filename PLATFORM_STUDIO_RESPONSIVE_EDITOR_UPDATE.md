# Platform Studio Responsive Editor Update

This local-testing release replaces the old narrow-div simulation with an isolated responsive preview viewport. The homepage now evaluates its media queries at the selected device width, so mobile navigation, grids, typography and spacing reflow as they do in a real browser.

## Included

- Independent desktop, tablet and mobile hero settings.
- Device-specific headline and supporting-text size and line height.
- Content width, automatic/minimum/exact/full-viewport section height, top/bottom/side spacing and element gap controls.
- Horizontal and vertical alignment.
- Per-device background focal point.
- Per-device action-button layout and full-width controls.
- Per-device search layout and search-button width.
- Per-device visibility and ordering for badge, eyebrow, headline, supporting text, search, popular searches, action buttons and trust items.
- Common desktop, tablet and phone presets from 320px through 1440px.
- Custom width and height, drag-to-resize, portrait/landscape, fit-to-canvas and manual zoom.
- Accessible mobile hamburger navigation with a scrollable drawer.
- Preview-safe navigation: menu controls work inside the editor, while links, submissions, logout and theme mutations remain blocked.
- Diagnostics for horizontal and vertical overflow, clipped text/media, clipped hero/navigation content and overlapping hero/custom blocks.
- One consistent 767px mobile / 1024px tablet breakpoint across the public page and editor.
- Safe responsive normalization and backwards-compatible migration of older flat hero settings.
- Tablet-aware configurable-button visibility.

## Preserved

- The real draft homepage preview and click-to-select section behavior.
- Draft/save/publish separation.
- Academic Services as the flagship category.
- Thesis Writing ($15/page), Dissertation Support ($25/page), Assignments ($12/page) and PhD Research Support ($40/page).
- Pricing links, Request Quote routes and the existing quote calculator.
- Existing public, client, provider and admin routes.

## Default mobile hero

- 42px headline at 1.08 line height.
- 17px supporting text at 1.5 line height.
- 360px maximum content width.
- 20px side spacing and a 720px minimum section height.
- Stacked, full-width action buttons.
- Stacked search input and full-width search button.
- Eyebrow and trust items hidden by default to reduce crowding; both can be enabled from the mobile inspector.

## Verification

Run `npm run check` after `npm ci`. A dedicated `verify:responsive` script validates responsive defaults and bounds, device ordering and visibility, the isolated frame, hamburger navigation, diagnostics, academic pricing and quote-route preservation.
