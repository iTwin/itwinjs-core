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

## Moving properties within an existing ECSchema

ECDb now supports moving properties within the existing class hierarchy. Columns will be remapped or data will be moved to match the new structure.
Inserting a new base class in the middle of the hierarchy which has properties is now also supported.
As this requires data modifications during schema updates, we will no longer support reverse and reinstate on schema changesets. Attempts to do so will now raise an error.
