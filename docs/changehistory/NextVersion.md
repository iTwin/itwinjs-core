---
ignore: true
---
# NextVersion

## Silhouettes for emphasis

The [Hilite]($common) effect can now be applied to individual features (elements, models, subcategories, etc) using [FeatureSymbology.Overrides]($frontend). The color, color ratios, and silhouette width can all be customized using [Viewport.emphasisSettings]($frontend) - the default settings apply a thick black silhouette to emphasized features with no effect on the features' own colors. If you are using [EmphasizeElements]($frontend), set its `wantEmphasis` property to control whether or not the emphasis settings are applied. Otherwise, have your [FeatureOverrideProvider]($frontend) specify which features are emphasized using [FeatureSymbology.Appearance.emphasized]($frontend) and optionally override [Viewport.emphasisSettings]($frontend).

![emphasis example](./assets/EmphasizedElements.png "Example showing default emphasis settings")

## Geometry

* [PolyfaceBuilder.addGreedyTriangulationBetweenLineStrings]($geometry) method to build triangles "between" loosely related linestrings.
* [RegionOps.consolidateAdjacentPrimitives]($geometry) method to consolidate adjacent lines and linestrings, and adjacent arcs of the same underlying circle or ellipse.
* [RegionOps.rectangleEdgeTransform]($geometry) method to decide if a Loop object or point array is a simple rectangle.

## Presentation

### Read-Only Mode

Added a flag [PresentationManagerProps.mode]($presentation-backend) to indicate that the backend always opens iModels in read-only mode and presentation manager
can make some optimizations related to reacting to changes in iModels. This is an optional property that defaults to previous behavior (read-write), but it's
strongly encouraged to set it to [PresentationManagerMode.ReadOnly]($presentation-backend) on read-only backends.
