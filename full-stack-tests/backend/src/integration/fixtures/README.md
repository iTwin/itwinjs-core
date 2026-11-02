# Vertical CRS Workspace Fixture

`VerticalCrs.itwin-workspace.gz` is a fixed, gzip-compressed SQLite workspace used
by the Vertical CRS resource-unavailability regression. Tests expand and upload it
to Azurite without accessing production services or an internal native build tree.

The workspace contains two vertical definitions, `EGM96 height` (EPSG 5773) and
`WGS84` (EPSG 4326), the horizontal dictionaries needed for `LL84`, and the real
EGM96 geoid grid. No synthetic or null transform substitutes for the grid.

## Provenance

Captured on 2026-10-22 from the public `gcs` container at
`https://geocoord-workspace.itwinjs.org`:

- `base:1.0.8`: the five `.dty` resources below, copied without modification, and
  `VerticalDatumDefinitions.json`, filtered to the two definitions above while
  retaining the dictionary's other top-level fields.
- `allEarth:1.0.8`: `World/WW15MGH._96`, copied without modification. The definition
  references `./World/WW15MGH.GRD`; native grid loading uses the compiled `_96`
  resource, matching the native GeoServices test fixture.

SHA-256 of each uncompressed blob resource:

| Resource | SHA-256 |
| --- | --- |
| `VerticalDatumDefinitions.json` | `e94c1cba30e829ee28bbeaf0c9a23356d7074258f156ec41b7e6f434d54772a8` |
| `coordsys.dty` | `08ed9a1295a57b9370bd49c3bddc8740994dbf8d8756415b634346d51184e492` |
| `datum.dty` | `ccb04bfce526de03e6f166d25c1a4970ac72bdfe4f0e08454ba57a3585f36897` |
| `ellipsoid.dty` | `73d2614e56cb2be38666dc71d2606d28d0b43b8f0690315f490d43fc57c57f68` |
| `GeodeticTransform.dty` | `174c3e13a7c851a9e9f9fde1dfd5bb8fe6eb5315b3c5150687f1a169773ddb0f` |
| `GeodeticPath.dty` | `552c39145650ab4256ff775da5bebf563297a2aec2b7f597301202c97238711d` |
| `World/WW15MGH._96` | `ae6070261edd327f98229c7bd7a543ceed22af862061afab65fdcc50d4c0ccaf` |

The compressed file is 4,350,312 bytes, with SHA-256
`dfdb696cf36e40054882d6b1fc706e681af6d514848418128a968d2a3c20e557`.
It expands to 18,821,120 bytes, with SHA-256
`3305a49544394a28c872c118c8fdd64dc4bc57971b4b4ea5ac4ba6da4c7e5b50`.

## Updating

Fixture updates are deliberate test-data changes, not part of test execution.
Open explicitly versioned source databases using
`IModelHost.appWorkspace.getWorkspaceDb`, read the listed resources using
`getBlob`, and apply the definition filter above. Create a local workspace using
`WorkspaceEditor`, add the seven resources using `addBlob`, close the editor,
and compress the resulting workspace using Node's `gzipSync` at level 9.
Record the source versions and new hashes here, and run the resource regression.
Workspace metadata can change the file hash even when resource hashes match.
