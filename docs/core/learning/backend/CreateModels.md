# Creating Models

To insert a new [Model]($backend) into an iModelDb,

1. Create and insert the modeled element.
2. Create and insert the model, referring to the modeled element.

Here are some examples:

## PhysicalModel

``` ts
[[include:IModelDb.Models.createModel.example-code]]
```

## DefinitionModel

``` ts
[[include:insertDefinitionModel.example-code]]
```
