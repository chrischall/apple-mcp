import { type Tool } from "@modelcontextprotocol/sdk/types.js";

const CONTACTS_TOOL: Tool = {
    name: "contacts",
    description: "Search and retrieve contacts from Apple Contacts app",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name to search for (optional - if not provided, returns all contacts). Can be partial name to search."
        }
      }
    }
  };
  
const NOTES_LIST_TOOL: Tool = {
  name: "notes_list",
  description: "List notes in Apple Notes, optionally filtered by folder",
  inputSchema: {
    type: "object",
    properties: {
      folder: { type: "string", description: "Folder name to filter by (optional)" },
      limit:  { type: "number", description: "Max results (default 50)" },
    },
  },
};

const NOTES_SEARCH_TOOL: Tool = {
  name: "notes_search",
  description: "Search notes in Apple Notes by title or content",
  inputSchema: {
    type: "object",
    properties: {
      query:  { type: "string", description: "Text to search for" },
      folder: { type: "string", description: "Folder name to filter by (optional)" },
      limit:  { type: "number", description: "Max results (default 50)" },
    },
    required: ["query"],
  },
};

const NOTES_GET_TOOL: Tool = {
  name: "notes_get",
  description: "Get the full content of a specific note by name",
  inputSchema: {
    type: "object",
    properties: {
      name:   { type: "string", description: "Exact note title" },
      folder: { type: "string", description: "Folder to search in (optional)" },
    },
    required: ["name"],
  },
};

const NOTES_CREATE_TOOL: Tool = {
  name: "notes_create",
  description: "Create a new note in Apple Notes",
  inputSchema: {
    type: "object",
    properties: {
      title:  { type: "string", description: "Note title" },
      body:   { type: "string", description: "Note content" },
      folder: { type: "string", description: "Folder to create note in (default: Notes)" },
    },
    required: ["title", "body"],
  },
};

const NOTES_LIST_FOLDERS_TOOL: Tool = {
  name: "notes_list_folders",
  description: "List all folders in Apple Notes",
  inputSchema: { type: "object", properties: {} },
};

const REMINDERS_LIST_LISTS_TOOL: Tool = {
  name: "reminders_list_lists",
  description: "List all reminder lists in Apple Reminders",
  inputSchema: { type: "object", properties: {} },
};

const REMINDERS_LIST_TOOL: Tool = {
  name: "reminders_list",
  description: "List reminders, optionally filtered by list name",
  inputSchema: {
    type: "object",
    properties: {
      list:             { type: "string", description: "Reminder list name to filter by (optional)" },
      includeCompleted: { type: "boolean", description: "Include completed reminders (default false)" },
      limit:            { type: "number", description: "Max results (default 50)" },
    },
  },
};

const REMINDERS_SEARCH_TOOL: Tool = {
  name: "reminders_search",
  description: "Search incomplete reminders by name",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for in reminder names" },
      list:  { type: "string", description: "Reminder list name to filter by (optional)" },
      limit: { type: "number", description: "Max results (default 50)" },
    },
    required: ["query"],
  },
};

const REMINDERS_CREATE_TOOL: Tool = {
  name: "reminders_create",
  description: "Create a new reminder in Apple Reminders",
  inputSchema: {
    type: "object",
    properties: {
      name:    { type: "string", description: "Reminder name" },
      list:    { type: "string", description: "List to add reminder to (optional, uses first list if omitted)" },
      notes:   { type: "string", description: "Additional notes (optional)" },
      dueDate: { type: "string", description: "Due date in ISO format (optional)" },
    },
    required: ["name"],
  },
};

const REMINDERS_COMPLETE_TOOL: Tool = {
  name: "reminders_complete",
  description: "Mark a reminder as completed by its ID",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Reminder ID (from reminders_list or reminders_search)" },
    },
    required: ["id"],
  },
};

const MESSAGES_SEND_TOOL: Tool = {
  name: "messages_send",
  description: "Send an iMessage to a phone number",
  inputSchema: {
    type: "object",
    properties: {
      phoneNumber: { type: "string", description: "Recipient phone number" },
      message:     { type: "string", description: "Message text to send" },
    },
    required: ["phoneNumber", "message"],
  },
};

