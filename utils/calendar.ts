// utils/calendar.ts — barrel re-export
import core from "./calendar-core.js";
import actions from "./calendar-actions.js";
export default { ...core, ...actions };
