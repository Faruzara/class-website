const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const stateSource = fs.readFileSync(path.join(root, 'lib/admin-slot-state.ts'), 'utf8');
const dbSource = fs.readFileSync(path.join(root, 'lib/db.ts'), 'utf8');
const authSource = fs.readFileSync(path.join(root, 'lib/auth.ts'), 'utf8');
const routeSource = fs.readFileSync(path.join(root, 'app/api/owner/slots/generate/route.ts'), 'utf8');
const code = ts.transpileModule(stateSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(code, context);
const { isAdminSlotActive } = context.exports;

test('permanent slots stay active until their key is explicitly revoked', () => {
  const now = Date.parse('2026-09-02T10:00:00.000Z');
  assert.equal(isAdminSlotActive({ key_hash: null }, now), false);
  assert.equal(isAdminSlotActive({ key_hash: 'hash', assigned_at: '2026-09-02T09:56:00.000Z', last_login: null }, now), true);
  assert.equal(isAdminSlotActive({ key_hash: 'hash', assigned_at: '2026-09-02T09:54:00.000Z', last_login: null }, now), true);
  assert.equal(isAdminSlotActive({ key_hash: 'hash', assigned_at: '2026-09-02T09:00:00.000Z', last_login: '2026-09-02T09:01:00.000Z' }, now), true);
  assert.equal(isAdminSlotActive({ key_hash: 'hash', expires_at: '2026-09-02T09:59:00.000Z', last_login: null }, now), true);
});

test('legacy schema fallback covers generate, revoke and one-time login claim', () => {
  assert.match(routeSource, /isMissingSupabaseColumn\(slotError, "activation_expires_at"\)/);
  assert.match(routeSource, /select\("key_hash, expires_at, assigned_at, last_login"\)/);
  assert.match(routeSource, /if \(slotError\)/);
  assert.match(dbSource, /isMissingSupabaseColumn\(error, "activation_expires_at"\)/);
  assert.match(dbSource, /expires_at: activationExpiresAt \?\? expiresAt/);
  assert.match(authSource, /if \("activation_expires_at" in slot\)/);
});
