# ECSchema XML

ECSchema XML is the XML representation of an [ECSchema](./ec-schema.md). It is a persistent interchange format for EC metadata: schemas, classes, properties, relationships, custom attributes, enumerations, quantities, units, and formats.

ECXML historically covered both metadata and instance data. Current iTwin schema workflows use ECSchema XML for schema metadata, while ECInstance XML appears most often as custom attribute instances embedded inside `ECCustomAttributes` elements.

This page documents the ECSchema XML 3.2 shape used by current iTwin schemas. The XML format describes the persisted schema document. The semantic rules for each EC item are documented on the linked EC pages and enforced by EC schema validation.

[ECSchema JSON](./ec-schema-json.md) is the JSON representation of the same model; see its [Differences from ECSchema XML](./ec-schema-json.md#differences-from-ecschema-xml) section for how the two shapes diverge (alias-qualified vs full-name references, `typeName`/`displayLabel` vs `name`/`label`, element ordering vs the `items` object, and a few required/optional differences).

## Namespace and Version

An ECSchema XML document has an `ECSchema` root element in an ECXML namespace.

```xml
<ECSchema schemaName="Example" alias="ex" version="01.00.00"
          xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  ...
</ECSchema>
```

The `version` attribute is the schema version, not the ECXML format version. It uses the `RR.WW.mm` form described by [ECSchema](./ec-schema.md): read version, write version, and minor version.

Common ECXML namespaces are:

| ECXML version | Namespace |
| --- | --- |
| 2.0 | `http://www.bentley.com/schemas/Bentley.ECXML.2.0` |
| 3.1 | `http://www.bentley.com/schemas/Bentley.ECXML.3.1` |
| 3.2 | `http://www.bentley.com/schemas/Bentley.ECXML.3.2` |

## Root Element

The `ECSchema` element contains schema-level metadata, references, custom attributes, and schema items.

### Attributes

| Attribute | Required | Description |
| --- | --- | --- |
| `schemaName` | Yes | Schema name and namespace for items in the schema. Must be an [ECName](./ec-name.md). |
| `alias` | Yes | Short alias used to qualify references from other schemas. |
| `version` | Yes | Schema version in `RR.WW.mm` form. |
| `description` | No | Localizable description. |
| `displayLabel` | No | Localizable display label. |

### Child Elements

The schema root may contain these child elements. Schema item names must be unique within the schema.

| Element | Multiplicity | Notes |
| --- | --- | --- |
| `ECSchemaReference` | `0..*` | References another schema by name, version, and alias. |
| `ECCustomAttributes` | `0..1` | Custom attribute instances applied to the schema. |
| `ECEntityClass` | `0..*` | Entity class definitions. |
| `ECStructClass` | `0..*` | Struct class definitions. |
| `ECCustomAttributeClass` | `0..*` | Custom attribute class definitions. |
| `ECRelationshipClass` | `0..*` | Relationship class definitions. |
| `ECEnumeration` | `0..*` | Enumeration definitions. |
| `KindOfQuantity` | `0..*` | Quantity definitions. |
| `PropertyCategory` | `0..*` | Property category definitions. |
| `UnitSystem` | `0..*` | Unit system definitions. |
| `Unit` | `0..*` | Unit definitions. |
| `InvertedUnit` | `0..*` | Inverted unit definitions. |
| `Constant` | `0..*` | Unit constant definitions. |
| `Phenomenon` | `0..*` | Phenomenon definitions. |
| `Format` | `0..*` | Numeric format definitions. |

## Schema References

An `ECSchemaReference` identifies another schema used by this schema.

```xml
<ECSchemaReference name="BisCore" version="01.00.25" alias="bis" />
```

| Attribute | Required | Description |
| --- | --- | --- |
| `name` | Yes | Referenced schema name. |
| `version` | Yes | Referenced schema version. |
| `alias` | Yes | Alias used by this schema when qualifying references to items in the referenced schema. |

## Schema Items

Most schema items share these attributes:

| Attribute | Required | Description |
| --- | --- | --- |
| `typeName` | Yes | Item name. Must be an [ECName](./ec-name.md). |
| `description` | No | Localizable description. |
| `displayLabel` | No | Localizable display label. |

References to items in the same schema may use the item name, such as `PhysicalElement`. References to items in another schema use the reference alias, such as `bis:PhysicalElement`.

## Classes

The EC class elements are `ECEntityClass`, `ECStructClass`, `ECCustomAttributeClass`, and `ECRelationshipClass`. See [ECClass](./ec-class.md), [ECEntityClass](./ec-entity-class.md), [ECStructClass](./ec-struct-class.md), [ECCustomAttributeClass](./ec-custom-attribute-class.md), and [ECRelationshipClass](./ec-relationship-class.md) for their semantics.

Common class attributes:

| Attribute | Required | Description |
| --- | --- | --- |
| `typeName` | Yes | Class name. |
| `modifier` | No | `None`, `Abstract`, or `Sealed`. Parsers accept casing variations. |
| `description` | No | Localizable description. |
| `displayLabel` | No | Localizable display label. |

Common class child elements:

| Element | Multiplicity | Notes |
| --- | --- | --- |
| `BaseClass` | `0..*` | Base class name or alias-qualified base class name. Relationship classes support at most one base class semantically. |
| `ECCustomAttributes` | `0..1` | Custom attribute instances applied to the class. |
| `ECProperty`, `ECArrayProperty`, `ECStructProperty`, `ECStructArrayProperty`, `ECNavigationProperty` | `0..*` | Property definitions. |

Example:

```xml
<ECEntityClass typeName="Pump" modifier="Sealed" displayLabel="Pump">
  <BaseClass>bis:PhysicalElement</BaseClass>
  <ECProperty propertyName="Manufacturer" typeName="string" />
  <ECProperty propertyName="RatedFlow" typeName="double" kindOfQuantity="Flow" />
</ECEntityClass>
```

> A mixin is serialized as an `ECEntityClass` carrying an `IsMixin` custom attribute (see [ECMixinClass](./ec-mixin-class.md)). A mixin is abstract by definition. The conventional and recommended form is to write `modifier="Abstract"` explicitly - every mixin in BisCore does, and that is what the serializer emits. Omitting the modifier is equivalent, since a mixin is abstract whether or not it is present. What is *not* valid is an explicit non-abstract value such as `modifier="None"`: it is meaningless, is not enforced anywhere, and should be treated as an authoring mistake.

### Custom Attribute Classes

`ECCustomAttributeClass` adds an `appliesTo` attribute that lists the container types where instances of the custom attribute may be applied. See [ECCustomAttributeClass](./ec-custom-attribute-class.md) for its semantics.

```xml
<ECCustomAttributeClass typeName="ReviewInfo" appliesTo="Schema,EntityClass,PrimitiveProperty">
  <ECProperty propertyName="Owner" typeName="string" />
</ECCustomAttributeClass>
```

The list may be separated by commas, semicolons, or vertical bars.

## Relationship Classes

`ECRelationshipClass` defines the relationship itself and contains `Source` and `Target` constraint elements. See [ECRelationshipClass](./ec-relationship-class.md) for its semantics.

| Attribute | Required | Description |
| --- | --- | --- |
| `typeName` | Yes | Relationship class name. |
| `modifier` | Yes | `None`, `Abstract`, or `Sealed`. Unlike other class kinds, where `modifier` is optional, it is required on relationship classes in ECXML 3.1 and later - a parser rejects a relationship class that omits it. |
| `strength` | No | `referencing`, `holding`, or `embedding`. Parsers accept casing variations. |
| `strengthDirection` | No | `forward` or `backward`. Parsers accept casing variations. |
| `description` | No | Localizable description. |
| `displayLabel` | No | Localizable display label. |

`Source` and `Target` constraints have these attributes:

| Attribute | Required | Description |
| --- | --- | --- |
| `multiplicity` | Yes | UML-style multiplicity, such as `(0..*)`, `(0..1)`, `(1..1)`, or `(2..5)`. |
| `roleLabel` | Yes | Label for the role of that endpoint. |
| `polymorphic` | Yes | Boolean value. Parsers accept casing variations. |
| `abstractConstraint` | No | Abstract class constraint for the endpoint. Required semantically when an endpoint has multiple constraint classes and no inherited abstract constraint. |

Each constraint contains one or more `Class` elements with a required `class` attribute. Source constraints support one class semantically; target constraints may support more than one.

A relationship class may also declare its own properties using the property elements described under [Properties](#properties). When it does, the `Source` and `Target` constraint elements must appear before any property elements; this ordering is required by the format and enforced by parsers.

For `holding` and `embedding` relationships, `strengthDirection` determines which endpoint acts as the parent or owner. `forward` means the source endpoint has that role; `backward` means the target endpoint has that role. Do not infer ownership from the endpoint names alone.

```xml
<ECRelationshipClass typeName="PumpFeedsTank" strength="referencing" strengthDirection="forward" modifier="Sealed">
  <Source multiplicity="(0..*)" roleLabel="feeds" polymorphic="true">
    <Class class="Pump" />
  </Source>
  <Target multiplicity="(0..1)" roleLabel="is fed by" polymorphic="true">
    <Class class="Tank" />
  </Target>
</ECRelationshipClass>
```

## Properties

EC property elements are split by property kind. This is intentional: each property kind has a different XML shape and maps naturally to different typed APIs. See [ECProperty](./ec-property.md) for its semantics.

Common property attributes:

| Attribute | Required | Description |
| --- | --- | --- |
| `propertyName` | Yes | Property name. Must be an [ECName](./ec-name.md). |
| `description` | No | Localizable description. |
| `displayLabel` | No | Localizable display label. |
| `readOnly` | No | Boolean value. Parsers accept casing variations. |
| `kindOfQuantity` | No | KindOfQuantity name or alias-qualified KindOfQuantity name. |
| `category` | No | PropertyCategory name or alias-qualified PropertyCategory name. |
| `priority` | No | Integer sorting priority. |

Property elements:

| Element | Required Attributes | Notes |
| --- | --- | --- |
| `ECProperty` | `propertyName`, `typeName` | Primitive or enumeration property. |
| `ECArrayProperty` | `propertyName`, `typeName` | Array of primitive or enumeration values. |
| `ECStructProperty` | `propertyName`, `typeName` | Struct-valued property. |
| `ECStructArrayProperty` | `propertyName`, `typeName` | Array of struct values. |
| `ECNavigationProperty` | `propertyName`, `relationshipName` | Navigation property backed by a relationship class. |

Array properties may define `minOccurs` and `maxOccurs`. `maxOccurs` may be a non-negative integer or `unbounded`.

Navigation properties use `direction="forward"` or `direction="backward"`.

```xml
<ECStructProperty propertyName="Address" typeName="PostalAddress" />
<ECArrayProperty propertyName="Tags" typeName="string" minOccurs="0" maxOccurs="unbounded" />
<ECNavigationProperty propertyName="Tank" relationshipName="PumpFeedsTank" direction="forward" />
```

## Enumerations

`ECEnumeration` defines a named enumeration with either an integer or string backing type. See [ECEnumeration](./ec-enumeration.md) for its semantics.

| Attribute | Required | Description |
| --- | --- | --- |
| `typeName` | Yes | Enumeration name. |
| `backingTypeName` | Yes | `int` or `string`. |
| `isStrict` | No | Boolean value. Defaults to `true` in ECObjects when omitted. |
| `description` | No | Localizable description. |
| `displayLabel` | No | Localizable display label. |

Each `ECEnumerator` has a required `name` and `value`, with optional `description` and `displayLabel`.

```xml
<ECEnumeration typeName="PumpState" backingTypeName="int" isStrict="true">
  <ECEnumerator name="Off" value="0" />
  <ECEnumerator name="On" value="1" />
</ECEnumeration>
```

## Quantities, Units, and Formats

ECXML 3.2 includes units and formats as schema items. See [KindOfQuantity](./kindofquantity.md), [Unit](./ec-unit.md), [Constant](./ec-constant.md), [Phenomenon](./ec-phenomenon.md), [UnitSystem](./ec-unitsystem.md), and [Format](./ec-format.md) for semantic details.

Common shapes:

```xml
<KindOfQuantity typeName="Length" persistenceUnit="u:M" presentationUnits="f:DefaultRealU(4)[u:M|m]" relativeError="0.0001" />

<Phenomenon typeName="LENGTH" definition="LENGTH" />
<UnitSystem typeName="METRIC" />
<Unit typeName="M" phenomenon="LENGTH" unitSystem="METRIC" definition="M" />

<Format typeName="DefaultRealU" type="decimal" precision="6" formatTraits="keepSingleZero|showUnitLabel">
  <Composite spacer=" ">
    <Unit label="m">u:M</Unit>
  </Composite>
</Format>
```

In ECXML 3.2, `KindOfQuantity/@persistenceUnit` is a unit reference, not a legacy format string. Presentation formats belong in `presentationUnits`.

The `presentationUnits` attribute is a semicolon-separated list of format references or format override strings. A format override can change the precision, add units to a unitless format, or override unit labels. See [KindOfQuantity format overrides](./kindofquantity.md#format-overrides) for the full syntax.

## Custom Attributes

`ECCustomAttributes` contains ECInstance XML for custom attribute instances applied to the parent schema, item, relationship constraint, or property. See [ECCustomAttributes](./ec-custom-attributes.md) for its semantics.

```xml
<ECCustomAttributes>
  <ProductionStatus xmlns="CoreCustomAttributes.01.00.03">
    <SupportedUse>NotForProduction</SupportedUse>
  </ProductionStatus>
</ECCustomAttributes>
```

The custom attribute element namespace is commonly the custom attribute schema full name, such as `CoreCustomAttributes.01.00.03`.

### ECInstance XML in Custom Attributes

Each child element of `ECCustomAttributes` is an instance of an `ECCustomAttributeClass`. The element name identifies the custom attribute class, and the element's child elements are property values for that custom attribute instance.

```xml
<ECCustomAttributes>
  <DateTimeInfo xmlns="CoreCustomAttributes.01.00.03">
    <DateTimeKind>Utc</DateTimeKind>
  </DateTimeInfo>
</ECCustomAttributes>
```

The type of each value is determined from the custom attribute class definition in the referenced schema. A schema item can have multiple custom attributes, but only one instance of a given custom attribute class may be applied to the same container.

### Relationship to ECJSON

A custom attribute attaches extra information to a piece of metadata. Its custom attribute class is meant to define the *shape* of that information - much as an XSD describes an XML document - so that, ideally, the value could be read and written as data without consulting the class. The ECInstance XML form falls short of that: a value cannot be converted between this form and its [ECJSON equivalent](./ec-custom-attributes.md) without loading the custom attribute class, because the two forms model the data differently. The XML form both omits and adds detail relative to JSON:

- **It repeats the schema version.** The instance element's `xmlns` carries the version of the custom attribute's schema, which the schema's `ECSchemaReference` already states.
- **It has no value types.** Every value is text. Whether `42` is an integer, a double, or a string is known only from the class definition.
- **A struct and a single-entry struct array look identical.** Both serialize as a single nested element; only the class says which one a given element is.
- **Struct-array entries are named for their struct class.** ECJSON identifies values by property name alone, so the struct class spelled into the XML element name has nowhere to come from or go to.

Custom attributes are also persisted in this ECInstance XML form inside iModels, so the format is effectively fixed: changing it would break read compatibility with existing files. A consequence is that these stored fragments are not fully self-describing on their own - interpreting or reshaping a value still depends on its custom attribute class.

## Validation

The XSD for ECSchema XML validates the XML document shape: allowed elements, attributes, simple value patterns, and some uniqueness rules. It does not express every semantic EC rule. Semantic rules such as relationship constraint compatibility, reference resolution, property override compatibility, and custom attribute applicability are covered by [EC Schema Validation](./ec-schema-validation.md).

The ECXML 3.2 XSD is maintained in the BIS schemas repository at [System/xsd/ECSchemaXML3.2.xsd](https://github.com/iTwin/bis-schemas/blob/master/System/xsd/ECSchemaXML3.2.xsd). It is intentionally XSD 1.0 compatible for broad tool support, including .NET XML tooling. A companion XSD 1.1 file may provide optional assertions for validators that support XSD 1.1.

## Version Notes

ECXML has evolved with ECObjects:

| ECXML version | Notes |
| --- | --- |
| 1.x | Early ECXML format used by older Bentley applications. |
| 2.0 | Added a fuller relationship model, schema references, namespaces, and multiple inheritance support. |
| 3.0 | Introduced with DgnDb generation 06. |
| 3.1 | Modern EC3 schema format before schema-level units and formats. |
| 3.2 | Adds units, constants, phenomena, unit systems, formats, and ECEnumerator names as first-class schema XML concepts. |

For current schemas, prefer ECXML 3.2 unless a repository or product explicitly requires an older format.

## See also

- [ECSchema JSON](./ec-schema-json.md) - the JSON representation of the same EC model.
- [SchemaView](../../learning/metadata/SchemaView.md) and its [binary format](../../learning/metadata/SchemaViewBinaryFormat.md) - a separate, **lossy runtime** representation used by `@itwin/ecschema-metadata` for fast in-memory access. Unlike ECSchema XML and JSON, it is an iTwin.js implementation format, not an EC interchange format: it drops units, formats, and custom attribute instances and is versioned independently of the EC spec.