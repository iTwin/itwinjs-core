# Map-layer security hardening: origin-restricted credentials, SSO gating, and attribution XSS fixes

## Summary

Map-layer imagery providers previously sent credentials with any request they issued and rendered server-provided attribution text as HTML. Because map-layer URLs may originate from untrusted input (user-typed URLs, layers persisted in display styles, URLs advertised in server capability documents), this could leak credentials to third-party hosts and allowed a malicious or compromised map server to inject markup into the viewer. This PR closes both gaps and adds the plumbing needed to test Kerberos / Windows Authentication (SSO) map servers end-to-end.

## Changes

### Origin-restricted credentials (opt-in, `@beta`)

- New `MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins` and `trustedCredentialsOrigins` properties. When enabled:
  - Basic-auth credentials stored in layer settings are only attached to requests targeting the layer's settings-URL origin or a whitelisted origin.
  - SSO retries (`credentials: "include"`) after an NTLM/Negotiate 401 challenge are only performed for origins explicitly listed in `trustedCredentialsOrigins`. The settings-URL origin is *not* implicitly trusted for SSO, since SSO shares the user's ambient identity.
  - Server-provided tooltip content (e.g. WMS `GetFeatureInfo`) is rendered as markup only for trusted origins; other origins render escaped text.
- Whitelist entries are normalized to their origin (scheme + host + port); invalid entries are ignored and logged. Exact origins only — no wildcard support for now.
- The origin check is centralized in `MapLayerFormatRegistry.isSsoAllowed` (`@internal`) so that every SSO retry site shares one implementation: `MapLayerImageryProvider.makeRequest`, `ArcGISImageryProvider.fetch`, and the static validation utilities `WmsUtilities.fetchXml` and `ArcGisUtilities.getServiceJson` (which have no provider instance).
- Default is `false`, preserving existing behavior. When the restriction is disabled, credentials sent to a non-whitelisted origin log a one-time-per-origin warning so applications can discover the origins they need to whitelist before opting in.

### Blocked-origin notification (`@beta`)

- New `MapLayerImageryProviderStatus.UntrustedOrigin` status and `MapLayerImageryProvider.blockedOrigins` property. When a request receives a 401 that could not be answered because credentials were withheld for an untrusted origin, the provider transitions to `UntrustedOrigin` and raises `onStatusChanged` (again for each newly blocked origin), letting applications surface the problem or prompt for whitelisting.
- `MapLayerImageryProvider.resetStatus` clears the accumulated blocked origins after the application updates the whitelist.
- Successful SSO handshakes are latched **per origin** (not per provider), so subsequent requests to that origin include credentials without repeating the 401 round-trip, while other origins still require their own validated handshake.

### Attribution text is no longer rendered as HTML

- Attribution/copyright strings from map servers (ArcGIS service metadata, Bing attribution service, Google Maps viewport info, Google Photorealistic 3D Tiles) were rendered via `innerHTML`; they are now always inserted as DOM text nodes. Visual output is unchanged for legitimate attribution text.
- `IModelApp.makeLogoCard` gains a `noticeLines?: Array<string | HTMLElement>` option: string entries are rendered as plain text — never parsed as HTML — making it the safe choice for untrusted content; an `HTMLElement` entry can be supplied for a line requiring markup. All four attribution call sites use it, and the notice styling remains an implementation detail (no CSS class name is exported). The existing `notice` string path is unchanged but now documents that it must never receive untrusted text.

### display-test-app

- New `IMJS_AUTH_SERVER_ALLOWLIST` environment variable: comma-separated servers for which Chromium may perform integrated authentication (Kerberos/NTLM SSO), applied via the `auth-server-whitelist` command-line switch in the Electron main process. Without this, Chromium silently refuses `Negotiate`/`NTLM` challenges from servers outside the intranet zone (dotted hostnames), and map-layer SSO fails with a repeated 401 carrying no `Authorization` header.
- DTA opts in to `restrictCredentialsToTrustedOrigins` to exercise the new behavior.

### Documentation

- `docs/changehistory/NextVersion.md`: new "Map-layer security hardening" section describing the opt-in restriction, the blocked-origin notification, the attribution rendering change, and migration guidance with code examples.

## Validation

Targeted verification:

- New unit tests:
  - `core/frontend/src/test/tile/map/MapLayerImageryProviderAuth.test.ts` (26 cases): basic-auth origin gating, SSO whitelist gating (including the `WmsUtilities.fetchXml` and `ArcGisUtilities.getServiceJson` static paths), legacy-default behavior when the restriction is disabled, per-origin SSO latch, blocked-origin accumulation/eventing, whitelist normalization.
  - `core/frontend/src/test/tile/map/MapLayerAttributionXss.test.ts`: server-provided attribution and tooltip strings render as escaped text, trusted-origin tooltip HTML still renders as markup.
  - `extensions/map-layers-formats/src/test/GoogleMaps/GoogleMaps.test.ts`: attribution rendering and de-duplication against the new text-node path (150 extension tests pass).
- Manual end-to-end Kerberos SSO test in Electron display-test-app against an internal IIS WMS server (`Negotiate`/`NTLM` challenges): confirmed the 401 challenge is answered only when the origin is whitelisted **and** `IMJS_AUTH_SERVER_ALLOWLIST` covers the host; verified via HAR capture that the retry carries `Authorization: Negotiate ...` and succeeds.
- `rush extract-api` run against a fresh build; `common/api/core-frontend.api.md` diff reviewed — additions only (`@beta`/`@internal`), no changes to shipped `@public` signatures.
- ESLint clean on all touched files.

Known baseline issues:

- Pre-existing editor-only TypeScript diagnostics in `core/frontend` about Node globals (`process`, `Buffer`) — unrelated to this change; package builds cleanly.
- Browser-hosted deployments cannot set the Chromium auth allowlist from code; integrated-auth eligibility there is governed by enterprise policy (`AuthServerAllowlist`) or Windows intranet-zone settings. Documented in the DTA README.
