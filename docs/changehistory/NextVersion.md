---
publish: false
---

# NextVersion

Table of contents:

- [NextVersion](#nextversion)
  - [Google Maps 2D tiles API](#google-maps-2d-tiles-api)
  - [Deprecated ECSqlStatement](#deprecated-ecsqlstatement)
  - [Deprecated addLogoCards](#deprecated-addlogocards)

## Google Maps 2D tiles API

The `@itwin/map-layers-formats` package now includes an API for consuming Google Maps 2D tiles.

To enable it as a base map, it's simple as:

 ```typescript
import { GoogleMaps } from "@itwin/map-layers-formats";
const ds = IModelApp.viewManager.selectedView.displayStyle;
ds.backgroundMapBase = GoogleMaps.createBaseLayerSettings();
```

Can also be attached as a map-layer:

```ts
[[include:GoogleMaps_AttachMapLayerSimple]]
```

  > ***IMPORTANT***: Make sure to configure your Google Cloud's API key in the `MapLayerOptions` when starting your IModelApp application:

```ts
[[include:GoogleMaps_SetGoogleMapsApiKey]]
```

## Deprecated ECSqlStatement

`ECSqlStatement` is deprecated in 4.11 Use [IModelDb.createQueryReader]($backend) or [ECDb.createQueryReader]($backend)

Following are related classes to ECSqlStatement that are also marked depercated

- `ECEnumValue`
- `ECSqlValue`
- `ECSqlValueIterator`
- `ECSqlColumnInfo`

  In concurrent query `QueryOptions.convertClassIdsToClassNames` & `QueryOptionsBuilder.setConvertClassIdsToNames()` are deprecated. Use ECSQL ec_classname() function to convert class ids to class names.

## Deprecated addLogoCards

- Deprecated synchronous [addLogoCards]($core-frontend)-related APIs in favor of new asynchronous ones:
  - `TileTreeReference.addLogoCard` : use `addAttributions` method instead
  - `MapLayerImageryProvider.addLogoCard` : use `addAttributions` method instead
