# Local Tide bootstrap diagnostic — 22 October 2026

The local container and dedicated realm exist. Automatic free-tier activation has not completed;
real login, enrollment, policy encryption and quorum acceptance remain unverified.

## Environment and completed setup

- Docker Linux engine 29.9.2, Microsoft WSL 3.0.3, Windows host.
- Image `tideorg/tidecloak-dev:latest`, release label `0.14.41-DEV`.
- Observed immutable Docker image ID:
  `sha256:3f52d0bc3e4e3ae5153e172960003bbe94705cd40af6561fd4c7c4434aaa2708`.
- Container `tidecloak-sealed-vault`, loopback binding `127.0.0.1:8080`.
- Persistent volume `sealed-vault-tide-data`, H2 mount `/opt/keycloak/data/h2`.
- Fixed initial volume ownership for the image's UID 1000. Master OIDC discovery responds.
- Dedicated realm `sealed-exam-vault`, public client `sealed-exam-vault-client`.
- Seven synthetic account slots created; zero linked human Tide accounts and zero governors.
- IGA has not been enabled. Zero pending requests does not prove governance is active.
- Actual origin, audience, invigilator subject and image observation configured privately;
  SQLite schema migration completed. No active application run has been created.

## Activation observations

Times below are UTC on 22 October 2026. Endpoint names are relative to
`/admin/realms/sealed-exam-vault/`.

| Observation | Result |
|---|---|
| 06:19, `POST vendorResources/setUpTideRealm`, form-encoded owner email and `isRagnarokEnabled=true` | HTTP 500, `TIDE-IDPEXT-VENDOR-KEYGEN_FAILED` |
| Initial activation log | Free-tier subscription initialized; vendor finalization attempted |
| Wallet finalization log | Could not determine wallet state, status `UNDETERMINED` |
| Initial `GET vendorResources/getLicenseDetails` | Local HTTP 200 with empty value; Midgard log reports upstream HTTP 503 |
| 06:26, one bounded `POST vendorResources/CreateTideVendorKey`, free tier and same owner email | HTTP 500, same failure code and wallet status |
| 06:33, `GET vendorResources/isPendingLicenseActive` | HTTP 200, `true` |
| 06:33, `GET vendorResources/getLicenseDetails` | HTTP 200, returns usage/expiry fields |
| 06:33, `GET vendorResources/get-installations-provider` for the actual client | HTTP 500; no adapter saved |

The setup response says the vendor key was created but the licence could not be set up.
An active pending subscription and returned licence details are partial observations, not proof
that wallet finalization, IdP signing or usable app configuration succeeded. The earlier upstream
503 may have been transient; the latest adapter export still fails. The precise upstream cause
requires Tide's investigation.

The free-tier flow uses the owner's email and automatic activation. It does not request a
manually entered challenge licence key. This agrees with the
[official Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart), which describes
licence activation as part of initialization. The supplied challenge-page text does not mention
a licence key and directs setup questions to Discord `#support`.

## Preserved state and next action

Retain the existing realm and volume so Tide can diagnose its pending subscription/vendor state.
No forced key generation, rotation, switch, licence bypass, paid checkout or fabricated adapter
was used. Credentials, owner email, customer/subscription IDs, key material and raw logs remain
private. No enrollment invites have been created.

Ask Tide support to inspect why free-tier wallet/vendor finalization returns `UNDETERMINED`
and how to resume this existing realm safely. After genuine activation succeeds, resume the
remaining steps in [Tide setup](../../tide-setup.md), including human enrollment and signed 2-of-3
governance. This report is prepared for review; it has not been sent to anyone.
