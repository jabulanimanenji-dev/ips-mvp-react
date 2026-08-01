# Platform Studio Live Preview + Editable Hero

This local update replaces the protected Home placeholder with the actual homepage rendered inside Platform Studio.

## Included
- Real Home preview: navbar, hero, homepage sections, pricing, testimonials and footer.
- Desktop, tablet and mobile viewport controls.
- Draft configuration is rendered immediately without publishing.
- Preview links/buttons/forms are blocked inside the editor.
- Open Live Page button opens the published homepage separately.
- Click homepage sections to identify/select them.
- Complete Home Hero inspector for headline, highlighted text, supporting copy, image/video media, overlay, alignment, height, search, popular searches and trust items.
- New broad IPS marketing defaults while preserving academic services, pricing and quote routes.

## Validation
- Updated JSX files pass Babel parser syntax validation.
- Full Vite build could not run in the packaging environment because the uploaded Windows node_modules lacks Rollup's Linux native optional package. Run npm install and npm run build on Windows.