const MESSAGES_READ_TOOL: Tool = {
  name: "messages_read",
  description: "Read recent messages from a phone number",
  inputSchema: {
    type: "object",
    properties: {
      phoneNumber: { type: "string", description: "Phone number to read messages from" },
      limit:       { type: "number", description: "Max messages to return (default 10)" },
    },
    required: ["phoneNumber"],
  },
};

const MESSAGES_UNREAD_TOOL: Tool = {
  name: "messages_unread",
  description: "Get unread messages from Apple Messages",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max messages to return (default 10)" },
    },
  },
};



const CALENDAR_LIST_TOOL: Tool = {
  name: "calendar_list",
  description: "List calendar events in a date range",
  inputSchema: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Start date in ISO format (default: today)" },
      endDate:   { type: "string", description: "End date in ISO format (default: 7 days from now)" },
      calendar:  { type: "string", description: "Calendar name to filter by" },
      limit:     { type: "number", description: "Max results (default 50)" },
    },
  },
};

const CALENDAR_SEARCH_TOOL: Tool = {
  name: "calendar_search",
  description: "Search calendar events by title or notes text",
  inputSchema: {
    type: "object",
    properties: {
      query:     { type: "string", description: "Text to search for in event title or notes" },
      startDate: { type: "string", description: "Start of search range in ISO format (default: today)" },
      endDate:   { type: "string", description: "End of search range in ISO format (default: 30 days out)" },
      calendar:  { type: "string", description: "Calendar name to filter by" },
      limit:     { type: "number", description: "Max results (default 50)" },
    },
    required: ["query"],
  },
};

const CALENDAR_GET_TOOL: Tool = {
  name: "calendar_get",
  description: "Get full details of a specific calendar event by its UID, including attendees",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Event UID (from calendar_list or calendar_search)" },
    },
    required: ["id"],
  },
};

const CALENDAR_CREATE_TOOL: Tool = {
  name: "calendar_create",
  description: "Create a new calendar event",
  inputSchema: {
    type: "object",
    properties: {
      title:     { type: "string", description: "Event title" },
      startDate: { type: "string", description: "Start date/time in ISO format" },
      endDate:   { type: "string", description: "End date/time in ISO format" },
      calendar:  { type: "string", description: "Calendar name (uses first writable calendar if omitted)" },
      location:  { type: "string", description: "Event location" },
      notes:     { type: "string", description: "Event notes" },
      url:       { type: "string", description: "Event URL" },
      isAllDay:  { type: "boolean", description: "Whether this is an all-day event (default false)" },
    },
    required: ["title", "startDate", "endDate"],
  },
};

const CALENDAR_UPDATE_TOOL: Tool = {
  name: "calendar_update",
  description: "Update fields on an existing calendar event",
  inputSchema: {
    type: "object",
    properties: {
      id:        { type: "string", description: "Event UID" },
      title:     { type: "string", description: "New event title" },
      startDate: { type: "string", description: "New start date/time in ISO format" },
      endDate:   { type: "string", description: "New end date/time in ISO format" },
      location:  { type: "string", description: "New location" },
      notes:     { type: "string", description: "New notes" },
      url:       { type: "string", description: "New URL" },
    },
    required: ["id"],
  },
};

const CALENDAR_DELETE_TOOL: Tool = {
  name: "calendar_delete",
  description: "Delete a calendar event (moves to trash)",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Event UID" },
    },
    required: ["id"],
  },
};

const CALENDAR_OPEN_TOOL: Tool = {
  name: "calendar_open",
  description: "Open a specific calendar event in Calendar.app",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Event UID" },
    },
    required: ["id"],
  },
};

const CALENDAR_LIST_CALENDARS_TOOL: Tool = {
  name: "calendar_list_calendars",
  description: "List all calendars in Calendar.app",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const CALENDAR_GET_FREE_BUSY_TOOL: Tool = {
  name: "calendar_get_free_busy",
  description: "Get busy blocks (existing events) in a date range — useful for finding free time",
  inputSchema: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Start of range in ISO format" },
      endDate:   { type: "string", description: "End of range in ISO format" },
      calendar:  { type: "string", description: "Calendar name to filter by" },
    },
    required: ["startDate", "endDate"],
  },
};

