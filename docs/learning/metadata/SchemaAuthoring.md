# Schema Authoring with SchemaDocument

`SchemaDocument` is an editable, in-memory representation of a single EC schema, designed for authoring: composing schemas in code, reading them from XML or JSON, editing them, comparing them, and writing them back. It lives in `@itwin/ecschema-metadata` under the `Authoring` namespace and works on both backend and frontend.

> **Status: alpha.** The API described here is released under the `@alpha` tag and may change between minor versions. It is the second evolution of the metadata package, following [SchemaView](./SchemaView.md), and tracks [the Schema Authoring Revision initiative](https://github.com/iTwin/itwinjs-core/issues/9337). Feedback on the issue is welcome.

## Why a new authoring API

Authoring and editing EC schemas in TypeScript has been harder than it should be. The existing model ([SchemaContext]($ecschema-metadata) plus `@itwin/ecschema-editing`) keeps every schema as part of a fully-resolved, always-valid object graph - an excellent shape for trusted reading, but a poor one for authoring:

- **You cannot work on a schema in isolation.** Editing requires the whole reference graph to be loaded and kept valid through every change. There is no notion of a temporarily-invalid, work-in-progress schema.
- **Editing leans on casts.** Setters on the metadata types are protected; edits beyond what `SchemaContextEditor` exposes require casting to `@internal` `Mutable*` shadow types.
- **Async spreads everywhere.** Cross-references are lazy promises, so `await` appears throughout even when all data is already in hand.
- **Errors are opaque.** A problem anywhere in the graph surfaces as "the schema does not load", not as an inspectable list of problems.

In practice, tests and tooling frequently fell back to hand-editing XML strings rather than use the API.

`SchemaDocument` keeps what a resolved graph is genuinely good for and drops the parts that made editing painful:

- **Ownership is explicit and singular.** A document belongs to one schema set, an item to one document, a property to one class. Nothing is shared, so nothing is ambiguous.
- **References are stored as names and resolved on demand.** No promise graph, no load order, no invalidation.
- **Nothing enforces validity.** A document can hold a half-finished or contradictory schema, the way a source file can hold code that does not compile. Validation is a separate step you invoke when you want it.
- **Everything is synchronous** except actual I/O.

## Choosing the right API

| You want to... | Use |
| -------------- | --- |
| Read schema metadata at runtime (property grids, IS-A checks, presentation) | [SchemaView](./SchemaView.md) - fast, synchronous, read-only |
| Compose, load, edit, compare, or serialize a schema | `SchemaDocument` (this page) |
| Workflows not yet covered by the above | [SchemaContext]($ecschema-metadata) / `@itwin/ecschema-editing` - the full resolved graph |

`SchemaDocument` is additive: `SchemaView` remains the read path, and the existing packages stay in place during migration.

## Every document belongs to exactly one schema set

A `SchemaSet` is a collection of documents that know about each other. It is the scope every reference in those documents resolves against, and it is the authority over their lifetime.

Three rules, and they are the whole model:

1. **A document is always in exactly one set.** `new SchemaDocument(...)` creates a private set holding only that document. There is no detached state.
2. **A set holds one document per schema name**, compared case-insensitively. `BisCore 1.0.0` and `BisCore 1.0.15` cannot both be in one set.
3. **Nothing appears in a set unless you put it there.** No locater, no on-demand loading, no priority chain. If a reference does not resolve, the schema is simply not in the set.

Because a document can only be in one set, there is no `add` - joining a set always means leaving another, so the method says `moveIn`:

```ts
import { Authoring } from "@itwin/ecschema-metadata";

const set = new Authoring.SchemaSet();

// Create a document straight into the set...
const bis = set.createSchema("BisCore", "bis", 1, 0, 15);

// ...or move in one you already have. It leaves the set it was in.
const myDomain = new Authoring.SchemaDocument("MyDomain", "md", 1, 0, 0);
set.moveIn(myDomain);
myDomain.schemaSet === set;   // true

// Take it back out. It lands in a fresh private set of its own, never nowhere.
const detached = set.moveOut("MyDomain");
detached!.schemaSet.size;     // 1

// Sets are iterable and support lookup by name.
for (const document of set)
  console.log(document.name);
set.getSchema("biscore");     // case-insensitive
set.getItem("BisCore:Element");
```

`moveIn` throws when the target set already holds a schema of that name. It will not silently evict the incumbent: call `moveOut` for it first, so eviction is always your decision.

The same ownership rule applies one level down. An item belongs to one document and a property to one class, both from the moment they are constructed:

```ts
const pump = myDomain.createEntity("Pump");    // owned by myDomain
pump.document === myDomain;                    // true
otherDocument.moveItemIn(pump);                // leaves myDomain
myDomain.removeItem("Pump");                   // returns false now - it is gone from here
```

`doc.items` and `class.properties` are read-only for this reason; use the `create*` factories, `moveItemIn` / `movePropertyIn`, and `removeItem` / `removeProperty`.

## Composing a schema in code

Factory methods take the mandatory data as positional arguments and everything optional through an `init` object, and return the created object so you can keep working with it - no re-fetching, no casts:

```ts
import { Authoring, PrimitiveType } from "@itwin/ecschema-metadata";

const doc = new Authoring.SchemaDocument("MyDomain", "mydom", 1, 0, 0, {
  description: "Example domain schema",
  references: [
    { name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" },
    { name: "AecUnits", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "AECU" },
  ],
  customAttributes: [Authoring.CoreCustomAttributes.dynamicSchema()],
});

const pump = doc.createEntity("Pump", {
  baseClass: "BisCore:PhysicalElement",
  description: "Pump physical element",
});
pump.createPrimitive("FlowRate", PrimitiveType.Double, { kindOfQuantity: "AECU:VOLUMETRIC_FLOW" });
const serial = pump.createPrimitive("SerialNumber", PrimitiveType.String);
serial.customAttributes.add(Authoring.CoreCustomAttributes.hiddenProperty());

const { text, issues } = new Authoring.SchemaXmlWriter().writeDocument(doc);
if (issues.hasErrors)
  throw new Error(issues.errors.map((e) => e.message).join("\n"));
// `text` is ECXML 3.2, ready for IModelDb.importSchemaStrings, a file, a test fixture...
```

Every `create*` factory has an equivalent public constructor taking the owner as its first argument - `new Authoring.EntityClass(doc, "Pump", init)` does exactly what `doc.createEntity("Pump", init)` does. The factories read better; the constructors are there for code that builds items generically.

This is particularly aimed at tests, which today often template raw XML strings: composing the schema in code is about as terse, and considerably easier to parameterize.

## Referring to other items

A reference to another item is stored as a plain string: a bare local name (`"Pump"`, an item in this schema), a full name (`"BisCore:PhysicalElement"`, either separator), or an alias-qualified name (`"bis:PhysicalElement"`, resolved through this document's reference list). That is what serializes, and it is what makes composing a document feel like writing a literal.

Every reference field has a sibling getter that resolves it through the schema set:

```ts
pump.baseClass;          // "BisCore:PhysicalElement" - the stored string
pump.getBaseClass();     // Authoring.EntityClass | undefined - resolved through the set

property.kindOfQuantity; property.getKindOfQuantity();
entity.mixins;           entity.getMixins();
constraint.constraintClasses; constraint.getConstraintClasses();
```

A resolve miss returns `undefined` silently - a dangling reference is something validation reports, not something an accessor should decide about. For list-valued references the resolved array is positionally aligned with the stored one, so an entry that did not resolve is `undefined` rather than dropped.

You can also set a reference from the item itself, which is usually what you have:

```ts
pump.setBaseClass(bis.getEntity("PhysicalElement")!);
// pump.baseClass is now "BisCore:PhysicalElement", and MyDomain has gained a
// schema reference to BisCore 1.0.15 if it did not have one.
```

Passing an **item** adds the missing schema reference for you, because the item's document supplies the version and a default alias. Assigning a **string** never does, because a string carries neither. An existing schema reference is never modified, so a version disagreement stays visible to validation instead of being silently rewritten.

### Walking inherited properties

`class.properties` is the class's own declarations. To see what a class actually has, resolved through its base class and mixins:

```ts
pump.getEffectiveProperties();       // base class first, then mixins, then own
pump.getEffectiveProperty("CodeValue");
```

An overridden property appears once, at the position the ancestor introduced it, as the overriding declaration. Base classes and mixins the set cannot resolve contribute nothing.

## Reading and writing

Reader/writer pairs exist per format, with one shared contract. ECXML and ECJSON 3.2 are covered today:

| | Read | Write |
| --- | --- | --- |
| ECXML 3.x | `SchemaXmlReader` | `SchemaXmlWriter` |
| ECJSON 3.x | `SchemaJsonReader` | `SchemaJsonWriter` |

```ts
const set = new Authoring.SchemaSet();
const result = await new Authoring.SchemaXmlReader().readDocument(xmlText, {
  source: "MyDomain.ecschema.xml",
  schemaSet: set,      // leave this out and the document gets a private set of its own
});
for (const issue of result.issues)
  console.warn(`${issue.code}: ${issue.message}`);

const doc = result.document; // undefined only if the input was unusable
if (doc) {
  doc.getEntity("Pump")!.getProperty("FlowRate")!.description = "Flow rate of the pump";
  const json = new Authoring.SchemaJsonWriter().writeDocument(doc).text;
}
```

Points of note:

- **Readers are lenient.** A recognizable schema with broken pieces yields a document with the broken pieces skipped and reported as issues - the read-and-repair workflow the old "does not load" behavior made impossible. `result.document` is `undefined` only for unusable input (malformed text, not a schema, unsupported spec version).
- **Read into a set when you have one.** A document in a set can resolve its references, which is what lets its custom attributes be understood and its inherited properties be walked.
- **Writers produce stable output.** The same document always serializes to byte-identical text, so write -> read -> write round-trips exactly - suitable for golden-file tests and clean diffs in version control.
- **Issue codes are stable contract; messages are not.** Match on `issue.code` (e.g. `SchemaXml-0026`), never on message text.
- **Spec versions are chosen at the boundary.** `writeDocument(doc, { spec: ECSpec.V3_2 })`; the default is `ECSpec.Latest`. Readers accept any 3.x input and record the source spec version on the document. Older spec versions (notably EC 2.0 write-back) are planned as sibling reader/writer pairs.

### Large inputs and streaming

Schema files can reach hundreds of megabytes. The readers accept `SchemaText`: a plain `string`, UTF-8 `Uint8Array` bytes, or an `AsyncIterable` of either - a Node `fs.createReadStream(path)` satisfies it directly:

```ts
import { createReadStream } from "fs";

const reader = new Authoring.SchemaXmlReader();
const { document } = await reader.readDocument(createReadStream("Huge.ecschema.xml"), { source: "Huge.ecschema.xml" });
```

When you only need a schema's identity and dependencies, `readHeader` peeks the name, version, alias, and reference list. On streamed XML it stops pulling input as soon as the header is complete, reading only the leading kilobytes of that huge file:

```ts
const { header } = await reader.readHeader(createReadStream("Huge.ecschema.xml"));
// header: { name, readVersion, writeVersion, minorVersion, alias, references }
```

## Discovering and loading the schemas a document needs

Filling a set by hand works when you know what you need. When you do not, `SchemaResolver` answers "here are my documents, here is where schemas live - what do I need to load, in what order?". It works on headers only; no full document is read until you ask:

```ts
const source = new Authoring.InMemorySchemaSource();
source.addDocument(bisCoreDoc); // sources for files / iModels are thin adapters over the same interface

const resolver = new Authoring.SchemaResolver();
resolver.addSource(source);

const resolution = await resolver.resolve([myDoc]);   // walk myDoc's reference closure
if (!resolution.isComplete)
  console.warn([...resolution.issues].map((i) => i.message)); // missing schemas, version conflicts, cycles

await resolution.loadDocuments(set);   // hydrated into the set, in dependency order
```

Three steps, each doing one thing: a `SchemaSource` says what schemas exist and what each declares about itself, `resolve` turns that into a dependency-ordered plan, `loadDocuments` hydrates the plan into a set. Two deliberate improvements over the legacy locater model:

- **All sources form one pool, and the highest compatible version wins** - not first-match-wins across an ordered locater list, where "latest" silently depended on registration order.
- **Discovery fully precedes loading.** The resolution lists every schema with provenance (`requestedBy`) before anything heavy happens, and conflicts are reported, not silently re-picked.

## Custom attributes

A custom attribute attaches extra information to a piece of metadata, and the aim is to treat that information as plain data. The ECXML serialization works against that aim: it carries no types (every value is text), and it names a struct-array entry after the entry's struct class, which ECJSON does not carry at all. The two formats simply do not hold the same information, so a custom attribute's values can only be understood with its **custom attribute class** in hand.

The document deals with that by **materializing lazily**:

- A custom attribute read from ECXML starts out unmaterialized, holding its body verbatim.
- Reading its values, editing it, or writing the document to any format materializes it against its custom attribute class.
- The class is resolved through the owning document's schema set, falling back to built-in definitions of the standard classes.

```ts
const ca = pump.customAttributes.get("ECDbMap:DbIndexList")!;
ca.isMaterialized;   // false, straight after reading the document from ECXML
ca.values;           // { Indexes: [{ Name: "ix_pump_code", Properties: ["CodeValue"] }] }
ca.isMaterialized;   // true
ca.setValue("Indexes", [...]);
```

`ca.values` **throws** when the custom attribute class cannot be resolved. That is deliberate: the fix is to put the schema defining it in the set, and only you can do that - returning a half-typed bag instead would surface the problem somewhere much harder to diagnose. Where not knowing is legitimate, `ca.tryGetValues()` returns `undefined` instead.

Writers never throw. A custom attribute they cannot materialize is reported as an issue and, when writing back to the format it came from, copied through verbatim - the output stays valid and keeps the data. Writing it to the *other* format is not possible, so it is dropped and an error reported. Check `issues.hasErrors` before trusting writer output.

### The standard classes need nothing loaded

`CoreCustomAttributes` and `ECDbMap` ship with the package as built-in definitions, so reading a `QueryView` query or an `IsMixin` works with an empty schema set. They are a **fallback only**: a class the document's own set resolves always wins, so a schema that upgrades or redefines one of these is never shadowed. A test asserts the built-ins still match the published `@bentley` schema packages.

### Composing them

Typed helpers build the well-known attributes, so the property names and value types are checked when you compile rather than when you serialize:

```ts
pump.customAttributes.add(
  Authoring.CoreCustomAttributes.hiddenClass({ show: false }),
  Authoring.ECDbMap.dbIndexList({
    indexes: [{ name: "ix_pump_serial", properties: ["SerialNumber"], isUnique: true }],
  }),
);
```

Anything else goes in as a literal, which is the same shape the helpers return:

```ts
pump.customAttributes.add({ className: "MyDomain:Reviewed", values: { Reviewer: "rschili", Passed: true } });
```

## Comparing schemas

`compareSchemaDocuments` reports how two documents differ - in one synchronous walk, grouped the way consumers ask: which items were added, removed, or modified, with field-level detail on the modified ones.

```ts
const comparison = Authoring.compareSchemaDocuments(before, after);
if (!comparison.areEqual) {
  console.log(Authoring.formatSchemaComparison(comparison));
  // ~ Pump
  //     label: "Pump" -> "Pumpe"
  //     properties.SerialNumber.priority: 50 -> 60
  // + IMPERIAL
}
for (const item of comparison.itemDifferences) {
  // { name: "Pump", change: "modified", differences: [{ path, left, right }, ...] }
}
```

Comparison is semantic, not textual:

- **Item references compare resolved.** `bis:PhysicalElement` equals `BisCore.PhysicalElement` when `bis` is that document's alias for BisCore - each side resolves through its own reference list.
- **Reference aliases are ignored.** The alias a schema assigns to a reference is ECXML-internal plumbing (it abbreviates names within that one file) and carries no semantic information - ECJSON does not even have it. Consequently, the same schema loaded from XML and from JSON compares **equal**. The schema's *own* alias is part of its identity and does compare.
- **Spec defaults equal absence.** Writing a default explicitly (`modifier="None"`, `polymorphic="true"`, ...) means the same schema as omitting it, and real serializers differ in which convention they follow - so the comparer treats them as equal, while the document itself preserves the distinction for exact round-trips.
- **Order is ignored where it carries no meaning.** Items, properties, enumerators, and custom attributes match by name; constraint classes and mixins compare as sets. Presentation formats stay ordered (the first is the default).

This makes round-trip and migration testing direct: read, write, read back, compare - and on failure, print the exact differences.

## The issue model

Everything in the authoring layer reports problems the same way: a `SchemaIssueList` of `SchemaIssue` entries, each carrying:

- `severity` - error, warning, or info. Only *errors* indicate the result is incomplete; warnings flag suspicious-but-handled input.
- `code` - a stable identifier, e.g. `SchemaXml-0026` ("relationship missing its Source constraint"). Codes are contract; match on them programmatically.
- `message` - human-readable detail. Not contract; may be reworded.
- `source` / `location` / `line` / `column` - where the problem was found, where the input form provides it.

There is no throw-on-error helper by design: you inspect the issues and decide what is fatal for *your* workflow, attaching the context you need to any error you raise.

Two places do throw, both about the API rather than about data: moving a document into a set that already holds its name, and reading the values of a custom attribute whose class is not in the set.

## Roadmap

This page grows as the initiative ([#9337](https://github.com/iTwin/itwinjs-core/issues/9337)) lands its increments:

- **Available now**: the document model and its schema set, reference resolution, ECXML/ECJSON 3.2 reader/writer pairs with streaming input, discovery and loading (`SchemaResolver`), and comparison.
- **Validation** - an explicit pass over one document or a whole set, reporting the same inspectable issues: unresolved references, override compatibility, base-class cycles, plus opt-in rule packs for conventions such as BIS.
- **Views** as a first-class item kind, instead of a hand-assembled `QueryView` custom attribute.
- **Reading schemas from an iModel** into documents.
- **Older spec versions** - reader/writer pairs for EC 2.0 and 3.1, including EC 2.0 write-back (long a gap: today the platform can effectively only emit 3.2).
- **Merging** on document data, replacing the resolved-graph comparer/merger.
- **Migration and deprecation** of the legacy editing surface (`@itwin/ecschema-editing`, `@itwin/ecschema-locaters`) once consumers have moved.
