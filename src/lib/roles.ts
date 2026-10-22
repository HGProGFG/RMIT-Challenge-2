import type { Role, VerifiedIdentity } from "./contracts";
export function hasVerifiedRole(identity: VerifiedIdentity, role: Role) {
  return identity.realmRoles.includes(role) || (role === "tide-realm-admin" &&
    identity.clientRoles["realm-management"]?.includes("tide-realm-admin") === true);
}
