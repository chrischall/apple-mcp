---
name: apple-mcp
description: Use this skill when the user asks about or wants to interact with Apple apps — Contacts, Notes, Messages, Mail, Reminders, Calendar, or Maps. Triggers on phrases like "check my calendar", "add a reminder", "send a message to", "read my mail", "search notes", "find contact", "create an event", "get directions", "look up in contacts", "check unread messages", or any request involving Apple's built-in macOS/iOS apps.
---

# apple-mcp

MCP server for Apple's native macOS apps — Contacts, Notes, Messages, Mail, Reminders, Calendar, and Maps.

- **npm:** [npmjs.com/package/apple-mcp](https://www.npmjs.com/package/apple-mcp)
- **Source:** [github.com/dhravya/apple-mcp](https://github.com/dhravya/apple-mcp)

## Requirements

macOS with the relevant apps installed and Full Disk Access granted to your terminal for Messages.

## Setup

### Claude Code (direct MCP)

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

## Tools

### Contacts
| Tool | Description |
|------|-------------|
| `contacts` | Search contacts by name (omit name to list all) |

### Notes
| Tool | Description |
|------|-------------|
| `notes_list` | List notes, optionally filtered by folder |
| `notes_search` | Search notes by title or content |
| `notes_get` | Get full content of a note by name |
| `notes_create` | Create a new note |
| `notes_list_folders` | List all Note folders |

### Reminders
| Tool | Description |
|------|-------------|
| `reminders_list_lists` | List all reminder lists |
| `reminders_list` | List reminders, optionally by list name |
| `reminders_search` | Search incomplete reminders by name |
| `reminders_create` | Create a new reminder with optional due date |
| `reminders_complete` | Mark a reminder complete by ID |

### Messages
| Tool | Description |
|------|-------------|
| `messages_send` | Send an iMessage to a phone number |
| `messages_read` | Read recent messages from a phone number |
| `messages_unread` | Get unread messages |

### Calendar
| Tool | Description |
|------|-------------|
| `calendar_list` | List events in a date range |
| `calendar_search` | Search events by title or notes |
| `calendar_get` | Get full details of an event by UID |
| `calendar_create` | Create a new event |
| `calendar_update` | Update fields on an existing event |
| `calendar_delete` | Delete an event |
| `calendar_open` | Open an event in Calendar.app |
| `calendar_list_calendars` | List all calendars |
| `calendar_get_free_busy` | Get busy blocks in a date range |
| `calendar_find_slots` | Find available time slots |

### Mail
| Tool | Description |
|------|-------------|
| `mail_search` | Search emails by query, sender, subject, date, flags |
| `mail_list` | List emails in a mailbox |
| `mail_get` | Get full content of an email |
| `mail_send` | Send an email |
| `mail_reply` | Reply to an email |
| `mail_forward` | Forward an email |
| `mail_create_draft` | Create a draft email |
| `mail_unread_count` | Get unread count for account/mailbox |
| `mail_mark_read` / `mail_mark_unread` | Toggle read status |
| `mail_flag` / `mail_unflag` | Toggle flagged status |
| `mail_delete` | Delete an email |
| `mail_move` | Move email to a mailbox |
| `mail_batch_*` | Batch operations (delete, move, mark read/unread, flag) |
| `mail_list_mailboxes` | List mailboxes with counts |
| `mail_list_accounts` | List email accounts |
| `mail_create_mailbox` | Create a new mailbox folder |
| `mail_list_attachments` | List attachments on an email |
| `mail_save_attachment` | Save an attachment to disk |
| `mail_list_templates` / `mail_save_template` / `mail_get_template` / `mail_delete_template` | Manage email templates |
| `mail_list_rules` / `mail_enable_rule` / `mail_disable_rule` | Manage mail rules |
| `mail_search_contacts` | Search Contacts from within Mail context |

### Maps
| Tool | Description |
|------|-------------|
| `maps` | Search locations, get directions, save favorites, manage guides |
