# Creating ElementAspects

Use [IModelDb.Elements.insertAspect]($backend) to insert a new ElementAspect into an IModelDb.
This method takes as its input an [ElementAspectProps]($common) or a subclass of it, which defines the class and all required properties of the new ElementAspect.
The pattern is:

``` ts
[[include:Elements.insertAspect]]
```
