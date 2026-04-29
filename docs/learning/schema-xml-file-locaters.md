# Loading ECSchemas from XML Files

To load [EC Schemas](https://www.itwinjs.org/reference/ecschema-metadata/metadata/schema) from XML files, you need to locate these files on the file system. The Bentley package [@itwin/ecschema-locaters](https://www.itwinjs.org/reference/ecschema-locaters) provides locater classes that implement [ISchemaLocater](https://www.itwinjs.org/reference/ecschema-metadata/context/ischemalocater) to locate schemas in a given [SchemaContext](https://www.itwinjs.org/reference/ecschema-metadata/context/schemacontext).

## Schemas included with core-backend

The [@itwin/core-backend](https://www.itwinjs.org/reference/core-backend) package ships a set of standard EC schemas as part of its native assets, accessible via [KnownLocations.nativeAssetsDir](https://www.itwinjs.org/reference/core-backend/imodelhost/knownlocations). These schemas are organized into subdirectories under `ECSchemas/` (currently: `Standard`, `Dgn`, `Domain`, and `ECDb`):

### Standard schemas (`ECSchemas/Standard`)

These are foundational EC schemas used across many iModel domains:

| Schema | Description |
|--------|-------------|
| `Units` | EC unit definitions |
| `Formats` | EC format definitions |
| `CoreCustomAttributes` | Core EC custom attribute definitions |
| `BisCustomAttributes` | BIS-specific custom attribute definitions |
| `EditorCustomAttributes` | Custom attributes used by editors |
| `SchemaLocalizationCustomAttributes` | Custom attributes for schema localization |
| `SchemaUpgradeCustomAttributes` | Custom attributes for schema upgrades |
| `SIUnitSystemDefaults` | SI unit system default definitions |
| `USCustomaryUnitSystemDefaults` | US customary unit system default definitions |

### BIS core schemas (`ECSchemas/Dgn`)

These schemas form the base of the BIS (Base Infrastructure Schema) hierarchy:

| Schema | Description |
|--------|-------------|
| `BisCore` | Base Infrastructure Schema — the root schema for all iModel data |
| `Generic` | Generic domain schema for common geometric elements |
| `ChangedElements` | Schema for tracking changed elements in iModels |

### Domain schemas (`ECSchemas/Domain`)

These schemas represent standardized EC domains included with core-backend:

| Schema | Description |
|--------|-------------|
| `Analytical` | Analytical domain schema |
| `Functional` | Functional domain schema |
| `LinearReferencing` | Linear Referencing domain schema |
| `PhysicalMaterial` | Physical Material domain schema |
| `PresentationRules` | Presentation Rules schema |

### ECDb schemas (`ECSchemas/ECDb`)

These schemas are used internally by ECDb:

| Schema | Description |
|--------|-------------|
| `ECDbChange` | Schema for ECDb change tracking |
| `ECDbFileInfo` | Schema for ECDb file information |
| `ECDbMap` | Schema for ECDb mapping |
| `ECDbMeta` | Schema for ECDb metadata |
| `ECDbSchemaPolicies` | Schema for ECDb schema policies |

## PublishedSchemaXmlFileLocater

The Bentley provided [@itwin/core-backend](https://www.itwinjs.org/reference/core-backend) package includes a set of standard schema assets accessible at [KnownLocations.nativeAssetsDir](https://www.itwinjs.org/reference/core-backend/imodelhost/knownlocations).

While the [SchemaXmlFileLocater](https://www.itwinjs.org/reference/ecschema-locaters/locaters/schemaxmlfilelocater) can locate schemas along user-defined search paths, it cannot access these standard schemas from the backend package assets. These standard schemas can be loaded using the [PublishedSchemaXmlFileLocater](https://www.itwinjs.org/reference/ecschema-locaters/locaters/publishedschemaxmlfilelocater).

### Constructor

The `PublishedSchemaXmlFileLocater` class takes a single argument: the native assets directory path of the backend package. This directory path can be accessed using the [KnownLocations.nativeAssetsDir](https://www.itwinjs.org/reference/core-backend/imodelhost/knownlocations) getter provided by the core-backend package.

The constructor automatically registers search paths for all schema subdirectories found under `ECSchemas/` in that native assets directory. In current core-backend assets, this includes folders such as `Standard`, `Dgn`, `Domain`, and `ECDb`, making the schemas listed above available without any additional configuration.

### Usage

The primary purpose of `PublishedSchemaXmlFileLocater` is to locate the standard schemas released by the core-backend package, making it a read-only locater. User-defined schemas should always take precedence over standard schemas. Therefore, when a schema context has multiple locaters, the `PublishedSchemaXmlFileLocater` should be added last to the locater list. This ensures that standard schemas are loaded only as a fallback when no user-defined version of the schema can be found.

The [SchemaContext](https://www.itwinjs.org/reference/ecschema-metadata/context/schemacontext) provides a method to achieve this: [addFallbackLocater(locater: ISchemaLocater)](https://www.itwinjs.org/reference/ecschema-metadata/context/schemacontext/addFallbackLocater). This method ensures that the locater remains at the end of the list, regardless of any existing locaters in the context or any new locaters added subsequently. Calling `addFallbackLocater` with the `PublishedSchemaXmlFileLocater` ensures that standard schemas are considered as fallbacks.

> `PublishedSchemaXmlFileLocater` is read-only. Calls to `addSchemaSearchPath` or `addSchemaSearchPaths` are silently ignored. To load schemas from additional directories alongside the standard ones, use a separate `SchemaXmlFileLocater` instance.

### Example

```typescript
import { SchemaContext } from "@itwin/ecschema-metadata";
import { PublishedSchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { KnownLocations } from "@itwin/core-backend";

const schemaContext = new SchemaContext();
const publishedSchemaLocater = new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir);
schemaContext.addFallbackLocater(publishedSchemaLocater);
```

## Handling schemas delivered with core-backend

This section describes the recommended patterns for working with the standard schemas shipped with `@itwin/core-backend`.

### Loading only standard schemas

If you only need to read standard schemas — for example to inspect `BisCore` or resolve `Units` for unit conversion — add `PublishedSchemaXmlFileLocater` as the sole locater:

```typescript
import { SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { PublishedSchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { KnownLocations } from "@itwin/core-backend";

const context = new SchemaContext();
context.addLocater(new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir));

const bisCore = await context.getSchema(new SchemaKey("BisCore"), SchemaMatchType.Latest);
```

### Loading custom schemas that reference standard schemas

The most common pattern is loading your own domain schemas that extend or reference standard BIS schemas. Use a `SchemaXmlFileLocater` for your schemas and add `PublishedSchemaXmlFileLocater` as the fallback so that standard schema references are resolved automatically:

```typescript
import { SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { PublishedSchemaXmlFileLocater, SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { KnownLocations } from "@itwin/core-backend";

const context = new SchemaContext();

// Register your own schema search paths first so they take precedence.
const customLocater = new SchemaXmlFileLocater();
customLocater.addSchemaSearchPath("/path/to/my/schemas");
context.addLocater(customLocater);

// Register standard schemas as a fallback so that BisCore, Units, etc.
// are resolved automatically when your schemas reference them.
context.addFallbackLocater(new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir));

const mySchema = await context.getSchema(new SchemaKey("MyDomainSchema"), SchemaMatchType.Latest);
```

The key points are:
- Add your own locater(s) **before** or via `addLocater` so they are searched first.
- Add `PublishedSchemaXmlFileLocater` via `addFallbackLocater` so it is always searched last. This guarantees your custom schemas override any standard schema of the same name.

### Overriding a standard schema with a custom version

If you need to supply a modified version of a standard schema (for testing or prototyping purposes), place that schema file on a custom search path and register its locater **before** the `PublishedSchemaXmlFileLocater`. Because locaters are searched in registration order, your version will be found first:

```typescript
import { SchemaContext } from "@itwin/ecschema-metadata";
import { PublishedSchemaXmlFileLocater, SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { KnownLocations } from "@itwin/core-backend";

const context = new SchemaContext();

// Custom BisCore override lives in this directory.
const overrideLocater = new SchemaXmlFileLocater();
overrideLocater.addSchemaSearchPath("/CustomSchemas/BisCoreOverride");
context.addLocater(overrideLocater);

// All other standard schemas are still resolved from the published set.
context.addFallbackLocater(new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir));
```
