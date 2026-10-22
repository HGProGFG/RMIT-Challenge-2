import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const realm = process.env.TIDE_REALM ?? 'sealed-exam-vault';
const client = process.env.TIDE_CLIENT ?? 'sealed-exam-vault-client';
const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
if (![realm, client].every(value => /^[a-z][a-z0-9-]{2,63}$/.test(value)) || realm === 'myrealm') throw Error('Use dedicated realm/client names.');
const url = new URL(origin);
if (url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw Error('APP_ORIGIN must be a canonical origin.');
const template = readFileSync(new URL('./templates/realm.json.template', import.meta.url), 'utf8');
const plan = JSON.parse(template.replaceAll('REALM_NAME', realm).replaceAll('CLIENT_NAME', client).replaceAll('CLIENT_APP_URL', origin));
for (const name of ['author', 'invigilator', 'teacher', 'app-admin']) plan.roles.realm.push({ name });
const accounts = [
  ['author', ['author', '_tide_encryptor']], ['invigilator', ['invigilator']],
  ['teacher', ['teacher']], ['app-admin', ['app-admin']],
  ['governor-1', []], ['governor-2', []], ['governor-3', []],
];
plan.users = accounts.map(([username, realmRoles]) => ({ username, enabled: true,
  attributes: { tideInvitable: ['true'] }, realmRoles: ['_tide_enabled', ...realmRoles] }));
// Governance roles are deliberately assigned LAST through governed, human-reviewed grants,
// after enrollment and signed IdP settings. Never bake admin votes or decrypt roles into defaults.
mkdirSync('data', { recursive: true });
writeFileSync('data/realm-import.json', JSON.stringify(plan, null, 2) + '\n');
console.log('Prepared data/realm-import.json with seven separate synthetic account slots. No remote write, licence activation, enrollment or quorum configuration was performed.');
