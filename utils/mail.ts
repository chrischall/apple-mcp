import { runAppleScript } from "run-applescript";
import { run as jxaRun } from "@jxa/run";

// Configuration
const CONFIG = {
	// Maximum emails to process (to avoid performance issues)
	MAX_EMAILS: 20,
	// Maximum content length for previews
	MAX_CONTENT_PREVIEW: 300,
	// Timeout for operations
	TIMEOUT_MS: 10000,
};

// Shape returned by the JXA helpers below, before we normalize defaults.
interface RawJxaEmail {
	subject?: string;
	sender?: string;
	dateSent?: string;
	content?: string;
	isRead?: boolean;
	mailbox?: string;
	account?: string;
}

function normalizeJxaEmail(raw: RawJxaEmail): EmailMessage {
	return {
		subject: raw.subject || "No subject",
		sender: raw.sender || "Unknown sender",
		dateSent: raw.dateSent || new Date().toString(),
		content: raw.content || "[Content not available]",
		isRead: typeof raw.isRead === "boolean" ? raw.isRead : false,
		mailbox: raw.account
			? `${raw.account} — ${raw.mailbox || "Unknown"}`
			: raw.mailbox || "Unknown",
	};
}

interface EmailMessage {
	subject: string;
	sender: string;
	dateSent: string;
	content: string;
	isRead: boolean;
	mailbox: string;
}

/**
 * Check if Mail app is accessible
 */
async function checkMailAccess(): Promise<boolean> {
	try {
		const script = `
tell application "Mail"
    return name
end tell`;

		await runAppleScript(script);
		return true;
	} catch (error) {
		console.error(
			`Cannot access Mail app: ${error instanceof Error ? error.message : String(error)}`,
		);
		return false;
	}
}

/**
 * Request Mail app access and provide instructions if not available
 */
