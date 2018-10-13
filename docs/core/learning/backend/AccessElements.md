# Accessing Elements in an IModelDb

An iModel.js [Element]($backend) is an in-memory representation of a [BIS Element](../../bis/intro/element-fundamentals.md). An Element object provides easy access to a set of properties and [Aspects](../Glossary.md#elementaspect).

[IModelDb.elements]($backend) represents the collection of Elements in an iModel.

Every iModel contains a single "root" [Subject]($backend) element that is the parent of all partitions. It is accessed by a special function called [IModelDb.Elements.getRootSubject]($backend).

You can look up all other elements in various ways. As described in BIS Element Fundamentals, an element is identified by a unique Id and may also have a Code and/or a FederationGuid. If you know one of these identifiers, you can look up an element very efficiently. The [IModelDb.Elements.getElement]($backend) method makes that easy.

You can discover an element's Id by [using ECSQL](./ExecutingECSQL.md) to query other properties or [spatial queries](../SpatialQueries.md).