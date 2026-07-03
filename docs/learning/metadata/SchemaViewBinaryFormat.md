# Schema View Binary Format

This document specifies the binary blob format produced by `SchemaViewWriter` (C++, imodel-native) and consumed by [SchemaView.fromBinary]($ecschema-metadata) (TypeScript, ecschema-metadata). It is the transport format for `SchemaView` - see [SchemaView](./SchemaView.md) for the consumer API.

This is a **lossy runtime** format and an iTwin.js implementation detail, distinct from the EC schema interchange formats. For the full, authoritative EC schema model and its persistence formats, see [ECSchema XML](../../bis/ec/ec-schema-xml.md) and [ECSchema JSON](../../bis/ec/ec-schema-json.md); this format drops units, formats, and custom attribute instances and is versioned independently of the EC spec.

All multi-byte integers are **little-endian**. String references (SRef) are uint32 indices into the string table at the end of the blob. A SRef of 0 always refers to the empty string.

Foreign-key references to `ec_` table rows use uint32 row IDs. A value of 0 means "no reference" (ec_ IDs are 1-based). A value of 0xFFFFFFFF means "not specified" (used for optional array bounds).

---

## Version History

| Version | Description                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------- |
| 1       | Initial format. Flat count-prefixed tables with string interning and property-def deduplication. The same format also carries [fragments](#fragments-partial-blobs) (a subset of schemas) - a fragment is a content variation, not a format change. |

---

## Version 1

### Header

| Offset | Type   | Field             | Description                                        |
| ------ | ------ | ----------------- | -------------------------------------------------- |
| 0      | uint32 | magic             | `0x43534348` ("CSCH" in ASCII)                     |
| 4      | uint8  | version           | Format version (1)                                 |
| 5      | uint32 | stringTableOffset | Byte offset from start of blob to the string table |

Total header size: **9 bytes**.

### Table Order

After the header, tables appear in this fixed order. Each table begins with a tag byte followed by a uint32 record count.

| Order | Tag              | Hex    | Table                                                          |
| ----- | ---------------- | ------ | -------------------------------------------------------------- |
| 1     | PropertyDefTable | 0x0A   | Deduplicated property definitions                              |
| 2     | SchemaTable      | 0x10   | Schemas                                                        |
| 3     | EnumTable        | 0x20   | Enumerations                                                   |
| 4     | KoQTable         | 0x30   | Kinds of Quantity                                              |
| 5     | PropCatTable     | 0x31   | Property Categories                                            |
| 6     | ClassTable       | 0x40   | Classes (with inline base classes, property refs, constraints) |
| -     | StringTable      | (none) | String table (at `stringTableOffset`)                          |

### PropertyDefTable (tag 0x0A)

Deduplicated property definitions. Multiple classes can reference the same def when all fields match. Properties that differ only in label, priority, or ecInstanceId are still the same def - those per-class fields live in the PropertyRef (see ClassTable).

| Type   | Field | Description                   |
| ------ | ----- | ----------------------------- |
| uint8  | tag   | 0x0A                          |
| uint32 | count | Number of PropertyDef records |

Each PropertyDef record:

| Type   | Field            | Description                                                                        |
| ------ | ---------------- | ---------------------------------------------------------------------------------- |
| uint32 | nameSid          | Property name (SRef)                                                               |
| uint8  | kind             | PropertyKind: 0=Primitive, 1=Struct, 2=PrimitiveArray, 3=StructArray, 4=Navigation |
| uint16 | primitiveType    | EC primitive type (0=None for struct/nav properties)                               |
| uint32 | extTypeSid       | Extended type name (SRef, empty if none)                                           |
| uint32 | enumRowId        | ec_Enumeration.Id (0 = none)                                                       |
| uint32 | structClassRowId | ec_Class.Id of the struct type (0 = none)                                          |
| uint32 | koqRowId         | ec_KindOfQuantity.Id (0 = none)                                                    |
| uint32 | catRowId         | ec_PropertyCategory.Id (0 = none)                                                  |
| uint32 | arrayMinOccurs   | Minimum array size (0xFFFFFFFF = not specified)                                    |
| uint32 | arrayMaxOccurs   | Maximum array size (0xFFFFFFFF = not specified)                                    |
| uint32 | navRelClassRowId | ec_Class.Id of the navigation relationship (0 = none)                              |
| uint8  | navDirection     | Navigation direction (0=Forward, 1=Backward; 0 if not a nav property)              |
| uint8  | isReadonly       | 1 if read-only, 0 otherwise                                                        |
| uint8  | isHidden         | 1 if HiddenProperty CA is present (with Show != true), 0 otherwise                 |
| uint32 | descriptionSid   | Description (SRef)                                                                 |

Record size: **46 bytes** fixed.

### SchemaTable (tag 0x10)

| Type   | Field | Description              |
| ------ | ----- | ------------------------ |
| uint8  | tag   | 0x10                     |
| uint32 | count | Number of schema records |

Each schema record:

| Type   | Field          | Description                                                                 |
| ------ | -------------- | --------------------------------------------------------------------------- |
| uint32 | nameSid        | Schema name (SRef)                                                          |
| uint16 | versionRead    | Read version digit                                                          |
| uint16 | versionWrite   | Write version digit                                                         |
| uint16 | versionMinor   | Minor version digit                                                         |
| uint32 | aliasSid       | Schema alias (SRef)                                                         |
| uint32 | labelSid       | Display label (SRef)                                                        |
| uint32 | descriptionSid | Description (SRef)                                                          |
| uint32 | ecInstanceId   | ec_Schema.Id                                                                |
| uint8  | isHidden       | 1 if the schema has HiddenSchema CA (with ShowClasses != true), 0 otherwise |

Record size: **27 bytes** fixed.

### EnumTable (tag 0x20)

| Type   | Field | Description                   |
| ------ | ----- | ----------------------------- |
| uint8  | tag   | 0x20                          |
| uint32 | count | Number of enumeration records |

Each enumeration record:

| Type   | Field          | Description                             |
| ------ | -------------- | --------------------------------------- |
| uint32 | schemaECId     | ec_Schema.Id of the owning schema       |
| uint32 | nameSid        | Enumeration name (SRef)                 |
| uint16 | primitiveType  | Underlying primitive type               |
| uint8  | isStrict       | 1 if strict, 0 otherwise                |
| uint32 | labelSid       | Display label (SRef)                    |
| uint32 | descriptionSid | Description (SRef)                      |
| uint32 | enumValuesSid  | Enumerator values as JSON string (SRef) |
| uint32 | ecInstanceId   | ec_Enumeration.Id                       |

Record size: **26 bytes** fixed.

The `enumValuesSid` field references a JSON array string stored in the string table. Each element has the shape: `{"Name":"...","IntValue":...,"StringValue":"...","DisplayLabel":"...","Description":"..."}`. The reader is responsible for parsing this JSON to extract individual enumerators.

### KoQTable (tag 0x30)

| Type   | Field | Description           |
| ------ | ----- | --------------------- |
| uint8  | tag   | 0x30                  |
| uint32 | count | Number of KoQ records |

Each KoQ record:

| Type    | Field                  | Description                        |
| ------- | ---------------------- | ---------------------------------- |
| uint32  | schemaECId             | ec_Schema.Id of the owning schema  |
| uint32  | nameSid                | KoQ name (SRef)                    |
| uint32  | labelSid               | Display label (SRef)               |
| uint32  | descriptionSid         | Description (SRef)                 |
| uint32  | persistenceUnitSid     | Persistence unit string (SRef)     |
| float64 | relativeError          | Relative error                     |
| uint32  | presentationFormatsSid | Presentation formats string (SRef) |
| uint32  | ecInstanceId           | ec_KindOfQuantity.Id               |

Record size: **36 bytes** fixed.

### PropCatTable (tag 0x31)

| Type   | Field | Description                         |
| ------ | ----- | ----------------------------------- |
| uint8  | tag   | 0x31                                |
| uint32 | count | Number of property category records |

Each property category record:

| Type   | Field          | Description                       |
| ------ | -------------- | --------------------------------- |
| uint32 | schemaECId     | ec_Schema.Id of the owning schema |
| uint32 | nameSid        | Category name (SRef)              |
| uint32 | labelSid       | Display label (SRef)              |
| uint32 | descriptionSid | Description (SRef)                |
| int32  | priority       | Display priority                  |
| uint32 | ecInstanceId   | ec_PropertyCategory.Id            |

Record size: **24 bytes** fixed.

### ClassTable (tag 0x40)

Classes have variable-length records due to inline count-prefixed sub-items.

| Type   | Field | Description             |
| ------ | ----- | ----------------------- |
| uint8  | tag   | 0x40                    |
| uint32 | count | Number of class records |

Each class record:

| Type   | Field             | Description                                                            |
| ------ | ----------------- | ---------------------------------------------------------------------- |
| uint32 | schemaECId        | ec_Schema.Id of the owning schema                                      |
| uint32 | nameSid           | Class name (SRef)                                                      |
| uint8  | classType         | 0=Entity, 1=Relationship, 2=Struct, 3=CustomAttribute, 4=Mixin, 5=View |
| uint8  | modifier          | 0=None, 1=Abstract, 2=Sealed                                           |
| uint32 | labelSid          | Display label (SRef)                                                   |
| uint32 | descriptionSid    | Description (SRef)                                                     |
| uint8  | strength          | **(Relationship only)** 0=Referencing, 1=Holding, 2=Embedding          |
| uint8  | strengthDirection | **(Relationship only)** 0=Forward, 1=Backward                          |
| uint32 | ecInstanceId      | ec_Class.Id                                                            |
| uint8  | isHidden          | Tri-state: 0 = undefined (no CA), 1 = hidden, 2 = explicitly shown     |

The `strength` and `strengthDirection` fields are **only present when classType == 1** (Relationship). For all other class types they are omitted.

The `isHidden` field encodes the class-level hidden state as a tri-state byte:
- **0 (undefined)**: No `HiddenClass` CA on the class and the owning schema does not hide classes.
- **1 (hidden)**: The class has `HiddenClass(Show != true)`, or the owning schema has `HiddenSchema(ShowClasses != true)` and the class has no explicit override.
- **2 (explicitly shown)**: The class has `HiddenClass(Show = true)`. This overrides schema-level hiding and breaks the base-class inheritance chain for `isEffectivelyHidden`.

#### Base Classes (inline, count-prefixed)

Immediately after the class record header:

| Type   | Field     | Description                  |
| ------ | --------- | ---------------------------- |
| uint16 | baseCount | Number of base class entries |

Each base class entry:

| Type   | Field         | Description                          |
| ------ | ------------- | ------------------------------------ |
| uint32 | schemaNameSid | Schema name of the base class (SRef) |
| uint32 | classNameSid  | Class name of the base class (SRef)  |
| uint8  | ordinal       | Base class ordinal (0-based)         |

#### Property Refs (inline, count-prefixed)

After the base classes:

| Type   | Field     | Description                    |
| ------ | --------- | ------------------------------ |
| uint16 | propCount | Number of property ref entries |

Each property ref entry:

| Type   | Field        | Description                                     |
| ------ | ------------ | ----------------------------------------------- |
| uint32 | defIdx       | Index into the PropertyDefTable                 |
| uint32 | labelSid     | Display label override for this class (SRef)    |
| int32  | priority     | Display priority                                |
| uint32 | ecInstanceId | ec_Property.Id (unique per class-property pair) |

Note: `ecInstanceId` lives on PropertyRef, not PropertyDef, because defs are deduplicated across classes while ec_Property.Id is unique per class-property pair.

#### Relationship Constraints (inline, count-prefixed)

**Only present when classType == 1** (Relationship). After the property refs:

| Type  | Field           | Description                  |
| ----- | --------------- | ---------------------------- |
| uint8 | constraintCount | Number of constraint entries |

Each constraint entry:

| Type   | Field                 | Description                                                    |
| ------ | --------------------- | -------------------------------------------------------------- |
| uint8  | relEnd                | 0=Source, 1=Target                                             |
| uint32 | multiplicityLower     | Lower multiplicity bound                                       |
| uint32 | multiplicityUpper     | Upper multiplicity bound                                       |
| uint8  | isPolymorphic         | 1 if polymorphic, 0 otherwise                                  |
| uint32 | roleLabelSid          | Role label (SRef)                                              |
| uint32 | abstractSchemaNameSid | Schema name of abstract constraint class (SRef, empty if none) |
| uint32 | abstractClassNameSid  | Class name of abstract constraint class (SRef, empty if none)  |

##### Constraint Classes (nested, count-prefixed)

After each constraint entry:

| Type  | Field      | Description                        |
| ----- | ---------- | ---------------------------------- |
| uint8 | classCount | Number of constraint class entries |

Each constraint class entry:

| Type   | Field         | Description        |
| ------ | ------------- | ------------------ |
| uint32 | schemaNameSid | Schema name (SRef) |
| uint32 | classNameSid  | Class name (SRef)  |

### String Table

Located at `stringTableOffset` (from the header). No tag byte.

| Type   | Field | Description       |
| ------ | ----- | ----------------- |
| uint32 | count | Number of strings |

Each string entry:

| Type   | Field  | Description                                                     |
| ------ | ------ | --------------------------------------------------------------- |
| uint32 | length | Byte length of the UTF-8 string (0 for empty)                   |
| bytes  | data   | Raw UTF-8 bytes (no null terminator). Omitted when length == 0. |

Index 0 is always the empty string.

---

## Fragments (partial blobs)

A **fragment** is a blob carrying only a requested subset of the iModel's schemas rather than all of them, so a consumer can load just what it needs (e.g. `BisCore` and its references) instead of hydrating every schema up front. This is what makes incremental loading of a `SchemaView` possible.

A fragment is **not a different format** - it uses the exact same layout described above, byte for byte. "Whole-schema" versus "fragment" is a difference in *which schemas the blob contains*, not in how it is encoded, so there is no format-version distinction and the reader needs no flag in the blob to parse it. What differs is **reference resolution** (see below), and the consumer already knows which kind it is holding because it chose which pragma to call.

No encoding change is needed because the format already addresses every cross-schema reference globally: row-id references carry `ec_` row ids (unique within the iModel) and class references carry schema-name/class-name string pairs. Neither is a blob-local index, so both already point at a row in any blob, whole or partial. The one blob-local index, `defIdx`, never crosses a fragment boundary (see below).

### Producing a fragment

- `PRAGMA schema_view(N)` emits a whole-schema blob: every non-excluded schema in the iModel.
- `PRAGMA schema_view_fragment('name,name,...')` emits a fragment containing exactly the named schemas. The caller passes a dependency-closed set of schema names (computed from the schema reference graph - `meta.ECSchemaDef` + `meta.SchemaHasSchemaReferences`, outside the blob). Names are matched case-insensitively; malformed or unknown names fail the pragma rather than emit a partial blob. The format version is an optional `v<N>;` prefix on the same string (e.g. `'v1;BisCore,Generic'`); omitted means the latest version. Schema names are ECNames, so neither `,` nor `;` can occur in one. See [PRAGMA schema_view_fragment](../ECSqlReference/Pragmas.md#pragma-schema_view_fragment) for the argument grammar and why the version is carried inside the string.

Both pragmas produce identical byte layout; a fragment that happens to contain every schema is byte-for-byte the same as the whole-schema blob.

### Fragment containment (no leakage)

A fragment contains only the rows **owned** by the requested schemas - their classes, properties, enumerations, KoQs, categories, and constraints. It contains **zero** rows owned by a schema that is referenced but not requested. References that cross the fragment boundary use the encodings the format already defines for any cross-schema reference:

- **Row-id references** (`schemaECId`, `structClassRowId`, `enumRowId`, `koqRowId`, `catRowId`, `navRelClassRowId`) carry the target's `ec_` row id. Row ids are unique within the iModel, so they address a row in any blob unambiguously.
- **Name references** (base classes, constraint classes, abstract constraint classes) carry the target's schema-name and class-name string refs.

Neither encoding marks a target as in-fragment versus cross-fragment, and it does not need to - resolution is the consumer's responsibility (see below).

`defIdx` (the PropertyRef index into the PropertyDefTable) is the one **blob-local** index. A class and its deduplicated property definitions always ship in the same blob, so `defIdx` is always resolvable within the blob it came from and never crosses a boundary. A consumer merging fragments must **re-base / re-deduplicate** these defs into its accumulated PropertyDefTable as it applies each fragment: the `defIdx` value is relative to its own blob's table, so the merge step maps it to the corresponding index in the combined table. This is the one place fragment merging needs care.

---

## Excluded Schemas

The writer silently skips schemas that provide no value at runtime. Excluded schemas and all their items (classes, properties, enumerations, etc.) are omitted from the blob. The exclusion is the union of two sets:

**1. All "standard" schemas** as reported by ECObjects' `ECSchema::IsStandardSchema`:

| Group                | Schemas                                                                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EC3 standards        | `CoreCustomAttributes`, `Units`, `Formats`, `ECDbMap`, `SchemaLocalizationCustomAttributes`, `EditorCustomAttributes`                                                                                                                                            |
| Legacy EC2-era       | `Bentley_Standard_CustomAttributes`, `Bentley_Standard_Classes`, `Bentley_ECSchemaMap`, `Bentley_Common_Classes`, `Dimension_Schema`, `iip_mdb_customAttributes`, `KindOfQuantity_Schema`, `rdl_customAttributes`, `SIUnitSystemDefaults`, `Unit_Attributes`, `Units_Schema`, `USCustomaryUnitSystemDefaults` |

**2. ECDb-specific additions** that are not in the standard list:

| Schema                                                              | Reason                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ECDbSystem`, `ECDbFileInfo`, `ECDbSchemaPolicies`                  | ECDb storage-layer internals                                                      |
| `BisCustomAttributes`, `ECv3ConversionAttributes`, `SchemaUpgradeCustomAttributes` | Pure CA schemas - blob has no CA instances, so the definitions add no value     |

Note: **ECDbMeta is NOT excluded** - consumers use it for metadata ECSQL queries.

## What Is Omitted

- **Custom attribute instances** - niche and potentially large; loaded lazily via ECSQL fallback.
- **Schema references** (ec_SchemaReference) - schemas act as flat namespaces in this context.
- **View query strings** - ECSQL is an ECDb implementation detail; consumers only need the view's property shape.
- **Units, Formats, Phenomena, UnitSystems** - referenced only as string names from KoQ fields.

## Cross-Reference Resolution

Row IDs (`schemaECId`, `enumRowId`, `structClassRowId`, etc.) and name-based references (base classes, constraint classes) must be resolved by the reader after parsing. The writer does not scrub references to excluded schemas. The resolution strategy depends on whether the blob is a whole-schema blob or a [fragment](#fragments-partial-blobs) - and the consumer always knows which, because it chose the pragma.

**Whole-schema blob** is self-contained: every non-excluded schema is present, so references resolve against the blob's own row-id and name maps. A reference whose target is absent points at an excluded schema and is dropped gracefully - drop properties with broken structural refs, skip dangling mixin/constraint entries. See the TS reader for the resolution strategy.

**Fragment** is not self-contained: a reference may target a schema carried by another fragment. The consumer applies fragments into one accumulated view and resolves references against the **merged** row-id and name maps spanning every fragment applied so far, not against the single blob. Fragments are applied in dependency order - a fragment is never applied before the schemas it references - so a cross-fragment target is already present when its reference is resolved. A target still absent after the requested closure has been applied points at an *excluded* schema and is dropped, exactly as for a whole-schema blob. Cross-fragment references and excluded-schema references thus share a single resolution path: look the target up in the merged maps, drop on a miss.

Because the byte layout is identical, the reader cannot - and need not - tell a fragment from a whole-schema blob by inspecting it. The caller selects the resolution mode (resolve standalone vs. resolve against accumulated maps) from which pragma it issued.

## ECDb Profile Compatibility

The pragma works against any ECDb profile from `4.0.0.1` onward without requiring an upgrade - all schema tables the writer queries exist in `4.0.0.1`. There is one degradation to be aware of:

- **Profile `4.0.0.1`** (introduced 2017, superseded by `4.0.0.2` in 2018): the EC3.2 Units/Formats migration had not yet run, so `ec_KindOfQuantity.PersistenceUnit` and `PresentationUnits` still contain the legacy FUS (Fuse) format strings. The writer passes those strings through unchanged - `KoQTable.persistenceUnitSid` and `presentationFormatsSid` will reference FUS-format strings rather than the alias-qualified EC3.2 form (`"u:M"`, `"f:DefaultRealU"`). All other tables and fields are unaffected.

In practice any iModel that has been opened by iTwin.js since mid-2018 has already been auto-upgraded to `4.0.0.2` or later. Profile versions `4.0.0.3`, `4.0.0.4`, and `4.0.0.5` made no changes to the `ec_*` tables, so they are equivalent to `4.0.0.2` from the writer's perspective. If a consumer encounters a KoQ string in FUS form, the recommended remediation is to upgrade the iModel's profile.

## Implementation References

- **Writer (C++)**: `iModelCore/ECDb/ECDb/SchemaViewWriter.cpp` / `.h`
- **Reader (TS)**: `core/ecschema-metadata/src/SchemaView/SchemaViewBinaryReader.ts`
- **Pragma handlers**: `PRAGMA schema_view(N)` (whole-schema blob) and `PRAGMA schema_view_fragment('name,name,...')` (fragment - same format, subset of schemas)
