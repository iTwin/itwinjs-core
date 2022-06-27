# Accessing Models

A [Model]($backend) is an in-memory representation of a [BIS Model](../../bis/guide/fundamentals/model-fundamentals.md).

The [IModelDb.Models]($backend) class represents the collection of Models in an iModel. It has methods to find model Ids and to load Model objects.

You will not normally need to load Model objects into memory. Model objects do not hold properties. The properties of a Model are held by the associated modeled element.

[IModelDb.Models.getSubModel]($backend) and [IModelDb.Models.tryGetSubModel]($backend) are convenient ways to look up a model by the Id, Code, or Guid of the modeled element.

[Element.model]($backend) is the Id of the model that contains an element.
