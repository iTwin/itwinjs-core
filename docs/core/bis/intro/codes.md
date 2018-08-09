# Element Codes
A *Code* is a human-readable string identifier of the real-world entity that an Element represents.

A Code conveys information to people and programs that understand the structure of the string and are therefore able to *decode* it.

Different domains and organizations have different ways of *encoding* business information into the *Code*, which they can express as [Code Specifications](#codespec).

## CodeValue Property
Each `Element` has a (nullable) `CodeValue` string property that holds its *Code*.

When present, a `CodeValue` should be a human-understandable string, *not* a Guid--`FederationGuid` fulfills that purpose.

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
- Door Number
- Room Number
- Etc.

When the identified entity is physical in nature, it will often have its *code* physically affixed to it (as in the VIN Number on a car or the Manufacturer’s Serial Number on an instrument).
When the identified entity is non-physical, it may have its *code* semi-permanently attached to a related physical entity.
For example, a physical valve will have its serial number permanently affixed to it. The "Tag Number" of the "function" that the valve is performing in the process is stamped onto a "Tag" attached to the valve with a wire. If the valve is replaced with a new one (with a new serial number) the Tag holding function's "Tag Number" will be moved to the new valve.

## CodeSpec
A `CodeSpec` (aka **Code Specification**) captures the rules for encoding and decoding significant business information into and from a Code.
A `CodeSpec` is associated to an Element subclass via configuration of the system that edits the BIS Repository, such as the iModelJs library, which can collaborate with a shared service (e.g. by an 'Identification Code Service') to generate and validate Codes.

The CodeSpec can also dictate that Codes for instances of the Element class should be null. This is appropriate when the modeled real-world entities don’t have a meaningful real-world identifier (e.g. a piece of baseboard, a pile of dirt, an average bolt).

## CodeSpec Property
Each `Element` has a `CodeSpec` navigation property relating it to a `CodeSpec`  that governs its Code.
A single BIS Repository (e.g. an iModel) may use many Code Specifications--different classes of Elements can have different coding conventions.

## CodeScope Property
Each `Element` has a `CodeScope` navigation property that points to another Element that provides the uniqueness scope for its Code.
The 'scoping' Element can represent the repository as a whole, a model, an assembly, etc.
The 'scoping' Element could also represent some entity with a scope that is greater than the current BIS Repository. In this case, uniqueness within that scope can only be enforced by an external 'Identification Code Service'.

For example, a Floor Code (like "1" or "2") must be unique within a Building, but is not unique across Buildings.
In this example, the Building instance is providing the CodeScope for the Floor.

## Uniqueness within a BIS Repository
For a given Element, the combination of it `CodeSpec`, `CodeScope`, and `CodeValue` properties must be unique within the BIS repository. All `null` values are considered to be unique.

> Next: [ElementAspect Fundamentals](./elementaspect-fundamentals.md)


