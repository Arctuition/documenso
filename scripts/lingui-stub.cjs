// Runtime stub for @lingui/macro (macros are normally compiled away by babel)
const msg = (strings) => ({ id: Array.isArray(strings) ? strings[0] : strings });
const t = (strings) => (Array.isArray(strings) ? strings[0] : strings);
const defineMessage = (m) => m;
const Trans = () => null;

module.exports = { msg, t, Trans, defineMessage };
