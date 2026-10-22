# Local simulation verification — 22 October 2026

Mode: `LOCAL_SIMULATION`. These results establish local application behavior only. No real Tide sign-in, ORK operation, policy signature or human quorum was performed.

The Tide MCP `relationship-attestation` scenario was consulted to map endpoint authorization, separate read/write policies, exact record tags and governed role membership. The implementation and remaining live gates are described in [the simulation guide](../simulation.md).

## Results

- `npm test`: 70 passed, 0 failed, including the existing real JWT/DPoP and governance boundary tests.
- `npm run typecheck`: passed.
- Production build with `NEXT_BUILD_DIR=.next-simulation-build`: passed; all application routes generated successfully.
- Running server started with `npm run demo`, bound to `127.0.0.1:3000` and accessed through `http://localhost:3000`.
- A real HTTP round trip used the simulation browser adapter and Web Crypto AES-GCM: author prepared and sealed a synthetic paper; teacher, administrator and unreleased invigilator were denied; one governor approval stayed pending; a duplicate vote returned 409; a second distinct governor committed release; invigilator recovered the exact original text.
- `/sign-in`, `/vault`, `/vault/new`, `/vault/:id`, `/governance`, `/administration/attacks` and `/activity` returned 200 and rendered the simulation banner and identity controls.
- Activity responses contained only `SIMULATION` sources. Administrator reset removed the test paper, keys and votes, and logout invalidated the session. The local app was left running with a fresh demo run.

Browser control was disabled in the user's Work settings. Interactive clicks, visual layout and browser hydration were not independently checked. The browser adapter's actual encryption code was exercised directly against both the test handler and running HTTP server.

The simulator's keys are held by its local server. Selecting two synthetic governor accounts does not establish two independent humans or Tide threshold security. The actual realm initialization failure remains documented in [the live diagnostic](tide/bootstrap-2026-10-22.md).
