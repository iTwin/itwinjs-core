# Metadata packages in the iTwin.js Library

## Packages

The metadata packages implement the abstract concepts of EC in typescript [EC overview](../../bis/ec/index.md)
The following packages exist:

- ($ecschema-metadata) is the basic package that exposes metadata objects.
- ($ecschema-editing) Since the basic package only implements an API for understanding schemas, this package adds editing on top of it.
- ($ecschema-locaters) contains classes for locating and loading EC schema files from the file system.
- ($ecschema-rpc) provides a schema RPC interface implementation

## Obtaining metadata from an imodel

An [IModelDb]($backend) owns a [SchemaContext]($ecschema-metadata) which can be used to access all the meta information stored inside of the imodel.

*Example:*

``` ts
[[include:Metadata.entitiesFromIModelDb]]
```

The provided [SchemaMatchType]($ecschema-metadata) specifies what schemas are acceptable, for example if the caller only cares that the returned schema is read compatible with the requested version.

## Working with items
Like schemas are identified by [SchemaKey]($ecschema-metadata), items inside a schema are identified by [SchemaItemKey]($ecschema-metadata).

The methods for getting items inside a schema, like [SchemaContext.getSchemaItem]($ecschema-metadata) or [Schema.getItem]($ecschema-metadata) follow a pattern where you can either get all items, or filter for a specific item type. The latter is done by passing the type of the desired item to the method like with EntityClass in the example in section above.

Supported item types within a schema are:
- [EntityClass]($ecschema-metadata)
- [Mixin]($ecschema-metadata)
- [StructClass]($ecschema-metadata)
- [CustomAttributeClass]($ecschema-metadata)
- [RelationshipClass]($ecschema-metadata)
- [Enumeration]($ecschema-metadata)
- [KindOfQuantity]($ecschema-metadata)
- [PropertyCategory]($ecschema-metadata)
- [Unit]($ecschema-metadata)
- [InvertedUnit]($ecschema-metadata)
- [Constant]($ecschema-metadata)
- [Phenomenon]($ecschema-metadata)
- [UnitSystem]($ecschema-metadata)
- [Format]($ecschema-metadata)

Each of those classes provides a type guard and assertion so general schema items can be checked for the specific type.

```ts
[[include:Metadata.schemaItemTypeGuard]]
```

