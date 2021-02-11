---
publish: false
---
# NextVersion

## GPU memory limits

The [RenderGraphic]($frontend)s used to represent a [Tile]($frontend)'s contents consume WebGL resources - chiefly, GPU memory. If the amount of GPU memory consumed exceeds that available, the WebGL context will be lost, causing an error dialog to be displayed and all rendering to cease. The [TileAdmin]($frontend) can now be configured with a strategy for managing the amount of GPU memory consumed and avoiding context loss. Each strategy defines a maximum amount of GPU memory permitted to be allocated to tile graphics; when that limit is exceeded, graphics for tiles that are not currently being displayed by any [Viewport]($frontend) are discarded one by one until the limit is satisfied or no more tiles remain to be discarded. Graphics are discarded in order from least-recently- to most-recently-displayed, and graphics currently being displayed will not be discarded. The available strategies are:

- "default" - a "reasonable" amount of GPU memory can be consumed.
- "aggressive" - a conservative amount of GPU memory can be consumed.
- "relaxed" - a generous amount of GPU memory can be consumed.
- "none" - an unbounded amount of GPU memory can be consumed - no maximum is imposed.

The precise amount of memory permitted by each strategy varies based on whether or not the client is running on a mobile device; see [TileAdmin.mobileGpuMemoryLimits]($frontend) and [TileAdmin.nonMobileGpuMemoryLimits]($frontend) for precise values. The application can also specify an exact amount in number of bytes instead.

The limit defaults to "default" for mobile devices and "none" for non-mobile devices. To configure the limit when calling [IModelApp.startup]($frontend), specify [TileAdmin.Props.gpuMemoryLimits]($frontend). For example:

```ts
  IModelApp.startup({ tileAdmin: TileAdmin.create({ gpuMemoryLimits: "aggressive" }) });
```

Separate limits for mobile and non-mobile devices can be specified at startup if desired; the appropriate limit will be selected based on the type of device the client is running on:

```ts
  IModelApp.startup({ tileAdmin: TileAdmin.create({
    gpuMemoryLimits: {
      mobile: "default",
      nonMobile: "relaxed",
    }),
  });
```

To adjust the limit after startup, assign to [TileAdmin.gpuMemoryLimit]($frontend).

This feature replaces the `@alpha` `TileAdmin.Props.mobileExpirationMemoryThreshold` option.

## Planar clip masks

Planar clip masks provide a two and a half dimensional method for masking the regions where the background map, reality models and BIM geometry overlap. A planar clip mask is described by [PlanarClipMaskProps]($common).A planar clip mask may be applied to a contexual reality model as a [ContextRealityModelProps.planarClipMask]($common) to the background map as [BackgroundMapProps.planarClipMask]($common) or as an override to attached reality models with the [DisplayStyleSettingsProps.planarClipOvr]($common) array of [DisplayStyleRealityModelPlanarClipMaskProps]($common).   The planar clip mask geometry is not required to be planar as the masks will be generated from their projection to the X-Y plane, therefore any 3D model or reality model can be used to generate a planar clip mask.

The [PlanarClipMaskProps.mode]($common) specifies how the mask geometry is collected.  [PlanarClipMaskMode]$(common) includes collection of masks by models, subcategories, elements (included or excluded) or by a priority scheme that clips against other models with a higher priority.

#### By masking a reality model with a BIM model we can display the BIM model without the overlapping reality model

![Building and reality model without mask](./assets/PlanarMask_BuildingNoMask.png)
![Reality model masked by building](./assets/PlanarMask_BuildingMasked.png)

#### By masking the background map terrain with the reality model we can display the current state of the quarry without intrusive terrain

![Quarry and Background Map Terrain without mask](./assets/PlanarMask_QuarryNoMask.png)
![Background Map Terrain masked by quarry reality model](./assets/PlanarMask_QuarryMasked.png)

#### Planar Clip Mask Transparency

Planar clip masks support transparency.  If a mask is not transparent then the masked geometry is omitted completely, if transparency is included then increasing the transparency will decrease the masking and increase a translucent blending of the masked geometry.  A transparency value of 1 would indicate no masking.  If no transparency is included then the transparency value from the mask elements is used.  In the image below a transparent mask is applied to the reality model to show the underground tunnel.

![Planar clip mask with transparency](./assets/PlanarMask_TunnelTransparent.png)

## Common table expression support in ECSQL

CTE are now supported in ECSQL. For more information read [Common Table Expression](..\learning\CommonTableExp.md)

## Breaking API change in quantity package

The alpha interface `ParseResult` has changed to `QuantityParserResult` which can either be a `ParseQuantityError` or a `ParsedQuantity`.
New static type guards `Parser.isParsedQuantity` and `Parser.isParseError` can be used to coerce the result into the appropriate type.