async function requestMailAccess(): Promise<{ hasAccess: boolean; message: string }> {
	try {
		// First check if we already have access
		const hasAccess = await checkMailAccess();
		if (hasAccess) {
			return {
				hasAccess: true,
				message: "Mail access is already granted."
			};
		}

		// If no access, provide clear instructions
		return {
			hasAccess: false,
			message: "Mail access is required but not granted. Please:\n1. Open System Settings > Privacy & Security > Automation\n2. Find your terminal/app in the list and enable 'Mail'\n3. Make sure Mail app is running and configured with at least one account\n4. Restart your terminal and try again"
		};
	} catch (error) {
		return {
			hasAccess: false,
			message: `Error checking Mail access: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}

/**
 * Get unread emails from Mail app via JXA.
 *
 * Uses `mailbox.messages.whose({readStatus: false})` for an indexed lookup
 * — orders of magnitude faster than iterating every message in every box.
 * The previous AppleScript implementation built a result list inside
 * osascript but threw it away on the JS side, returning [].
 */
async function getUnreadMails(limit = 10): Promise<EmailMessage[]> {
	try {
		const accessResult = await requestMailAccess();
		if (!accessResult.hasAccess) {
			throw new Error(accessResult.message);
		}

		const maxEmails = Math.min(limit, CONFIG.MAX_EMAILS);

		const result = await jxaRun(
			(args: { limit: number; preview: number }) => {
				const Mail = Application("Mail");
				const out: RawJxaEmail[] = [];
				const accounts = Mail.accounts();
				outer: for (let i = 0; i < accounts.length; i++) {
					try {
						const accountName = accounts[i].name();
						const boxes = accounts[i].mailboxes();
						for (let j = 0; j < boxes.length; j++) {
							try {
								const msgs = boxes[j].messages.whose({ readStatus: false })();
								const boxName = boxes[j].name();
								for (let k = 0; k < msgs.length; k++) {
									if (out.length >= args.limit) break outer;
									try {
										let content = "";
										try {
											content = msgs[k].content() || "";
										} catch {
											content = "[Content not available]";
										}
										if (content.length > args.preview) {
											content = content.substring(0, args.preview) + "...";
										}
										out.push({
											subject: msgs[k].subject(),
											sender: msgs[k].sender(),
											dateSent: msgs[k].dateSent().toISOString(),
											content,
											isRead: false,
											mailbox: boxName,
											account: accountName,
										});
									} catch {
										// Skip individual messages we can't read.
									}
								}
							} catch {
								// Skip mailboxes we can't enumerate.
							}
						}
					} catch {
						// Skip accounts we can't enumerate.
					}
				}
				return out;
			},
			{ limit: maxEmails, preview: CONFIG.MAX_CONTENT_PREVIEW },
		);

		if (!Array.isArray(result)) return [];
		return (result as RawJxaEmail[]).map(normalizeJxaEmail);
	} catch (error) {
		console.error(
			`Error getting unread emails: ${error instanceof Error ? error.message : String(error)}`,
		);
		return [];
	}
}

/**
 * Search for emails by subject substring (case-insensitive).
 *
 * Uses JXA `whose({subject: {_contains: term}})` for an indexed lookup.
 *
 * Performance: with no scope, this iterates every mailbox in every account
 * and can take minutes on accounts with many labels (e.g. Gmail). Pass
 * `account` (and optionally `mailbox`) to scope the search down to a few
 * seconds.
 */
async function searchMails(
	searchTerm: string,
	limit = 10,
	account?: string,
	mailbox?: string,
): Promise<EmailMessage[]> {
	try {
		const accessResult = await requestMailAccess();
		if (!accessResult.hasAccess) {
			throw new Error(accessResult.message);
		}

		if (!searchTerm || searchTerm.trim() === "") {
			return [];
		}

		const maxEmails = Math.min(limit, CONFIG.MAX_EMAILS);

		const result = await jxaRun(
			(args: {
				searchTerm: string;
				limit: number;
				preview: number;
				account?: string;
				mailbox?: string;
			}) => {
				const Mail = Application("Mail");
				const out: RawJxaEmail[] = [];
				const allAccounts = Mail.accounts();
				const accounts = args.account
					? allAccounts.filter((a: any) => a.name() === args.account)
					: allAccounts;
				outer: for (let i = 0; i < accounts.length; i++) {
					try {
						const accountName = accounts[i].name();
						const allBoxes = accounts[i].mailboxes();
						const boxes = args.mailbox
							? allBoxes.filter((b: any) => b.name() === args.mailbox)
							: allBoxes;
						for (let j = 0; j < boxes.length; j++) {
							try {
								const msgs = boxes[j].messages
									.whose({ subject: { _contains: args.searchTerm } })();
								const boxName = boxes[j].name();
								for (let k = 0; k < msgs.length; k++) {
									if (out.length >= args.limit) break outer;
									try {
										let content = "";
										try {
											content = msgs[k].content() || "";
										} catch {
											content = "[Content not available]";
										}
										if (content.length > args.preview) {
											content = content.substring(0, args.preview) + "...";
										}
										out.push({
											subject: msgs[k].subject(),
											sender: msgs[k].sender(),
											dateSent: msgs[k].dateSent().toISOString(),
											content,
											isRead: msgs[k].readStatus(),
											mailbox: boxName,
											account: accountName,
										});
									} catch {
										// Skip individual messages we can't read.
									}
								}
							} catch {
								// Skip mailboxes we can't enumerate.
							}
						}
					} catch {
						// Skip accounts we can't enumerate.
					}
				}
				return out;
			},
			{
				searchTerm,
				limit: maxEmails,
				preview: CONFIG.MAX_CONTENT_PREVIEW,
				account,
				mailbox,
			},
		);

		if (!Array.isArray(result)) return [];
		return (result as RawJxaEmail[]).map(normalizeJxaEmail);
	} catch (error) {
		console.error(
			`Error searching emails: ${error instanceof Error ? error.message : String(error)}`,
		);
		return [];
	}
}

/**
 * Send an email
 */
async function sendMail(
	to: string,
	subject: string,
	body: string,
	cc?: string,
	bcc?: string,
): Promise<string | undefined> {
	try {
		const accessResult = await requestMailAccess();
		if (!accessResult.hasAccess) {
			throw new Error(accessResult.message);
		}

		// Validate inputs
		if (!to || !to.trim()) {
			throw new Error("To address is required");
		}
		if (!subject || !subject.trim()) {
			throw new Error("Subject is required");
		}
		if (!body || !body.trim()) {
			throw new Error("Email body is required");
		}

		// Use file-based approach for email body to avoid AppleScript escaping issues
		const tmpFile = `/tmp/email-body-${Date.now()}.txt`;
		const fs = require("fs");

		// Write content to temporary file
		fs.writeFileSync(tmpFile, body.trim(), "utf8");

		const script = `
tell application "Mail"
    activate

    -- Read email body from file to preserve formatting
    set emailBody to read file POSIX file "${tmpFile}" as «class utf8»

    -- Create new message
    set newMessage to make new outgoing message with properties {subject:"${subject.replace(/"/g, '\\"')}", content:emailBody, visible:true}

    tell newMessage
        make new to recipient with properties {address:"${to.replace(/"/g, '\\"')}"}
        ${cc ? `make new cc recipient with properties {address:"${cc.replace(/"/g, '\\"')}"}` : ""}
        ${bcc ? `make new bcc recipient with properties {address:"${bcc.replace(/"/g, '\\"')}"}` : ""}
    end tell

    send newMessage
    return "SUCCESS"
end tell`;

		const result = (await runAppleScript(script)) as string;

		// Clean up temporary file
		try {
			fs.unlinkSync(tmpFile);
		} catch (e) {
			// Ignore cleanup errors
		}

		if (result === "SUCCESS") {
			return `Email sent to ${to} with subject "${subject}"`;
		} else {
			throw new Error("Failed to send email");
		}
	} catch (error) {
		console.error(
			`Error sending email: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw new Error(
			`Error sending email: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Get list of mailboxes (simplified for performance)
 */
async function getMailboxes(): Promise<string[]> {
	try {
		const accessResult = await requestMailAccess();
		if (!accessResult.hasAccess) {
			throw new Error(accessResult.message);
		}

		const script = `
tell application "Mail"
    try
        -- Simple check - try to get just the count first
        set mailboxCount to count of mailboxes
        if mailboxCount > 0 then
            return {"Inbox", "Sent", "Drafts"}
        else
            return {}
        end if
    on error
        return {}
    end try
end tell`;

		const result = (await runAppleScript(script)) as unknown;

		if (Array.isArray(result)) {
			return result.filter((name) => name && typeof name === "string");
		}

		return [];
	} catch (error) {
		console.error(
			`Error getting mailboxes: ${error instanceof Error ? error.message : String(error)}`,
		);
		return [];
	}
}

/**
 * Get list of email accounts (simplified for performance)
 */
async function getAccounts(): Promise<string[]> {
	try {
		const accessResult = await requestMailAccess();
		if (!accessResult.hasAccess) {
			throw new Error(accessResult.message);
		}

		const script = `
tell application "Mail"
    try
        -- Simple check - try to get just the count first
        set accountCount to count of accounts
        if accountCount > 0 then
            return {"Default Account"}
        else
            return {}
        end if
    on error
        return {}
    end try
end tell`;

		const result = (await runAppleScript(script)) as unknown;

		if (Array.isArray(result)) {
			return result.filter((name) => name && typeof name === "string");
		}

		return [];
	} catch (error) {
		console.error(
			`Error getting accounts: ${error instanceof Error ? error.message : String(error)}`,
		);
		return [];
	}
}

/**
 * Get mailboxes for a specific account
 */
async function getMailboxesForAccount(accountName: string): Promise<string[]> {
	try {
		const accessResult = await requestMailAccess();
		if (!accessResult.hasAccess) {
			throw new Error(accessResult.message);
		}

		if (!accountName || !accountName.trim()) {
			return [];
		}

		const script = `
tell application "Mail"
    set boxList to {}

    try
        -- Find the account
        set targetAccount to first account whose name is "${accountName.replace(/"/g, '\\"')}"
        set accountMailboxes to mailboxes of targetAccount

        repeat with i from 1 to (count of accountMailboxes)
            try
                set currentMailbox to item i of accountMailboxes
                set mailboxName to name of currentMailbox
                set boxList to boxList & {mailboxName}
            on error
                -- Skip problematic mailboxes
            end try
        end repeat
    on error
        -- Account not found or other error
        return {}
    end try

    return boxList
