# ECCustomAttributes

A way to add custom metadata to any of the supported [CustomAttribute Container Types](./customattribute-container-types.md). To understand ECCustomAttributes, you need to understand [.NET "custom attributes"](https://docs.microsoft.com/en-us/dotnet/standard/attributes/index).

ECCustomAttributes are the key aspect of the EC metadata abstractions that allow the addition of metadata concepts not in the EC specification. This gives ECObjects the flexibility needed to represent externally defined metadata with full fidelity.

ECCustomAttributes are the most unusual of the entities in an ECSchema, because they are actually instances of an ECCustomAttributeClass.
