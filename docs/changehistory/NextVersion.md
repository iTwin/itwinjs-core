---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Quantity formatting](#quantity-formatting)
    - [Bearing and Azimuth formatting now respects the persistence unit's phenomenon](#bearing-and-azimuth-formatting-now-respects-the-persistence-units-phenomenon)
  - [Electron 43 support](#electron-43-support)
  - [@itwin/core-backend](#itwincore-backend)
    - [ChangesetReader.setBatchSize](#changesetreadersetbatchsize)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Map-layer security hardening](#map-layer-security-hardening)
      - [Origin-restricted credentials (opt-in)](#origin-restricted-credentials-opt-in)
      - [Blocked-origin notification](#blocked-origin-notification)
      - [Attribution text is no longer rendered as HTML](#attribution-text-is-no-longer-rendered-as-html)

## Quantity formatting

### Bearing and Azimuth formatting now respects the persistence unit's phenomenon

Previously, [Bearing and Azimuth format types]($docs/quantity-formatting/definitions/Formats.md#bearing-and-azimuth-format) assumed the persisted magnitude was always a true azimuth (measured clockwise from north), regardless of the quantity's `persistenceUnit`. This was incorrect for properties whose `persistenceUnit.phenomenon` is `Units.ANGLE` (a raw mathematical angle, measured counter-clockwise from east) - see [#9465](https://github.com/iTwin/itwinjs-core/issues/9465).

[Formatter.formatQuantity]($quantity) and [Parser.parseQuantityString]($quantity) now branch on `persistenceUnit.phenomenon`:

- `Units.HORIZONTAL_DIRECTION` (a phenomenon; e.g. its `Units.HORIZONTAL_DIR_RAD` unit): unchanged - a `HORIZONTAL_DIRECTION` value is already a true azimuth, so it's formatted/parsed as-is.
- `Units.ANGLE` (a phenomenon; e.g. its `Units.RAD` unit): the `90° − θ` conversion is now applied automatically before formatting an `ANGLE` value, and inverse-applied after parsing one.

For code that persists Bearing/Azimuth values as `ANGLE`-phenomenon units and previously worked around the bug by manually applying its own `90° − θ` correction: **that manual correction must now be removed**, or values will be double-converted. For example, `AccuDraw`'s manual correction for its `QuantityType.Angle` bearing display (persisted as `Units.RAD`) has been removed as part of this change.

If your KindOfQuantity persists true azimuth values directly, switch its persistence unit to a `Units.HORIZONTAL_DIRECTION` unit (e.g. `Units.HORIZONTAL_DIR_RAD`) to opt out of the conversion entirely.

**Note:** if you switch your persistence unit's phenomenon, remember to also update `revolutionUnit` (and `azimuthBaseUnit`, if set) to a unit from the same phenomenon - e.g. `Units.HORIZONTAL_DIR_REVOLUTION` instead of `Units.REVOLUTION` for a `Units.HORIZONTAL_DIRECTION` persistence unit. These units cannot be converted across phenomena, so a mismatch will fail to resolve. See [Bearing and Azimuth Format]($docs/quantity-formatting/definitions/Formats.md#bearing-and-azimuth-format) for details.

## Electron 43 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 43](https://www.electronjs.org/blog/electron-43-0).

## @itwin/core-backend

### ChangesetReader.setBatchSize

[ChangesetReader]($backend) now exposes a `setBatchSize(n: number)` method that controls how many change rows are cached in the reader. It is a performance improvement parameter that can be tweaked as per user's choice. Increasing the batch size increases the number of rows read at once and cached in the reader, thereby improving throughput when iterating large changesets but it also increases memory consumption; decreasing it reduces peak memory use. The method must be called before the first [ChangesetReader.step]($backend) call.

Default batch sizes (unchanged behaviour when `setBatchSize` is not called):

| Active configuration | Default |
|---|---|
| `propFilter: InstanceKey` | 100 |
| `propFilter: BisCoreElement` | 20 |
| `propFilter: All`, `abbreviateBlobs: false` | 5 |
| `propFilter: All` (blobs abbreviated or unset) | 10 |

```ts
using reader = ChangesetReader.openFile({ db, fileName: changeset.pathname });
reader.setBatchSize(10);
while (reader.step()) { /* ... */ }
```

**Performance improvement with new caching behaviour in ChangesetReader`**:

| Cache type | Inserts | Before (s) | After (s) | Improvement |
|---|---|---|---|---|
| InMemoryCache | 1,000 | 0.220 | 0.204 | 7.3% |
| InMemoryCache | 10,000 | 2.213 | 1.402 | 36.6% |
| SqliteBackedCache | 1,000 | 0.399 | 0.207 | 48.1% |
| SqliteBackedCache | 10,000 | 3.342 | 1.981 | 40.7% |

## @itwin/core-frontend

### Map-layer security hardening

#### Origin-restricted credentials (opt-in)

Previously, map-layer imagery providers sent credentials with any request they issued: the basic-auth credentials stored in [ImageMapLayerSettings]($common) were attached to every request URL, and an NTLM or Negotiate http 401 challenge from any server triggered a retry with browser credentials included (i.e. SSO / Windows Authentication). Because map-layer URLs may come from user input or from URLs advertised in server capability documents, this could leak credentials to third-party hosts.

Applications can now opt in to origin restrictions via two new `@beta` properties on [MapLayerFormatRegistry]($frontend):

```ts
IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://tiles.corp.example.com"];
```

When `restrictCredentialsToTrustedOrigins` is enabled:

- The basic-auth credentials stored in the layer settings are only attached to requests targeting the origin of the layer's settings URL, or an origin listed in `trustedCredentialsOrigins`.
- SSO retries after an NTLM/Negotiate challenge are only performed for origins explicitly listed in `trustedCredentialsOrigins`. Unlike basic-auth, the settings-URL origin is *not* implicitly trusted for SSO, because SSO shares the user's ambient identity while map-layer URLs may originate from untrusted input.
- Server-provided tooltip content (e.g. WMS `GetFeatureInfo` responses), which may deliberately contain HTML, is rendered as markup only when it comes from the settings-URL origin or an origin listed in `trustedCredentialsOrigins`; text from other origins is escaped and renders literally.

Entries in `trustedCredentialsOrigins` are normalized to their origin (scheme + host + port); invalid entries are ignored and logged.

The default is `false`, preserving the existing behavior. Applications — especially those relying on Kerberos / Windows Authentication for map servers — are encouraged to enable the restriction and whitelist their trusted map-server origins.

#### Blocked-origin notification

When the origin restriction blocks authentication — that is, a request receives an authentication challenge (http 401) that cannot be answered because credentials were withheld for an untrusted origin — the provider's status transitions to the new [MapLayerImageryProviderStatus]($frontend) member `UntrustedOrigin` (`@beta`) and [MapLayerImageryProvider.onStatusChanged]($frontend) is raised. The blocked origins are accumulated in the new `MapLayerImageryProvider.blockedOrigins` (`@beta`) property; the event is raised again each time a new origin is blocked. Note that a request whose credentials were withheld but that succeeds anonymously does not change the status.

Applications can use this to surface the problem to the user, or to prompt for whitelisting:

```ts
provider.onStatusChanged.addListener((p) => {
  if (p.status === MapLayerImageryProviderStatus.UntrustedOrigin)
    console.warn(`Credentials withheld for untrusted origin(s): ${p.blockedOrigins.join(", ")}`);
});
```

[MapLayerImageryProvider.resetStatus]($frontend) clears the accumulated blocked origins, e.g. after the application has updated `trustedCredentialsOrigins`.

#### Attribution text is no longer rendered as HTML

Attribution and copyright strings received from map servers (ArcGIS service metadata, Bing attribution service, Google Maps viewport info, Google Photorealistic 3D Tiles copyrights) were previously rendered using `innerHTML`, allowing a malicious or compromised server to inject markup or script into the viewport's logo cards and on-screen credits. These strings are now inserted as plain text; visual output is unchanged for legitimate attribution text.

The behavior of [IModelApp.makeLogoCard]($frontend) itself is unchanged: string `notice` values may still contain HTML. For untrusted text, use the new `noticeLines` option instead — its string entries are always rendered as plain text (never parsed as HTML) with standard logo-card styling, and an `HTMLElement` entry can be supplied for a line requiring markup.

