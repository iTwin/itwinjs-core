# Categories

A `Category` is a property of a `GeometricElement` that classifies its geometry for display purposes. That is, every GeometricElement is *in* one and only one Category. Furthermore, Categories are not hierarchical, that is, it not allowed to define a Category as the parent of another Category.

The visibility (on/off) of a category may be controlled per-view.

Categories are similar to *levels* in DGN and *layers* in DWG, as geometry-classification constructs.
Categories are similar to *categories* in RVT as being the parent concept of the construct that enables visibility and styling control over portions of geometry - i.e. SubCategory.

For more information about semantics vs. geometry classification in BIS, see [Classifying Elements](./data-classification.md).

## Category Classes

There are three Category classes, with this hierarchy:

- `DefinitionElement`
  - `Category` (abstract)
    - `DrawingCategory` (concrete & sealed)
    - `SpatialCategory` (concrete & sealed)

`DrawingCategory` is used for classifying `GeometricElement2d` elements via the  `GeometricElement2dIsInCategory` (concrete & sealed) relationship. `GeometricElement2dIsInCategory` relates each `GeometricElement2d` with exactly 1 `DrawingCategory`.

`SpatialCategory` is used for classifying `GeometricElement3d` elements via the `GeometricElement3dIsInCategory` (concrete & sealed) relationship. `GeometricElement3dIsInCategory` relates each `GeometricElement3d` with exactly 1 `SpatialCategory`.

Note that Categories are not relevant for Elements that are not subclasses of GeometricElements.

## SubCategories

A `SubCategory` is a *subdivision* of a `Category`. SubCategories allow GeometricElements to have multiple pieces of Geometry that can be independently visible and styled (color, linesStyle, transparency, etc.)

> It is important to understand that a `SubCategory` is **not** a `Category` (i.e. Categories do *not* nest.) GeometricElements are always related to a Category, not a SubCategory. That is, it makes no sense to say a `GeometricElement` is "on" a `SubCategory`.

A `SubCategory` always subdivides a single `Category`. This relationship is defined by the `CategoryOwnsSubCategories` relationship. Every Category has one SubCategory called the *default* SubCategory.

SubCategories are similar to *levels* in DGN, *layers* in DWG and *subcategories* in RVT as being the construct directly involved in visibility and styling of geometry.

An example of a Category is "Window". The "Window" Category might contain SubCategories "Pane", "Mullion" and "Hardware". If the Window Category is displayed, the "Pane" SubCategory may be displayed while the "Mullion" SubCategory may be turned off.

**Note:** If a GeometricElement's Category is off, the element is not displayed, period. SubCategory is only relevant when the Category of the element *is* displayed.

## Category and SubCategory Rank

Categories and SubCategories have a property called `Rank` that is defined by the following enum. It is meant to capture at what level a given Category or SubCategory was proposed. Applications can rely on the `Rank` property to understand the purpose of a given Category or SubCategory, when applicable.

```cpp
enum class Rank
  {
  System = 0, //!< This category is predefined by the system
  Domain = 1, //!< This category is defined by a domain.
  Application = 2, //!< This category is defined by an application.
  User = 3, //!< This category is defined by a user.
  };
```

## Category and SubCategory CodeValue

Category and SubCategory names comes from their `CodeValue`.

To avoid creating names that are unprintable, indistinguishable to users, and/or cannot be export to other systems, the following characters are disallowed in Category and SubCategory names:

`<>\\/.\"?*|,='&\n\t`

## Category CodeScope

Category is a subclass of DefinitionElement, and are therefore required to be in DefinitionModels. By convention, the Codes for Categories are scoped to their DefinitionModel.

For Categories that are meant to be specific to a discipline or Domain, create a DefinitionModel and use it for your Categories. This permits each Domain to have a unique set of Categories, even though their names are not necessarily unique across the Domains.

## SubCategory CodeScope

The `CodeScope` of a `SubCategory` is always its parent `Category`. That is, SubCategory CodeValues are only unique within their Category.

## SubCategory References in GeometryStreams

Every `GeometricElement2d` and `GeometricElement3d` has a `Category`. They also have a `GeometryStream` property that defines the geometry of the `Element`. Within that GeometryStream, 0..N references can be made to SubCategoryIds *of the element's Category* to control the visibility and style of
entries within the GeometryStream. Any reference to a SubCategoryId that is not a SubCategory of the element's Category is rejected.

## Data-writing applications and Categories

Each application synchronizing external data or authoring it directly on a BIS repository shall store its Categories on its own [Editing Channel](./../data-organization/top-of-the-world.md#editing-channels). That way each application can have its own set of Categories without risk of name collision with each other.

Applications should consider the SpatialCategories proposed by Standard BIS Domains, when applicable.

## Standardization of Categories

Categories are ultimately under the control of the user. Users may be interested in eventually standardizing the list of Categories and Subcategories used in a BIS repository, especially when its data is created by different applications. Standard BIS Domains as well as Applications may suggest *default* Categories to certain GeometricElements in order to aid towards that goal.

Categories proposed as defaults may correspond to one or more classes in the Domain ("Door", "Pavement", "Beam", etc.).

Every `GeometricElement` subclass does **not** need its own default `Category`. Two common Category patterns are:

   1. A Category is used for a class and all its descendent classes.
   2. A Category is used for a set of unrelated classes that have some conceptual similarity but do not fit rule 1.

<!-- TODO: Clarify how/where the Domain authors document the Categories. -->

---
| Next: [Information Hierarchy](../data-organization/information-hierarchy.md)
|:---
