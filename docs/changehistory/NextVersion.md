---
publish: false
---

# NextVersion

- [@itwin/presentation-common](#itwinpresentation-common)
  - [Additions](#additions)
  - [Fixes](#fixes)
- [@itwin/core-backend](#itwincore-backend)
  - [vacuum API](#vacuum)
  - [analyze API](#analyze)
  - [optimize API](#optimize)

## @itwin/presentation-common

### Additions

- Added `parentArrayField` and `parentStructField` attributes to `PropertiesField` class to allow easier navigation to parent fields when traversing content. The new properties, together with `parent` property, are mutually exclusive, i.e., only one of them can be defined at a time (a field can't be a struct member and an array item field at the same time).
- Added `getFieldByName` method to `ArrayPropertiesField` and `StructPropertiesField`.
  - For array field, the method returns items field if its name matches the given name.
  - For struct field, the method returns the member field with the given name, if any.

### Fixes

- Fixed content traverser (result of `createContentTraverser` call) not passing parent struct / array field names as `parentFieldName` to `IContentVisitor` methods.

## @itwin/core-backend

### Database Optimization APIs

Three new database optimization APIs have been added to maintain optimal query performance and iModel file size.

#### vacuum()

Reclaims unused space and defragments the database file.

```typescript
// After large deletions
briefcaseDb.vacuum();
```

#### analyze()

Updates SQLite query optimizer statistics.

```typescript
// After large data imports or schema changes
briefcaseDb.analyze();
```

#### optimize()

Performs both `vacuum()` and `analyze()` operations in sequence. This is the recommended way to optimize an iModel.

For convenience, optimization can be performed automatically when closing an iModel by using the `optimize` property of the `CloseIModelArgs`:

```typescript
// Automatically optimize when closing
briefcaseDb.close({ optimize: true });
```

Alternatively, call `optimize()` explicitly for more control over when optimization is needed:

```typescript
// Optimize before closing
briefcaseDb.performCheckpoint();  // Changes might still be in the WAL file
briefcaseDb.optimize();
briefcaseDb.saveChanges();

// Later close without re-optimizing
briefcaseDb.close();
```

## Display

### EXT_textureInfo_constant_lod

Support was added for the proposed [EXT_textureInfo_constant_lod](https://github.com/CesiumGS/glTF/pull/92) glTF extension which supports constant level-of-detail texture mapping mode for glTF models. The mode is already supported for iModels, see the [documentation](https://www.itwinjs.org/changehistory/4.0.0/#constant-lod-mapping-mode) from when it was introduced for more information.

iTwin.js supports `EXT_textureInfo_constant_lod` on the `baseColorTexture` property in glTF model materials, with fallback to `emissiveTexture` if `baseColorTexture` is not present. When the extension is present on `normalTexture`, it is only applied when `baseColorTexture` (or `emissiveTexture`) also has the extension, and the constant LOD properties from the base texture are used for both to keep texture mapping in sync.

The extension is not supported for `occlusionTexture` and `metallicRoughnessTexture`.
