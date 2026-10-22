import { createPublicKey, verify } from "node:crypto";
import type { PolicyPurpose, SignedPolicy } from "../../contracts";
import { tideConfig } from "../../server/config";
import { AppError } from "../../server/errors";

// Bounded reader for the published @tideorg/js 0.14.29 Policy v4 / TideMemory v1 wire format.
// Keep browser SDK imports (including decryption) out of the server dependency graph.
function sections(bytes: Uint8Array, maximum: number): Uint8Array[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4 || view.getInt32(0, true) !== 1) throw Error();
  const out: Uint8Array[] = []; let offset = 4;
  while (offset < bytes.length) {
    if (out.length === maximum || offset + 4 > bytes.length) throw Error();
    const length = view.getInt32(offset, true); offset += 4;
    if (length < 0 || offset + length > bytes.length) throw Error();
    out.push(bytes.subarray(offset, offset + length)); offset += length;
  }
  return out;
}
const text = (b: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(b);
export async function verifyExamPolicy(input: { examId: string; purpose: PolicyPurpose; signedBytes: Uint8Array }): Promise<Omit<SignedPolicy, "id" | "digest" | "signedBytesBase64">> {
  const { adapter } = tideConfig();
  if (!adapter.vendorId) throw new AppError(503, "POLICY_NOT_READY", "The exported Tide vendor identifier is required.");
  try {
    if (input.signedBytes.length > 65536) throw Error();
    const outer = sections(input.signedBytes, 2);
    if (outer.length !== 2 || outer[1].length !== 64) throw Error();
    const layout = sections(outer[0], 8);
    if (layout.length < 7 || text(layout[0]) !== "4" || text(layout[1]) !== "RelationshipAttestation:1" ||
        text(layout[3]) !== adapter.vendorId || text(layout[4]) !== "IMPLICIT" || text(layout[5]) !== "PRIVATE") throw Error();
    const models = sections(layout[2], 2).map(text);
    if (models.length !== 2 || models[0] !== "PolicyEnabledEncryption:1" || models[1] !== "PolicyEnabledDecryption:1") throw Error();
    if (layout[7]) {
      if (layout[7].length !== 8 || new DataView(layout[7].buffer, layout[7].byteOffset, 8).getBigInt64(0, true) <= BigInt(Math.floor(Date.now() / 1000))) throw Error();
    }
    const params = new Map<string, string>();
    for (const field of sections(layout[6], 4)) {
      const parts = sections(field, 3);
      if (parts.length !== 3 || text(parts[1]) !== "str" || params.has(text(parts[0]))) throw Error();
      params.set(text(parts[0]), text(parts[2]));
    }
    const subjectId = input.purpose === "WRITE" ? "author" : "invigilator";
    const operationRoles = [input.purpose === "WRITE" ? "_tide_encryptor" : "_tide_decryptor"] as SignedPolicy["operationRoles"];
    if (params.size !== 4 || params.get("subjectType") !== "Role" || params.get("subjectId") !== subjectId ||
        params.get("assignmentId") !== input.examId || params.get("roles") !== JSON.stringify(operationRoles)) throw Error();
    // Verify exact signed dataToVerify bytes, never a re-encoded metadata description.
    const valid = adapter.jwk.keys.some(jwk => verify(null, outer[0], createPublicKey({ key: jwk, format: "jwk" }), outer[1]));
    if (!valid) throw Error();
    return { examId: input.examId, purpose: input.purpose, contractId: "RelationshipAttestation:1",
      assignmentId: input.examId, subjectType: "Role", subjectId, operationRoles, version: 1 };
  } catch { throw new AppError(422, "INVALID_SIGNED_POLICY", "The signed policy does not match the pinned vendor, record, subject and operation."); }
}
