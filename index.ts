#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { runAppleScript } from "run-applescript";
import { z } from "zod";

// Safe mode implementation - lazy loading of modules
let useEagerLoading = true;
let loadingTimeout: ReturnType<typeof setTimeout> | null = null;
let safeModeFallback = false;

console.error("Starting apple-mcp server...");

// Placeholders for modules - will either be loaded eagerly or lazily
let contacts: typeof import("./utils/contacts").default | null = null;
let notes: typeof import("./utils/notes").default | null = null;
let message: typeof import("./utils/message").default | null = null;
let mail: typeof import("./utils/mail").default | null = null;
let reminders: typeof import("./utils/reminders").default | null = null;

let calendar: typeof import("./utils/calendar").default | null = null;
let maps: typeof import("./utils/maps").default | null = null;

// Type map for module names to their types
type ModuleMap = {
	contacts: typeof import("./utils/contacts").default;
	notes: typeof import("./utils/notes").default;
	message: typeof import("./utils/message").default;
	mail: typeof import("./utils/mail").default;
	reminders: typeof import("./utils/reminders").default;
	calendar: typeof import("./utils/calendar").default;
	maps: typeof import("./utils/maps").default;
};

// Helper function for lazy module loading
async function loadModule<
	T extends
		| "contacts"
		| "notes"
		| "message"
		| "mail"
		| "reminders"
		| "calendar"
		| "maps",
>(moduleName: T): Promise<ModuleMap[T]> {
	if (safeModeFallback) {
		console.error(`Loading ${moduleName} module on demand (safe mode)...`);
	}

	try {
		switch (moduleName) {
			case "contacts":
				if (!contacts) contacts = (await import("./utils/contacts")).default;
				return contacts as ModuleMap[T];
			case "notes":
				if (!notes) notes = (await import("./utils/notes")).default;
				return notes as ModuleMap[T];
			case "message":
				if (!message) message = (await import("./utils/message")).default;
				return message as ModuleMap[T];
			case "mail":
				if (!mail) mail = (await import("./utils/mail")).default;
				return mail as ModuleMap[T];
			case "reminders":
				if (!reminders) reminders = (await import("./utils/reminders")).default;
				return reminders as ModuleMap[T];
			case "calendar":
				if (!calendar) calendar = (await import("./utils/calendar")).default;
				return calendar as ModuleMap[T];
			case "maps":
				if (!maps) maps = (await import("./utils/maps")).default;
				return maps as ModuleMap[T];
			default:
				throw new Error(`Unknown module: ${moduleName}`);
		}
	} catch (e) {
		console.error(`Error loading module ${moduleName}:`, e);
		throw e;
	}
}

// Set a timeout to switch to safe mode if initialization takes too long
loadingTimeout = setTimeout(() => {
	console.error(
		"Loading timeout reached. Switching to safe mode (lazy loading...)",
	);
	useEagerLoading = false;
	safeModeFallback = true;

	// Clear the references to any modules that might be in a bad state
	contacts = null;
	notes = null;
	message = null;
	mail = null;
	reminders = null;
	calendar = null;

	// Proceed with server setup
	initServer();
}, 5000); // 5 second timeout

// Eager loading attempt
async function attemptEagerLoading() {
	try {
		console.error("Attempting to eagerly load modules...");

		contacts = (await import("./utils/contacts")).default;
		console.error("- Contacts module loaded successfully");

		notes = (await import("./utils/notes")).default;
		console.error("- Notes module loaded successfully");

		message = (await import("./utils/message")).default;
		console.error("- Message module loaded successfully");

		mail = (await import("./utils/mail")).default;
		console.error("- Mail module loaded successfully");

		reminders = (await import("./utils/reminders")).default;
		console.error("- Reminders module loaded successfully");

		calendar = (await import("./utils/calendar")).default;
		console.error("- Calendar module loaded successfully");

		maps = (await import("./utils/maps")).default;
		console.error("- Maps module loaded successfully");

		// If we get here, clear the timeout and proceed with eager loading
		if (loadingTimeout) {
			clearTimeout(loadingTimeout);
			loadingTimeout = null;
		}

		console.error("All modules loaded successfully, using eager loading mode");
		initServer();
	} catch (error) {
		console.error("Error during eager loading:", error);
		console.error("Switching to safe mode (lazy loading)...");

		if (loadingTimeout) {
			clearTimeout(loadingTimeout);
			loadingTimeout = null;
		}

		useEagerLoading = false;
		safeModeFallback = true;

		contacts = null;
		notes = null;
		message = null;
		mail = null;
		reminders = null;
		calendar = null;
		maps = null;

		initServer();
	}
}

