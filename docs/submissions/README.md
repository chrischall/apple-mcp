# Registry submissions — apple-mcp

> ⚠ The npm package name `apple-mcp` is owned by [dhravya](https://www.npmjs.com/package/apple-mcp), not chrischall. This fork is not published to npm, so registries that require an owned npm package (`modelcontextprotocol/registry`, and transitively PulseMCP) are **not** part of the automated pipeline. To include those, publish this fork as a scoped name like `@chrischall/apple-mcp` and add `mcpName`/`server.json` in a follow-up.

## Coverage matrix

| Registry                          | Automated?                               | Where |
| --- | --- | --- |
| GitHub Releases                   | ✅ `release.yml`                          | `.skill` + `.mcpb` attached |
| ClawHub (OpenClaw)                | ✅ conditional on `CLAWHUB_TOKEN`         | `clawhub skill publish` |
| mcpservers.org                    | ❌ manual — [mcpservers.org/submit](https://mcpservers.org/submit) | |
| Anthropic community plugins       | ❌ manual — [clau.de/plugin-directory-submission](https://clau.de/plugin-directory-submission) | |
| modelcontextprotocol/registry     | ❌ not applicable (see note above)        | |
| PulseMCP                          | ❌ transitive (skipped with MCP Registry) | |
| npm                               | ❌ not owned                              | |

## mcpservers.org

- **Server Name:** `apple-mcp`
- **Short Description:** `Apple MCP server for Claude — contacts, notes, messages, mail, reminders, calendar, and maps integration on macOS via AppleScript/JXA bridges. No network auth needed; requires macOS.`
- **Link:** `https://github.com/chrischall/apple-mcp`
- **Category:** `Productivity`
- **Contact Email:** `chris.c.hall@gmail.com`

## Anthropic community plugins

- **Repo URL:** `https://github.com/chrischall/apple-mcp`
- **Plugin name:** `apple-mcp`
- **Short description:** `Apple MCP server for Claude — contacts, notes, messages, mail, reminders, calendar, and maps integration on macOS`
- **Category:** Productivity
- **Tags:** apple, macos, contacts, notes, messages, mail, calendar, reminders, maps, mcp
