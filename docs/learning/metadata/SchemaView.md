# SchemaView

The shape of data in iModels is expressed using [ECSchemas](../../bis/ec/ec-schema.md).
Sometimes, these schemas can grow quite large and complex. It is possible to have a hundred schemas, thousands of classes and hundreds of thousands of properties flat, which expands to millions of properties when you include inherited properties.

When that happens, performance and memory consumption suffer, plus in typescript there is the additional caveat of our metadata library loading the info synchronously, which blocks the backend. A web service may freeze for multiple seconds, which is not acceptable.

`SchemaView` is the first library primarily aimed at memory consumption and performance. It uses a binary blob to fetch exactly the data it needs from the iModel in as few (async) calls as possible, including string and property deduplication. It is read-only and designed for synchronous access to schema metadata that is held in memory for the lifetime of a connection.

It lives in `@itwin/ecschema-metadata` and should be the first choice for accessing schema metadata at runtime - for example in presentation layers, property grids, or data-driven UI.

For the binary transport format specification, see [SchemaViewBinaryFormat.md](./SchemaViewBinaryFormat.md).

`SchemaView` excludes some information like units, formats, and custom attribute instances. For the full, authoritative EC schema model and its interchange formats, see [ECSchema XML](../../bis/ec/ec-schema-xml.md) and [ECSchema JSON](../../bis/ec/ec-schema-json.md). For formats and units, a separate dedicated API is planned for the near future. For custom attributes, a sidecar will be provided alongside SchemaView which allows getting them on demand directly from the iModel.

## When to use SchemaView

Use `SchemaView` when you need fast, synchronous, repeated lookups at runtime without chatty calls into the iModel.

