# Creating Models

To insert a new [Model]($backend) into an iModelDb,
1. Create and insert the modeled element.
1. Create and insert the model, refering to the modeled element.

*Example:*
``` ts
[[include:IModelDb.Models.createModel.example-code]]
```

Create a Definition model:

``` ts
[[include:insertDefinitionModel.example-code]]
```
