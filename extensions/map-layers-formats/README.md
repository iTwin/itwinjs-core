# @itwin/map-layers-formats

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/map-layers-formats__ Enables additional map-layers formats in iTwin.js

## List of formats

- ArcGIS Feature service
- Google Maps
- Azure Maps

## Azure Maps basemaps

`@itwin/map-layers-formats` can register Azure Maps support after `IModelApp.startup`:

```ts
await MapLayersFormats.initialize();
```

Provide the Azure Maps subscription key through `IModelApp` startup:

```ts
await IModelApp.startup({
  mapLayerOptions: {
    ["AzureMaps"]: {
      key: "subscription-key",
      value: "abc123",
    },
  },
});
```

Then apply Azure Maps basemaps through the extension API:

```ts
AzureMaps.applyBackgroundMap(viewport.displayStyle, BackgroundMapType.Hybrid);
```
