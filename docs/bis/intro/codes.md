# Element Codes

Every BIS `Element` has a *Code* that represents its formal identifier in the real world.
A Code holds a human-readable string that is used to uniquely identify something.

Codes are enforced to be unique within a BIS repository.

A Code conveys information to people and programs that understand the structure of the string and are therefore able to *decode* it.
Different domains and organizations have different ways of *encoding* business information.

Every Element has a Code. For some subclasses of Element, a Code is required and for other subclasses of Element, Code is optional (i.e., it may be `null`.)

Examples uses for Code include:

- Asset Tracking Number
- Tag Number
- Serial Number
- VIN Number
- Social Security Number
- Document Tracking Number
- Contract Number
- Project Number
- RFID
- Etc.

When the identified entity is physical in nature, it will often have its *code* physically affixed to it (as in the VIN Number on a car or the Manufacturer’s Serial Number on an instrument).

**Code** is a three-part identifier that consists of a `CodeSpec`, a `CodeScope` and a `CodeValue`.

## CodeSpec

A `CodeSpec` (aka **Code Specification**) captures the rules for encoding and decoding significant business information into and from a Code.
A Code Specification is used to generate and validate Codes.

A single BIS Repository (e.g. an iModel) may use many Code Specifications, because different classes of Elements can have different coding conventions.

Each `Element` has a relationship to the `CodeSpec` that should be used to encode or decode the Code for that instance.

## CodeScope

Each `Element` has a relationship to another Element that provides the **uniqueness scope for its Code**.
For example, a Floor Code (like "1" or "2") must be unique within a Building, but is not unique across Buildings.
In this example, the Building instance is providing the CodeScope for the Floor.

## CodeValue

Each `Element` stores a `CodeValue` that is a text string.
In many contexts, CodeValue is colloquially referred to as the *Element's Code*.

Elements representing real-world entities that don’t have a meaningful real-world identifier, e.g. a piece of baseboard, a pile of dirt, an average bolt, will have `null` for its `CodeValue`.

A `CodeValue` should be a human-understandable string, *not* a Guid. `FederationGuid` fulfills that purpose.

> Next: [ElementAspect Fundamentals](./elementaspect-fundamentals.md)
