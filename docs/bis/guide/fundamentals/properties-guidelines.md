# Properties: Guidelines

## Introduction

BIS offers multiple ways to capture properties of Entities being modeled. It is the job of the schema designer to choose the most appropiate strategy to follow in every case. This article aims to provide general guidelines for the choosing among those strategies.

Properties of Entities model their attributes relevant in light of a particular modeling perspective. Examples of properties include the _inner diameter_ of a _Pipe_ (Physical Perspective), the _roughness coefficient_ of a _Pipe_ (Hydraulic Analysis perspective) or the _tag number_ of a _Piping Segment_ (Functional Perspective).

Note that while a schema designer is responsible to model all relevant properties of an Entity, not every property needs to be persisted in a BIS repository. Some properties can be derived from other information already persisted. This is specially true for iTwin Native apps offering data-editing functionality. Persisting data about properties that could be derived turns them into, effectively, caches that need to be kept in-sync as the more fundamental information change. In general, caches add significant implementation complexity.

Schema designers need to choose which properties to persist and which ones to introduce as derived. That decision can be arbitrary sometimes, depending on the situation. For example, three very common physical properties of a _Pipe_ are its _inner diameter_, _outer diameter_ and _thickness_. Persisting only two of them is sufficient since the third one can can be derived from them.

## Persisted Properties

The following sections focus on properties that are meant to be persisted in a BIS repository.

### Essential Element Properties

Schema designers' job include identifying which properties being modeled are *essential* according to the semantics and [modeling perspective](../data-organization/modeling-perspectives.md) captured by the element-class modeling the associated Entity. The _physical material_ an Entity is made of or its _shape_ or _dimensions_ are examples of property considered essential in light of the Physical modeling of such Entity.

