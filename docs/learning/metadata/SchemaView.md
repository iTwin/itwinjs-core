# SchemaView

`SchemaView` is a high-performance, read-only schema metadata cache available in both backend and frontend. It loads a curated subset of an iModel's schemas in a single call and provides synchronous access to schemas, classes, properties, enumerations, kinds of quantity, and relationship constraints.

It lives in `@itwin/ecschema-metadata` and should be the first choice for accessing schema metadata at runtime - for example in presentation rules, property grids, or data-driven UI.

For the binary transport format specification, see [SchemaViewBinaryFormat.md](./SchemaViewBinaryFormat.md).

## When to use SchemaView

Use `SchemaView` when you need fast, synchronous, repeated lookups at runtime:

- Property grids and data-driven UI
- IS-A checks and class hierarchy navigation
- Presentation rules and adapter layers
- Iterating properties (including inherited) of a class

Reach for the full-fidelity [SchemaContext]($ecschema-metadata) instead when you are *working with schemas as schemas*: authoring, editing, validating, serializing to XML/JSON, or accessing data that `SchemaView` deliberately omits (see [What is included](#what-is-included)). `SchemaContext` is the more expensive option - one async RPC per schema, full object graph with cross-references, slow to load - so use it when its completeness is what you actually need.

|                       | SchemaView                                                              | SchemaContext                                            |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| **Loading**           | Single binary blob, one RPC call                                        | One async RPC per schema (84 schemas = 84 round-trips)   |
| **Memory**            | Flat arrays, string dedup, property dedup; 90-95% less memory           | Full object graph with cross-references                  |
| **Parse time**        | Very fast (binary decode into typed arrays)                             | Slow (JSON parse + object construction per schema)       |
| **Access**            | Synchronous after one async hydration                                   | Async throughout                                         |
| **Mutability**        | Read-only snapshot                                                      | Mutable; supports editing                                |
| **Scope**             | Curated subset for runtime consumers                                    | Full EC spec                                             |
| **Custom attributes** | Not modeled (selected concepts promoted to first-class - see below)     | All custom attribute instances available                 |

## What is included

`SchemaView` covers what runtime consumers ask for most: schemas, classes (entity, struct, mixin, relationship, custom attribute, view), properties (including inherited, in declaration order), enumerations, kinds of quantity, property categories, and relationship constraints. Class-type checks and downward navigation via `derivedClasses` are also exposed.

A small number of widely-used custom attributes are promoted to first-class concepts on the view objects:

- **Views** - entity classes with the `QueryView` custom attribute are surfaced with `ClassType.View`, iterable via `schema.getClasses(ClassType.View)`.
- **Mixin** - the mixin custom attribute is reflected in `classType` and is included in `applies-to`/`is-a` walks.
- **Hidden** - hidden flags on schemas, classes, and properties are exposed directly (e.g. `schema.isHidden`).

## What is excluded

The exclusion list is deliberate - it trades a small amount of breadth for a large reduction in transport size and load time. The omitted data is not "never needed", just needed rarely enough that pulling it on demand via `SchemaContext` or [ECDbMeta](../ECDbMeta.ecschema.md) ECSQL queries is a better trade-off than carrying it in every runtime cache.

Currently excluded:

- **Custom attribute instances** on schemas, classes, properties, and relationship constraints. Promote what you need to a first-class concept if it becomes widespread (see above).
- **All "standard" schemas** as defined by ECObjects' `ECSchema::IsStandardSchema`. This covers:
  - The EC3 standards: `CoreCustomAttributes`, `Units`, `Formats`, `ECDbMap`, `SchemaLocalizationCustomAttributes`, `EditorCustomAttributes`. `KindOfQuantity` carries only persistence-unit and presentation-format strings; consumers resolve names against the dedicated units/formats APIs (today: `SchemaContext` or ECSQL - see [Resolving format and unit names](#resolving-format-and-unit-names)).
  - Legacy EC2-era schemas: `Bentley_Standard_CustomAttributes`, `Bentley_Standard_Classes`, `Bentley_ECSchemaMap`, `Bentley_Common_Classes`, `Dimension_Schema`, `iip_mdb_customAttributes`, `KindOfQuantity_Schema`, `rdl_customAttributes`, `SIUnitSystemDefaults`, `Unit_Attributes`, `Units_Schema`, `USCustomaryUnitSystemDefaults`. These predate EC3.2 and are not referenced structurally by modern domain schemas.
- **ECDb-internal schemas** beyond the standard list - `ECDbSystem`, `ECDbFileInfo`, `ECDbSchemaPolicies`. These describe storage-layer mapping and are not relevant to runtime consumers. Note that `ECDbMeta` is *not* excluded - it remains queryable via ECSQL.
- **Pure custom-attribute schemas** beyond the standard list - `BisCustomAttributes`, `ECv3ConversionAttributes`, `SchemaUpgradeCustomAttributes`. These contain only `CustomAttribute` and `Struct` definitions used for decoration; since CA instances are not transported, the definitions add little value.

The authoritative logic lives in `IsExcludedSchema()` in `SchemaViewWriter.cpp` (imodel-native), which delegates the standard-schema check to `ECSchema::IsStandardSchema`.

When you do need data from an excluded schema, [SchemaContext]($ecschema-metadata) and ECDbMeta queries remain available. Examples of resolving units and formats are in [Resolving format and unit names](#resolving-format-and-unit-names).

## Obtaining the schema view

The schema view is obtained from [IModelDb]($backend) (backend) or [IModelConnection]($frontend) (frontend). The first call builds the cache; subsequent calls return it instantly.

```ts
[[include:SchemaView.obtain]]
```

The schema view is cached for the lifetime of the connection. Schema changes (via `importSchemas` or pulling changesets with schema changes) automatically invalidate the cache.

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

ECViews (entity classes with a `QueryView` custom attribute) are included in the runtime blob. They show up as classes with `ClassType.View` - use `schema.getClasses(ClassType.View)` to iterate just views, or `findClass(...)` + `isView()` to look one up by qualified name. Views expose their own properties but do not participate in class inheritance.

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

All schema, class, and property access is **synchronous** - the data is fully loaded from the binary blob on first hydration. This is a key difference from ecschema-metadata, where loading schemas and resolving cross-references requires async calls.

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
