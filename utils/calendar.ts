// utils/calendar.ts — barrel re-export
import core from "./calendar-core.js";
import actions from "./calendar-actions.js";
import manage from "./calendar-manage.js";
export default { ...core, ...actions, ...manage };
