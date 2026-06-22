# Resume AI — Design Conventions

## Wrapping and setup

No theme provider is required. All tokens are defined as CSS custom properties on `:root` in `styles.css` → `_ds_bundle.css` (loaded automatically in every preview). Components render styled out of the box.

Dark mode: add `class="dark"` to the outermost `<html>` or container element. All tokens have dark-mode overrides already defined.

App-specific components (Navbar, ResumeEditor, AuthModal, AccountSidebar, etc.) internally import auth and router context — they render as floor-card placeholders unless wrapped in the full app shell. Use the shadcn/ui primitives (Button, Card, Input, etc.) and display-only components (EmptyState, Badge, StreamingOutput) for design work; reserve the complex app components for mocking layout structure.

## Styling idiom: Tailwind utility classes backed by CSS variables

This DS uses Tailwind. Style layout glue and new elements with Tailwind utilities — never write inline styles or invent new class names. All brand colors map to CSS-variable-backed classes:

| Purpose | Class |
|---|---|
| Page background | `bg-background` |
| Surface / card | `bg-card`, `bg-muted` |
| Primary blue (#0071E3) | `bg-primary`, `text-primary` |
| Body text | `text-foreground` |
| Subdued text | `text-muted-foreground` |
| Borders | `border-border` |
| Secondary surface | `bg-secondary` |
| Destructive | `bg-destructive`, `text-destructive` |

Opacity variants work: `bg-primary/10`, `border-border/50`, etc.

Border radius: `rounded-sm`, `rounded-md`, `rounded-lg` (= `--radius` 0.5rem), `rounded-xl`, `rounded-2xl`.

Typography: `font-display` applies Space Grotesk (headings). Body uses Inter (the default). Both are loaded from Google Fonts via `styles.css`.

Custom shadows: `shadow-dropdown` (blue glow, menus), `shadow-paper` (blue glow, cards/modals).

## Where the truth lives

- **Tokens and utilities**: `_ds/<folder>/styles.css` → imports `_ds_bundle.css` which contains all CSS variables and compiled Tailwind utilities.
- **Component API**: `<Name>.d.ts` for props, `<Name>.prompt.md` for usage notes.
- Read `_ds_bundle.css` before deciding on class names — the file is the authoritative list of what's compiled in.

## Idiomatic build example

```jsx
import { Button } from '_ds/components/general/Button/Button'
import { Card, CardHeader, CardTitle, CardContent } from '_ds/components/general/Card/Card'

// A simple action card — uses DS tokens for layout glue
function ResumeCard({ title, onExport }) {
  return (
    <div className="bg-background min-h-screen p-8">
      <Card className="max-w-md shadow-paper">
        <CardHeader>
          <CardTitle className="font-display text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="default">Tailor resume</Button>
          <Button variant="outline" onClick={onExport}>Export</Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

Button variants: `default` (primary blue), `outline`, `secondary`, `ghost`, `destructive`.
