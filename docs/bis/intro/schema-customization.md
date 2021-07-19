# Schema Customization

<!-- TODO
COMMENT: This is really about dynamic metadata, not data. Or you could just call it extended metadata... the point is not that it is changing (it is not), it is simply metadata that extends beyond the current state of BIS.
-->

## Introduction

While BIS models a significant portion of the world of built infrastructure, and new discipline-specific domain schemas are being added all the time, there will inevitably be a need to store data not-yet-covered by BIS. Some common cases where this situation may arise are:

- Customizations and extensions to existing BIS concepts (often per-project or per-company)
- Vendor-specific information
- Transfer of information from other infrastructure-related databases (e.g. via iModel connectors).
- Modeling of concepts that do not currently exist in BIS.
- The need to add unstructured information to Elements.

This page discusses strategies available for creating and controlling this data, referred to as "custom data", and provides best practice advice. Custom data should be modeled differently depending on the nature of the data and how the property definitions and values vary.

Properties that vary per class or type should be modeled using property definitions, properties which vary per instance should be modeled using Json.

<!-- TODO
## Dynamic Schemas

### Creating Dynamic Schemas

### Inherent Risks of Dynamic Schemas

### Allowed and Forbidden Capabilities in Dynamic Schemas
-->

## Vendor Data and Related Catalogs

Vendors will often need to define Element subclasses and associated Type subclasses. For example a pump vendor might define a Pump subclass (BigCo:MonsterPump) and a related PumpType subclass (BigCo:MonsterPumpType).

BigCo:MonsterPumpType might define four new properties:

- ModelNumber
- Power
- InletDiameter
- OutletDiameter

 BigCo:MonsterPump might define one new property:

- OutletLength

When BigCo's pump catalog is distributed, it will include:

- BigCo:MonsterPump class definition
- BigCo:MonsterPumpType class definition
- Multiple BigCo:MonsterPumpType instances (defining the pump types available for purchase)

<!-- TODO
QUESTION: *IN PRACTICE, DOES THIS MEAN THAT IF I WANT TO CHANGE A PUMP FROM BIGCO TO LITTLECO, THEN I NEED TO CHANGE THE CLASS OF PUMP AS WELL (IE - I NEED TO DELETE AND RECREATED THE PUMP)?*
-->

## Data Imported from Other Databases (including via iModel Connectors)

The technology (often iModel connectors) that converts data from other databases into BIS data will usually need to convert from the class structure in the native database to a BIS class structure. It is rare that a BIS schema will work "out of the box". Typically a dynamic schema will need to be defined by the converter and then the data converted from the native DB into instance of the new dynamic schema's classes (likely along with some instances of standard BIS classes).

## Dynamic Schema Minor Change Considerations

As dynamic schemas are extensions of BIS schemas, they must follow the rules of BIS schemas to prevent upgrade problems. These rules are defined in [Schema Versioning and Generations](./schema-versioning-and-generations.md). The most notable of these rules is that classes and properties cannot be removed or significantly redefined. In general, only additions to schemas are allowed.

## Minor (BIS) Schema Upgrade Considerations

As defined in [Schema Versioning and Generations](./schema-versioning-and-generations.md), BIS schemas may be upgraded at almost any time within a generation. The classes in dynamic schemas always subclass from BIS classes, so they may be affected by these minor upgrades at almost anytime.

The biggest danger from these minor schema upgrades is that a BIS class may add a property that has the same name as a property in a dynamic subclass. This class will cause ????????????? when the upgraded schema is imported into a BIS repository.

Class name conflicts (a class being added in BIS that has the same name as a class in a dynamic schema) is not a technical problem as the classes are scoped by the name of the schema that contains them. The duplicate class names can cause user confusion, however.

## Generational (BIS) Schema Upgrade Considerations

As defined in [Schema Versioning and Generations](./schema-versioning-and-generations.md), generational changes allow radical changes to schemas and must be accompanied by code that understands how to map data (Elements and Models) from one generation of schemas to another. The generational mapping code can potentially be very complex; for example, it may include:

- 1:1, 1:N, N:1, N:N instance mapping
- 1:1, 1:N, N:1, N:N property mapping
- Moving of properties between classes (as a simple case, from PhysicalElementType subclass to its related PhysicalElement subclass)
- Rearrangement of Model hierarchy

<!-- TODO
There needs to be a default strategy for converting the dynamic schemas to descent from the new BIS schemas, and for the conversion of dynamic data. We cannot rely on custom code to perform the upgrade; the entity that created the custom schemas may not even be in business any more.
-->

---
| Next: [Data Evolution Across Time](./appendix-a-data-evolution-across-time.md)
|:---
