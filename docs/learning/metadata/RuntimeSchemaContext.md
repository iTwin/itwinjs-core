# RuntimeSchemaContext

`RuntimeSchemaContext` is a high-performance, read-only schema metadata cache available in both backend and frontend. It loads a lossy optimized version of schemas from an iModel in a single call and provides synchronous access to schemas, classes, properties, enumerations, kinds of quantity, and relationship constraints.

It lives in `@itwin/core-common` and is the recommended way to access schema metadata at runtime when you need fast, repeated lookups - for example in presentation rules, property grids, or data-driven UI.

## Why not ecschema-metadata?

[ecschema-metadata](./index.md) (`@itwin/ecschema-metadata`) is the full-fidelity schema toolkit. It models every detail of the EC specification - units, formats, constants, phenomena, custom attribute instances, schema references, editing, and round-trip serialization to XML/JSON. It is indispensable for schema authoring, validation, and tooling that needs the complete EC object graph.

That completeness has a cost at runtime:

| | ecschema-metadata | RuntimeSchemaContext |
|---|---|---|
| **Loading** | One async RPC per schema (84 schemas = 84 round-trips) | Single binary blob, one RPC call |
| **Memory** | full object graph with cross-references | flat arrays, string dedup, property dedup, consumes  90-95% less memory |
| **Parse time** | Slow (JSON parse + object construction per schema) | very fast (binary decode into typed arrays) |
| **Loading mechanism** | Synchronously, can lock the backend during large schemas. | Async via QueryReader |
| **Custom attributes** | Always available | Excluded by default |
| **Scope** | Full EC spec | Subset (based on what runtime consumers need) |

**Use RuntimeSchemaContext when** you need fast, synchronous lookups at runtime - property grids, IS-A checks, class navigation, presentation logic.

**Use ecschema-metadata when** you need to author schemas, validate against rules, serialize to XML, or access units/formats/phenomena.

## How does it relate to ECDbMeta ECSQL queries?

The [ECDbMeta](../ECDbMeta.ecschema.md) schema (`meta.ECClassDef`, `meta.ECPropertyDef`, etc.) exposes the same underlying `ec_` tables via ECSQL. You can query individual classes or properties with SQL filters, joins, and projections. This is powerful for targeted lookups - for example, "find all navigation properties pointing at `BisCore:Element`."

`RuntimeSchemaContext` reads the same `ec_` tables, but caches it in one shot into an in-memory structure optimized for traversal.

If you need "give me all classes where property X has extended type Y" - use ECSQL. If you need "walk the property list of this class including inherited properties and check each one" - use `RuntimeSchemaContext`.

At the time of writing, some concepts are not exposed through ECDbMeta, and some iModels may not have updated to its latest version which added CustomAttributes.
Walking all flattenes properties of a class is currently not something that ECDbMeta supports.

## Obtaining the context

The context is obtained from [IModelDb]($backend) (backend) or [IModelConnection]($common) (frontend). The first call builds the cache; subsequent calls return it instantly.

```ts
[[include:RuntimeSchemaContext.obtain]]
```

The context is cached for the lifetime of the connection. Schema changes (via `importSchemas` or pulling changesets with schema changes) automatically invalidate the cache.

## Navigating schemas and classes

All lookups are synchronous and case-insensitive.

```ts
[[include:RuntimeSchemaContext.navigate-schemas]]
```

## Class types and IS-A checks

Classes expose their type (entity, relationship, struct, mixin, custom attribute) and support `is()` for inheritance checks. The `is()` method walks base classes and mixins transitively - the result is cached after the first call.

```ts
[[include:RuntimeSchemaContext.class-type-checks]]
```

## Working with properties

Properties include inherited properties from base classes and mixins, in base-first declaration order. Each property exposes its kind (primitive, struct, array, navigation) and type-specific attributes.

```ts
[[include:RuntimeSchemaContext.properties]]
```

## Relationship constraints

Relationship classes expose source and target constraints, each with an abstract constraint class.

```ts
[[include:RuntimeSchemaContext.relationships]]
```

## Enumerations

Schemas contain enumerations with typed enumerators.

```ts
[[include:RuntimeSchemaContext.enumerations]]
```

## Kind of quantity and property categories

Properties can reference a kind of quantity (KoQ) or a property category.

```ts
[[include:RuntimeSchemaContext.koq-and-categories]]
```

## Exhaustive walk

You can iterate every schema, class, and property in the context efficiently. This is a common pattern for building indexes or validating metadata.

```ts
[[include:RuntimeSchemaContext.exhaustive-walk]]
```

## Presentation-style adapter pattern

`RuntimeSchemaContext` is designed to replace ecschema-metadata in presentation and UI code. Here is a typical adapter pattern:

```ts
[[include:RuntimeSchemaContext.presentation-adapter]]
```

## Sync/async contract

All schema, class, and property access is **synchronous** - the data is fully loaded from the binary blob on first hydration. This is a key difference from ecschema-metadata, where every getter is async.