const CALENDAR_FIND_SLOTS_TOOL: Tool = {
  name: "calendar_find_slots",
  description: "Find available time slots in a date range that fit a minimum duration",
  inputSchema: {
    type: "object",
    properties: {
      startDate:       { type: "string", description: "Start of range in ISO format" },
      endDate:         { type: "string", description: "End of range in ISO format" },
      durationMinutes: { type: "number", description: "Minimum slot duration in minutes" },
      calendar:        { type: "string", description: "Calendar name to filter by" },
    },
    required: ["startDate", "endDate", "durationMinutes"],
  },
};
  
const MAPS_TOOL: Tool = {
  name: "maps",
  description: "Search locations, manage guides, save favorites, and get directions using Apple Maps",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description: "Operation to perform with Maps",
        enum: ["search", "save", "directions", "pin", "listGuides", "addToGuide", "createGuide"]
      },
      query: {
        type: "string",
        description: "Search query for locations (required for search)"
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (optional for search)"
      },
      name: {
        type: "string",
        description: "Name of the location (required for save and pin)"
      },
      address: {
        type: "string",
        description: "Address of the location (required for save, pin, addToGuide)"
      },
      fromAddress: {
        type: "string",
        description: "Starting address for directions (required for directions)"
      },
      toAddress: {
        type: "string",
        description: "Destination address for directions (required for directions)"
      },
      transportType: {
        type: "string",
        description: "Type of transport to use (optional for directions)",
        enum: ["driving", "walking", "transit"]
      },
      guideName: {
        type: "string",
        description: "Name of the guide (required for createGuide and addToGuide)"
      }
    },
    required: ["operation"]
  }
};

const MAIL_SEARCH_TOOL: Tool = {
  name: "mail_search",
  description: "Search emails in Apple Mail by query, sender, subject, date range, read/flagged status",
  inputSchema: {
    type: "object",
    properties: {
      query:    { type: "string", description: "Full-text search term (subject + sender)" },
      from:     { type: "string", description: "Filter by sender address" },
      subject:  { type: "string", description: "Filter by subject text" },
      mailbox:  { type: "string", description: "Mailbox to search (default: INBOX)" },
      account:  { type: "string", description: "Account name (searches first account if omitted)" },
      isRead:   { type: "boolean", description: "Filter by read status" },
      isFlagged:{ type: "boolean", description: "Filter by flagged status" },
      dateFrom: { type: "string", description: "Start date (e.g. 'March 1, 2026')" },
      dateTo:   { type: "string", description: "End date (e.g. 'March 31, 2026')" },
      limit:    { type: "number", description: "Max results (default 50)" },
    },
  },
};

const MAIL_LIST_TOOL: Tool = {
  name: "mail_list",
  description: "List emails in a mailbox (newest first)",
  inputSchema: {
    type: "object",
    properties: {
      mailbox:    { type: "string", description: "Mailbox name (default: INBOX)" },
      account:    { type: "string", description: "Account name" },
      limit:      { type: "number", description: "Max results (default 50)" },
      unreadOnly: { type: "boolean", description: "Return only unread messages" },
    },
  },
};

const MAIL_GET_TOOL: Tool = {
  name: "mail_get",
  description: "Get the full content (plain text and HTML) of a specific email by its numeric ID",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Numeric message ID (from mail_search or mail_list)" },
    },
    required: ["id"],
  },
};

const MAIL_SEND_TOOL: Tool = {
  name: "mail_send",
  description: "Send an email via Apple Mail",
  inputSchema: {
    type: "object",
    properties: {
      to:          { type: "array", items: { type: "string" }, description: "Recipient addresses" },
      subject:     { type: "string", description: "Email subject" },
      body:        { type: "string", description: "Email body (plain text)" },
      cc:          { type: "array", items: { type: "string" }, description: "CC addresses" },
      bcc:         { type: "array", items: { type: "string" }, description: "BCC addresses" },
      account:     { type: "string", description: "Sender account email address" },
      attachments: { type: "array", items: { type: "string" }, description: "Absolute paths to files to attach" },
    },
    required: ["to", "subject", "body"],
  },
};

