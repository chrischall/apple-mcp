# Mail Tools — Granular Redesign

**Date:** 2026-03-30  
**Status:** Approved

## Summary

Replace the single `mail` MCP tool (with an `operation` discriminator) with 33 granular tools, each doing one thing. AppleScript implementations are ported from `apple-mail-mcp/src/services/appleMailManager.ts` and adapted to this project's functional style.

---

## Architecture

### File Structure

```
utils/
  mail-core.ts       # search, list, get, send, unread-count
  mail-actions.ts    # reply, forward, create-draft, mark-read, mark-unread,
                     # flag, unflag, delete, move
  mail-batch.ts      # batch-delete, batch-move, batch-mark-read,
                     # batch-mark-unread, batch-flag, batch-unflag
  mail-manage.ts     # list-mailboxes, list-accounts, create-mailbox,
                     # list-attachments, save-attachment,
                     # list-templates, save-template, get-template, delete-template,
                     # list-rules, enable-rule, disable-rule, search-contacts
  mail.ts            # barrel re-export replacing current implementation

tools.ts             # one Tool constant per new tool; MAIL_TOOL removed
index.ts             # handler per new tool; old "mail" case removed
```

### Data Flow

```
MCP client → index.ts (tool dispatch) → utils/mail-*.ts (AppleScript) → Apple Mail.app
```

`index.ts` imports all mail functions through the `utils/mail.ts` barrel, calls them, and formats results as MCP text responses.

---

## Tool Inventory

### Core (5 tools)

| Tool | Key Parameters |
|------|---------------|
| `mail_search` | `query?`, `from?`, `to?`, `subject?`, `mailbox?`, `account?`, `isRead?`, `isFlagged?`, `dateFrom?`, `dateTo?`, `limit?` |
| `mail_list` | `mailbox?`, `account?`, `limit?`, `unreadOnly?` |
| `mail_get` | `id` — returns full message body |
| `mail_send` | `to[]`, `subject`, `body`, `cc?`, `bcc?`, `account?`, `isHtml?`, `attachments?[]` |
| `mail_unread_count` | `mailbox?`, `account?` |

### Message Actions (9 tools)

| Tool | Key Parameters |
|------|---------------|
| `mail_reply` | `id`, `body`, `replyAll?`, `account?` |
| `mail_forward` | `id`, `to[]`, `body?`, `account?` |
| `mail_create_draft` | `to[]`, `subject`, `body`, `cc?`, `bcc?`, `account?` |
| `mail_mark_read` | `id` |
| `mail_mark_unread` | `id` |
| `mail_flag` | `id` |
| `mail_unflag` | `id` |
| `mail_delete` | `id` |
| `mail_move` | `id`, `mailbox`, `account?` |

### Batch Operations (6 tools)

All batch tools accept `ids[]` (1–100 items) and return per-item success/error results.

| Tool | Additional Parameters |
|------|----------------------|
| `mail_batch_delete` | — |
| `mail_batch_move` | `mailbox`, `account?` |
| `mail_batch_mark_read` | — |
| `mail_batch_mark_unread` | — |
| `mail_batch_flag` | — |
| `mail_batch_unflag` | — |

### Management (13 tools)

| Tool | Key Parameters |
|------|---------------|
| `mail_list_mailboxes` | `account?` |
| `mail_list_accounts` | — |
| `mail_create_mailbox` | `name`, `account?` |
| `mail_list_attachments` | `id` |
| `mail_save_attachment` | `id`, `attachmentName`, `savePath` |
| `mail_list_templates` | — |
| `mail_save_template` | `name`, `subject`, `body`, `to?[]`, `cc?[]` |
| `mail_get_template` | `id` |
| `mail_delete_template` | `id` |
| `mail_list_rules` | — |
| `mail_enable_rule` | `name` |
| `mail_disable_rule` | `name` |
| `mail_search_contacts` | `query` |

---

## Implementation Notes

### AppleScript Source

Port implementations from `~/git/apple-mail-mcp/src/services/appleMailManager.ts`. Key helpers to bring over:
- `escapeForAppleScript(text)` — backslash and double-quote escaping
- `buildAttachmentCommands(attachments?)` — validates paths, builds attach AppleScript
- `AS_DATE_TO_STRING` / `parseAppleScriptDate()` — locale-independent date handling
- `MAILBOX_ALIASES` — maps normalized names to actual mailbox name variants
- TTL cache for accounts and mailbox names (60s) to avoid redundant AppleScript calls

### Message IDs

Apple Mail message IDs are numeric strings. The `id` parameter on all single-message tools must be validated with `/^\d+$/` to prevent AppleScript injection.

### Batch IDs

Capped at 100 per call. Each item returns `{ id, success, error? }`.

### Templates

Templates are stored as JSON in `~/.apple-mcp-templates.json` (file-based, no external dependency).

### Error Handling

- All functions use try/catch; failures return typed error objects rather than throwing
- Access check (`tell application "Mail" return name`) runs before any operation
- Timeout is 30s for content-heavy operations (get full body, search), 10s otherwise

---

## Testing

- Integration tests in `tests/integration/mail.test.ts` — extend existing file
- One test per tool group (core, actions, batch, manage)
- Tests follow existing pattern: call the function, assert on returned data shape
- No mocking of AppleScript — tests require Mail.app to be running (consistent with rest of suite)

---

## Migration

The existing `mail` tool and its six operations (`unread`, `search`, `send`, `mailboxes`, `accounts`, `latest`) are **removed**. No backward-compatibility shim. The `utils/mail.ts` implementation file is replaced by the barrel re-export.
