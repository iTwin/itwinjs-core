# ECSchema JSON

ECSchema JSON is the JSON representation of an [ECSchema](./ec-schema.md). Like [ECSchema XML](./ec-schema-xml.md), it is a persistent interchange format for EC metadata: schemas, classes, properties, relationships, custom attributes, enumerations, quantities, units, and formats. The two formats describe the same EC information model; this page is the JSON counterpart to [ECSchema XML](./ec-schema-xml.md) and links back to it where the two diverge.

This page documents the ECSchema JSON 3.2 shape used by current iTwin schemas. The semantic rules for each EC item are documented on the linked EC pages and enforced by EC schema validation; this page covers the JSON document shape only.

## Two JSON forms

JSON supports two related shapes:

- **ECSchema JSON** - the whole schema in one object, with its items in a name-keyed `items` object. This is the JSON analogue of an ECSchema XML document.
- **SchemaItem JSON** - a single schema item (one class, enumeration, KindOfQuantity, etc.) described on its own, outside its schema. Used to move a single item compactly (for example over the wire) without serializing the whole schema. A SchemaItem JSON object is identical to the in-schema item object, plus four locating properties (`$schema`, `schema`, `schemaVersion`, `name`) that identify the schema it came from. It does not redefine or change the item.

## `$schema` and Version

Every ECSchema JSON document has a required `$schema` property naming the JSON Schema for the spec version. The EC version is parsed from this URL.

```json
{
  "$schema": "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  "name": "Example",
  "version": "01.00.00",
  "alias": "ex"
}
```

| Form | `$schema` URL |
| --- | --- |
| ECSchema JSON (3.2) | `https://dev.bentley.com/json_schemas/ec/32/ecschema` |
| SchemaItem JSON (3.2) | `https://dev.bentley.com/json_schemas/ec/32/schemaitem` |

