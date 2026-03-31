// utils/mail-batch.ts
import {
  markAsRead, markAsUnread, flagMessage, unflagMessage, deleteMessage, moveMessage
} from "./mail-actions.js";

export interface BatchResult {
  id: string;
  success: boolean;
  error?: string;
}

const MAX_BATCH = 100;

function validateBatch(ids: string[]): void {
  if (ids.length === 0) throw new Error("At least one ID is required");
  if (ids.length > MAX_BATCH) throw new Error(`Cannot process more than ${MAX_BATCH} messages in a single batch`);
}

export async function batchMarkAsRead(ids: string[]): Promise<BatchResult[]> {
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await markAsRead(id) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export async function batchMarkAsUnread(ids: string[]): Promise<BatchResult[]> {
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await markAsUnread(id) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export async function batchFlagMessages(ids: string[]): Promise<BatchResult[]> {
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await flagMessage(id) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export async function batchUnflagMessages(ids: string[]): Promise<BatchResult[]> {
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await unflagMessage(id) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export async function batchDeleteMessages(ids: string[]): Promise<BatchResult[]> {
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await deleteMessage(id) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export async function batchMoveMessages(params: {
  ids: string[];
  mailbox: string;
  account?: string;
}): Promise<BatchResult[]> {
  const { ids, mailbox, account } = params;
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await moveMessage({ id, mailbox, account }) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export default { batchMarkAsRead, batchMarkAsUnread, batchFlagMessages, batchUnflagMessages, batchDeleteMessages, batchMoveMessages };