Properties considered as essential are typically captured in a BIS class as its _first-class_ properties. Under that strategy, a property of an Entity is implemented as an [ECProperty](../../ec/ec-property.md) directly defined on the [Element-class](./data-classification.md#element-class) that represents it.

Note, however, that there may be *essential* properties whose applicability dependend on the state of a more general *essential* property on a specific Entity. As an example, the applicability of essential properties such as _Diameter_ or _Height_ depends on the _Shape_ of an Entity. Such *essential* properties shall be implemented via a class-hierarchy based on [`_Mandatory_ Element-Aspects`](./elementaspect-fundamentals.md#sub-properties-and-mandatory-elementaspects). If the overall concept is considered *essential* for the associated Entity in a given modeling perspective, the target multiplicity of its associated `ElementOwnsUniqueAspect` or `ElementOwnsMultiAspect` relationship shall be set accordingly (i.e. 1..1 or 1..* respectively). See [Sub-Properties and _mandatory_ ElementAspects](./elementaspect-fundamentals.md#sub-properties-and-mandatory-elementaspects) for more information and an example of this situation.

*Essential* Element properties shall be shown in UX controls as attribution of their associated Element-class, unless they are selectively hidden by using the `HiddenProperty` or `HiddenClass` *Custom-Attributes*.

### Non-essential Element Properties

Schema designers' may consider some properties as non-essential. They typically provide additional information about an Entity but they are not required to correctly describe it given its semantics in a particular modeling perspective. Examples include _Year Installed_ of a _Pipe_ from a Hydraulic Analysis perspective - a property not needed to carry out such kind of simulation - or _Compression Strength_ of an Entity modeled in a Physical perspective.

Properties of an Entity considered non-essential are implemented as [EC Properties](../../ec/ec-property.md) of an [Element-Aspect](./elementaspect-fundamentals.md). An `Element-Aspect` is a set of properties that can be attached to an `Element` instance.

Element-Aspect properties shall be shown in UX controls as attribution of their associated Element-instance, unless they are selectively hidden by using the `HiddenProperty` or `HiddenClass` *Custom-Attributes*.

### Properties in Link-table Relationships

[Link-table](./relationship-fundamentals.md#link-table) relationships can contain properties if the associated property does not apply separately to any of the Entities involved, but it only applies to them when they are associated by the relationship instance.

As an example, the base class of `Link-table` relationships - `ElementRefersToElements` - contains the `MemberPriority` property to enable data-writers to specify an order for the instances at the target-end of the relationship with respect to a common source-instance.

Link-table relationship properties shall not be included in any generic UX control by default.

### JSON data

Instance-specific *ad hoc* data on an Element can be captured in JSON format in the [`JsonProperties`](./element-fundamentals.md#jsonproperties) property of an `Element`. See [`Advantages and Disadvantages of JsonProperties`](./element-fundamentals.md#advantages-and-disadvantages-of-jsonproperties) for additional information on this topic.

More carefully planned data can also be stored in JSON format. This is the case of [Authoring-focused attributes](#authoring-focused-attributes) in some cases, especially because such data typically only has one reader: the iTwin Native application that depends on it. In that case, it is recommended that a property different from the base `JsonProperties` is used to store it. Such kind of properties need to be defined as *string* [ECProperties](../../ec/ec-property.md) whose *extendedType* is set to *Json*. That strategy saves the data-writer application from having to define a namespace to avoid data collisions if it targeted the `JsonProperties` ECProperty instead.

JSON-based properties shall not be included in any generic UX control by default.

## Derived Properties

There are two strategies that a schema designer can plan for in order to avoid storing derived data into a BIS repository:

1. Presentation Rules

The [Presentation library](https://www.itwinjs.org/presentation/hierarchies/) offers the ability to control how persisted data is shown through UX Controls such as a Property Pane or a Hierarchical View. There are two approaches to address derived properties with it:

- Via [Calculated Properties](https://www.itwinjs.org/presentation/content/calculatedpropertiesspecification/), which can be used if the calculation involved can be expressed in terms of an [ECExpression](https://www.itwinjs.org/presentation/advanced/ecexpressions/).

- Via a [Custom Renderer](https://www.itwinjs.org/reference/presentation-common/presentationrules/customrendererspecification/), which provides the opportunity to write any logic programmatically needed to render the values and/or behavior of a derived property in the UX.

2. ECViews

If the calculation of derived properties can be expressed in terms of the [ECSQL](../../../learning/ECSQL.md) query language, one can define them in a BIS schema as properties part of an [ECView](../../../learning/ECSqlReference/Views.md). This approach may still need the usage of the aforementioned Presentation Library in order to control when the classes and properties defined in an ECView should be shown at the UX level.

## Authoring-focused properties

iTwin Native applications, which use BIS repositories as their primary Data Store, typically need to persist some data that is mainly the input of the authoring workflow(s) that it was designed with. Such workflows assist the users of the application to create complex discipline-specific Elements and related data. Authoring-focused properties are typically application-specific; no other consumers of such data are expected. Examples include:

- Overall style (Line-style, font, arrow-style, etc) and any other related setting associated to a Dimensioning element.
- Settings (e.g. prefix, seed, sequence, suffix, etc) that drive the automatic assignment of *Names* on certain Elements.
- Properties associated to Template-recipes and other parametric algorithms that help users create Road, Rail or Bridge 3D models.

Each iTwin Native application shall evaluate the aforementioned strategies while modeling authoring-focused properties, keeping in mind considerations such as desired UX behaviors. In general, essential properties of Elements modeling real-world Entities are not mixed with autoring-focused properties on the same Element-class. The latter are typically introduced via application-specific Element or Aspect subclasses, or as JSON data. This last option leads to the need of custom application UX developments that expose it correctly to its users.

## Summary

The following table summarizes the situations appropriate for the different approaches presented above.

| Situation | Approach |
| --- | --- |
| Independent Essential Properties | Element Properties |
| Dependent Essential Properties | Mandatory Element Aspect |
| Non-essential / Optional Properties | Element Aspect |
| Association Properties | Link-table Relationship Properties |
| Derived Properties | Presentation Rules or ECView |
| Authoring-focused data | Any of above or Separate JSON-based property |
| Adhoc data | Element.JsonProperties |

---
| Next: [Mixins](./mixins.md)
|:---
