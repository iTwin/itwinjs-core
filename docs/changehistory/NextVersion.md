---
publish: false
---
# NextVersion

## Simplified material creation

[RenderSystem.createMaterial]($frontend) presents an awkward API requiring the instantiation of several related objects to create even a simple [RenderMaterial]($common). It also requires an [IModelConnection]($frontend). It has been deprecated in favor of [RenderSystem.createRenderMaterial]($frontend), which accepts a single [CreateRenderMaterialArgs]($frontend) object concisely specifying only the properties of interest to the caller. For example, the following:

```ts
  const params = new RenderMaterial.Params();
  params.alpha = 0.5;
  params.diffuseColor = ColorDef.blue;
  params.diffuseWeight = 0.4;
  params.textureMapping = new TextureMapping(texture, new TextureMapping.Params({ textureWeight: 0.25 }));
  const material = IModelApp.renderSystem.createMaterial(params, iModel);
```

Can now be expressed as follows (note no IModelConnection is required):

```ts
  const material = IModelApp.renderSystem.createRenderMaterial({
    alpha: 0.5,
    diffuse: { color: ColorDef.blue, weight: 0.4 },
    textureMapping: { texture, weight: 0.25 },
  });
```
