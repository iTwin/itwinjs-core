# Map layers, basemaps, and Azure Maps

Azure Maps setup uses the generic map-layer APIs from `@itwin/core-frontend` and the Azure Maps format support from `@itwin/map-layers-formats`.

Use `@itwin/core-frontend` to start the app and attach ordinary background or overlay layers. Use `@itwin/map-layers-formats` to register Azure Maps support, provide the Azure Maps subscription key, and apply Azure basemaps like Street, Aerial, and Hybrid.

## When to use each package

Use `@itwin/core-frontend` for the generic map imagery workflow:

- start `IModelApp`
- provide generic map-layer credentials at startup
- work with a [Viewport]($frontend), [DisplayStyleState]($frontend), and the standard map-layer APIs
- attach additional background or overlay imagery layers

Use `@itwin/map-layers-formats` for Azure Maps-specific behavior:

- `MapLayersFormats.initialize()` to register optional formats and configure the Azure Maps subscription key
- `AzureMaps.applyBackgroundMap(...)` to apply Azure Maps Street, Aerial, or Hybrid basemaps
- `AzureMaps.getBackgroundMapType(...)` to inspect the active Azure Maps basemap type

## Typical setup order

A typical Azure Maps app does three things in order:

1. Start `IModelApp`.
2. Initialize `@itwin/map-layers-formats` with the Azure Maps subscription key so Azure Maps support is registered.
3. Apply an Azure basemap through the `AzureMaps` helper, and then keep using the normal map-layer APIs for any additional layers.

### 1. Start IModelApp

```ts
[[include:AzureMaps_StartIModelApp]]
```

### 2. Register the optional map-layers-formats package and provide the Azure Maps key

```ts
[[include:AzureMaps_InitializeMapLayersFormats]]
```

This step registers the optional Azure Maps format supplied by `@itwin/map-layers-formats`. The Azure Maps key can also be supplied through the generic `IModelApp.startup({ mapLayerOptions: { AzureMaps: ... } })` credential path, but `azureMapsOpts.subscriptionKey` keeps Azure-specific setup with the package that handles Azure Maps.

## Applying Azure Maps basemaps

After startup and registration, apply Azure basemaps through the extension helper:

### Azure Maps Street

```ts
[[include:AzureMaps_BaseMapStreet]]
```

### Azure Maps Aerial

```ts
[[include:AzureMaps_BaseMapAerial]]
```

### Azure Maps Hybrid

```ts
[[include:AzureMaps_BaseMapHybrid]]
```

Hybrid is exposed as one Azure basemap choice even though its internal composition is provider-specific. Applications should request Hybrid through `AzureMaps.applyBackgroundMap(...)` instead of trying to assemble it manually from catalog rows or raw tile URLs.

## Mixing Azure basemaps with normal map layers

Using Azure Maps for the basemap does **not** replace the normal map-layer APIs. After applying an Azure basemap, continue using the regular `DisplayStyleState.attachMapLayer(...)` workflow for additional layers.

For example, an app can apply an Azure aerial basemap and then attach an ordinary overlay layer on top:

```ts
[[include:AzureMaps_BaseMapWithOverlay]]
```

This is the key interleaving model:

- `AzureMaps.applyBackgroundMap(...)` chooses the basemap.
- Standard map-layer APIs add any extra background or overlay content.

## Inspecting the current Azure basemap type

If your UI needs to stay in sync with the active Azure basemap, use the Azure-specific inspection helper:

```ts
[[include:AzureMaps_InspectBaseMapType]]
```

## Choosing between generic and Azure-specific APIs

As a rule of thumb:

- Use generic core APIs when you are managing views, display styles, and ordinary map layers.
- Use `AzureMaps` from `@itwin/map-layers-formats` when you specifically want Azure Maps basemap behavior.

If your app never uses Azure Maps, it does not need to import Azure-specific helpers at all.

## Before expecting imagery to appear

Even correctly configured map imagery may still not be visible unless:

- the iModel is geolocated; and
- the view or viewport has background maps enabled.

For more on those prerequisites, see [GeoLocation of iModels](../GeoLocation.md) and [Using Views in iTwin.js](./Views.md).

## Related topics

- [The App Frontend](./index.md)
- [Using Views in iTwin.js](./Views.md)
- [GeoLocation of iModels](../GeoLocation.md)
- [The iTwin.js Display System](../display/index.md)
- [@itwin/map-layers-formats]($map-layers-formats)
