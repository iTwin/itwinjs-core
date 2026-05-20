# Map layers, basemaps, and Azure Maps

Map imagery in iTwin.js is intentionally split across two layers:

- `@itwin/core-frontend` provides the generic display-style and map-layer APIs used by every app.
- `@itwin/map-layers-formats` provides optional vendor-specific integrations like Azure Maps and Google Maps.

That split can look odd at first because Azure Maps setup touches both packages. The reason is that they have different responsibilities:

- Use `@itwin/core-frontend` to configure generic application startup and to attach background or overlay layers.
- Use `@itwin/map-layers-formats` to register Azure-specific format support and to apply Azure-specific basemap behavior like Street, Aerial, and Hybrid.

## When to use each package

Use `@itwin/core-frontend` for the generic map imagery workflow:

- start `IModelApp`
- provide map-layer credentials at startup
- work with a [Viewport]($frontend), [DisplayStyleState]($frontend), and the standard map-layer APIs
- attach additional background or overlay imagery layers

Use `@itwin/map-layers-formats` when you need vendor-specific behavior that core does not own:

- `MapLayersFormats.initialize()` to register optional formats
- `AzureMaps.applyBackgroundMap(...)` to apply Azure Maps Street, Aerial, or Hybrid basemaps
- `AzureMaps.getBackgroundMapType(...)` to inspect the active Azure Maps basemap type

## Why Azure Maps is not a core frontend basemap provider

This package split is deliberate. `@itwin/core-frontend` owns generic display and map-layer behavior that should work regardless of map provider. Azure Maps-specific URL construction, Hybrid composition behavior, and helper APIs are vendor-specific concerns, so they live in `@itwin/map-layers-formats` instead of becoming first-class core provider semantics.

That lets an application combine:

- generic core APIs for view and layer management; with
- optional extension APIs for Azure-specific behavior.

## Typical setup order

A typical Azure Maps app does three things in order:

1. Start `IModelApp` and provide the Azure Maps key through the generic `mapLayerOptions` startup configuration.
2. Initialize `@itwin/map-layers-formats` so Azure Maps support is registered.
3. Apply an Azure basemap through the `AzureMaps` helper, and then keep using the normal map-layer APIs for any additional layers.

### 1. Provide the Azure Maps key at startup

```ts
[[include:AzureMaps_SetAzureMapsApiKey]]
```

The startup configuration belongs to `@itwin/core-frontend` because `IModelApp` owns application startup and generic map-layer configuration.

### 2. Register the optional map-layers-formats package

```ts
[[include:AzureMaps_InitializeMapLayersFormats]]
```

This step belongs to `@itwin/map-layers-formats` because Azure Maps support is extension-owned, not built into the core frontend package.

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
- [@itwin/map-layers-formats](../../../extensions/map-layers-formats/README.md)
