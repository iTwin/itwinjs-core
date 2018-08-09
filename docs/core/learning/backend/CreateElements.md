# Creating Elements

Use [IModelDb.Elements.insertElement]($backend) to insert a new element into an IModelDb. This method takes as its input an [ElementProps]($common) or a subclass of it, which defines the class and all required properties of the new element.

*Example:*
``` ts
[[include:Element.createGeometricElement3d.example-code]]
```
The above example shows the use of the [GeometricElement3dProps]($common) subclass of ElementProps.

Some classes provide `create` helper functions.

*Example:*
``` ts
[[include:Element.createSpatialCategory.example-code]]
```

The above example shows the use of the [SpatialCategory.create]($backend) helper function to create the props object. It also illustrates how [IModelDb.Elements.updateElement]($backend) is used.