Reach for the full-fidelity [SchemaContext]($ecschema-metadata) instead when you are: authoring, validating, serializing to XML/JSON, or accessing data that `SchemaView` deliberately omits (see [What is included](#what-is-included)). `SchemaContext` is the more expensive option - a full object graph with cross-references - use it when its completeness is what you actually need.

## What is included

`SchemaView` covers what runtime consumers ask for most: schemas, classes (entity, struct, mixin, relationship, custom attribute, view), properties (including inherited, in declaration order), enumerations, kinds of quantity, property categories, and relationship constraints. Class-type checks and downward navigation via `derivedClasses` are also exposed.

A small number of widely-used custom attributes are promoted to first-class concepts on the view objects:

- **Views** - ECViews are surfaced as their own `ClassType.View` (see [Views](#views)).
- **Mixin** - the mixin custom attribute is reflected in `classType` and is included in `applies-to`/`is-a` walks.
- **Hidden** - hidden flags on schemas, classes, and properties are exposed directly (e.g. `schema.isHidden`).

## What is excluded

The exclusion list is a curated set of things we judged to be outside the sweet spot of what runtime consumers usually need. It is not primarily a size optimization - on a typical iModel the excluded data is a small fraction of the schema - it is about keeping the view focused, and keeping out data that has historically caused trouble. Custom attribute instances in particular have been a recurring source of performance problems in the heavier metadata layers: some iModels carry exceptionally large or numerous custom attributes that most apps never look at. Anything omitted is still reachable on demand via `SchemaContext` or [ECDbMeta](../ECDbMeta.ecschema.md) ECSQL queries. At a high level, `SchemaView` omits:

- **Custom attribute instances** - the values, not the classes.
- **"Standard" schemas** - units, formats, core custom attributes, and the EC2-era legacy schemas (as defined by ECObjects' `ECSchema::IsStandardSchema`). `KindOfQuantity` still carries its persistence-unit and presentation-format strings; you resolve those names yourself (see [Resolving format and unit names](#resolving-format-and-unit-names)).
- **ECDb-internal and pure custom-attribute schemas** - storage-mapping schemas and decoration-only schemas whose only value is the CA instances that aren't transported anyway. `ECDbMeta` is *not* excluded - it stays queryable via ECSQL.

For the exact schema names in each category, see [Full list of excluded schemas](#full-list-of-excluded-schemas). The authoritative logic lives in `IsExcludedSchema()` in [SchemaViewWriter](https://github.com/iTwin/imodel-native/blob/main/iModelCore/ECDb/ECDb/SchemaViewWriter.cpp), which delegates the standard-schema check to `ECSchema::IsStandardSchema`.

The list is subject to debate - if a compelling use case emerges for any excluded schema, we will remove it. When you do need data from an excluded schema, [SchemaContext]($ecschema-metadata) and ECDbMeta queries remain available.

## Obtaining the schema view

The schema view is obtained from [IModelDb]($backend) (backend) or [IModelConnection]($frontend) (frontend). The first call builds the cache; subsequent calls return it instantly.

```ts
[[include:SchemaView.obtain]]
```

The schema view is cached for the lifetime of the connection. Schema changes (via `importSchemas` or pulling changesets with schema changes) automatically invalidate the cache.

### Loading only a subset of schemas

By default `getSchemaView()` loads every (non-excluded) schema in the iModel. On a large iModel with many schemas, a consumer that only needs a few - for example a Models tree that starts from `BisCore` - can ask for just those schemas plus their references:

```ts
[[include:SchemaView.obtain-subset]]
```

We use a single accumulating `SchemaView`, so if multiple callers request different subsets, the union of all requested schemas is loaded. If one party loads the whole set, it will be cached for everybody despite what filters they requested. View the option like a "I care about these schemas" rather than "only return these".

The trade-off is: you pay only for the schemas you load, but downward schema navigation (`derivedClasses`) will only reflect what is loaded. Reach for the full view when you need a complete picture, but try to limit the scope when possible.

Additional instructions for backend/frontend developers: We strongly advise against loading the "full" SchemaView automatically on every connection. Try and keep this "on-demand" with limited scope, or else every consumer always pays the cost. That said, on backend, even the worst case scenarios should load in less than a second, asynchronously.

## Navigating schemas and classes

All lookups are synchronous and case-insensitive.

```ts
[[include:SchemaView.navigate-schemas]]
```

## Class types and IS-A checks

Classes expose their type (entity, relationship, struct, mixin, custom attribute, view) and support `is()` for inheritance checks. The `is()` method walks base classes and mixins transitively - the result is cached after the first call. Use `isRelationship()` to narrow to `SchemaView.RelationshipClass` for type-safe access to strength, direction, source, and target constraint fields.

```ts
[[include:SchemaView.class-type-checks]]
```

## Working with properties

Properties include inherited properties from base classes and mixins, in base-first declaration order. Each property exposes its kind (primitive, struct, array, navigation) and type-specific attributes.

```ts
[[include:SchemaView.properties]]
```

## Relationship constraints

Relationship classes expose source and target constraints, each with an abstract constraint class. Use `assertRelationship()` or `isRelationship()` to narrow to `SchemaView.RelationshipClass` before accessing these fields.

```ts
[[include:SchemaView.relationships]]
```

## Enumerations

Schemas contain enumerations with typed enumerators.

```ts
[[include:SchemaView.enumerations]]
```

## Kind of quantity and property categories

Properties can reference a kind of quantity (KoQ) or a property category. KoQs carry presentation format information - `presentationFormats` returns parsed `SchemaView.PresentationFormat` objects with the format name, optional precision override, and optional unit/label overrides. All names are alias-qualified (e.g. `"f:DefaultRealU"`, `"u:M"`).

```ts
[[include:SchemaView.koq-and-categories]]
```

### Resolving format and unit names

Presentation format names use schema aliases (e.g. `"f"` for `Formats`, `"u"` for `Units`). The Units and Formats schemas themselves are excluded from `SchemaView` (see [What is excluded](#what-is-excluded)), so you resolve these names yourself.

> **Pre-EC3.2 iModels:** on the rare iModel still on ECDb profile `4.0.0.1` (predates the 2018 EC3.2 Units/Formats migration), `KindOfQuantity.persistenceUnit` and `presentationFormats` are returned in legacy FUS format and will not parse with the alias-qualified resolution patterns below. The fix is to upgrade the iModel's ECDb profile. See [SchemaViewBinaryFormat - ECDb Profile Compatibility](./SchemaViewBinaryFormat.md#ecdb-profile-compatibility).

If you need the actual format definitions or unit details today, you can resolve the alias-qualified names via **ecschema-metadata** or **ECSQL**:

#### Via ecschema-metadata (SchemaContext)

Split the alias-qualified name at `:` - the left part is the schema alias (e.g. `"f"` -> `"Formats"`, `"u"` -> `"Units"`), the right part is the item name. Look up the schema item via `IModelDb.schemaContext`:

```ts
const fmt = koq.presentationFormats[0]; // { name: "f:DefaultRealU", precision: 2, unitAndLabels: [["u:M", undefined]] }

// Resolve format: "f:DefaultRealU" -> "Formats.DefaultRealU"
const format = iModel.schemaContext.getSchemaItemSync("Formats.DefaultRealU", Format);
// format.precision, format.type, format.formatTraits, etc.

// Resolve unit: "u:M" -> "Units.M"
const unit = iModel.schemaContext.getSchemaItemSync("Units.M", Unit);
// unit.fullName, unit.label, await unit.unitSystem, etc.

// To build a FormatterSpec for quantity formatting, use SchemaUnitProvider:
const unitsProvider = new SchemaUnitProvider(iModel.schemaContext);
const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
```

#### Via ECSQL (ECDbMeta)

Query `meta.FormatDef` for the format's `NumericSpec` (a JSON object with type, precision, traits, etc.) and `meta.UnitDef` for unit details:

```ts
// Look up the base format definition
for await (const row of iModel.createQueryReader(
  `SELECT f.NumericSpec, f.CompositeSpec
   FROM meta.FormatDef f
   JOIN meta.ECSchemaDef s USING meta.SchemaOwnsFormats
   WHERE f.Name = 'DefaultRealU' AND s.Name = 'Formats'`,
)) { /* row.numericSpec is a JSON string with FormatProps */ }

// Look up a unit and its unit system
for await (const row of iModel.createQueryReader(
  `SELECT u.Name, u.DisplayLabel, us.Name AS unitSystemName
   FROM meta.UnitDef u
   JOIN meta.ECSchemaDef s USING meta.SchemaOwnsUnits
   JOIN meta.UnitSystemDef us USING meta.UnitSystemHasUnits
   WHERE u.Name = 'M' AND s.Name = 'Units'`,
)) { /* row.name, row.displayLabel, row.unitSystemName */ }

// For composite formats (like AngleDMS with degrees/minutes/seconds), query the composite units:
for await (const row of iModel.createQueryReader(
  `SELECT cu.Ordinal, u.Name AS unitName, cu.Label
   FROM meta.FormatCompositeUnitDef cu
   JOIN meta.FormatDef f USING meta.FormatOwnsCompositeUnits
   JOIN meta.ECSchemaDef s USING meta.SchemaOwnsFormats
   JOIN meta.UnitDef u USING meta.CompositeUnitRefersToUnit
   WHERE f.Name = 'AngleDMS' AND s.Name = 'Formats'
   ORDER BY cu.Ordinal`,
)) { /* row.ordinal, row.unitName, row.label */ }
```

## Views

ECViews (entity classes with a `QueryView` custom attribute) are included in the SchemaView as their own type distinct from entity classes. They show up as classes with `ClassType.View` - use `schema.getClasses(ClassType.View)` to iterate just views, or `findClass(...)` + `isView()` to look one up by qualified name. Views expose their own properties but do not participate in class inheritance.

```ts
[[include:SchemaView.views]]
```

## Derived classes

You can walk the class hierarchy downward via `derivedClasses`. The reverse map is built lazily on first access.

```ts
[[include:SchemaView.derived-classes]]
```

## Exhaustive walk

You can iterate every schema, class, and property in the schema view efficiently. This is a common pattern for building indexes or validating metadata.

```ts
[[include:SchemaView.exhaustive-walk]]
```

## Presentation-style adapter pattern

`SchemaView` is designed to replace ecschema-metadata in presentation and UI code. Here is a typical adapter pattern:

```ts
[[include:SchemaView.presentation-adapter]]
```

## Sync/async contract

All schema, class, and property access is **synchronous**. `getSchemaView()` is the only asynchronous/IO step - it loads the binary blob once - and every read after that is synchronous. This is a key difference from ecschema-metadata, where loading schemas and resolving cross-references requires async calls and results in unpredictable loading behavior.

## View objects and allocation

`SchemaView.Schema`, `SchemaView.Class`, `SchemaView.Property`, and the other view types are lightweight wrappers holding only a `SchemaView` reference and an index. They do not cache data and are not identity-stable - calling `element.schema` twice returns two distinct objects that expose the same data. This means `===` comparison will fail; use `name` or `fullName` for equality checks.

Calling `getProperties()` allocates a new `SchemaView.Property` wrapper for each property on every call. For hot loops, consider caching the result in a local variable. The underlying data is shared - only the thin wrapper objects are allocated.

## Dangling references

Because some schemas are excluded wholesale (see [What is excluded](#what-is-excluded)), cross-references pointing into them become unresolvable. The loader handles this as follows:

- **Struct and navigation properties** whose type can't be resolved are **dropped** - they won't appear in the property list at all. This means `structClass` and `relationshipClass` are always valid (non-nullable) on any property you can see.
- **Base classes and mixins** that can't be resolved are silently skipped - `baseClass` returns `undefined`, missing mixins are omitted from the mixin list.
- **Enumerations, categories, and kinds of quantity** that can't be resolved result in `undefined` from the corresponding getter.

A diagnostic warning is logged listing all unresolved references. In practice, the current exclusion list produces very few dangling references because domain schemas rarely have structural dependencies on the excluded infrastructure schemas.

<details>
<summary><strong>How does SchemaView differ from ECDbMeta ECSQL queries?</strong></summary>

The [ECDbMeta](../ECDbMeta.ecschema.md) schema (`meta.ECClassDef`, `meta.ECPropertyDef`, etc.) exposes the same underlying `ec_` tables via ECSQL. You can query individual classes or properties with SQL filters, joins, and projections. This is powerful for targeted lookups - for example, "find all navigation properties pointing at `BisCore:Element`."

`SchemaView` reads the same `ec_` tables, but caches the curated subset in one shot into an in-memory structure optimized for traversal.

If you need "give me all classes where property X has extended type Y" - use ECSQL. If you need "walk the property list of this class including inherited properties and check each one" - use `SchemaView`.

At the time of writing, some concepts are not exposed through ECDbMeta, and some iModels may not have updated to its latest version which added CustomAttributes. Walking all flattened properties of a class is currently not something that ECDbMeta supports.

</details>

## Full list of excluded schemas

<details>
<summary><strong>Exact schema names excluded from SchemaView</strong></summary>

- **Custom attribute instances** (all).
- **All "standard" schemas** as defined by ECObjects' `ECSchema::IsStandardSchema`:
  - EC3 standards: `CoreCustomAttributes`, `Units`, `Formats`, `ECDbMap`, `SchemaLocalizationCustomAttributes`, `EditorCustomAttributes`.
  - Legacy EC2-era schemas: `Bentley_Standard_CustomAttributes`, `Bentley_Standard_Classes`, `Bentley_ECSchemaMap`, `Bentley_Common_Classes`, `Dimension_Schema`, `iip_mdb_customAttributes`, `KindOfQuantity_Schema`, `rdl_customAttributes`, `SIUnitSystemDefaults`, `Unit_Attributes`, `Units_Schema`, `USCustomaryUnitSystemDefaults`. These predate EC3.2 and are not referenced structurally by modern domain schemas.
- **ECDb-internal schemas** beyond the standard list - `ECDbSystem`, `ECDbFileInfo`, `ECDbSchemaPolicies`. These describe storage-layer mapping and are not relevant to runtime consumers.
- **Pure custom-attribute schemas** beyond the standard list - `BisCustomAttributes`, `ECv3ConversionAttributes`, `SchemaUpgradeCustomAttributes`. These contain only `CustomAttribute` and `Struct` definitions used for decoration; since CA instances are not transported, the definitions add little value.

</details>

## Schema Localization

To use schema localization for SchemaView items, see [SchemaLocalization.md](./SchemaLocalization.md).
