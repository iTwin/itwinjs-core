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

`SchemaDocument` resolves this by separating two concerns that the old model conflates:

- **The document** is plain, ordered, editable data. No resolved cross-references - references are names (strings). No validity enforcement - a document can hold a half-finished or even contradictory schema, the way a source file can hold code that does not compile. You can build, read, edit, clone, compare, and save it in isolation.
- **Validation** is an explicit, separate step (the *compiler*, in progress - see [Roadmap](#roadmap)) that resolves references and checks the rules when you ask, reporting an inspectable list of problems instead of refusing to load.

## Choosing the right API

| You want to... | Use |
| -------------- | --- |
| Read schema metadata at runtime (property grids, IS-A checks, presentation) | [SchemaView](./SchemaView.md) - fast, synchronous, read-only |
| Compose, load, edit, compare, or serialize a schema | `SchemaDocument` (this page) |
| Workflows not yet covered by the above | [SchemaContext]($ecschema-metadata) / `@itwin/ecschema-editing` - the full resolved graph |

`SchemaDocument` is additive: `SchemaView` remains the read path, and the existing packages stay in place during migration. Longer term, the authoring layer plus `SchemaView` are intended to cover what consumers reach to `SchemaContext` for today.

A `SchemaDocument` differs from the resolved-graph model in ways worth internalizing up front:

- **References are strings.** `"BisCore:PhysicalElement"` is just data - nothing checks that BisCore is loaded, or that the class exists, until you explicitly compile. An item can be referenced by bare local name (`"Pump"`, same schema), full name (`"BisCore:PhysicalElement"` or dot-separated), or alias-qualified form (`"bis:PhysicalElement"`, resolved against the document's reference list).
- **Everything is synchronous** except actual I/O (the readers accept streamed input).
- **Problems are issues, not exceptions.** Readers, writers, and discovery never throw on bad data; they report `SchemaIssue`s (each with a stable `code`, a severity, and a message) alongside a best-effort result. You decide what is fatal.
- **The document always models the latest EC spec.** Readers and writers convert older serialization formats at the boundary; the in-memory model stays canonical.

## Composing a schema in code

Factory methods take the mandatory data as positional arguments and everything optional through an `init` object, and return the created object so you can keep working with it - no re-fetching, no casts:

```ts
import { PrimitiveType, SchemaDocument, SchemaXmlWriter } from "@itwin/ecschema-metadata";

const doc = new SchemaDocument("MyDomain", "mydom", 1, 0, 0, {
  description: "Example domain schema",
  references: [
    { name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" },
    { name: "AecUnits", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "AECU" },
  ],
});
doc.customAttributes.add({ className: "CoreCustomAttributes.DynamicSchema" });

const pump = doc.createEntity("Pump", {
  baseClass: "BisCore:PhysicalElement",
  description: "Pump physical element",
});
pump.createPrimitive("FlowRate", PrimitiveType.Double, {
  kindOfQuantity: "AECU:VOLUMETRIC_FLOW",
});
const serial = pump.createPrimitive("SerialNumber", PrimitiveType.String);
serial.customAttributes.add({ className: "CoreCustomAttributes.HiddenProperty" });

const { text, issues } = new SchemaXmlWriter().writeDocument(doc);
if (issues.hasErrors)
  throw new Error(issues.errors.map((e) => e.message).join("\n"));
// `text` is ECXML 3.2, ready for IModelDb.importSchemaStrings, a file, a test fixture...
```

This is particularly aimed at tests, which today often template raw XML strings: composing the schema in code is about as terse, and considerably easier to parameterize.

## Reading and writing

Reader/writer pairs exist per format, with one shared contract. ECXML and ECJSON 3.2 are covered today:

| | Read | Write |
| --- | --- | --- |
| ECXML 3.x | `SchemaXmlReader` | `SchemaXmlWriter` |
| ECJSON 3.x | `SchemaJsonReader` | `SchemaJsonWriter` |

```ts
import { SchemaJsonWriter, SchemaXmlReader } from "@itwin/ecschema-metadata";

// Read one schema in isolation - no reference graph required.
const result = await new SchemaXmlReader().readDocument(xmlText, { source: "MyDomain.ecschema.xml" });
for (const issue of result.issues)
  console.warn(`${issue.code}: ${issue.message}`);

const doc = result.document; // undefined only if the input was unusable
if (doc) {
  doc.getEntity("Pump")!.getProperty("FlowRate")!.description = "Flow rate of the pump";
  const json = new SchemaJsonWriter().writeDocument(doc).text; // cross-format conversion is just read -> write
}
```

Points of note:

- **Readers are lenient.** A recognizable schema with broken pieces yields a document with the broken pieces skipped and reported as issues - the read-and-repair workflow the old "does not load" behavior made impossible. `result.document` is `undefined` only for unusable input (malformed text, not a schema, unsupported spec version).
- **Writers produce stable output.** The same document always serializes to byte-identical text, so write -> read -> write round-trips exactly - suitable for golden-file tests and clean diffs in version control.
- **Issue codes are stable contract; messages are not.** Match on `issue.code` (e.g. `SchemaXml-0026`), never on message text.
- **Spec versions are chosen at the boundary.** `writeDocument(doc, { spec: ECSpec.V3_2 })`; the default is `ECSpec.Latest`. Readers accept any 3.x input and record the source spec version on the document. Older spec versions (notably EC 2.0 write-back) are planned as sibling reader/writer pairs - see [Roadmap](#roadmap).

### Large inputs and streaming

Schema files can reach hundreds of megabytes. The readers accept `SchemaText`: a plain `string`, UTF-8 `Uint8Array` bytes, or an `AsyncIterable` of either - a Node `fs.createReadStream(path)` satisfies it directly:

```ts
import { createReadStream } from "fs";

const reader = new SchemaXmlReader();
const { document } = await reader.readDocument(createReadStream("Huge.ecschema.xml"), { source: "Huge.ecschema.xml" });
```

When you only need a schema's identity and dependencies, `readHeader` peeks the name, version, alias, and reference list. On streamed XML it stops pulling input as soon as the header is complete, reading only the leading kilobytes of that huge file:

```ts
const { header } = await reader.readHeader(createReadStream("Huge.ecschema.xml"));
// header: { name, readVersion, writeVersion, minorVersion, alias, references }
```

## Discovering and resolving schemas

`SchemaSourceSet` answers "here are my documents, here is where schemas live - what do I need to load, in what order?". Discovery works on headers only; no full document is hydrated until you ask:

```ts
import { InMemorySchemaSource, SchemaSourceSet } from "@itwin/ecschema-metadata";

const source = new InMemorySchemaSource();
source.addDocument(bisCoreDoc); // sources for files / iModels are thin adapters over the same interface

const sources = new SchemaSourceSet();
sources.addSource(source);

const resolution = await sources.resolve([myDoc]); // walk myDoc's reference closure
if (!resolution.isComplete)
  console.warn([...resolution.issues].map((i) => i.message)); // missing schemas, version conflicts, cycles

const documents = await resolution.loadDocuments(); // hydrated in dependency order
```

Two deliberate improvements over the legacy locater model:

- **All sources form one pool, and the highest compatible version wins** - not first-match-wins across an ordered locater list, where "latest" silently depended on registration order.
- **Discovery fully precedes loading.** The resolution lists every schema with provenance (`requestedBy`) before anything heavy happens, and conflicts are reported, not silently re-picked.

## Comparing schemas

`compareSchemaDocuments` reports how two documents differ - in one synchronous walk, grouped the way consumers ask: which items were added, removed, or modified, with field-level detail on the modified ones.

```ts
import { compareSchemaDocuments, formatSchemaComparison } from "@itwin/ecschema-metadata";

const comparison = compareSchemaDocuments(before, after);
if (!comparison.areEqual) {
  console.log(formatSchemaComparison(comparison));
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

## Custom attributes

A custom attribute attaches extra information to a piece of metadata. The aim is to treat that information as plain data - the custom attribute class defines its *shape*, but you should not need the class loaded just to read or write the value. The ECInstance XML serialization does not fully allow this: a value cannot be converted between XML and JSON without the class, because the two forms carry the information differently (the [ECSchema XML reference](../../bis/ec/ec-schema-xml.md#relationship-to-ecjson) lists exactly how they differ). The document works around that gap rather than hiding it.

A custom attribute instance is held as its class name plus a value. Because the document has no resolved CA class definition (that arrives at compile), it keeps the value in whichever **raw form** its source produced and converts only when a writer crosses the format boundary:

- **JSON form** - a plain property object (`{ [name]: value }`), the canonical ECJSON shape. This is what the JSON reader produces and what you write when authoring in code.
- **XML form** - the raw ECXML body, exactly as written. This is what the XML reader produces; it is kept verbatim so an XML-sourced CA round-trips back to XML untouched.

`CustomAttribute.format` says which form a value is in; the matching `json` or `xml` accessor returns it, and the *other* accessor throws - reading the wrong side can only mean a conversion was skipped:

```ts
const ca = entity.customAttributes.add({ className: "BisCore:ClassHasHandler", json: { Restrictions: ["Clone"] } });
ca.format;     // Authoring.CustomAttributeFormat.Json
ca.json;       // { Restrictions: ["Clone"] }
// ca.xml;     // throws - this value is held as JSON, not XML
```

Writing to the **same** format the value came from is a passthrough - no interpretation, exact bytes. Writing to the **other** format runs the conversion, which is where the XML/JSON custom-attribute gap lives:

- **Most values convert without the CA class** - scalars (with type recovery for booleans and canonical numbers), primitive arrays, structs, and multi-entry struct arrays.
- **Two shapes genuinely need the CA class**, because one format carries information the other does not. Going XML -> JSON, a *single-entry* struct array is lexically identical to a struct, so without the class it is read as a struct. Going JSON -> XML, a struct array's entry element name (its struct class) is absent from canonical JSON and cannot be invented.
- When such a value is met and no class is available, **the custom attribute is dropped and an error is reported** - the rest of the document is still written. Supply a resolved [SchemaView](./SchemaView.md) through `writeDocument(doc, { schemaView })` to convert these faithfully: the writer looks up the CA class to disambiguate the struct array and to name its entry elements.

> Because of this, **always check `issues.hasErrors` before trusting writer output.** An error means something was dropped (typically a struct-array custom attribute that needed a CA class no `schemaView` supplied), not that nothing was produced. The conversion logic - and the full matrix of what is recoverable without the class - lives in one place, `CustomAttributeConverter`.

## The issue model

Everything in the authoring layer reports problems the same way: a `SchemaIssueList` of `SchemaIssue` entries, each carrying:

- `severity` - error, warning, or info. Only *errors* indicate the result is incomplete; warnings flag suspicious-but-handled input.
- `code` - a stable identifier, e.g. `SchemaXml-0026` ("relationship missing its Source constraint"). Codes are contract; match on them programmatically.
- `message` - human-readable detail. Not contract; may be reworded.
- `source` / `location` / `line` / `column` - where the problem was found, where the input form provides it.

There is no throw-on-error helper by design: you inspect the issues and decide what is fatal for *your* workflow, attaching the context you need to any error you raise.

## Roadmap

This page grows as the initiative ([#9337](https://github.com/iTwin/itwinjs-core/issues/9337)) lands its increments:

- **Available now**: the document model, ECXML/ECJSON 3.2 reader/writer pairs with streaming input, schema discovery (`SchemaSourceSet`), and comparison.
- **Reading schemas from an iModel** into documents.
- **Older spec versions** - reader/writer pairs for EC 2.0 and 3.1, including EC 2.0 write-back (long a gap: today the platform can effectively only emit 3.2).
- **Compilation** - the explicit validation step: resolve references against sources, validate against the spec and BIS rules, produce a read model (a `SchemaView`) plus diagnostics.
- **Merging** on document data, replacing the resolved-graph comparer/merger.
- **Migration and deprecation** of the legacy editing surface (`@itwin/ecschema-editing`, `@itwin/ecschema-locaters`) once consumers have moved.
