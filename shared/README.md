# shared/

Plain TypeScript used by **both** the app (`src/`) and the Netlify Functions
(`netlify/functions/`). Netlify Functions can't import from `src/` (separate
bundle and tsconfig), so anything the two sides must agree on lives here
instead of being copied into each with a "keep in sync" comment.

Keep it free of browser APIs, Node APIs and third-party imports.
