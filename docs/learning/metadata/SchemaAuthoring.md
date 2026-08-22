# Schema Authoring with SchemaDocument

`SchemaDocument` is an editable, in-memory representation of a single EC schema, designed for authoring: composing schemas in code, reading them from XML or JSON, editing them, comparing them, and writing them back. It lives in `@itwin/ecschema-metadata` under the `Authoring` namespace and works on both backend and frontend.

> **Status: alpha.** The API described here is released under the `@alpha` tag and may change between minor versions. It is the second evolution of the metadata package, following [SchemaView](./SchemaView.md), and tracks [the Schema Authoring Revision initiative](https://github.com/iTwin/itwinjs-core/issues/9337). Feedback on the issue is welcome.

## What a document is

`SchemaDocument` holds one EC schema as plain, editable data:

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
pump.getExpandedProperties();       // base class first, then mixins, then own
pump.getExpandedProperty("CodeValue");
```

An overridden property appears once, as the overriding declaration, at the overriding class's own position - the order an ECSQL `SELECT *` reflects. Base classes and mixins the set cannot resolve contribute nothing.

### Mixins and views

Two kinds are first-class in the document but not in the file formats, because the formats express them as an entity class carrying a custom attribute:

| Kind | Serializes as | ECJSON |
| --- | --- | --- |
| `Mixin` | entity class + `CoreCustomAttributes:IsMixin` | first-class `Mixin` item |
| `View` | entity class + `ECDbMap:QueryView` | entity class + the attribute |

The readers promote such a class and consume the attribute; the writers put it back. Either way you author against the kind, not the attribute:

```ts
const view = doc.createView("PipeView", `
  SELECT [p].[ECInstanceId], [p].[Length]
    FROM [pipphys].[Pipe] [p]`, { modifier: ECClassModifier.Abstract });
view.createPrimitive("Length", PrimitiveType.Double, { kindOfQuantity: "CivilUnits:LENGTH" });
```

A view's query is ECSQL, kept opaque: stored, compared, and written back exactly as given, never parsed. Declare one property per column the query returns. ECDb additionally requires a view to be abstract, to have no base class, and to have nothing derived from it - the validator reports the first two, and the last only surfaces on import.

## Validating

A document is allowed to be invalid, so checking one is a separate step you invoke when you want it. `validateSchemaDocument` walks one document; `validateSchemaSet` walks every document in a set. Both return the same `SchemaIssueList` the rest of the layer reports through, and neither throws:

```ts
const issues = Authoring.validateSchemaDocument(doc);
if (issues.hasErrors)
  throw new Error(issues.errors.map((issue) => `${issue.location}: ${issue.message}`).join("\n"));
for (const issue of issues.warnings)
  console.warn(`${issue.location}: ${issue.message}`);
```

It covers item references (every one resolves, and to an item of the right kind), names and version components, declarations that collide, inheritance (base class kind, sealed bases, cycles, mixin applicability, a property arriving from two places), property overrides (kind, value type, persistence unit), navigation properties, relationship constraints, custom attributes (the class resolves, is concrete, accepts this kind of container, and the values are ones it declares), and the constraints an iModel import adds on top.

**What is loaded decides what can be checked.** References resolve through the document's schema set, so a schema that is not in the set is reported **once**, as `schema-reference-not-loaded`, and every reference into it is skipped - one unloaded schema costs one issue rather than hundreds. Load the closure first when you want those references checked:

```ts
const resolution = await resolver.resolve([doc]);
await resolution.loadDocuments(doc.schemaSet);
const issues = Authoring.validateSchemaSet(doc.schemaSet);
```

**Match on `issue.name`.** Names are kebab-case and start with the subject they are about, so sorting an issue list groups it by subject: `class-base-sealed`, `entity-mixin-not-applicable`, `property-override-kind-mismatch`, `relationship-constraint-abstract-required`, `custom-attribute-container-not-allowed`, `schema-reference-alias-duplicate`. Where a check exists in one of the published rule catalogs, its number comes along in `issue.code` (`ECObjects-1300`, `ECDb_0299`, `BIS-1700`) so findings can be lined up against the older validators - but the name is the identity, and no new numbers are allocated.

**Severity says whether the schema is invalid.** Errors mean it is; warnings cover everything else, and these fire on healthy schemas:

- An unresolved **unit or format** reference. Units and formats are moving out of schemas into the external units framework, where the same identifier resolves elsewhere, so the schema set not holding it says little.
- A reference to a **deprecated** item, unless the thing referring to it is deprecated too.
- A **schema reference nothing uses**, and a reference with no alias (which ECJSON does not carry - see `fillMissingReferenceAliases`).

**`options.spec`** is the specification version the document is held to; it defaults to `ECSpec.Latest`. Most of the spec's history cannot be represented in a latest-spec document at all, so this only affects the handful of rules that got stricter going up - three-component versions, enumerator names, the strict multiplicity grammar, role labels and abstract constraints. Validating a document read from a 3.0 file against the default therefore tells you what to fix before it can be saved as 3.2, which is usually what you want; pass the older spec when you mean to check it as what it is.

The rule set is the universal one: what the EC specification requires, plus the constraints an ECDb import enforces (tagged with their `ECDb_` codes). BIS conventions are a separate pack and are not applied here.

Validation is one walk over the document, with the inherited-property expansion computed once per class for the whole run, so cost scales with the size of the schema rather than with the number of rules. Validating every released BIS schema at once takes a fraction of a second.

## Reading and writing

Reader/writer pairs exist per format, with one shared contract:

| | Read | Write |
| --- | --- | --- |
| ECXML 2.0, 3.0, 3.1, 3.2 | `SchemaXmlReader` | `SchemaXmlWriter` |
| ECJSON | `SchemaJsonReader` | `SchemaJsonWriter` |

```ts
const set = new Authoring.SchemaSet();
const result = await new Authoring.SchemaXmlReader().readDocument(xmlText, {
  source: "MyDomain.ecschema.xml",
  schemaSet: set,      // leave this out and the document gets a private set of its own
});
for (const issue of result.issues)
  console.warn(`${issue.name}: ${issue.message}`);

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
- **Issue names are stable contract; messages are not.** Match on `issue.name` (e.g. `relationship-source-missing`), never on message text.
- **Spec versions are chosen at the boundary.** `writeDocument(doc, { spec: ECSpec.V3_2 })`; the default is `ECSpec.Latest`. Reading is the other way round - a caller cannot know a file's version before opening it, so `SchemaXmlReader` reads the version out of the namespace and records it on the document. Writing to an older version drops what that version has no way to express, and reports each loss as an issue.
- **Kinds of quantity change shape below 3.2.** That is where `Unit` and `Format` items were introduced, so earlier versions carry legacy FUS descriptors (`CM(real4u)`) instead of references. The readers upgrade them and the writers put them back, and the mapping is lossy in both directions - a precision or unit label with no legacy name does not survive the way down, and a composite format's descriptor unit does not survive the way up. Each loss is reported.

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

## Merging schemas

`mergeSchemaInto` folds an incoming document into a target set. A name the set does not hold is copied in; a name it holds is merged into that document. The incoming document is never touched, and calling it repeatedly with the same set is how you accumulate several schemas into one.

```ts
const result = Authoring.mergeSchemaInto(targetSet, incoming);
for (const rename of result.renames) {
  // { kind: "property", location: "MyDomain:Pump", from: "Serial", to: "Serial_1" }
}
const issues = Authoring.validateSchemaSet(targetSet);
```

The merge **never throws and never refuses**. It produces a document plus a `SchemaIssueList`, and you validate the result and fix what it reports. That is what makes it usable in a pipeline: policy is a separate, inspectable step rather than a set of flags that decide whether the operation happens at all.

What it does:

- **Merge is a union. It never removes.** Items, properties, enumerators, mixins, constraint classes, schema references, and presentation formats from both sides end up in the result.
- **Fields are classified, not case-analysed.** A leaf where both sides hold a differing value is a conflict, and each field has a policy: *identity* fields (a property's type, a unit's definition, an enumerator's value) say the two sides describe different things; *descriptive* fields (label, description, priority) resolve to the target's value and are reported as info.
- **Properties rename on conflict** with a counter suffix (`Serial_1`), reusing an existing name when its declaration is compatible - so merging a third schema that agrees with an earlier rename lands on the same name, and merging the same schema twice changes nothing. Items rename only under `renameItemOnConflict`, because renaming an item breaks references to it from other schemas.
- **Target property order is authoritative**, with incoming-only properties appended.
- **The higher of the two schema versions wins.**

Two hooks override the defaults, both synchronous:

```ts
Authoring.mergeSchemaInto(targetSet, incoming, {
  onConflict: (conflict) => "takeIncoming",       // or "keepTarget" | "rename" | "skip"
  onCustomAttribute: (site) => site.className === "MyDomain:Internal" ? "drop" : undefined,
});
```

A custom attribute merges as one unit keyed by class name - no field-level merge, since a hybrid instance neither side authored is worse than picking a side. `onCustomAttribute` fires for every class on either side of every container, including containers copied wholesale from the incoming schema, so it is also how you strip an attribute off a newly added class.

One limit worth knowing: detecting that an incoming `Pump.Name` collides with an inherited `Element.Name` needs BisCore in the target set. Without it the merge reports `merge-base-class-not-loaded` once and falls back to comparing own properties.

## The issue model

Everything in the authoring layer reports problems the same way: a `SchemaIssueList` of `SchemaIssue` entries, each carrying:

- `severity` - error, warning, or info. Only *errors* indicate the result is incomplete; warnings flag suspicious-but-handled input.
- `group` - which operation reported it: `"xml"`, `"json"`, `"discovery"`, `"ec2-conversion"`, `"comparison"`, `"merge"`, `"validation"`.
- `name` - a stable kebab-case identifier starting with the subject it is about, e.g. `custom-attribute-class-unresolved`. Names are contract; match on them programmatically. Sorting a list of issues by name groups it by subject.
- `message` - human-readable detail. Not contract; may be reworded.
- `location` - where the problem is, when known. Either a source position as `path:line:column`, which the readers produce and terminals turn into a clickable link, or a schema element path such as `MyDomain:Pump.SerialNumber`.
- `code` - the number this check carries in a published rule catalog, where one exists (`ECObjects-1300`, `BIS-601`, `ECDb_0299`). Present only so findings can be matched against the older validators.

There is no throw-on-error helper by design: you inspect the issues and decide what is fatal for *your* workflow, attaching the context you need to any error you raise.

Two places do throw, both about the API rather than about data: moving a document into a set that already holds its name, and reading the values of a custom attribute whose class is not in the set.

## Roadmap

This page grows as the initiative ([#9337](https://github.com/iTwin/itwinjs-core/issues/9337)) lands its increments:

- **Available now**: the document model and its schema set, reference resolution, ECXML (2.0 through 3.2) and ECJSON reader/writer pairs with streaming input, the opt-in EC2 custom attribute conversion, discovery and loading (`SchemaResolver`), reading schemas out of an iModel, comparison, merging, and validation.
- **Rule packs** on top of validation, for conventions such as BIS.
- **Migration and deprecation** of the legacy editing surface (`@itwin/ecschema-editing`, `@itwin/ecschema-locaters`) once consumers have moved.
