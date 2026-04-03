---
name: apple-mcp
description: This skill should be used when the user asks about Apple apps on macOS. Triggers on phrases like "check my contacts", "create a note", "send a message", "check my email", "search mail", "set a reminder", "check my calendar", "get directions", "find on maps", or any request involving Apple Contacts, Notes, Messages, Mail, Reminders, Calendar, or Maps.
---

# apple-mcp

MCP server for Apple apps (Contacts, Notes, Messages, Mail, Reminders, Calendar, Maps) via AppleScript/JXA.

- **npm:** [npmjs.com/package/apple-mcp](https://www.npmjs.com/package/apple-mcp)
- **Source:** [github.com/chrischall/apple-mcp](https://github.com/chrischall/apple-mcp)

## Setup

### Option A -- Claude Code (direct MCP)

Add to `.mcp.json` in your project or `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "apple": {
      "command": "npx",
      "args": ["-y", "apple-mcp"]
    }
  }
}
```

### Option B -- From source

```bash
git clone https://github.com/chrischall/apple-mcp
cd apple-mcp
bun install && bun run build
node dist/index.js
```

## Tools

### Contacts
| Tool | Description |
|------|-------------|
| `contacts` | Search and retrieve contacts from Apple Contacts app |

### Notes
| Tool | Description |
|------|-------------|
| `notes` | Search, retrieve, and create notes in Apple Notes (list, get, create, list folders) |

### Messages
| Tool | Description |
|------|-------------|
| `messages` | Send iMessages, read messages from a phone number, check unread messages |

### Mail
| Tool | Description |
|------|-------------|
| `mail` | Full mail management: list, search, read, send, reply, forward, flag, move, delete, manage mailboxes, rules, templates, and attachments |

### Reminders
| Tool | Description |
|------|-------------|
| `reminders` | Search, create, complete, and list reminders and reminder lists |

### Calendar
| Tool | Description |
|------|-------------|
| `calendar` | List, search, create, update, delete events; list calendars; find free/busy time and available slots |

### Maps
| Tool | Description |
|------|-------------|
| `maps` | Search locations, save favorites, pin locations, get directions, manage guides |

## Requirements

- macOS only (uses AppleScript/JXA)
- Requires permission to control Apple apps via System Preferences > Privacy & Security > Automation
