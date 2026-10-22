import type { DecryptResult, Role, SignedPolicy } from "../../contracts";

/** Application boundary for Dinh's reviewed Tide SDK integration, not Tide SDK exports.
 * Only the real SDK may authenticate, produce ciphertext or return opened plaintext.
 */
export interface BrowserTideAdapter {
  connected: boolean;
  login(roleHint?: Role): Promise<void>;
  logout(): Promise<void>;
  secureFetch(input: string, init?: RequestInit): Promise<Response>;
  encrypt(input: { examId: string; plaintext: string; policy: SignedPolicy }): Promise<string>;
  decrypt(input: { examId: string; ciphertextBase64: string; policy: SignedPolicy }): Promise<DecryptResult>;
}
const unavailable = async (): Promise<never> => { throw new Error("TIDE_NOT_READY"); };
const disconnected: BrowserTideAdapter = {
  connected: false, login: unavailable, logout: async () => {}, secureFetch: unavailable,
  encrypt: unavailable, decrypt: unavailable,
};
let adapter: BrowserTideAdapter = disconnected;
/** Install only from the trusted application provider after SDK initialization.
 * Never install fixture authentication or accept an adapter from URL/browser storage.
 */
export function configureBrowserTide(value: BrowserTideAdapter) { adapter = value; }
export function getBrowserTide(): BrowserTideAdapter { return adapter; }
