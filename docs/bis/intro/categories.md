# Categories

A `Category` is a property of a `GeometricElement` that *categorizes* its geometry. That is, every GeometricElement is *in* one and only one Category.

The visibility (on/off) of a category may be controlled per-view.

Categories are similar to *levels* in DGN, *layers* in DWG, and *categories* in RVT.

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

An example of a Category is "Window". The "Window" Category might contain SubCategories "Pane", "Mullion" and "Hardware". If the Window Category is displayed, the Pane SubCategory may be displayed while the Mullion SubCategory may be turned off.

**Note:** If a GeometricElement's Category is off, the element is not displayed, period. SubCategory is only relevant when the Category of the element *is* displayed.

## Category Rank

Categories have a property called `Rank` that is defined by this enum:

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

## Domain Standardization of SpatialCategories

Every Domain should provide standard Categories for the GeometricElements that it creates. Categories will often correspond to classes in the Domain ("Door", "Window", "Beam", etc.). SubCategories within each Category may correspond to portions of the GeometricElement ("Hardware") or to important geometric aspects of the GeometricElement ("CenterLine").

Every `SpatialElement` subclass does **not** need its own `SpatialCategory`. Two common SpatialCategory patterns are:

   1. A SpatialCategory is used for a class and all its descendent classes.
   2. A SpatialCategory is used for a set of unrelated classes that have some conceptual similarity but do not fit rule 1.

<!-- TODO: Clarify how/where the Domain authors document the Categories. -->

## User Control of DrawingCategories

DrawingCategories are similar to drawing layer/level standards and are ultimately under the control of the user. It is intended that DrawingCategories will be distributed via catalogs in the future.

<!-- TODO: Elaborate on how user can (or will be able to) control drawing standards in the future. They won't be manually changing GeometricElement2dIsInCategory? -->

## iModel Connectors and Categories

Each iModel Connector job should create a `DefinitionModel` for its Categories. That way each connector can have its own set of Categories without risk of name collision with other jobs.

iModel Connectors should respect and use the standard SpatialCategories defined by the Domains.

---
| Next: [Schema Customization](./schema-customization.md)
|:---
