# Phase 16 — Universal Platform Studio Page Editor

## Purpose

Platform Studio now renders and edits the real interface for every page in the governed 41-page registry. The former conversion placeholder is no longer used.

## Page coverage

- 7 public website pages
- 9 client portal pages
- 8 service-provider portal pages
- 17 administration pages

Each page can be previewed with safe sample data at desktop, tablet and mobile sizes. Operational actions are disabled inside the preview.

## Editing capabilities

For native page elements, Super Admin can edit:

- visible text, placeholders, accessible titles and image descriptions
- safe link destinations
- images, videos, video posters and container background images from the Media Library
- visibility and order independently on desktop, tablet and mobile
- typography, colours, width, maximum width and minimum height
- padding, margin, gap, radius, alignment, grid/flex layout and positioning
- media fit and focal point

Page-level controls include responsive image/video backgrounds, overlay, page padding, minimum height, content width and SEO/share settings. Optional text, button, card, banner, image and video blocks can still be added to any page.

The homepage hero keeps its dedicated editor for content, image/video backgrounds, posters, responsive typography, alignment, spacing, height, button/search layout, visibility and element ordering.

Shared headers, footers and portal navigation use global editing scopes so one saved change is reused wherever that component appears.

## Safety boundary

The editor changes presentation and safe user-facing copy. It does not expose passwords, live record values, authorization rules, API behavior, payment actions or submission logic. Dynamic preview pages use deterministic sample records and cannot mutate live data.

The page-level switch controls whether that page's Studio design is applied after publication. A disabled page remains fully inspectable inside Platform Studio but its draft background, native overrides and custom blocks are not applied to the live route.

## Validation

Run:

```cmd
npm run check
```

The check validates the production build, all 41 preview mappings, universal native editor schema and sanitization, responsive editor configuration, storage behavior and protected session routes.

