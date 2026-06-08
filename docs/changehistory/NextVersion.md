---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Bing Maps imagery is deprecated](#bing-maps-imagery-is-deprecated)
  - [@itwin/map-layers-formats](#itwinmap-layers-formats)
    - [Azure Maps basemap support is available through map-layers-formats](#azure-maps-basemap-support-is-available-through-map-layers-formats)

## @itwin/core-frontend

### Bing Maps imagery is deprecated

Bing Maps imagery-specific APIs are now deprecated. This release does not change runtime behavior, and existing persisted Bing-backed styles continue to load for compatibility.

For new basemap imagery, prefer Azure Maps via `@itwin/map-layers-formats`.

> This imagery-only deprecation does not deprecate `BingLocationProvider` or `BingElevationProvider`, and it does not add a built-in replacement for Bing elevation or location services. Applications that continue using those Bing services must continue supplying `MapLayerOptions.BingMaps`.

## @itwin/map-layers-formats

### Azure Maps basemap support is available through map-layers-formats

`@itwin/map-layers-formats` now registers Azure Maps imagery support through `MapLayersFormats.initialize()` and exposes a beta `AzureMaps` helper for applying Azure Maps Street, Aerial, and Hybrid basemaps.

Applications configure the Azure Maps key when initializing `@itwin/map-layers-formats` with `MapLayersFormats.initialize({ azureMapsOpts: { subscriptionKey: ... } })`. After initializing `@itwin/map-layers-formats`, code that wants Azure-specific basemap helpers can import `AzureMaps` from that package.
