# SchemaView

`SchemaView` is a high-performance, read-only schema metadata cache available in both backend and frontend. It loads a lossy optimized version of schemas from an iModel in a single call and provides synchronous access to schemas, classes, properties, enumerations, kinds of quantity, and relationship constraints.

It lives in `@itwin/ecschema-metadata` and is the recommended way to access schema metadata at runtime when you need fast, repeated lookups - for example in presentation rules, property grids, or data-driven UI.

For the binary transport format specification, see [SchemaViewBinaryFormat.md](./SchemaViewBinaryFormat.md).

## Why not SchemaContext?

SchemaContext is from the full-fidelity schema toolkit. It models every detail of the EC specification - units, formats, constants, phenomena, custom attribute instances, schema references, editing, and round-trip serialization to XML/JSON. It is indispensable for schema authoring, validation, and tooling that needs the complete EC object graph.

That completeness has a cost at runtime:

|                       | SchemaContext                                             | SchemaView                                                              |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Loading**           | One async RPC per schema (84 schemas = 84 round-trips)    | Single binary blob, one RPC call                                        |
| **Memory**            | full object graph with cross-references                   | flat arrays, string dedup, property dedup, consumes  90-95% less memory |
| **Parse time**        | Slow (JSON parse + object construction per schema)        | very fast (binary decode into typed arrays)                             |
| **Loading mechanism** | Synchronously, can lock the backend during large schemas. | Async via QueryReader                                                   |
| **Custom attributes** | Always available                                          | Excluded by default                                                     |
| **Scope**             | Full EC spec                                              | Subset (based on what runtime consumers need)                           |

**Use SchemaView when** you need fast, synchronous lookups at runtime - property grids, IS-A checks, class navigation, presentation logic.

**Use SchemaContext when** you need to author schemas, validate against rules, serialize to XML, or access units/formats/phenomena.

## How does it relate to ECDbMeta ECSQL queries?

The [ECDbMeta](../ECDbMeta.ecschema.md) schema (`meta.ECClassDef`, `meta.ECPropertyDef`, etc.) exposes the same underlying `ec_` tables via ECSQL. You can query individual classes or properties with SQL filters, joins, and projections. This is powerful for targeted lookups - for example, "find all navigation properties pointing at `BisCore:Element`."

`SchemaView` reads the same `ec_` tables, but caches it in one shot into an in-memory structure optimized for traversal.

If you need "give me all classes where property X has extended type Y" - use ECSQL. If you need "walk the property list of this class including inherited properties and check each one" - use `SchemaView`.

At the time of writing, some concepts are not exposed through ECDbMeta, and some iModels may not have updated to its latest version which added CustomAttributes.
Walking all flattened properties of a class is currently not something that ECDbMeta supports.

## Obtaining the context

The context is obtained from [IModelDb]($backend) (backend) or [IModelConnection]($frontend) (frontend). The first call builds the cache; subsequent calls return it instantly.

```ts
[[include:SchemaView.obtain]]
```

The context is cached for the lifetime of the connection. Schema changes (via `importSchemas` or pulling changesets with schema changes) automatically invalidate the cache.

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

Presentation format names use schema aliases (e.g. `"f"` for `Formats`, `"u"` for `Units`). The Units and Formats schemas are excluded from `SchemaView` because they will be accessed through a separate dedicated API in the future.

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
  "SELECT NumericSpec, CompositeSpec FROM meta.FormatDef WHERE Name = 'DefaultRealU' AND Schema.Name = 'Formats'",
)) { /* row.numericSpec is a JSON string with FormatProps */ }

// Look up a unit and its unit system
for await (const row of iModel.createQueryReader(
  "SELECT Name, DisplayLabel, UnitSystem.Name FROM meta.UnitDef WHERE Name = 'M' AND Schema.Name = 'Units'",
)) { /* row.name, row.displayLabel, row.unitSystemName */ }

// For composite formats (like AngleDMS with degrees/minutes/seconds), query the composite units:
for await (const row of iModel.createQueryReader(
  `SELECT cu.Ordinal, cu.Unit.Name, cu.Label
   FROM meta.FormatCompositeUnitDef cu
   WHERE cu.Format.Name = 'AngleDMS' AND cu.Format.Schema.Name = 'Formats'
   ORDER BY cu.Ordinal`,
)) { /* row.ordinal, row.unitName, row.label */ }
```

## Views

ECViews (entity classes with a `QueryView` custom attribute) are included in the runtime blob. You can iterate them per schema or look them up by qualified name. Views expose their own properties but do not participate in class inheritance.

```ts
[[include:SchemaView.views]]
```

## Derived classes

You can walk the class hierarchy downward via `derivedClasses`. The reverse map is built lazily on first access.

```ts
[[include:SchemaView.derived-classes]]
```

## Exhaustive walk

You can iterate every schema, class, and property in the context efficiently. This is a common pattern for building indexes or validating metadata.

```ts
[[include:SchemaView.exhaustive-walk]]
```

## Presentation-style adapter pattern

`SchemaView` is designed to replace ecschema-metadata in presentation and UI code. Here is a typical adapter pattern:

```ts
[[include:SchemaView.presentation-adapter]]
```

## Sync/async contract

All schema, class, and property access is **synchronous** - the data is fully loaded from the binary blob on first hydration. This is a key difference from ecschema-metadata, where loading schemas and resolving cross-references requires async calls.

## View objects and allocation

`SchemaView.Schema`, `SchemaView.Class`, `SchemaView.Property`, and the other view types are lightweight wrappers holding only a context reference and an index. They do not cache data and are not identity-stable - calling `element.schema` twice returns two distinct objects that expose the same data. This means `===` comparison will fail; use `name` or `fullName` for equality checks.

Calling `getProperties()` allocates a new `SchemaView.Property` wrapper for each property on every call. For hot loops, consider caching the result in a local variable. The underlying data is shared - only the thin wrapper objects are allocated.

## Excluded schemas and data completeness

`SchemaView` intentionally excludes a select list of schemas: Units, Formats, ECDb-internal schemas (ECDbSystem, ECDbMap, etc.), and pure custom-attribute schemas (CoreCustomAttributes, EditorCustomAttributes, etc.). The full list is defined in the C++ writer's `IsExcludedSchema()` function in `SchemaViewWriter.cpp`.

The rationale for Units/Formats being: We are in the process of decoupling those from schemas. In a yet to be shipped API they will be loaded separately, so this API will already only expose identifiers which will be used to perform the lookup.

Because these schemas are excluded wholesale, cross-references that point into them become unresolvable. The loader handles this as follows:

- **Struct and navigation properties** whose type can't be resolved are **dropped** - they won't appear in the property list at all. This means `structClass` and `relationshipClass` are always valid (non-nullable) on any property you can see.
- **Base classes and mixins** that can't be resolved are silently skipped - `baseClass` returns `undefined`, missing mixins are omitted from the mixin list.
- **Enumerations, categories, and kinds of quantity** that can't be resolved result in `undefined` from the corresponding getter.

A diagnostic warning is logged listing all unresolved references. In practice, the current exclusion list produces very few dangling references because domain schemas rarely have structural dependencies on the excluded infrastructure schemas.
