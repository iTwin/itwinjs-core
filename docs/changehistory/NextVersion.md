---
ignore: true
---
# NextVersion

## Logo Cards

iModel.js now displays an icon in the lower left corner of viewports to provide credit attribution for software or data authors.

![iModel.js icon]($docs/learning/frontend/imodeljs_icon.png "Example showing iModel.js icon")

When the cursor moves over the icon, a set of *Logo Cards* with notices and logos for the content of the view appears. Applications may also add their own Logo Card to display information about their authors, versions, status, etc.

![logo cards]($docs/learning/frontend/logo-cards.png "Example logo cards")

If the user clicks or taps on the iModel.js icon, a modal dialog opens showing the logo cards.

See [Logo Cards]($docs/learning/frontend/LogoCards.md) for more information.

## Geometry

PolyfaceQuery methods to support edge visibility markup.

* PolyfaceQuery.setSingleEdgeVisibility (polyface, facetIndex, vertexIndex, value)
  * within indicated facet, mark visibility of edge that starts with indicated vertexIndex
* PolyfaceQuery.markPairedEdgesInvisible (polyface, sharpEdgeAngle?)
  * Mark all unpaired edges visible
  * Also marked paired edges with large angle across the edge visible.
  * mark all other paired edges invisible
* PolyfaceQuery.computeFacetUnitNormal (visitor, facetIndex, result?): Vector3d | undefined
  * move the visitor to the indicated facet and compute a unit normal with `PolygonOps.unitNormal`
* PolyfaceQuery.markAllEdgeVisibility (mesh, value : boolean)
  * mark all edges of all facets visible (true) or invisible (false)
