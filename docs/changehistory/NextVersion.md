---
publish: false
---
# NextVersion

## Presentation

### Associating content items with given input

Sometimes there's a need to associate content items with given input. For example, when requesting child elements' content based on given parent keys, we may want to know which child element content item is related to which
given parent key. That information has been made available through [Item.inputKeys]($presentation-common) attribute. Because getting this information may be somewhat expensive and is needed only occasionally, it's only set
when content is requested with [ContentFlags.IncludeInputKeys]($presentation-common) flag.

## External textures

The external textures feature is now enabled by default.

Previously, by default the images for textured materials would be embedded in the tile contents. This increased the size of the tile, consumed bandwidth, and imposed other penalties. The external textures feature, however, requires only the Id of the texture element to be included in the tile; the image can then be requested separately. Texture images are cached, so the image need only be requested once no matter how many tiles reference it.

Additionally, if a dimension of the external texture exceeds the client's maximum supported texture size, the image will be downsampled to adhere to that limit before being transmitted to the client.

To disable external textures, pass a `TileAdmin` to [IModelApp.startup]($frontend) with the feature disabled as follows:

```ts
  const tileAdminProps: TileAdmin.Props = { enableExternalTextures: false };
  const tileAdmin = TileAdmin.create(tileAdminProps);
  IModelApp.startup({ tileAdmin });
```

Disabling this feature will incur a performance penalty. The option to disable this feature will likely be removed in the future.
