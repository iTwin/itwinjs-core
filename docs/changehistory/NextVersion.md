---
publish: false
---
# NextVersion

## Hiliting models and subcategories

Support for hiliting models and subcategories using [HiliteSet]($frontend) has been promoted from `@beta` to `@public`. This allows applications to toggle hiliting of all elements belonging to a set of [Model]($backend)s and/or [SubCategory]($backend)'s. This feature can work in one of two modes, specified by [HiliteSet.modelSubCategoryMode]($frontend):
- Union - an element will be hilited if either its model or its subcategory is hilited; or
- Intersection - an element will be hilited if both its model and its subcategory are hilited.

Applications often work with [Category]($backend)'s instead of subcategories. You can use the new [Categories API](#frontend-category-apis) to obtain the Ids of the subcategories belonging to one or more categories.

## Frontend category APIs

A [Category]($backend) provides a way to organize groups of [GeometricElement]($backend)s. Each category contains at least one [SubCategory]($backend) which defines the appearance of geometry belonging to that subcategory. This information is important for frontend code - for example, the display system needs access to subcategory appearances so that it can draw elements correctly, and applications may want to [hilite subcategories](#hiliting-models-and-subcategories) in a [Viewport]($frontend).

[IModelConnection.categories]($frontend) now provides access to APIs for querying this information. The information is cached upon retrieval so that repeated requests need not query the backend.
- [IModelConnection.Categories.getCategoryInfo]($frontend) provides the Ids and appearance properties of all subcategories belonging to one or more categories.
- [IModelConnection.Categories.getSubCategoryInfo]($frontend) provides the appearance properties of one or more subcategories belonging to a specific category.
