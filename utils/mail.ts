// utils/mail.ts  (still growing — finalized in Task 14)
import core from "./mail-core.js";
import actions from "./mail-actions.js";
import batch from "./mail-batch.js";
export default { ...core, ...actions, ...batch };
