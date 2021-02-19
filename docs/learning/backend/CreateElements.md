# Creating Elements

Use [IModelDb.Elements.insertElement]($backend) to insert a new element into an IModelDb. This method takes as its input an [ElementProps]($common) or a subclass of it, which defines the class and all required properties of the new element. The pattern is:

``` ts
const elementProps: SomeBisClassProps = {
  classFullName: bisFullClassName
  ... other required props ...
};
const newElementId: Id64String = iModel.elements.insertElement(elementProps);
```

The type of the "props" object is chosen as appropriate for the particular Element subclass that is to be instanced. There are [InformationPartitionElementProps]($common), [SubjectProps]($common), [GeometricElement3dProps]($common), and many more. See the various ["props" interfaces]($common:Entities) defined in iTwin.js. Domains may define their own "props" subclasses.

Why "props"?

As explained in the [article on elements and schemas](./SchemasAndElementsInTypeScript.md), an element is always an instance of a class in the BIS hierarchy. The BIS class of an element defines what the element is, so that it accurately represents an entity in the real world, according to a well thought out classification scheme that is appropriate to the modeling problem at hand. To that end, domains define many subclasses of Element. These BIS classes support strong modeling semantics. At the same time, it is very convenient to work with BIS classes in iTwin.js apps. In particular, there is no need to write a TypeScript class for every BIS class that you may work with.

The IModelDb.Elements.insertElement API is a good example of the way iTwin.js combines strong data-modeling semantics with programming convenience. When creating a new element, the app only needs to specify the required properties of the element, including its BIS class. These defining properties are called "props". Often there will be no pre-defined TypeScript or JavaScript class corresponding to a given BIS class at compile time. That's no obstacle. All that matters is that the BIS class is defined in the BIS schema, and the app just needs to supply its name, along with its other required props.

Once an element has been inserted into the iModel, it is understood by iTwin.js to be an instance of the specified BIS class. When an app [gets the element from the iModel](./AccessElements.md), it will see an instance of a JavaScript class that corresponds exactly to the BIS class definition for that element. All defined properties will be there and will be accessible as properties in a natural, JavaScript way.

That is why the IModelDb.Elements.insertElement API takes a "props" object and why many BIS subclasses can share the same props JavaScript class without confusion.

## Examples

Here are examples of creating various specific types of elements:

## Subject

See [Subject.insert]($backend)

## GeometricElement3d

``` ts
[[include:Element.createGeometricElement3d.example-code]]
```

See [GeometricElement3dProps]($common).

where:

``` ts
[[include:GeometryStreamBuilder.example-code]]
```

See [GeometryStreamBuilder]($common)

## SpatialCategory

See [SpatialCategory.insert]($backend)

## ModelSelector

See [ModelSelector.insert]($backend)

## CategorySelector

See [CategorySelector.insert]($backend)

## DisplayStyle3d

See [DisplayStyle3d.insert]($backend)

## OrthographicViewDefinition

See [OrthographicViewDefinition.insert]($backend)
