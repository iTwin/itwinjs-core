# iModel Transformation and Data Exchange

The `@itwin/core-transformer` package provides some classes that implement [Extract, Transform, and Load](https://en.wikipedia.org/wiki/Extract,_transform,_load) (ETL) functionality:

- [IModelExporter]($transformer) and [IModelExportHandler]($transformer) are the base classes that implement the *extract* (or *export*) part of ETL functionality.
- [IModelTransformer]($transformer) is the base class that implements the *transform* part of ETL functionality.
- [IModelImporter]($transformer) is the base class that implements the *load* (or *import*) part of ETL functionality.

The above classes contain the lower-level functionality required to implement transformation and data exchange services.
These classes should be considered a framework and not confused with the actual packaged and deployed services that use the framework.

## IModelExporter

The [IModelExporter]($transformer) and [IModelExportHandler]($transformer) base classes are used when the **source** data in an ETL workflow is contained within an iModel.

While it is possible to export data from an iModel using the standard [IModelDb]($backend) API, the [IModelExporter]($transformer) and [IModelExportHandler]($transformer) base classes offer the following capabilities:

- An implementation of a [visitor](https://en.wikipedia.org/wiki/Visitor_pattern) pattern that makes it easy to iterate the iModel in a prescribed order that attempts to visit dependencies/prerequisites before dependents.
- Visit the entire iModel using [IModelExporter.exportAll]($transformer)
- Visit only changed entities using [IModelExporter.exportChanges]($transformer)
- Visit a subset of the iModel using [IModelExporter.exportModel]($transformer), [IModelExporter.exportModelContents]($transformer), or [IModelExporter.exportElement]($transformer)
- Easily exclude certain entity types to filter the export content using [IModelExporter.excludeElementsInCategory]($transformer), [IModelExporter.excludeElementClass]($transformer), or [IModelExporter.excludeElementAspectClass]($transformer)
- Integration with [IModelTransformer]($transformer)

Below is an example of using [IModelExporter]($transformer) and [IModelExportHandler]($transformer) to export all [Code]($common) values from an iModel:

```ts
[[include:IModelExporter_CodeExporter.code]]
```

## IModelImporter

The [IModelImporter]($transformer) base class is used when the **target** in an ETL workflow is an iModel.

While it is possible to import data into an iModel using the standard [IModelDb]($backend) API, the [IModelImporter]($transformer) class offers the following capabilities:

- Callbacks whenever IModelImporter is used to insert, update, or delete entities. Simply override one of the protected `onInsert*`, `onUpdate*`, or `onDelete*` methods.
- Automatically compute the [IModel.projectExtents]($common) during import via the [IModelImporter.autoExtendProjectExtents]($transformer) setting.
- The ability to optionally simplify element geometry to optimize visualization workflows via the [IModelImporter.simplifyElementGeometry]($transformer) setting.
- Integration with [IModelTransformer]($transformer)

### IModelImporter.autoExtendProjectExtents

[IModelImporter.autoExtendProjectExtents]($transformer) and [IModelImportOptions.autoExtendProjectExtents]($transformer) provide different options for handling the projectExtents of the target iModel.
See the following for more information about projectExtents:

- [IModel.projectExtents]($common)
- [IModelDb.updateProjectExtents]($backend)
- [IModelDb.computeProjectExtents]($backend)

#### autoExtendProjectExtents = false

This setting should be used when the target iModel projectExtents are being set directly. For example:

- If the target iModel projectExtents will be the same as the source iModel, then it can just be copied over.
- If the target iModel projectExtents are known ahead of time, then it can be directly set.

### autoExtendProjectExtents = true

This setting causes the target iModel projectExtents to be extended to include the range box of **every** element that is imported.
This includes potential *outliers* (one/few elements that are located far away from the main collection of elements).
*Outliers* tend to suggest a user modeling problem or a Connector problem, but it is difficult for a program to know for sure what the intent was.
This setting assumes every Element is there for a reason.

#### autoExtendProjectExtents = { excludeOutliers: true }

This setting causes the projectExtents to be extended to include the range box of every element that is imported **except** for *outliers*.
In this case, *outliers* are assumed to be a mistake and [IModelImporter]($transformer) tries to detect them using *fuzzy logic* from the [IModelDb.computeProjectExtents]($backend) method in order to exclude them from the projectExtents calculation.

Either of the non-false autoExtendProjectExtents options are useful for consolidation cases or filtering cases where the target iModel will have different optimal projectExtents than the source iModel(s).

## IModelCloneContext

The [IModelCloneContext]($backend) class provides the core *cloning* capability required for iModel transformation.
It also maintains the **sourceId --> targetId** mapping which is required to successfully *clone* [Entity]($backend) instances from the source iModel into the target iModel.
iModel entities are highly related to each other. Therefore, *cloning* an entity means copying a *graph* of objects and remapping their source references (Ids) to other target entities.

## IModelTransformer

The [IModelTransformer]($transformer) base class is used when the **source** and **target** in an ETL workflow are both/different iModels and some sort of data transformation is needed in the middle.
An instance of `IModelTransformer` holds instances of `IModelExporter`, `IModelImporter`, and `IModelCloneContext`.
This means that customization is possible at the export stage, the transformation stage, and the import stage of the overall ETL process.

Potential transformations include:

- Cloning - copying an entity from the source and remapping its internal Ids for the target
- Filtering - excluding data from the target that is contained in the source
- Augmenting - generating data during transformation for the target that is not part of the source
- Schema Mapping - mapping classes and properties to a new schema during transformation
- Change Squashing - each iModel has its own change ledger, so multiple changesets from the source could be *squashed* into a single changeset to the target

## Logging

With batch processes like iModel transformation and data exchange, logging is often the only way to figure out what is actually happening.
The following logger categories are provided for use with the [Logger]($bentley):

- [TransformerLoggerCategory.IModelExporter]($transformer)
- [TransformerLoggerCategory.IModelTransformer]($transformer)
- [TransformerLoggerCategory.IModelImporter]($transformer)