// Attempt eager loading first
attemptEagerLoading();

// Main server object
let server: McpServer;

// Initialize the server and set up handlers
function initServer() {
	console.error(
		`Initializing server in ${safeModeFallback ? "safe" : "standard"} mode...`,
	);

	server = new McpServer(
		{
			name: "Apple MCP tools",
			version: "2.0.2",
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	// --- contacts ---
	server.registerTool("contacts", {
		description: "Search and retrieve contacts from Apple Contacts app",
		inputSchema: {
			name: z.string().optional().describe("Name to search for (optional - if not provided, returns all contacts). Can be partial name to search."),
		},
	}, async ({ name: searchName }) => {
		try {
			const contactsModule = await loadModule("contacts");

			if (searchName) {
				const numbers = await contactsModule.findNumber(searchName);
				return {
					content: [
						{
							type: "text" as const,
							text: numbers.length
								? `${searchName}: ${numbers.join(", ")}`
								: `No contact found for "${searchName}". Try a different name or use no name parameter to list all contacts.`,
						},
					],
				};
			} else {
				const allNumbers = await contactsModule.getAllNumbers();
				const contactCount = Object.keys(allNumbers).length;

				if (contactCount === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No contacts found in the address book. Please make sure you have granted access to Contacts.",
							},
						],
					};
				}

				const formattedContacts = Object.entries(allNumbers)
					.filter(([_, phones]) => phones.length > 0)
					.map(([name, phones]) => `${name}: ${phones.join(", ")}`);

				return {
					content: [
						{
							type: "text" as const,
							text:
								formattedContacts.length > 0
									? `Found ${contactCount} contacts:\n\n${formattedContacts.join("\n")}`
									: "Found contacts but none have phone numbers. Try searching by name to see more details.",
						},
					],
				};
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text" as const,
						text: errorMessage.includes("access") ? errorMessage : `Error accessing contacts: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	});

	// --- notes ---
	server.registerTool("notes", {
		description: "Search, retrieve and create notes in Apple Notes app",
		inputSchema: {
			operation: z.enum(["search", "list", "create"]).describe("Operation to perform: 'search', 'list', or 'create'"),
			searchText: z.string().optional().describe("Text to search for in notes (required for search operation)"),
			title: z.string().optional().describe("Title of the note to create (required for create operation)"),
			body: z.string().optional().describe("Content of the note to create (required for create operation)"),
			folderName: z.string().optional().describe("Name of the folder to create the note in (optional for create operation, defaults to 'Claude')"),
		},
	}, async ({ operation, searchText, title, body, folderName }) => {
		try {
			const notesModule = await loadModule("notes");

			switch (operation) {
				case "search": {
					if (!searchText) {
						throw new Error("Search text is required for search operation");
					}

					const foundNotes = await notesModule.findNote(searchText);
					return {
						content: [
							{
								type: "text" as const,
								text: foundNotes.length
									? foundNotes
											.map((note) => `${note.name}:\n${note.content}`)
											.join("\n\n")
									: `No notes found for "${searchText}"`,
							},
						],
					};
				}

				case "list": {
					const allNotes = await notesModule.getAllNotes();
					return {
						content: [
							{
								type: "text" as const,
								text: allNotes.length
									? allNotes
											.map((note) => `${note.name}:\n${note.content}`)
											.join("\n\n")
									: "No notes exist.",
							},
						],
					};
				}

				case "create": {
					if (!title || !body) {
						throw new Error("Title and body are required for create operation");
					}

					const result = await notesModule.createNote(title, body, folderName);

					return {
						content: [
							{
								type: "text" as const,
								text: result.success
									? `Created note "${title}" in folder "${result.folderName}"${result.usedDefaultFolder ? " (created new folder)" : ""}.`
									: `Failed to create note: ${result.message}`,
							},
						],
						isError: !result.success,
					};
				}

				default:
					throw new Error(`Unknown operation: ${operation}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text" as const,
						text: errorMessage.includes("access") ? errorMessage : `Error accessing notes: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	});

	// --- messages ---
	server.registerTool("messages", {
		description: "Interact with Apple Messages app - send, read, schedule messages and check unread messages",
		inputSchema: {
			operation: z.enum(["send", "read", "schedule", "unread"]).describe("Operation to perform: 'send', 'read', 'schedule', or 'unread'"),
			phoneNumber: z.string().optional().describe("Phone number to send message to (required for send, read, and schedule operations)"),
			message: z.string().optional().describe("Message to send (required for send and schedule operations)"),
			limit: z.number().optional().describe("Number of messages to read (optional, for read and unread operations)"),
			scheduledTime: z.string().optional().describe("ISO string of when to send the message (required for schedule operation)"),
		},
	}, async (args) => {
		try {
			const messageModule = await loadModule("message");

			switch (args.operation) {
				case "send": {
					if (!args.phoneNumber || !args.message) {
						throw new Error("Phone number and message are required for send operation");
					}
					await messageModule.sendMessage(args.phoneNumber, args.message);
					return {
						content: [
							{
								type: "text" as const,
								text: `Message sent to ${args.phoneNumber}`,
							},
						],
					};
				}

				case "read": {
					if (!args.phoneNumber) {
						throw new Error("Phone number is required for read operation");
					}
					const messages = await messageModule.readMessages(args.phoneNumber, args.limit);
					return {
						content: [
							{
								type: "text" as const,
								text:
									messages.length > 0
										? messages
												.map(
													(msg) =>
														`[${new Date(msg.date).toLocaleString()}] ${msg.is_from_me ? "Me" : msg.sender}: ${msg.content}`,
												)
												.join("\n")
										: "No messages found",
							},
						],
					};
				}

				case "schedule": {
					if (!args.phoneNumber || !args.message || !args.scheduledTime) {
						throw new Error("Phone number, message, and scheduled time are required for schedule operation");
					}
					const scheduledMsg = await messageModule.scheduleMessage(
						args.phoneNumber,
						args.message,
						new Date(args.scheduledTime),
					);
					return {
						content: [
							{
								type: "text" as const,
								text: `Message scheduled to be sent to ${args.phoneNumber} at ${scheduledMsg.scheduledTime}`,
							},
						],
					};
				}

				case "unread": {
					const messages = await messageModule.getUnreadMessages(args.limit);

					const contactsModule = await loadModule("contacts");
					const messagesWithNames = await Promise.all(
						messages.map(async (msg) => {
							if (!msg.is_from_me) {
								const contactName = await contactsModule.findContactByPhone(msg.sender);
								return {
									...msg,
									displayName: contactName || msg.sender,
								};
							}
							return {
								...msg,
								displayName: "Me",
							};
						}),
					);

					return {
						content: [
							{
								type: "text" as const,
								text:
									messagesWithNames.length > 0
										? `Found ${messagesWithNames.length} unread message(s):\n` +
											messagesWithNames
												.map(
													(msg) =>
														`[${new Date(msg.date).toLocaleString()}] From ${msg.displayName}:\n${msg.content}`,
												)
												.join("\n\n")
										: "No unread messages found",
							},
						],
					};
				}

				default:
					throw new Error(`Unknown operation: ${args.operation}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text" as const,
						text: errorMessage.includes("access") ? errorMessage : `Error with messages operation: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	});

	// --- mail ---
	server.registerTool("mail", {
		description: "Interact with Apple Mail app - read unread emails, search emails, and send emails",
		inputSchema: {
			operation: z.enum(["unread", "search", "send", "mailboxes", "accounts", "latest"]).describe("Operation to perform: 'unread', 'search', 'send', 'mailboxes', 'accounts', or 'latest'"),
			account: z.string().optional().describe("Email account to use (optional - if not provided, searches across all accounts)"),
			mailbox: z.string().optional().describe("Mailbox to use (optional - if not provided, uses inbox or searches across all mailboxes)"),
			limit: z.number().optional().describe("Number of emails to retrieve (optional, for unread, search, and latest operations)"),
			searchTerm: z.string().optional().describe("Text to search for in emails (required for search operation)"),
			to: z.string().optional().describe("Recipient email address (required for send operation)"),
			subject: z.string().optional().describe("Email subject (required for send operation)"),
			body: z.string().optional().describe("Email body content (required for send operation)"),
			cc: z.string().optional().describe("CC email address (optional for send operation)"),
			bcc: z.string().optional().describe("BCC email address (optional for send operation)"),
		},
	}, async (args) => {
		try {
			const mailModule = await loadModule("mail");

			switch (args.operation) {
				case "unread": {
					let emails;
					if (args.account) {
						console.error(`Getting unread emails for account: ${args.account}`);
						const script = `
tell application "Mail"
    set resultList to {}
    try
        set targetAccount to first account whose name is "${args.account.replace(/"/g, '\\"')}"

        -- Get mailboxes for this account
        set acctMailboxes to every mailbox of targetAccount

        -- If mailbox is specified, only search in that mailbox
        set mailboxesToSearch to acctMailboxes
        ${
					args.mailbox
						? `
        set mailboxesToSearch to {}
        repeat with mb in acctMailboxes
            if name of mb is "${args.mailbox.replace(/"/g, '\\"')}" then
                set mailboxesToSearch to {mb}
                exit repeat
            end if
        end repeat
        `
						: ""
				}

        -- Search specified mailboxes
        repeat with mb in mailboxesToSearch
            try
                set unreadMessages to (messages of mb whose read status is false)
                if (count of unreadMessages) > 0 then
                    set msgLimit to ${args.limit || 10}
                    if (count of unreadMessages) < msgLimit then
                        set msgLimit to (count of unreadMessages)
                    end if

                    repeat with i from 1 to msgLimit
                        try
                            set currentMsg to item i of unreadMessages
                            set msgData to {subject:(subject of currentMsg), sender:(sender of currentMsg), \u00ac
                                        date:(date sent of currentMsg) as string, mailbox:(name of mb)}

                            -- Try to get content if possible
                            try
                                set msgContent to content of currentMsg
                                if length of msgContent > 500 then
                                    set msgContent to (text 1 thru 500 of msgContent) & "..."
                                end if
                                set msgData to msgData & {content:msgContent}
                            on error
                                set msgData to msgData & {content:"[Content not available]"}
                            end try

                            set end of resultList to msgData
                        on error
                            -- Skip problematic messages
                        end try
                    end repeat

                    if (count of resultList) \u2265 ${args.limit || 10} then exit repeat
                end if
            on error
                -- Skip problematic mailboxes
            end try
        end repeat
    on error errMsg
        return "Error: " & errMsg
    end try

    return resultList
end tell`;

						try {
							const asResult = await runAppleScript(script);
							if (asResult && asResult.startsWith("Error:")) {
								throw new Error(asResult);
							}

							const emailData: any[] = [];
							const matches = asResult.match(/\{([^}]+)\}/g);
							if (matches && matches.length > 0) {
								for (const match of matches) {
									try {
										const props = match
											.substring(1, match.length - 1)
											.split(",");
										const email: any = {};

										props.forEach((prop) => {
											const parts = prop.split(":");
											if (parts.length >= 2) {
												const key = parts[0].trim();
												const value = parts.slice(1).join(":").trim();
												email[key] = value;
											}
										});

										if (email.subject || email.sender) {
											emailData.push({
												subject: email.subject || "No subject",
												sender: email.sender || "Unknown sender",
												dateSent: email.date || new Date().toString(),
												content: email.content || "[Content not available]",
												isRead: false,
												mailbox: `${args.account} - ${email.mailbox || "Unknown"}`,
											});
										}
									} catch (parseError) {
										console.error("Error parsing email match:", parseError);
									}
								}
							}

							emails = emailData;
						} catch (error) {
							console.error("Error getting account-specific emails:", error);
							emails = await mailModule.getUnreadMails(args.limit);
						}
					} else {
						emails = await mailModule.getUnreadMails(args.limit);
					}

					return {
						content: [
							{
								type: "text" as const,
								text:
									emails.length > 0
										? `Found ${emails.length} unread email(s)${args.account ? ` in account "${args.account}"` : ""}${args.mailbox ? ` and mailbox "${args.mailbox}"` : ""}:\n\n` +
											emails
												.map(
													(email: any) =>
														`[${email.dateSent}] From: ${email.sender}\nMailbox: ${email.mailbox}\nSubject: ${email.subject}\n${email.content.substring(0, 500)}${email.content.length > 500 ? "..." : ""}`,
												)
												.join("\n\n")
										: `No unread emails found${args.account ? ` in account "${args.account}"` : ""}${args.mailbox ? ` and mailbox "${args.mailbox}"` : ""}`,
							},
						],
					};
				}

				case "search": {
					if (!args.searchTerm) {
						throw new Error("Search term is required for search operation");
					}
					const emails = await mailModule.searchMails(args.searchTerm, args.limit);
					return {
						content: [
							{
								type: "text" as const,
								text:
									emails.length > 0
										? `Found ${emails.length} email(s) for "${args.searchTerm}"${args.account ? ` in account "${args.account}"` : ""}${args.mailbox ? ` and mailbox "${args.mailbox}"` : ""}:\n\n` +
											emails
												.map(
													(email: any) =>
														`[${email.dateSent}] From: ${email.sender}\nMailbox: ${email.mailbox}\nSubject: ${email.subject}\n${email.content.substring(0, 200)}${email.content.length > 200 ? "..." : ""}`,
												)
												.join("\n\n")
										: `No emails found for "${args.searchTerm}"${args.account ? ` in account "${args.account}"` : ""}${args.mailbox ? ` and mailbox "${args.mailbox}"` : ""}`,
							},
						],
					};
				}

				case "send": {
					if (!args.to || !args.subject || !args.body) {
						throw new Error("Recipient (to), subject, and body are required for send operation");
					}
					const result = await mailModule.sendMail(args.to, args.subject, args.body, args.cc, args.bcc);
					return {
						content: [{ type: "text" as const, text: result }],
					};
				}

				case "mailboxes": {
					if (args.account) {
						const mailboxes = await mailModule.getMailboxesForAccount(args.account);
						return {
							content: [
								{
									type: "text" as const,
									text:
										mailboxes.length > 0
											? `Found ${mailboxes.length} mailboxes for account "${args.account}":\n\n${mailboxes.join("\n")}`
											: `No mailboxes found for account "${args.account}". Make sure the account name is correct.`,
								},
							],
						};
					} else {
						const mailboxes = await mailModule.getMailboxes();
						return {
							content: [
								{
									type: "text" as const,
									text:
										mailboxes.length > 0
											? `Found ${mailboxes.length} mailboxes:\n\n${mailboxes.join("\n")}`
											: "No mailboxes found. Make sure Mail app is running and properly configured.",
								},
							],
						};
					}
				}

				case "accounts": {
					const accounts = await mailModule.getAccounts();
					return {
						content: [
							{
								type: "text" as const,
								text:
									accounts.length > 0
										? `Found ${accounts.length} email accounts:\n\n${accounts.join("\n")}`
										: "No email accounts found. Make sure Mail app is configured with at least one account.",
							},
						],
					};
				}

				case "latest": {
					let account = args.account;
					if (!account) {
						const accounts = await mailModule.getAccounts();
						if (accounts.length === 0) {
							throw new Error("No email accounts found. Make sure Mail app is configured with at least one account.");
						}
						account = accounts[0];
					}
					const emails = await mailModule.getLatestMails(account, args.limit);
					return {
						content: [
							{
								type: "text" as const,
								text:
									emails.length > 0
										? `Found ${emails.length} latest email(s) in account "${account}":\n\n` +
											emails
												.map(
													(email: any) =>
														`[${email.dateSent}] From: ${email.sender}\nMailbox: ${email.mailbox}\nSubject: ${email.subject}\n${email.content.substring(0, 500)}${email.content.length > 500 ? "..." : ""}`,
												)
												.join("\n\n")
										: `No latest emails found in account "${account}"`,
							},
						],
					};
				}

				default:
					throw new Error(`Unknown operation: ${args.operation}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text" as const,
						text: errorMessage.includes("access") ? errorMessage : `Error with mail operation: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	});

	// --- reminders ---
	server.registerTool("reminders", {
		description: "Search, create, and open reminders in Apple Reminders app",
		inputSchema: {
			operation: z.enum(["list", "search", "open", "create", "listById"]).describe("Operation to perform: 'list', 'search', 'open', 'create', or 'listById'"),
			searchText: z.string().optional().describe("Text to search for in reminders (required for search and open operations)"),
			name: z.string().optional().describe("Name of the reminder to create (required for create operation)"),
			listName: z.string().optional().describe("Name of the list to create the reminder in (optional for create operation)"),
			listId: z.string().optional().describe("ID of the list to get reminders from (required for listById operation)"),
			props: z.array(z.string()).optional().describe("Properties to include in the reminders (optional for listById operation)"),
			notes: z.string().optional().describe("Additional notes for the reminder (optional for create operation)"),
			dueDate: z.string().optional().describe("Due date for the reminder in ISO format (optional for create operation)"),
		},
	}, async (args) => {
		try {
			const remindersModule = await loadModule("reminders");

			const { operation } = args;

			if (operation === "list") {
				const lists = await remindersModule.getAllLists();
				const allReminders = await remindersModule.getAllReminders();
				return {
					content: [
						{
							type: "text" as const,
							text: `Found ${lists.length} lists and ${allReminders.length} reminders.`,
						},
					],
				};
			} else if (operation === "search") {
				const { searchText } = args;
				const results = await remindersModule.searchReminders(searchText!);
				return {
					content: [
						{
							type: "text" as const,
							text:
								results.length > 0
									? `Found ${results.length} reminders matching "${searchText}".`
									: `No reminders found matching "${searchText}".`,
						},
					],
				};
			} else if (operation === "open") {
				const { searchText } = args;
				const result = await remindersModule.openReminder(searchText!);
				return {
					content: [
						{
							type: "text" as const,
							text: result.success
								? `Opened Reminders app. Found reminder: ${result.reminder?.name}`
								: result.message,
						},
					],
					isError: !result.success,
				};
			} else if (operation === "create") {
				const { name, listName, notes, dueDate } = args;
				const result = await remindersModule.createReminder(name!, listName, notes, dueDate);
				return {
					content: [
						{
							type: "text" as const,
							text: `Created reminder "${result.name}" ${listName ? `in list "${listName}"` : ""}.`,
						},
					],
				};
			} else if (operation === "listById") {
				const { listId, props } = args;
				const results = await remindersModule.getRemindersFromListById(listId!, props);
				return {
					content: [
						{
							type: "text" as const,
							text:
								results.length > 0
									? `Found ${results.length} reminders in list with ID "${listId}".`
									: `No reminders found in list with ID "${listId}".`,
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: "Unknown operation",
					},
				],
				isError: true,
			};
		} catch (error) {
			console.error("Error in reminders tool:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text" as const,
						text: errorMessage.includes("access") ? errorMessage : `Error in reminders tool: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	});

	// --- calendar ---
	server.registerTool("calendar", {
		description: "Search, create, and open calendar events in Apple Calendar app",
		inputSchema: {
			operation: z.enum(["search", "open", "list", "create"]).describe("Operation to perform: 'search', 'open', 'list', or 'create'"),
			searchText: z.string().optional().describe("Text to search for in event titles, locations, and notes (required for search operation)"),
			eventId: z.string().optional().describe("ID of the event to open (required for open operation)"),
			limit: z.number().optional().describe("Number of events to retrieve (optional, default 10)"),
			fromDate: z.string().optional().describe("Start date for search range in ISO format (optional, default is today)"),
			toDate: z.string().optional().describe("End date for search range in ISO format (optional, default is 30 days from now for search, 7 days for list)"),
			title: z.string().optional().describe("Title of the event to create (required for create operation)"),
			startDate: z.string().optional().describe("Start date/time of the event in ISO format (required for create operation)"),
			endDate: z.string().optional().describe("End date/time of the event in ISO format (required for create operation)"),
			location: z.string().optional().describe("Location of the event (optional for create operation)"),
			notes: z.string().optional().describe("Additional notes for the event (optional for create operation)"),
			isAllDay: z.boolean().optional().describe("Whether the event is an all-day event (optional for create operation, default is false)"),
			calendarName: z.string().optional().describe("Name of the calendar to create the event in (optional for create operation, uses default calendar if not specified)"),
		},
	}, async (args) => {
		try {
			const calendarModule = await loadModule("calendar");
			const { operation } = args;

			switch (operation) {
				case "search": {
					const { searchText, limit, fromDate, toDate } = args;
					const events = await calendarModule.searchEvents(searchText!, limit, fromDate, toDate);

					return {
						content: [
							{
								type: "text" as const,
								text:
									events.length > 0
										? `Found ${events.length} events matching "${searchText}":\n\n${events
												.map(
													(event) =>
														`${event.title} (${new Date(event.startDate!).toLocaleString()} - ${new Date(event.endDate!).toLocaleString()})\n` +
														`Location: ${event.location || "Not specified"}\n` +
														`Calendar: ${event.calendarName}\n` +
														`ID: ${event.id}\n` +
														`${event.notes ? `Notes: ${event.notes}\n` : ""}`,
												)
												.join("\n\n")}`
										: `No events found matching "${searchText}".`,
							},
						],
					};
				}

				case "open": {
					const { eventId } = args;
					const result = await calendarModule.openEvent(eventId!);

					return {
						content: [
							{
								type: "text" as const,
								text: result.success
									? result.message
									: `Error opening event: ${result.message}`,
							},
						],
						isError: !result.success,
					};
				}

				case "list": {
					const { limit, fromDate, toDate } = args;
					const events = await calendarModule.getEvents(limit, fromDate, toDate);

					const startDateText = fromDate
						? new Date(fromDate).toLocaleDateString()
						: "today";
					const endDateText = toDate
						? new Date(toDate).toLocaleDateString()
						: "next 7 days";

					return {
						content: [
							{
								type: "text" as const,
								text:
									events.length > 0
										? `Found ${events.length} events from ${startDateText} to ${endDateText}:\n\n${events
												.map(
													(event) =>
														`${event.title} (${new Date(event.startDate!).toLocaleString()} - ${new Date(event.endDate!).toLocaleString()})\n` +
														`Location: ${event.location || "Not specified"}\n` +
														`Calendar: ${event.calendarName}\n` +
														`ID: ${event.id}`,
												)
												.join("\n\n")}`
										: `No events found from ${startDateText} to ${endDateText}.`,
							},
						],
					};
				}

				case "create": {
					const { title, startDate, endDate, location, notes, isAllDay, calendarName } = args;
					const result = await calendarModule.createEvent(
						title!, startDate!, endDate!, location, notes, isAllDay, calendarName,
					);
					return {
						content: [
							{
								type: "text" as const,
								text: result.success
									? `${result.message} Event scheduled from ${new Date(startDate!).toLocaleString()} to ${new Date(endDate!).toLocaleString()}${result.eventId ? `\nEvent ID: ${result.eventId}` : ""}`
									: `Error creating event: ${result.message}`,
							},
						],
						isError: !result.success,
					};
				}

				default:
					throw new Error(`Unknown calendar operation: ${operation}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text" as const,
						text: errorMessage.includes("access") ? errorMessage : `Error in calendar tool: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	});

	// --- maps ---
	server.registerTool("maps", {
		description: "Search locations, manage guides, save favorites, and get directions using Apple Maps",
		inputSchema: {
			operation: z.enum(["search", "save", "directions", "pin", "listGuides", "addToGuide", "createGuide"]).describe("Operation to perform with Maps"),
			query: z.string().optional().describe("Search query for locations (required for search)"),
			limit: z.number().optional().describe("Maximum number of results to return (optional for search)"),
			name: z.string().optional().describe("Name of the location (required for save and pin)"),
			address: z.string().optional().describe("Address of the location (required for save, pin, addToGuide)"),
			fromAddress: z.string().optional().describe("Starting address for directions (required for directions)"),
			toAddress: z.string().optional().describe("Destination address for directions (required for directions)"),
			transportType: z.enum(["driving", "walking", "transit"]).optional().describe("Type of transport to use (optional for directions)"),
			guideName: z.string().optional().describe("Name of the guide (required for createGuide and addToGuide)"),
		},
	}, async (args) => {
		try {
			const mapsModule = await loadModule("maps");
			const { operation } = args;

			switch (operation) {
				case "search": {
					const { query, limit } = args;
					if (!query) {
						throw new Error("Search query is required for search operation");
					}

					const result = await mapsModule.searchLocations(query, limit);

					return {
						content: [
							{
								type: "text" as const,
								text: result.success
									? `${result.message}\n\n${result.locations
											.map(
												(location) =>
													`Name: ${location.name}\n` +
													`Address: ${location.address}\n` +
													`${location.latitude && location.longitude ? `Coordinates: ${location.latitude}, ${location.longitude}\n` : ""}`,
											)
											.join("\n\n")}`
									: `${result.message}`,
							},
						],
						isError: !result.success,
					};
				}

				case "save": {
					const { name, address } = args;
					if (!name || !address) {
						throw new Error("Name and address are required for save operation");
					}

					const result = await mapsModule.saveLocation(name, address);

					return {
						content: [
							{
								type: "text" as const,
								text: result.message,
							},
						],
						isError: !result.success,
					};
				}

				case "pin": {
					const { name, address } = args;
					if (!name || !address) {
						throw new Error("Name and address are required for pin operation");
					}

					const result = await mapsModule.dropPin(name, address);

					return {
						content: [
							{
								type: "text" as const,
								text: result.message,
							},
						],
						isError: !result.success,
					};
				}

				case "directions": {
					const { fromAddress, toAddress, transportType } = args;
					if (!fromAddress || !toAddress) {
						throw new Error("From and to addresses are required for directions operation");
					}

					const result = await mapsModule.getDirections(
						fromAddress,
						toAddress,
						transportType as "driving" | "walking" | "transit",
					);

					return {
						content: [
							{
								type: "text" as const,
								text: result.message,
							},
						],
						isError: !result.success,
					};
				}

				case "listGuides": {
					const result = await mapsModule.listGuides();

					return {
						content: [
							{
								type: "text" as const,
								text: result.message,
							},
						],
						isError: !result.success,
					};
				}

				case "addToGuide": {
					const { address, guideName } = args;
					if (!address || !guideName) {
						throw new Error("Address and guideName are required for addToGuide operation");
					}

					const result = await mapsModule.addToGuide(address, guideName);

					return {
						content: [
							{
								type: "text" as const,
								text: result.message,
							},
						],
						isError: !result.success,
					};
				}

				case "createGuide": {
					const { guideName } = args;
					if (!guideName) {
						throw new Error("Guide name is required for createGuide operation");
					}

					const result = await mapsModule.createGuide(guideName);

					return {
						content: [
							{
								type: "text" as const,
								text: result.message,
							},
						],
						isError: !result.success,
					};
				}

				default:
					throw new Error(`Unknown maps operation: ${operation}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text" as const,
						text: errorMessage.includes("access") ? errorMessage : `Error in maps tool: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	});

	// Start the server transport
	console.error("Setting up MCP server transport...");

	(async () => {
		try {
			console.error("Initializing transport...");
			const transport = new StdioServerTransport();

			// Ensure stdout is only used for JSON messages
			console.error("Setting up stdout filter...");
			const originalStdoutWrite = process.stdout.write.bind(process.stdout);
			process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
				// Only allow JSON messages to pass through
				if (typeof chunk === "string" && !chunk.startsWith("{")) {
					console.error("Filtering non-JSON stdout message");
					return true; // Silently skip non-JSON messages
				}
				return originalStdoutWrite(chunk, encoding, callback);
			};

			console.error("Connecting transport to server...");
			await server.connect(transport);
			console.error("Server connected successfully!");
		} catch (error) {
			console.error("Failed to initialize MCP server:", error);
			process.exit(1);
		}
	})();
}
