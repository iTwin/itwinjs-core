# Creating Elements

Use [IModelDb.Elements.insertElement]($backend) to insert a new element into an IModelDb. This method takes as its input an [ElementProps]($common) or a subclass of it, which defines the class and all required properties of the new element.

Here are examples of creating various specific types of elements:

## Subject

```ts
[[include:insertSubject.example-code]]
```

## GeometricElement3d

``` ts
[[include:Element.createGeometricElement3d.example-code]]
```
See [GeometricElement3dProps]($common).

where:

``` ts
[[include:GeometryStreamBuilder.example-code]]
```

See [GeometryStreamBuilder]($geometry)

## SpatialCategory

``` ts
[[include:InsertSpatialCategory.example-code]]
```

See [SpatialCategory]($backend), [CategoryProps]($common), [SubCategoryAppearance]($common).

Also see [IModelDb.Elements.updateElement]($backend).

## ModelSelector

``` ts
[[include:InsertModelSelector.example-code]]
```

See [ModelSelector]($backend), [ModelSelectorProps]($common)

## CategorySelector

``` ts
[[include:InsertCategorySelector.example-code]]
```

See [CategorySelector]($backend), [CategorySelectorProps]($common)

## DisplayStyle3d

``` ts
[[include:InsertDisplayStyle3d.example-code]]
```

See [DefinitionElementProps]($common), [DisplayStyle3d]($backend)

## OrthographicViewDefinition

``` ts
[[include:InsertOrthographicViewDefinition.example-code]]
```

See [ViewDefinition.createCode]($backend), [OrthographicViewDefinition]($backend), [SpatialViewDefinitionProps]($common)