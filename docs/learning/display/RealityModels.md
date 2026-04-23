# Reality Models

Reality models let an iTwin.js application visualize *captured* real-world conditions - such as reality meshes, point clouds, terrain, and imagery-derived tiles - alongside the modeled contents of an iModel.

Unlike design geometry stored in the iModel, reality data is typically large, externally hosted, and prepared as tiled content for display. As described in [iModel contents guidance](../backend/IModelContents.md#reality-data), the recommended pattern is to keep that captured data separate from the iModel and *mash it up* with the iModel at display time.

## Two ways a view can include reality models

iTwin.js supports two ways to show reality models in a spatial view.

### Context reality models

Context reality models are attached to a [DisplayStyleState]($frontend) rather than loaded through the view's model selector. They are the most direct way to add external reality data to a view or display style.

- Attach them using [DisplayStyleState.attachRealityModel]($frontend).
- Enumerate them using [DisplayStyleState.realityModels]($frontend).
- Configure per-model metadata like `name` and `description` through [ContextRealityModelProps]($common).
- Apply classification, planar clip masks, appearance overrides, and display settings through [ContextRealityModel]($common).

This is generally the best fit when you want to add or remove reality data as view context without representing it as a BIS spatial model.

For a concrete example, see [Google Photorealistic 3D Tiles in iTwin.js](../frontend/GooglePhotorealistic3DTiles.md).

### Persistent reality models

Persistent reality models are stored in the iModel as [SpatialModel]($backend) subclasses like `PointCloudModel`, `RasterModel`, `ScalableMeshModel`, `ThreeMxModel`, and `WebMercatorModel`. They become visible when their model ids are included in the spatial view's model selector.

This approach remains supported, especially for existing data and workflows, but it is the older schema-based pattern. The BIS guidance notes that these "reality modeling" specializations are [not a pattern that we wish to promote or continue](../../bis/guide/physical-perspective/3d-guidance.md#3d-models) for new modeling work.

Use this path primarily when you are working with existing iModels or workflows that already persist reality models as BIS spatial models.

## Shared display behaviors

Both kinds of reality models participate in the same display system and can be combined with design models in the same spatial view. Common capabilities include:

- tile-based rendering in the [display system](./Tiles.md);
- spatial classification;
- planar clip masking; and
- appearance and display-setting overrides.

The APIs differ slightly depending on whether the model is context-attached or persistent, but the rendered result is the same: the reality model contributes tiles to the scene shown by the [Viewport]($frontend).

## Enumerating reality models from a view

If you only need context reality models, use [DisplayStyleState.realityModels]($frontend).

If you need a single iterator covering both context and persistent reality models visible in a view, use [ViewState.getRealityModelTreeRefs]($frontend):

```ts
for (const { treeRef, name, description } of view.getRealityModelTreeRefs()) {
  console.log(name, description, treeRef);
}
```

[ViewState.getRealityModelTreeRefs]($frontend) returns:

- all visible context reality models attached to the display style; and
- persistent reality models whose tile trees have already loaded.

That loaded-tile-tree caveat applies only to persistent models; context reality models can be identified directly from the display style. Persistent tile trees are typically created on demand as the view starts drawing them, so code that needs a complete combined list should wait until those tile trees have loaded.