const MAIL_UNREAD_COUNT_TOOL: Tool = {
  name: "mail_unread_count",
  description: "Get the total unread email count for an account or mailbox",
  inputSchema: {
    type: "object",
    properties: {
      mailbox: { type: "string", description: "Mailbox name (omit for all mailboxes in account)" },
      account: { type: "string", description: "Account name" },
    },
  },
};

const MAIL_REPLY_TOOL: Tool = {
  name: "mail_reply",
  description: "Reply to an email message",
  inputSchema: {
    type: "object",
    properties: {
      id:       { type: "string", description: "Numeric message ID" },
      body:     { type: "string", description: "Reply body text" },
      replyAll: { type: "boolean", description: "Reply to all recipients (default false)" },
    },
    required: ["id", "body"],
  },
};

const MAIL_FORWARD_TOOL: Tool = {
  name: "mail_forward",
  description: "Forward an email to one or more recipients",
  inputSchema: {
    type: "object",
    properties: {
      id:   { type: "string", description: "Numeric message ID" },
      to:   { type: "array", items: { type: "string" }, description: "Recipient addresses" },
      body: { type: "string", description: "Optional text to prepend before the forwarded content" },
    },
    required: ["id", "to"],
  },
};

const MAIL_CREATE_DRAFT_TOOL: Tool = {
  name: "mail_create_draft",
  description: "Create a draft email (saved but not sent)",
  inputSchema: {
    type: "object",
    properties: {
      to:      { type: "array", items: { type: "string" }, description: "Recipient addresses" },
      subject: { type: "string", description: "Email subject" },
      body:    { type: "string", description: "Email body" },
      cc:      { type: "array", items: { type: "string" }, description: "CC addresses" },
      bcc:     { type: "array", items: { type: "string" }, description: "BCC addresses" },
      account: { type: "string", description: "Account to create the draft in" },
    },
    required: ["to", "subject", "body"],
  },
};

