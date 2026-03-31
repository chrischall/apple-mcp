// utils/mail.ts
import core from "./mail-core.js";
import actions from "./mail-actions.js";
import batch from "./mail-batch.js";
import manage from "./mail-manage.js";
export default { ...core, ...actions, ...batch, ...manage };