The version digit in the URL (`/ec/32/`) is the EC/JSON spec version, not the schema version. The `version` property is the schema version in `RR.ww.mm` form described by [ECSchema](./ec-schema.md). (The XML namespace `http://www.bentley.com/schemas/Bentley.ECXML.3.2` is the XML equivalent of `$schema` - see [ECSchema XML](./ec-schema-xml.md#namespace-and-version).)

## Root Object

The root object holds schema-level metadata, references, custom attributes, and the items object.

| Property | Required | JSON type | Description |
| --- | --- | --- | --- |
| `$schema` | Yes | string | JSON Schema URL identifying the spec version. |
| `name` | Yes | string | Schema name and namespace for its items. Must be an [ECName](./ec-name.md). |
| `version` | Yes | string | Schema version in `RR.ww.mm` form. |
| `alias` | Yes | string | Short alias for the schema. |
| `label` | No | string | Localizable display label. |
| `description` | No | string | Localizable description. |
| `references` | No | array | Schema references (see below). |
| `customAttributes` | No | array | Custom attribute instances applied to the schema (see [Custom Attributes](#custom-attributes)). |
| `items` | No | object | Schema items keyed by item name (see below). |

### The `items` object

Schema items are properties of an `items` object, keyed by item name:

```json
"items": {
  "Pump":   { "schemaItemType": "EntityClass", "...": "..." },
  "Tank":   { "schemaItemType": "EntityClass", "...": "..." },
  "Length": { "schemaItemType": "KindOfQuantity", "...": "..." }
}
```

The key is the item name, so an in-schema item object omits the `name`, `schema`, and `schemaVersion` properties (those are implied by the key and the enclosing schema). Item names must be unique across all item kinds in a schema - an entity class and an enumeration cannot share a name. This differs from XML, where each item is an element of a specific kind and ordering is positional; in JSON the items are object members. (See [ECName](./ec-name.md) for naming and uniqueness rules.)

## Schema References

A reference identifies another schema this schema depends on:

```json
"references": [
  { "name": "BisCore", "version": "01.00.25" }
]
```

| Property | Required | JSON type | Description |
| --- | --- | --- | --- |
| `name` | Yes | string | Referenced schema name. |
| `version` | Yes | string | Referenced schema version. |

A JSON reference carries **no alias** - this is a deliberate difference from [ECSchema XML](./ec-schema-xml.md#schema-references), where the reference carries a required `alias`. JSON references items in other schemas by full schema name, not alias (see below), so no per-reference alias is needed.

## Schema Items

Every item object shares these properties:

| Property | Required | JSON type | Description |
| --- | --- | --- | --- |
| `schemaItemType` | Yes | string | Item kind (see values below). |
| `label` | No | string | Localizable display label. |
| `description` | No | string | Localizable description. |

A **SchemaItem JSON** object (an item serialized on its own) additionally carries `$schema` (the schemaitem URL), `schema` (its schema name), `name` (its item name), and optionally `schemaVersion`. In-schema item objects omit all four.

`schemaItemType` values: `EntityClass`, `Mixin`, `StructClass`, `CustomAttributeClass`, `RelationshipClass`, `Enumeration`, `KindOfQuantity`, `PropertyCategory`, `Unit`, `InvertedUnit`, `Constant`, `Phenomenon`, `UnitSystem`, `Format`.

> **References use the full schema name with a `.` separator**, such as `"BisCore.PhysicalElement"` - not the alias-qualified `bis:PhysicalElement` form used in XML. An item in the same schema may be referenced by its bare name. This applies to every cross-reference property below (`baseClass`, `mixins`, `appliesTo`, `typeName`, `relationshipName`, `category`, `kindOfQuantity`, constraint classes, units, phenomena, and so on).

## Classes

The class item kinds are `EntityClass`, `Mixin`, `StructClass`, `CustomAttributeClass`, and `RelationshipClass`. See [ECClass](./ec-class.md), [ECEntityClass](./ec-entity-class.md), [ECMixinClass](./ec-mixin-class.md), [ECStructClass](./ec-struct-class.md), [ECCustomAttributeClass](./ec-custom-attribute-class.md), and [ECRelationshipClass](./ec-relationship-class.md) for semantics.

Common class properties:

| Property | Required | JSON type | Description |
| --- | --- | --- | --- |
| `modifier` | No | string | `none` (default), `abstract`, or `sealed`. |
| `baseClass` | No | string | Full base class name `{schema}.{class}`. Relationship classes support at most one base class semantically. |
| `properties` | No | array | Property objects (see [Properties](#properties)). |
| `customAttributes` | No | array | Custom attribute instances applied to the class. |

`EntityClass` adds an optional `mixins` array of full class names. `Mixin` is always abstract (the `modifier` is implied) and adds a required `appliesTo` (full entity class name). See [ECMixinClass](./ec-mixin-class.md) for the mixin rules.

```json
"Pump": {
  "schemaItemType": "EntityClass",
  "modifier": "sealed",
  "label": "Pump",
  "baseClass": "BisCore.PhysicalElement",
  "mixins": ["Example.IServiceable"],
  "properties": [
    { "type": "PrimitiveProperty", "name": "Manufacturer", "typeName": "string" },
    { "type": "PrimitiveProperty", "name": "RatedFlow", "typeName": "double", "kindOfQuantity": "Example.Flow" }
  ]
}
```

### Custom Attribute Classes

`CustomAttributeClass` adds a required `appliesTo` listing the container types where instances may be applied. The value is a list separated by `,`, `;`, or `|`. See [ECCustomAttributeClass](./ec-custom-attribute-class.md) and [CustomAttribute container types](./customattribute-container-types.md).

```json
"ReviewInfo": {
  "schemaItemType": "CustomAttributeClass",
  "appliesTo": "Schema, EntityClass, PrimitiveProperty",
  "properties": [
    { "type": "PrimitiveProperty", "name": "Owner", "typeName": "string" }
  ]
}
```

## Relationship Classes

`RelationshipClass` adds `strength`, `strengthDirection`, and `source` / `target` constraint objects. See [ECRelationshipClass](./ec-relationship-class.md) for semantics.

| Property | Required | JSON type | Description |
| --- | --- | --- | --- |
| `strength` | Yes | string | `referencing`, `holding`, or `embedding`. |
| `strengthDirection` | Yes | string | `forward` or `backward`. |
| `source` | Yes | object | Source constraint (see below). |
| `target` | Yes | object | Target constraint (see below). |

> `strength` and `strengthDirection` are **required in JSON** (the deserializer rejects an object that omits them). This differs from [ECSchema XML](./ec-schema-xml.md#relationship-classes), where both are optional and default to `referencing` / `forward`.

`source` and `target` constraint objects:

| Property | Required | JSON type | Description |
| --- | --- | --- | --- |
| `multiplicity` | Yes | string | UML-style, such as `(0..*)`, `(0..1)`, `(1..1)`, `(2..5)`. |
| `roleLabel` | Yes | string | Label for the endpoint's role. |
| `polymorphic` | Yes | boolean | Whether the endpoint accepts subclasses. |
| `abstractConstraint` | Conditional | string | Full class name. Required when an endpoint has more than one constraint class and no inherited abstract constraint. |
| `constraintClasses` | Yes | array | One or more full class names allowed at the endpoint. |
| `customAttributes` | No | array | Custom attribute instances on the constraint. |

```json
"PumpFeedsTank": {
  "schemaItemType": "RelationshipClass",
  "modifier": "sealed",
  "strength": "referencing",
  "strengthDirection": "forward",
  "source": {
    "multiplicity": "(0..*)", "roleLabel": "feeds", "polymorphic": true,
    "constraintClasses": ["Example.Pump"]
  },
  "target": {
    "multiplicity": "(0..1)", "roleLabel": "is fed by", "polymorphic": true,
    "constraintClasses": ["Example.Tank"]
  }
}
```

## Properties

Property objects live in a class's `properties` array. The `type` property is the discriminator; there are five kinds. See [ECProperty](./ec-property.md) for semantics.

Common property properties:

| Property | Required | JSON type | Description |
| --- | --- | --- | --- |
| `name` | Yes | string | Property name. Must be an [ECName](./ec-name.md). |
| `type` | Yes | string | `PrimitiveProperty`, `StructProperty`, `PrimitiveArrayProperty`, `StructArrayProperty`, or `NavigationProperty`. |
| `label` | No | string | Localizable display label. |
| `description` | No | string | Localizable description. |
| `isReadOnly` | No | boolean | Whether the property is read-only. |
| `category` | No | string | Full PropertyCategory name. |
| `priority` | No | number | Integer sorting priority. |
| `kindOfQuantity` | No | string | Full KindOfQuantity name (primitive and primitive-array kinds). |
| `customAttributes` | No | array | Custom attribute instances on the property. |
| `inherited` | No | boolean | Marks a property surfaced from a base class (informational; typically only set on read). |

Per-kind additions:

| `type` | Adds | Notes |
| --- | --- | --- |
| `PrimitiveProperty` | `typeName`, `extendedTypeName`, `minValue`/`maxValue`, `minLength`/`maxLength` | `typeName` is a [primitive type](./primitive-types.md) keyword **or** a full enumeration name. An enumeration-backed property has no distinct `type` - it is a `PrimitiveProperty` whose `typeName` is an enumeration. |
| `StructProperty` | `typeName` (full struct class name) | |
| `PrimitiveArrayProperty` | `typeName`, `extendedTypeName`, value/length bounds, `minOccurs`/`maxOccurs` | enum-backed arrays use this kind with an enumeration `typeName`. |
| `StructArrayProperty` | `typeName` (full struct class name), `minOccurs`/`maxOccurs` | |
| `NavigationProperty` | `relationshipName` (full relationship name), `direction` (`forward`/`backward`) | |

```json
{ "type": "StructProperty", "name": "Address", "typeName": "Example.PostalAddress" }
{ "type": "PrimitiveArrayProperty", "name": "Tags", "typeName": "string", "minOccurs": 0, "maxOccurs": 2147483647 }
{ "type": "NavigationProperty", "name": "Tank", "relationshipName": "Example.PumpFeedsTank", "direction": "forward" }
```

> Unbounded arrays serialize `maxOccurs` as the integer `2147483647` in JSON, where XML uses the string `"unbounded"`.

## Enumerations

`ECEnumeration` has an integer or string backing type and a required `enumerators` array. See [ECEnumeration](./ec-enumeration.md).

| Property | Required | JSON type | Description |
| --- | --- | --- | --- |
| `type` | Yes | string | `int` or `string`. (XML names this attribute `backingTypeName`.) |
| `isStrict` | No | boolean | Defaults to `true`. When `false`, values outside the declared set are allowed. |
| `enumerators` | Yes | array | Array of enumerator objects (may be empty). |

Each enumerator object: `name` (required), `value` (required; number or string matching `type`, unique within the enumeration), `label` (optional), `description` (optional).

```json
"PumpState": {
  "schemaItemType": "Enumeration",
  "type": "int",
  "isStrict": true,
  "enumerators": [
    { "name": "Off", "value": 0, "label": "Off" },
    { "name": "On",  "value": 1, "label": "On" }
  ]
}
```

## Quantities, Units, and Formats

ECSchema JSON 3.2 includes units and formats as schema items. See [KindOfQuantity](./kindofquantity.md), [Unit](./ec-unit.md), [Constant](./ec-constant.md), [Phenomenon](./ec-phenomenon.md), [UnitSystem](./ec-unitsystem.md), and [Format](./ec-format.md) for semantics.

```json
"Length": {
  "schemaItemType": "KindOfQuantity",
  "persistenceUnit": "Units.M",
  "relativeError": 0.0001,
  "presentationUnits": ["Formats.DefaultRealU(4)[Units.M|m]"]
}
```

- **KindOfQuantity**: `persistenceUnit` (required, full unit name), `relativeError` (required, number), `presentationUnits` (optional; an array of format strings, or a single `;`-separated string). The first presentation format is the default. See [KindOfQuantity format overrides](./kindofquantity.md) for the override grammar.
- **Unit**: `phenomenon`, `unitSystem`, `definition` (all required); `numerator`, `denominator`, `offset` (optional).
- **InvertedUnit**: `invertsUnit`, `unitSystem` (both required).
- **Constant**: `phenomenon`, `definition` (required); `numerator`, `denominator` (optional).
- **Phenomenon**: `definition` (required).
- **UnitSystem**: label/description only.
- **Format**: `type` (required), `precision`, `roundFactor`, `minWidth`, `showSignOption`, `formatTraits` (array or delimited string), `decimalSeparator`, `thousandSeparator`, `uomSeparator`, `scientificType` (required when `type` is `scientific`), `stationOffsetSize` (required when `type` is `station`), `stationSeparator`, and an optional `composite`. A `composite` has `spacer`, `includeZero`, and a `units` array of 1-4 `{ name, label }` objects (`name` is a full unit name). See [Format](./ec-format.md).

## Custom Attributes

A custom attribute instance is a JSON object with a `className` (full custom attribute class name) plus a property for each value. See [ECCustomAttributes](./ec-custom-attributes.md) for semantics and the [ECInstance representation](./ec-schema-xml.md#ecinstance-xml-in-custom-attributes) for value shapes.

```json
"customAttributes": [
  { "className": "CoreCustomAttributes.ProductionStatus", "SupportedUse": "NotForProduction" }
]
```

A container may carry multiple custom attributes, but only one instance of a given custom attribute class. Unlike schema items, custom attribute order is not significant.

## Validation

The JSON Schema for ECSchema JSON validates document shape: allowed properties, value types, and simple patterns. It does not express every semantic EC rule; semantic rules (relationship constraint compatibility, reference resolution, property override compatibility, custom attribute applicability) are covered by [EC Schema Validation](./ec-schema-validation.md).

The 3.2 JSON Schema files live in the BIS schemas repository under `System/json_schema/ec32/`.

## Differences from ECSchema XML

The two formats describe the same model; the shape differs. Summary (see [ECSchema XML](./ec-schema-xml.md) for the XML side):

| Aspect | ECSchema XML | ECSchema JSON |
| --- | --- | --- |
| Spec/version marker | `xmlns` namespace | `$schema` URL |
| Item name | `typeName` attribute | object key (or `name` in SchemaItem JSON) |
| Label / description | `displayLabel` / `description` | `label` / `description` |
| Enumeration backing type | `backingTypeName` | `type` |
| Read-only flag | `readOnly` | `isReadOnly` |
| Constraint polymorphic flag | `polymorphic` | `polymorphic` |
| Cross-references | alias-qualified, `bis:Class`, `:` separator | full schema name, `BisCore.Class`, `.` separator |
| Reference alias | required `alias` on each `ECSchemaReference` | none (no alias in JSON) |
| Items | one element per kind, order positional | `items` object keyed by name |
| Relationship `strength` / `strengthDirection` | optional, default `referencing` / `forward` | **required** |
| Unbounded array `maxOccurs` | `"unbounded"` | `2147483647` |
| Standalone single item | not supported | SchemaItem JSON |

## Version Notes

ECSchema JSON tracks the EC information model the same way [ECSchema XML](./ec-schema-xml.md#version-notes) does. For current schemas, prefer the 3.2 form. The `$schema` URL's version segment identifies the spec version; readers parse it to select the matching rules.
