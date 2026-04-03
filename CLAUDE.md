# apple-mcp

MCP server for Apple apps (Contacts, Notes, Messages, Mail, Reminders, Calendar, Maps) via AppleScript/JXA.

## Build & Test

```bash
bun run build         # bun build → dist/index.js
bun run bundle        # bun build → dist/bundle.js (for mcpb)
bun test tests/unit/  # unit tests
```

## Architecture

- `index.ts` — MCP server entry point, tool routing
- `tools.ts` — tool definitions (MCP schemas)
- `utils/` — one file per Apple app domain (mail.ts, calendar.ts, notes.ts, etc.)
- `tests/unit/` — unit tests
- `tests/integration/` — integration tests (require macOS + app access)

## Versioning

Version appears in FOUR places — all must match:

1. `package.json` → `"version"`
2. `bun.lockb` → run `bun install` after changing package.json
3. `index.ts` → `Server` constructor `version` field
4. `manifest.json` → `"version"`

### Important

Do NOT manually bump versions or create tags unless the user explicitly asks. Versioning is handled by the **Cut & Bump** GitHub Action.

### Release workflow

Main is always one version ahead of the latest tag. To release, run the **Cut & Bump** GitHub Action (`cut-and-bump.yml`) which:

1. Runs CI (build + test)
2. Tags the current commit with the current version
3. Bumps patch in all four files
4. Rebuilds, commits, and pushes main + tag
5. The tag push triggers the **Release** workflow (CI + npm publish + GitHub release)

## Gotchas

- Uses **bun** for builds and tests, not npm/node
- Main entry point is `index.ts` at the root, not in `src/`
- AppleScript/JXA utilities only work on macOS — CI runs unit tests only
- Uses tabs for indentation (not spaces)
