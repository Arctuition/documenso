'use strict';

const Module = require('module');

// @lingui/macro re-exports @lingui/babel-plugin-lingui-macro/macro at runtime.
// tsx (esbuild) doesn't run babel macros, so msg/t are never transformed —
// we stub them so the module loads without error.
const LINGUI_STUB = {
  isBabelMacro: true,
  options: {},
  msg: (strings) => ({ id: Array.isArray(strings) ? strings[0] : strings }),
  t: (strings) => (Array.isArray(strings) ? strings[0] : strings),
  Trans: () => null,
  defineMessage: (m) => m,
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@lingui/macro' || request.includes('@lingui/babel-plugin-lingui-macro/macro')) {
    return LINGUI_STUB;
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Now safe to pull in tsx-compiled modules
const { sealDocument } = require('../packages/lib/server-only/document/seal-document');

const documentId = Number(process.argv[2]);

if (!documentId || isNaN(documentId)) {
  console.error('Usage: node scripts/reseal-document.cjs <documentId>');
  process.exit(1);
}

console.log(`Resealing document ${documentId}...`);

sealDocument({ documentId, isResealing: true, sendEmail: true })
  .then(() => {
    console.log(`Document ${documentId} sealed and webhooks triggered successfully.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
