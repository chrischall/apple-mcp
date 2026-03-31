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
  
  const NOTES_TOOL: Tool = {
    name: "notes", 
    description: "Search, retrieve and create notes in Apple Notes app",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "Operation to perform: 'search', 'list', or 'create'",
          enum: ["search", "list", "create"]
        },
        searchText: {
          type: "string",
          description: "Text to search for in notes (required for search operation)"
        },
        title: {
          type: "string",
          description: "Title of the note to create (required for create operation)"
        },
        body: {
          type: "string",
          description: "Content of the note to create (required for create operation)"
        },
        folderName: {
          type: "string",
          description: "Name of the folder to create the note in (optional for create operation, defaults to 'Claude')"
        }
      },
      required: ["operation"]
    }
  };
  
  const MESSAGES_TOOL: Tool = {
    name: "messages",
    description: "Interact with Apple Messages app - send, read, schedule messages and check unread messages",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "Operation to perform: 'send', 'read', 'schedule', or 'unread'",
          enum: ["send", "read", "schedule", "unread"]
        },
        phoneNumber: {
          type: "string",
          description: "Phone number to send message to (required for send, read, and schedule operations)"
        },
        message: {
          type: "string",
          description: "Message to send (required for send and schedule operations)"
        },
        limit: {
          type: "number",
          description: "Number of messages to read (optional, for read and unread operations)"
        },
        scheduledTime: {
          type: "string",
          description: "ISO string of when to send the message (required for schedule operation)"
        }
      },
      required: ["operation"]
    }
  };
  
  const REMINDERS_TOOL: Tool = {
    name: "reminders",
    description: "Search, create, and open reminders in Apple Reminders app",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "Operation to perform: 'list', 'search', 'open', 'create', or 'listById'",
          enum: ["list", "search", "open", "create", "listById"]
        },
        searchText: {
          type: "string",
          description: "Text to search for in reminders (required for search and open operations)"
        },
        name: {
          type: "string",
          description: "Name of the reminder to create (required for create operation)"
        },
        listName: {
          type: "string",
          description: "Name of the list to create the reminder in (optional for create operation)"
        },
        listId: {
          type: "string",
          description: "ID of the list to get reminders from (required for listById operation)"
        },
        props: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Properties to include in the reminders (optional for listById operation)"
        },
        notes: {
          type: "string",
          description: "Additional notes for the reminder (optional for create operation)"
        },
        dueDate: {
          type: "string",
          description: "Due date for the reminder in ISO format (optional for create operation)"
        }
      },
      required: ["operation"]
    }
  };
  
  
const CALENDAR_TOOL: Tool = {
  name: "calendar",
  description: "Search, create, and open calendar events in Apple Calendar app",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description: "Operation to perform: 'search', 'open', 'list', or 'create'",
        enum: ["search", "open", "list", "create"]
      },
      searchText: {
        type: "string",
        description: "Text to search for in event titles, locations, and notes (required for search operation)"
      },
      eventId: {
        type: "string",
        description: "ID of the event to open (required for open operation)"
      },
      limit: {
        type: "number",
        description: "Number of events to retrieve (optional, default 10)"
      },
      fromDate: {
        type: "string",
        description: "Start date for search range in ISO format (optional, default is today)"
      },
      toDate: {
        type: "string",
        description: "End date for search range in ISO format (optional, default is 30 days from now for search, 7 days for list)"
      },
      title: {
        type: "string",
        description: "Title of the event to create (required for create operation)"
      },
      startDate: {
        type: "string",
        description: "Start date/time of the event in ISO format (required for create operation)"
      },
      endDate: {
        type: "string",
        description: "End date/time of the event in ISO format (required for create operation)"
      },
      location: {
        type: "string",
        description: "Location of the event (optional for create operation)"
      },
      notes: {
        type: "string",
        description: "Additional notes for the event (optional for create operation)"
      },
      isAllDay: {
        type: "boolean",
        description: "Whether the event is an all-day event (optional for create operation, default is false)"
      },
      calendarName: {
        type: "string",
        description: "Name of the calendar to create the event in (optional for create operation, uses default calendar if not specified)"
      }
    },
    required: ["operation"]
  }
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
  CONTACTS_TOOL, NOTES_TOOL, MESSAGES_TOOL, REMINDERS_TOOL, CALENDAR_TOOL, MAPS_TOOL,
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
