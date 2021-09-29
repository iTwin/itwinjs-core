# 2.19.0 Change Notes

## Decoration graphics enhancements

### Visible edges

Graphics produced by a [GraphicBuilder]($frontend) can now produce edges for surfaces. By default, edges are only produced for graphics of type [GraphicType.Scene]($frontend), and only if the [Viewport]($frontend)'s [ViewFlags]($common) specify that edges should be displayed. To generate edges for other types of graphics, or to prevent them from being generated, override [GraphicBuilderOptions.generateEdges]($frontend) or [GraphicBuilder.wantEdges]($frontend) when creating the graphic. Note that surfaces will z-fight with their edges to a degree unless the graphic is also pickable - see [GraphicBuilderOptions.pickable]($frontend).

### Solid primitives in decorations

Decoration graphics can now be produced from [SolidPrimitive]($core-geometry)s - e.g., spheres, cones, slabs, swept surfaces, and so on - using [GraphicBuilder.addSolidPrimitive]($frontend).

## Presentation changes

Added `RelatedPropertiesSpecificationNew.skipIfDuplicate` attribute to allow specification to be overriden by specifications from higher priority content modifiers. Set this attribute to all related properties' specifications in the default BisCore ruleset.

## Dictionary enhancements

[Dictionary.keys]($core-bentley) and [Dictionary.values]($core-bentley) enable iteration of the dictionary's keys and values in the same manner as a standard Map.

[Dictionary.findOrInsert]($core-bentley) returns the existing value associated with a key, or - if none yet exists - inserts a new value with that key. It also returns a flag indicating whether or not a new value was inserted. This allows the following code that requires two lookups of the key:

```ts
let value = dictionary.get(key);
let inserted = undefined !== value;
if (undefined === value)
  inserted = dictionary.insert(key, value = newValue);

alert(`${value} was ${inserted ? "inserted" : "already present"}`);
```

To be replaced with a more efficient version that requires only one lookup:

```ts
const result = dictionary.findOrInsert(key, value);
alert(`${result.value} was ${result.inserted ? "inserted" : "already present"}`);
```

## ChangesetIndex vs. ChangesetId

A changeset represents the delta (i.e. the "set of changes") between two points on an iModel's timeline. It can be identified by two means: a [ChangesetId]($common) and a [ChangesetIndex]($common) - every changeset has both once it has been pushed to iModelHub. A `ChangesetId` is a string that is formed from the checksum of the contents of the changeset and its parent `ChangesetId`. A `ChangesetIndex` is a small sequential integer representing the position of the changeset on the iModel's timeline. Later changesets will always have a larger `ChangesetIndex` than earlier changesets. However, it is not possible to compare two `ChangesetId`s and tell anything about their relative position on the timeline.

Much of the `iTwin.js` api that refers to changesets takes a `ChangesetId` as an argument. That is unfortunate, since `ChangesetIndex` is often required to determine order of changesets. Obtaining the `ChangesetIndex` from a `ChangesetId` requires a round-trip to iModelHub. This version begins the process of reworking the api to prefer `ChangesetIndex` as the identifier for changesets. However, for backwards compatibility, the new types [ChangesetIndexAndId]($common) (both values are known) and [ChangesetIdWithIndex]($common) (Id is known, index may be undefined) are used many places. Ultimately only `ChangesetIndex` will be used to identify changesets, and you should prefer it in any new api that identifies changesets.

### Breaking change

 The return type of the methods `BriefcaseDb.pullAndMergeChanges` and [BriefcaseDb.pushChanges]($backend) was changed from a string `ChangesetId` to [ChangesetIndexAndId]($common).

## FederationGuid Policy Change

In previous versions, if you inserted an element with [ElementProps.federationGuid]($common) `undefined`, its value would be `NULL` in the inserted element. In this version, if `federationGuid === undefined`, a new valid Guid will be created for the new element. This is to better facilitate tracking element identity across iModels in `IModelTransformer`.

> Note: if `federationGuid` is a valid Guid, its value will be preserved.

To insert an element with a `NULL` federationGuid, set it to an illegal value (e.g. `Guid.empty`).

```ts
   const elementId = imodel1.elements.insertElement( {
      classFullName: SpatialCategory.classFullName,
      model: IModel.dictionaryId,
      federationGuid: Guid.empty,
      code: SpatialCategory.createCode(imodel1, IModel.dictionaryId, "TestCategory")
   });
```
