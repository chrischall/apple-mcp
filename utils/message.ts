import { runAppleScript } from 'run-applescript';
import { spawn } from 'node:child_process';
import { escapeAppleScriptString as escapeAS } from './applescript-utils.js';
import { normalizePhoneNumber, decodeAttributedBody } from './phone-utils.js';

/**
 * Runs a sqlite3 query using spawn (no shell) to eliminate shell-injection risk.
 * The query string and db path are passed as direct process arguments, not
 * interpreted by /bin/sh.
 */
function runSqlite(dbPath: string, query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn('sqlite3', ['-json', dbPath, query]);
    child.stdout.on('data', (d: Buffer) => { stdout += d; });
    child.stderr.on('data', (d: Buffer) => { stderr += d; });
    child.on('close', (code: number | null) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`sqlite3 exited with code ${code}: ${stderr.trim()}`));
      } else {
        resolve(stdout);
      }
    });
    child.on('error', reject);
  });
}

async function sendMessage(phoneNumber: string, message: string): Promise<boolean> {
  try {
    await runAppleScript(`
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "${escapeAS(phoneNumber)}"
    send "${escapeAS(message)}" to targetBuddy
end tell`);
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

interface Message {
  content: string;
  date: string;
  sender: string;
  is_from_me: boolean;
  attachments?: string[];
  url?: string;
}

async function getAttachmentPaths(messageId: number): Promise<string[]> {
  try {
    const query = `
      SELECT filename
      FROM attachment
      INNER JOIN message_attachment_join
      ON attachment.ROWID = message_attachment_join.attachment_id
      WHERE message_attachment_join.message_id = ${messageId}
    `;
    const dbPath = `${process.env.HOME}/Library/Messages/chat.db`;
    const stdout = await runSqlite(dbPath, query);
    if (!stdout.trim()) {
      return [];
    }
    const attachments = JSON.parse(stdout) as { filename: string }[];
    return attachments.map(a => a.filename).filter(Boolean);
  } catch (error) {
    console.error('Error getting attachments:', error);
    return [];
  }
}

async function readMessages(phoneNumber: string, limit = 10): Promise<Message[]> {
  try {
    const maxLimit = Math.min(limit, 50);

    const phoneFormats = normalizePhoneNumber(phoneNumber);
    console.error("Trying phone formats:", phoneFormats);

    const phoneList = phoneFormats.map(p => `'${p.replace(/'/g, "''")}'`).join(',');

    const query = `
      SELECT
          m.ROWID as message_id,
          CASE
              WHEN m.text IS NOT NULL AND m.text != '' THEN m.text
              WHEN m.attributedBody IS NOT NULL THEN hex(m.attributedBody)
              ELSE NULL
          END as content,
          datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
          h.id as sender,
          m.is_from_me,
          m.is_audio_message,
          m.cache_has_attachments,
          m.subject,
          CASE
              WHEN m.text IS NOT NULL AND m.text != '' THEN 0
              WHEN m.attributedBody IS NOT NULL THEN 1
              ELSE 2
          END as content_type
      FROM message m
      INNER JOIN handle h ON h.ROWID = m.handle_id
      WHERE h.id IN (${phoneList})
          AND (m.text IS NOT NULL OR m.attributedBody IS NOT NULL OR m.cache_has_attachments = 1)
          AND m.is_from_me IS NOT NULL
          AND m.item_type = 0
          AND m.is_audio_message = 0
      ORDER BY m.date DESC
      LIMIT ${maxLimit}
    `;

    const dbPath = `${process.env.HOME}/Library/Messages/chat.db`;
    const stdout = await runSqlite(dbPath, query);

    if (!stdout.trim()) {
      console.error("No messages found in database for the given phone number");
      return [];
    }

    const messages = JSON.parse(stdout) as (Message & {
      message_id: number;
      is_audio_message: number;
      cache_has_attachments: number;
      subject: string | null;
      content_type: number;
    })[];

    const processedMessages = await Promise.all(
      messages
        .filter(msg => msg.content !== null || msg.cache_has_attachments === 1)
        .map(async msg => {
          let content = msg.content || '';
          let url: string | undefined;

          if (msg.content_type === 1) {
            const decoded = decodeAttributedBody(content);
            content = decoded.text;
            url = decoded.url;
          } else {
            const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
              url = urlMatch[1];
            }
          }

          let attachments: string[] = [];
          if (msg.cache_has_attachments) {
            attachments = await getAttachmentPaths(msg.message_id);
          }

          if (msg.subject) {
            content = `Subject: ${msg.subject}\n${content}`;
          }

          const formattedMsg: Message = {
            content: content || '[No text content]',
            date: new Date(msg.date).toISOString(),
            sender: msg.sender,
            is_from_me: Boolean(msg.is_from_me)
          };

          if (attachments.length > 0) {
            formattedMsg.attachments = attachments;
            formattedMsg.content += `\n[Attachments: ${attachments.length}]`;
          }

          if (url) {
            formattedMsg.url = url;
            formattedMsg.content += `\n[URL: ${url}]`;
          }

          return formattedMsg;
        })
    );

    return processedMessages;
  } catch (error) {
    console.error('Error reading messages:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return [];
  }
}

async function getUnreadMessages(limit = 10): Promise<Message[]> {
  try {
    const maxLimit = Math.min(limit, 50);

    const query = `
      SELECT
          m.ROWID as message_id,
          CASE
              WHEN m.text IS NOT NULL AND m.text != '' THEN m.text
              WHEN m.attributedBody IS NOT NULL THEN hex(m.attributedBody)
              ELSE NULL
          END as content,
          datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
          h.id as sender,
          m.is_from_me,
          m.is_audio_message,
          m.cache_has_attachments,
          m.subject,
          CASE
              WHEN m.text IS NOT NULL AND m.text != '' THEN 0
              WHEN m.attributedBody IS NOT NULL THEN 1
              ELSE 2
          END as content_type
      FROM message m
      INNER JOIN handle h ON h.ROWID = m.handle_id
      WHERE m.is_from_me = 0
          AND m.is_read = 0
          AND (m.text IS NOT NULL OR m.attributedBody IS NOT NULL OR m.cache_has_attachments = 1)
          AND m.is_audio_message = 0
          AND m.item_type = 0
      ORDER BY m.date DESC
      LIMIT ${maxLimit}
    `;

    const dbPath = `${process.env.HOME}/Library/Messages/chat.db`;
    const stdout = await runSqlite(dbPath, query);

    if (!stdout.trim()) {
      console.error("No unread messages found");
      return [];
    }

    const messages = JSON.parse(stdout) as (Message & {
      message_id: number;
      is_audio_message: number;
      cache_has_attachments: number;
      subject: string | null;
      content_type: number;
    })[];

    const processedMessages = await Promise.all(
      messages
        .filter(msg => msg.content !== null || msg.cache_has_attachments === 1)
        .map(async msg => {
          let content = msg.content || '';
          let url: string | undefined;

          if (msg.content_type === 1) {
            const decoded = decodeAttributedBody(content);
            content = decoded.text;
            url = decoded.url;
          } else {
            const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
              url = urlMatch[1];
            }
          }

          let attachments: string[] = [];
          if (msg.cache_has_attachments) {
            attachments = await getAttachmentPaths(msg.message_id);
          }

          if (msg.subject) {
            content = `Subject: ${msg.subject}\n${content}`;
          }

          const formattedMsg: Message = {
            content: content || '[No text content]',
            date: new Date(msg.date).toISOString(),
            sender: msg.sender,
            is_from_me: Boolean(msg.is_from_me)
          };

          if (attachments.length > 0) {
            formattedMsg.attachments = attachments;
            formattedMsg.content += `\n[Attachments: ${attachments.length}]`;
          }

          if (url) {
            formattedMsg.url = url;
            formattedMsg.content += `\n[URL: ${url}]`;
          }

          return formattedMsg;
        })
    );

    return processedMessages;
  } catch (error) {
    console.error('Error reading unread messages:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return [];
  }
}

export default { sendMessage, readMessages, getUnreadMessages };
