# Design Sync Notes — Resume AI

## Setup: App-not-library

This is a Vite app, not a component library. The converter runs in synth-entry mode using a hand-authored entry file:

- **Entry**: `frontend/src/_ds_entry.tsx` — manually lists all exported components; update this file when adding new components.
- **Run command**: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules frontend/node_modules --entry ./frontend/src/_ds_entry.tsx --out ds-bundle`
- **PKG_DIR**: `frontend/` (derived by walking up from entry file to the nearest `package.json`)
- All config paths (`srcDir`, `cssEntry`, `tsconfig`) are **relative to `frontend/`**.

## CSS rebuild required before each sync

The `cssEntry` is a compiled Tailwind CSS file at `frontend/src/_ds_styles.css`. It must be rebuilt before running the converter if any components or class usage changed:

```bash
cd frontend && npx tailwindcss -i src/index.css -o src/_ds_styles.css
cp frontend/src/_ds_styles.css .design-sync/styles.css
```

The `buildCmd` in config reflects this.

## Render check skipped

Playwright is not installed — render check passes `--no-render-check`. This is fine for floor cards. If you later author rich previews and want visual verification, install playwright:

```bash
npm i -D playwright && npx playwright install chromium
```

## Known warnings (non-critical)

- `[TOKENS_MISSING]`: `--tw-shadow-color`, `--scrollbar-*` from `tailwind-scrollbar` plugin. These are set at runtime by Tailwind internals. Not needed for floor cards.
- `[DTS_STUBBED]`: Type props are `[key: string]: unknown` because there's no built .d.ts library. For richer types in a future sync, consider generating declarations or annotating key components via `cfg.dtsPropsFor`.

## App-specific component limitations

Components that import auth context (Navbar, AuthModal, AccountSidebar, ResumeEditor) or react-router-dom (ResumeEditor, etc.) will fall back to floor cards because the design sandbox has no real auth/router. The Supabase client is bundled (all 92 inlined packages include Supabase), which is fine — it just won't have real credentials.

## Component additions

When adding new components:
1. Add the export to `frontend/src/_ds_entry.tsx`
2. Add to `componentSrcMap` in `.design-sync/config.json`
3. Rebuild CSS + run converter + re-sync

## Re-sync risks

- CSS class list reflects the component code at sync time — if component code changes to add new Tailwind classes, rebuild CSS before re-sync.
- The `_ds_entry.tsx` is manually maintained and can drift from the actual component set.
- `conventions.md` references `Button` variants — verify against `button.tsx` if the DS is updated.
- 92 bundled npm packages include Supabase SDK — if Supabase major version bumps, bundle size may shift significantly.
