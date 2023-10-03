# Element Codes

A *Code* is a human-readable textual identifier of the entity that an Element represents.

A Code conveys information to people and programs that understand the structure of the string and are therefore able to *decode* it.

Different domains and organizations have different ways of *encoding* business information into the *Code*, which they can express as [Code Specifications](#codespec).

In BIS, Codes are modeled using three properties of *bis:Element*: CodeValue, CodeSpec and CodeScope.

## CodeValue Property

Each `Element` has a (nullable) `CodeValue` string property that holds its *Code*.

When present, a `CodeValue` should be a human-understandable string.

### Examples uses for Code

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

When the identified entity is a role assumed by a physical entity, it may have its *code* semi-permanently attached to a related physical entity. For example, a physical valve will have its serial number permanently affixed to it. The "Tag Number" of the "function" that the valve is performing in the process is stamped onto a "Tag" attached to the valve with a wire. If the valve is replaced with a new one (with a new serial number) the Tag holding function's "Tag Number" will be moved to the new valve.

When the identified entity is pure information in nature, it will often have its *code* assigned to it in the form of a *name* or similar concept, assigned by a domain, organization or software system. Examples include the "name" assigned to a document by an organization, the "model" identifying a specific type of valve from its manufacturer's catalog or the "name" of a particular *line style* used in drawings of an organization.

### Example misuses of Code

- A [Guid](https://en.wikipedia.org/wiki/Universally_unique_identifier) is not human-understandable and does not encode business meaning, so should not be used as a `CodeValue`--[FederationGuid](./element-fundamentals.md#FederationGuid) fulfills that purpose.
- A [Hash](https://en.wikipedia.org/wiki/Hash_function) should not be used as a `CodeValue` for the same reasons as above.
- A `CodeValue` that is hundreds of characters long would also be very difficult for a human to understand, so should be avoided. In fact, a code management service may enforce a hard limit on the length of the `CodeValue`. For example, iModelHub currently has a hard limit of 350 characters.

## CodeSpec

A `CodeSpec` (aka **Code Specification**) names and specifies a new *classification* for Codes.
A `CodeSpec` also captures the rules for encoding and decoding significant business information into and from a Code.
For example, the Codes for ViewDefinitions and the Codes for Equipment have different *encoding* rules and uniqueness constraints, so would each have a separate `CodeSpec`.

Typically, a `CodeSpec` has a strong correlation with a branch of the Element class hierarchy and is often named after an abstract base class that defines the starting point of that branch. It is common for all subclasses (direct or indirect) descending from that base class to share the same `CodeSpec`.

For example, the standard `CodeSpec` called "bis:ViewDefinition" helps ensure unique names for all subclasses of the `BisCore:ViewDefinition` Element class.

Configuration can define the association between Element class and CodeSpec so that a shared service (e.g. 'Identification Code Service') can be used to generate and validate Codes.

The CodeSpec can also dictate that Codes for instances of the Element class should be null. This is appropriate when the modeled real-world entities don’t have a meaningful real-world identifier (e.g. a piece of baseboard, a pile of dirt, an average bolt).

> Note: To ensure unique `CodeSpec` names, a namespace (often the alias of a schema) should be used as demonstrated with the standard "bis:ViewDefinition" `CodeSpec`.

## CodeSpec Property

Each `Element` has a `CodeSpec` navigation property relating it to a `CodeSpec` that governs its Code. A single BIS Repository (e.g. an iModel) is expected to use many Code Specifications--different classes of Elements can have different coding conventions.

## CodeScope Property

Each `Element` has a `CodeScope` navigation property that points to another Element that provides the uniqueness scope for its Code. The 'scoping' Element can represent the repository as a whole, a model, an assembly, etc.

The `CodeSpec` specifies the types of elements that can be used as a `CodeScope`. The most common types are:

- `Repository` - CodeValues are unique across an entire repository.
- `Model` - CodeValues are unique within a Model.
- `ParentElement` - CodeValues are unique among children with the same parent.
- `RelatedElement` - CodeValues are unique across the set related to the same element.

For example, a Floor Code (like "1" or "2") must be unique within a Building, but is not unique across Buildings.
In this example, the Building instance is providing the CodeScope for the Floor.

> Note: The 'scoping' Element could also represent some entity with a scope that is greater than the current BIS Repository. In this case, uniqueness within that scope can only be enforced by an external 'Identification Code Service'.

## Uniqueness within a BIS Repository

For a given Element, the combination of it `CodeSpec`, `CodeScope`, and `CodeValue` properties must be unique within the BIS repository. All `null` values are considered to be unique.

## CodeSpec creation guidelines

The following table summarizes the typical purpose behind the creation of a CodeSpec by schema designers, Connector or Application developers as well as by end-users and admins. Typical CodeScopes and the strategy for referencing of CodeScope-Elements for each case is also presented.

| Creator | CodeSpec Purpose | Typical CodeScopes | CodeScope-Element Referencing |
|---|---|---|---|
| Shared-domains & Authoring Applications | Code-classification for classes, usually `DefinitionElement`s, that model concepts considered repository-specific artifacts, in order to:<br/>- Ensure uniqueness (at Subject-specific & global scopes) or to... <br/>- Provide a well-known way to find certain instances (at global scope). | By-model or by-parent. | via ElementId |
| Connectors | Reproduce existing code/tag/name-uniqueness rules in the source format, if any. | - By-model or by-parent.<br/>- By-related-element if applicable depending on source format.<br/>- By-repository is typically invalid. | via ElementId |
| Users / Admins | Code-classification set up via app-configuration for specific classes. Code-uniqueness typically expected across repositories. | Any CodeScope appropriate to each case. | via FederationGuid |


---
| Next: [FederationGuids](./federationGuids.md)
|:---
