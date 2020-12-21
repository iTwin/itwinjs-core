# iModel Transformation and Data Exchange

The `@bentley/imodeljs-backend` package provides some classes that implement [Extract, Transform, and Load](https://en.wikipedia.org/wiki/Extract,_transform,_load) (ETL) functionality:

- [IModelExporter]($backend) and [IModelExportHandler]($backend) are the base classes that implement the *extract* (or *export*) part of ETL functionality.
- [IModelTransformer]($backend) is the base class that implements the *transform* part of ETL functionality.
- [IModelImporter]($backend) is the base class that implements the *load* (or *import*) part of ETL functionality.

The above classes contain the lower-level functionality required to implement transformation and data exchange services.
These classes should be considered a framework and not confused with the actual packaged and deployed services that use the framework.

## IModelExporter

The [IModelExporter]($backend) and [IModelExportHandler]($backend) base classes are used when the **source** data in an ETL workflow is contained within an iModel.

While it is possible to export data from an iModel using the standard [IModelDb]($backend) API, the [IModelExporter]($backend) and [IModelExportHandler]($backend) base classes offer the following capabilities:

- An implementation of a [visitor](https://en.wikipedia.org/wiki/Visitor_pattern) pattern that makes it easy to iterate the iModel in a prescribed order that attempts to visit dependencies/prerequisites before dependents.
- Visit the entire iModel using [IModelExporter.exportAll]($backend)
- Visit only changed entities using [IModelExporter.exportChanges]($backend)
- Visit a subset of the iModel using [IModelExporter.exportModel]($backend), [IModelExporter.exportModelContents]($backend), or [IModelExporter.exportElement]($backend)
- Easily exclude certain entity types to filter the export content using [IModelExporter.excludeElementCategory]($backend), [IModelExporter.excludeElementClass]($backend), or [IModelExporter.excludeElementAspectClass]($backend)
- Integration with [IModelTransformer]($backend)

Below is an example of using [IModelExporter]($backend) and [IModelExportHandler]($backend) to export all [Code]($common) values from an iModel:

```ts
[[include:IModelExporter_CodeExporter.code]]
```

## IModelImporter

The [IModelImporter]($backend) base class is used when the **target** in an ETL workflow is an iModel.

While it is possible to import data into an iModel using the standard [IModelDb]($backend) API, the [IModelImporter]($backend) class offers the following capabilities:

- Callbacks whenever IModelImporter is used to insert, update, or delete entities. Simply override one of the protected `onInsert*`, `onUpdate*`, or `onDelete*` methods.
- Automatically compute the [IModel.projectExtents]($common) during import via the [IModelImporter.autoExtendProjectExtents]($backend) setting.
- The ability to optionally simplify element geometry to optimize visualization workflows via the [IModelImporter.simplifyElementGeometry]($backend) setting.
- Integration with [IModelTransformer]($backend)

## IModelCloneContext

The [IModelCloneContext]($backend) class provides the core *cloning* capability required for iModel transformation.
It also maintains the **sourceId --> targetId** mapping which is required to successfully *clone* [Entity]($backend) instances from the source iModel into the target iModel.
iModel entities are highly related to each other. Therefore, *cloning* an entity means copying a *graph* of objects and remapping their source references (Ids) to other target entities.

## IModelTransformer

The [IModelTransformer]($backend) base class is used when the **source** and **target** in an ETL workflow are both/different iModels and some sort of data transformation is needed in the middle.
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

- [BackendLoggerCategory.IModelExporter]($backend)
- [BackendLoggerCategory.IModelTransformer]($backend)
- [BackendLoggerCategory.IModelImporter]($backend)