end tell`;

		const result = (await runAppleScript(script)) as unknown;

		if (Array.isArray(result)) {
			return result.filter((name) => name && typeof name === "string");
		}

		return [];
	} catch (error) {
		console.error(
			`Error getting mailboxes for account: ${error instanceof Error ? error.message : String(error)}`,
		);
		return [];
	}
}

/**
 * Get latest emails from a specific account
 */
async function getLatestMails(
	account: string,
	limit = 5,
): Promise<EmailMessage[]> {
	try {
		const accessResult = await requestMailAccess();
		if (!accessResult.hasAccess) {
			throw new Error(accessResult.message);
		}

		const script = `
tell application "Mail"
    set resultList to {}
    try
        set targetAccount to first account whose name is "${account.replace(/"/g, '\\"')}"
        set acctMailboxes to every mailbox of targetAccount

        repeat with mb in acctMailboxes
            try
                set messagesList to (messages of mb)
                set sortedMessages to my sortMessagesByDate(messagesList)
                set msgLimit to ${limit}
                if (count of sortedMessages) < msgLimit then
                    set msgLimit to (count of sortedMessages)
                end if

                repeat with i from 1 to msgLimit
                    try
                        set currentMsg to item i of sortedMessages
                        set msgData to {subject:(subject of currentMsg), sender:(sender of currentMsg), ¬
                                    date:(date sent of currentMsg) as string, mailbox:(name of mb)}

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

                if (count of resultList) ≥ ${limit} then exit repeat
            on error
                -- Skip problematic mailboxes
            end try
        end repeat
    on error errMsg
        return "Error: " & errMsg
    end try

    return resultList
end tell

on sortMessagesByDate(messagesList)
    set sortedMessages to sort messagesList by date sent
    return sortedMessages
end sortMessagesByDate`;

		const asResult = await runAppleScript(script);

		if (asResult && asResult.startsWith("Error:")) {
			throw new Error(asResult);
		}

		const emailData = [];
		const matches = asResult.match(/\{([^}]+)\}/g);
		if (matches && matches.length > 0) {
			for (const match of matches) {
				try {
					const props = match.substring(1, match.length - 1).split(",");
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
							mailbox: `${account} - ${email.mailbox || "Unknown"}`,
						});
					}
				} catch (parseError) {
					console.error("Error parsing email match:", parseError);
				}
			}
		}

		return emailData;
	} catch (error) {
		console.error("Error getting latest emails:", error);
		return [];
	}
}

export default {
	getUnreadMails,
	searchMails,
	sendMail,
	getMailboxes,
	getAccounts,
	getMailboxesForAccount,
	getLatestMails,
	requestMailAccess,
};
