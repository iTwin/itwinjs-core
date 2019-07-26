# Content-related Terminology

## Primary Class

ECClass we requested content for.

## Primary Instance

ECInstance we requested content for.

## Select Class

ECClass we're selecting data from.

## Select Instances

ECInstances that we get when selecting from [select classes](#select-class).

## Related Instance

ECInstance that is related to [select instance](#select-instances).

## Related Properties

Properties that belong to a [related instance](#related-instance) rather
than [select instance](#select-instances).

## Property Merging

When content is requested for multiple different classes and they all have similar
properties, multiple properties may get merged under one field.

Example: requesting content for *Window* and *Door* classes which both have property
*Height* - content will contain only one field with name *Height* and values of
both *Window* and *Door* instances will be put under that field.

Properties are considered similar if:
- Names are equal
- Types are equal
- Editors are equal
- For [related properties](#related-properties) only: related to the same property

## Value Merging

When content is requested with [ContentFlags.MergeResults]($presentation-common)
flag and contains more than 1 result row, its values are merged
into 1 record. This is generally used only for property pane use
case where we may request content for multiple selected elements.

Example of merged values:

Row       |    Field 1    |         Field 2        |         Field 1        |
----------|---------------|------------------------|------------------------|
row 1     |   has value   |        has value       |            -           |
row 2     |   has value   |           -            |        has value       |
**Result**| **has value** | **\*\*\*Varies\*\*\*** | **\*\*\*Varies\*\*\*** |

The above example would render into a similar property grid:

Field       | Value               |
------------|---------------------|
**Field 1** | has value           |
**Field 2** | \*\*\*Varies\*\*\*  |
**Field 3** | \*\*\*Varies\*\*\*  |

## Nested Content

In most cases property values are primitive, arrays or structs. However,
it is possible to set up [related properties](#related-properties) using
one-to-many or many-to-many relationship which creates, what we call,
nested content.

Example:
```
           Model
          /  |  \
         /   |   \
        /    |    \
Element1 Element2 Element3
```
In the above example *Model* has 3 related *Element* instances. We can
request content for *Model* and ask to additionally show related *Element*
properties. In this case element properties are be called
**nested content** because properties of multiple *Element* instances are
displayed as a single *Model* property. The property is created as an array
of structs where each struct is created from *Element* instance.
