# Schemas and Elements in TypeScript

A [Schema]($backend) represents an ECSchema in TypeScript. It is a collection of Entity-based classes. See [the BIS overview]($docs/bis) for how ECSchemas are used to model information. ECSchemas define classes for models, elements, and aspects, as well as ECRelationships.

An [Element]($backend) object represents an *instance* if a [bis:Element]($docs/BIS/intro/element-fundamentals.md) class when it is read from an iModel. The Element object has properties that correspond to the bis class definition in the schema. An [ElementAspect]($backend) object represents an instance of a [bis:Aspect]($docs/BIS/intro/elementaspect-fundamentals.md) in memory.

ECSchemas typically define subclasses of bis:Element, bis:Aspect, and so on. The objects that are loaded into memory are instances of TypeScript/JavaScript classes that match the ECSchema definitions. So, for example, an instance of a bis:GeometricElement3d is an object of the class [GeometricElement3d]($backend).

## Importing the Schema

An ECSchema must be imported into an iModel before apps can insert and query instances of the ECClasses that it defines.

*Example:*
``` ts
[[include:IModelDb.importSchema]]
```

ECSchema.xml files must be in the app backend's install set, as part of its assets.

The app can ensure that the underlying schema is imported by registering an onOpened event handler:

*Example:*
``` ts
[[include:Schema.importSchema]]
```

where the schema is:
``` xml
[[include:RobotWorld.ecschema.xml]]
```

## TypeScript and ECSchemas and ECClasses

Once an ECSchema has been imported into an iModel, you can work with Elements, Models, and ElementAspects from that schema without writing TypeScript classes to represent them. A JavaScript class will be generated dynamically to represent each ECClass that you access, if there is no pre-registered TypeScript class to represent it.

You *may* write a TypeScript Schema class to represent an ECSchema and TypeScript Element-based or ElementAspect-based classes to represent some or all of its ECClasses. The benefit of writing a TypeScript class to represent an ECClass is that you can add hand-coded methods to provide and centralize business logic for applications to use when working with that specific class.

*Example:*
``` ts
[[include:Element.subclass]]
```
Note that the pre-written TypeScript class does not have to define accessors for the properties of the ECClass. The Element base class takes care of that automatically.

Note that you still have to import the underlying ECSchema before attempting to create instances of the ECClasses that it defines.

## Schema Registration

If an app backend wants to use a pre-written TypeScript Schema class, it must register the pre-written schema first.

*Example:*
``` ts
[[include:Schema.registerSchema]]
```

The TypeScript Schema class itself must register all of the classes that it defines. The best practice is for the Schema class to do that in its constructor.

*Example:*
``` ts
[[include:ClassRegistry.registerModule]]
```
