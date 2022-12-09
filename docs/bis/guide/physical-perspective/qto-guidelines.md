# Quantity takeoffs: Guidelines

## Introduction

Quantity takeoffs and material estimating are an important use-cases for BIS. Their computation feeds into a wide number of applications such as Carbon Footprint, Costing and Construction scheduling. [Physical Materials](./physical-materials.md) explained the standard patterns in BIS in order to understand the Physical Material any Physical Element is made of. The next step towards enabling material estimating involves explaining the actual quantity values.

## General approach

It is expected that each Discipline-Physical schema includes relevant quantities as first-class properties of its classes using appropriate names for the domain and applicable [Kind of Quantity](../../ec/kindofquantity.md) definitions.

## Fallback strategies

Since not all BIS schemas at the Discipline-Physical layer have quantity-related properties, a fallback approach is needed. This approach primarily targets iModel Connectors and iModel-writers in need to write quantity-related data for BIS domains which do not exist yet, or may not have the equivalent properties yet.

The first fallback strategy is the usage of the aspect classes from the [Quantity Takeoffs Aspects](../../domains/quantitytakeoffsaspects.ecschema) schema. It contains a number of commonly used quantity-related properties that can be attached to any Element as unique-aspects.

As a last-resort, if the properties are not available in a standard domain or the QTO schema, the iModel Connector or iModel-writer may introduce them into their own Application-level schema. This strategy should be seen as temporary, and a request to add those missing quantity-related properties should be made to the BIS Working Group.

## Data duplication during transitions to data-alignment

As it was explained, the fallback approaches described above to store quantity-related properties missing from a Discipline-Physical schema are considered temporary solutions. Once those missing properties are added to the appropriate domain, technically aligning those concepts, iModel Connectors and iModel writers shall be updated in order to target them.

However, it is still expected that iModel Connectors and iModel writers continue to write the same data in terms of the fallback approach that they were using in order to prevent immediate disruptions to any existing consumers of their output. Therefore, they shall plan the transition from the fallback strategy into the aligned approach by providing a specified period of time in which data will be duplicated. The details of the transition period decided for a particular iModel Connector or iModel writer component shall be communicated to their consumers accordingly.

## Discoverability of Quantity Takeoff properties

The expectation that the definition of quantity-related properties include Kind of Quantity metadata enables their basic discovery based on their persistence unit.

As an example, an application interested in discovering properties that capture a Volumetric quantity about an Element can do so by gathering any of its properties whose persistence unit is cubic metres.

---
| Next: [Functional Models and Elements](../other-perspectives/functional-models-and-elements.md)
|:---
