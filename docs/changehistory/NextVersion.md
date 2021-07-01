---
publish: false
---
# NextVersion

## Edges for decoration graphics

Graphics produced by a [GraphicBuilder]($frontend) can now produce edges for surfaces. By default, edges are only produced for graphics of type [GraphicType.Scene]($frontend), and only if the [Viewport]($frontend)'s [ViewFlags]($common) specify that edges should be displayed. To generate edges for other types of graphics, or to prevent them from being generated, override [GraphicBuilderOptions.generateEdges]($frontend) or [GraphicBuilder.wantEdges]($frontend) when creating the graphic. Note that surfaces will z-fight with their edges to a degree unless the graphic is also pickable - see [GraphicBuilderOptions.pickable]($frontend).