const MAIL_MARK_READ_TOOL: Tool = {
  name: "mail_mark_read",
  description: "Mark an email as read",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_MARK_UNREAD_TOOL: Tool = {
  name: "mail_mark_unread",
  description: "Mark an email as unread",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_FLAG_TOOL: Tool = {
  name: "mail_flag",
  description: "Flag an email message",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_UNFLAG_TOOL: Tool = {
  name: "mail_unflag",
  description: "Remove the flag from an email message",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_DELETE_TOOL: Tool = {
  name: "mail_delete",
  description: "Delete (move to Trash) an email message",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_MOVE_TOOL: Tool = {
  name: "mail_move",
  description: "Move an email to a different mailbox",
  inputSchema: {
    type: "object",
    properties: {
      id:      { type: "string", description: "Numeric message ID" },
      mailbox: { type: "string", description: "Destination mailbox name" },
      account: { type: "string", description: "Account containing the destination mailbox" },
    },
    required: ["id", "mailbox"],
  },
};

const BATCH_IDS_SCHEMA = {
  type: "array",
  items: { type: "string" },
  description: "Array of numeric message IDs (max 100)",
};

const MAIL_BATCH_DELETE_TOOL: Tool = {
  name: "mail_batch_delete",
  description: "Delete multiple emails at once (max 100)",
  inputSchema: { type: "object", properties: { ids: BATCH_IDS_SCHEMA }, required: ["ids"] },
};

const MAIL_BATCH_MOVE_TOOL: Tool = {
  name: "mail_batch_move",
  description: "Move multiple emails to a mailbox (max 100)",
  inputSchema: {
    type: "object",
    properties: {
      ids:     BATCH_IDS_SCHEMA,
      mailbox: { type: "string", description: "Destination mailbox name" },
      account: { type: "string", description: "Account containing the destination mailbox" },
    },
    required: ["ids", "mailbox"],
  },
};

const MAIL_BATCH_MARK_READ_TOOL: Tool = {
  name: "mail_batch_mark_read",
  description: "Mark multiple emails as read (max 100)",
  inputSchema: { type: "object", properties: { ids: BATCH_IDS_SCHEMA }, required: ["ids"] },
};

const MAIL_BATCH_MARK_UNREAD_TOOL: Tool = {
  name: "mail_batch_mark_unread",
  description: "Mark multiple emails as unread (max 100)",
  inputSchema: { type: "object", properties: { ids: BATCH_IDS_SCHEMA }, required: ["ids"] },
};

const MAIL_BATCH_FLAG_TOOL: Tool = {
  name: "mail_batch_flag",
  description: "Flag multiple emails (max 100)",
  inputSchema: { type: "object", properties: { ids: BATCH_IDS_SCHEMA }, required: ["ids"] },
};

const MAIL_BATCH_UNFLAG_TOOL: Tool = {
  name: "mail_batch_unflag",
  description: "Remove flags from multiple emails (max 100)",
  inputSchema: { type: "object", properties: { ids: BATCH_IDS_SCHEMA }, required: ["ids"] },
};

const MAIL_LIST_MAILBOXES_TOOL: Tool = {
  name: "mail_list_mailboxes",
  description: "List all mailboxes for an account with unread and total message counts",
  inputSchema: { type: "object", properties: { account: { type: "string", description: "Account name (uses first account if omitted)" } } },
};

const MAIL_LIST_ACCOUNTS_TOOL: Tool = {
  name: "mail_list_accounts",
  description: "List all configured email accounts in Apple Mail",
  inputSchema: { type: "object", properties: {} },
};

const MAIL_CREATE_MAILBOX_TOOL: Tool = {
  name: "mail_create_mailbox",
  description: "Create a new mailbox (folder) in an account",
  inputSchema: {
    type: "object",
    properties: {
      name:    { type: "string", description: "Mailbox name to create" },
      account: { type: "string", description: "Account to create the mailbox in" },
    },
    required: ["name"],
  },
};

const MAIL_LIST_ATTACHMENTS_TOOL: Tool = {
  name: "mail_list_attachments",
  description: "List attachments for a specific email message",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_SAVE_ATTACHMENT_TOOL: Tool = {
  name: "mail_save_attachment",
  description: "Save an email attachment to disk",
  inputSchema: {
    type: "object",
    properties: {
      id:             { type: "string", description: "Numeric message ID" },
      attachmentName: { type: "string", description: "Filename of the attachment (no path separators)" },
      savePath:       { type: "string", description: "Absolute directory path to save the file (must be under home directory, /tmp, or /Volumes)" },
    },
    required: ["id", "attachmentName", "savePath"],
  },
};

const MAIL_LIST_TEMPLATES_TOOL: Tool = {
  name: "mail_list_templates",
  description: "List all saved email templates",
  inputSchema: { type: "object", properties: {} },
};

const MAIL_SAVE_TEMPLATE_TOOL: Tool = {
  name: "mail_save_template",
  description: "Create or update an email template",
  inputSchema: {
    type: "object",
    properties: {
      name:    { type: "string", description: "Template name" },
      subject: { type: "string", description: "Subject line (may include {{placeholder}} tokens)" },
      body:    { type: "string", description: "Email body (may include {{placeholder}} tokens)" },
      to:      { type: "array", items: { type: "string" }, description: "Default recipients" },
      cc:      { type: "array", items: { type: "string" }, description: "Default CC recipients" },
      id:      { type: "string", description: "Template ID to update (omit to create new)" },
    },
    required: ["name", "subject", "body"],
  },
};

const MAIL_GET_TEMPLATE_TOOL: Tool = {
  name: "mail_get_template",
  description: "Get a saved email template by ID",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Template ID" } }, required: ["id"] },
};

const MAIL_DELETE_TEMPLATE_TOOL: Tool = {
  name: "mail_delete_template",
  description: "Delete a saved email template",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Template ID" } }, required: ["id"] },
};

const MAIL_LIST_RULES_TOOL: Tool = {
  name: "mail_list_rules",
  description: "List all mail rules (filters) configured in Apple Mail",
  inputSchema: { type: "object", properties: {} },
};

const MAIL_ENABLE_RULE_TOOL: Tool = {
  name: "mail_enable_rule",
  description: "Enable a mail rule by name",
  inputSchema: { type: "object", properties: { name: { type: "string", description: "Rule name" } }, required: ["name"] },
};

const MAIL_DISABLE_RULE_TOOL: Tool = {
  name: "mail_disable_rule",
  description: "Disable a mail rule by name",
  inputSchema: { type: "object", properties: { name: { type: "string", description: "Rule name" } }, required: ["name"] },
};

const MAIL_SEARCH_CONTACTS_TOOL: Tool = {
  name: "mail_search_contacts",
  description: "Search Apple Contacts by name or email address (useful for finding recipients)",
  inputSchema: { type: "object", properties: { query: { type: "string", description: "Name or email to search for" } }, required: ["query"] },
};

const tools = [
  CONTACTS_TOOL, MAPS_TOOL,
  // Notes tools (5)
  NOTES_LIST_TOOL, NOTES_SEARCH_TOOL, NOTES_GET_TOOL, NOTES_CREATE_TOOL, NOTES_LIST_FOLDERS_TOOL,
  // Reminders tools (5)
  REMINDERS_LIST_LISTS_TOOL, REMINDERS_LIST_TOOL, REMINDERS_SEARCH_TOOL, REMINDERS_CREATE_TOOL, REMINDERS_COMPLETE_TOOL,
  // Messages tools (3)
  MESSAGES_SEND_TOOL, MESSAGES_READ_TOOL, MESSAGES_UNREAD_TOOL,
  // Calendar tools (10)
  CALENDAR_LIST_TOOL, CALENDAR_SEARCH_TOOL, CALENDAR_GET_TOOL, CALENDAR_CREATE_TOOL,
  CALENDAR_UPDATE_TOOL, CALENDAR_DELETE_TOOL, CALENDAR_OPEN_TOOL,
  CALENDAR_LIST_CALENDARS_TOOL, CALENDAR_GET_FREE_BUSY_TOOL, CALENDAR_FIND_SLOTS_TOOL,
  // Mail tools (33)
  MAIL_SEARCH_TOOL, MAIL_LIST_TOOL, MAIL_GET_TOOL, MAIL_SEND_TOOL, MAIL_UNREAD_COUNT_TOOL,
  MAIL_REPLY_TOOL, MAIL_FORWARD_TOOL, MAIL_CREATE_DRAFT_TOOL,
  MAIL_MARK_READ_TOOL, MAIL_MARK_UNREAD_TOOL, MAIL_FLAG_TOOL, MAIL_UNFLAG_TOOL,
  MAIL_DELETE_TOOL, MAIL_MOVE_TOOL,
  MAIL_BATCH_DELETE_TOOL, MAIL_BATCH_MOVE_TOOL,
  MAIL_BATCH_MARK_READ_TOOL, MAIL_BATCH_MARK_UNREAD_TOOL,
  MAIL_BATCH_FLAG_TOOL, MAIL_BATCH_UNFLAG_TOOL,
  MAIL_LIST_MAILBOXES_TOOL, MAIL_LIST_ACCOUNTS_TOOL, MAIL_CREATE_MAILBOX_TOOL,
  MAIL_LIST_ATTACHMENTS_TOOL, MAIL_SAVE_ATTACHMENT_TOOL,
  MAIL_LIST_TEMPLATES_TOOL, MAIL_SAVE_TEMPLATE_TOOL, MAIL_GET_TEMPLATE_TOOL, MAIL_DELETE_TEMPLATE_TOOL,
  MAIL_LIST_RULES_TOOL, MAIL_ENABLE_RULE_TOOL, MAIL_DISABLE_RULE_TOOL,
  MAIL_SEARCH_CONTACTS_TOOL,
];

export default tools;
