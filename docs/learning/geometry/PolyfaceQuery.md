
# Examples of `PolyfaceQuery` methods

## Partitioning by vertex and edge connectivity

|  |  |
---|---|
| A single mesh with 5 facets  | ![>](./figs/PolyfaceQuery/PartitionByConnectivity/SingleMesh5Facets.png) |
| create arrays of facet indices that share any vertex contact  | const facetIndexArraysWithVertexConnectivity = PolyfaceQuery.partitionFacetIndicesByEdgeConnectedComponent(polyface) |
| extract as separate meshes |  const fragmentPolyfaces = PolyfaceQuery.clonePartitions(polyface, facetIndexArraysWithVertexConnectivity);|
| 2 separate Polyface meshes (red, green), each with at least vertex-to-vertex connectivity | ![>](./figs/PolyfaceQuery/PartitionByConnectivity/SplitByVertexConnectivity.png)|
| create arrays of facet indices that share an entire edge  | const facetIndexArraysWithEdgeConnectivity = PolyfaceQuery.partitionFacetIndicesByEdgeConnectedComponent(polyface) |
| extract as separate meshes |  const fragmentPolyfaces = PolyfaceQuery.clonePartitions(polyface, facetIndexArraysWithEdgeConnectivity);|
| 3 separate Polyface objects (blue, drab, magenta), each with at least edge-to-edge connectivity | ![>](./figs/PolyfaceQuery/PartitionByConnectivity/SplitByEdgeConnectivity.png)|


Unit Test
  * source: imodeljs/core/geometry/src/test/clipping/PolyfaceQuery.test.ts
  * test name: "PartitionFacetIndicesByConnectivity"
  * output: imodeljs/core/geometry/src/test/output/PolyfaceQuery/PartitionFacetsByConnectivity.imjs

## Fixup TVertices

|  |  |
---|---|
| A mesh with 7 square facets. <br> Note that vertices from adjacent squares appear "within" some long edges. | ![>](./figs/PolyfaceQuery/TVertexFixup/AllQuadsShaded.png) |
| Skeletal display with circles near each vertex of each facet  <br> The circles indicate that each facet references only its actual corners <br> Red highlight shows "TVertex" situations | ![>](./figs/PolyfaceQuery/TVertexFixup/AllQuadsSectorMarkup.png) |
| After calling `PolyfaceQuery.cloneWithTVertexFixup` the long edges that passed through the T-Vertex <br> have vertices inserted <br> The two larger "squares" now reference (left of center) 9 and (upper right) 6 vertices | ![>](./figs/PolyfaceQuery/TVertexFixup/FixupSectorMarkup.png) |


Unit Test
  * source: imodeljs/core/geometry/src/test/clipping/PolyfaceQuery.test.ts
  * test name: "cloneWithTVertexFixup"
  * output: imodeljs/core/geometry/src/test/output/PolyfaceQuery/cloneWithTVertexFixup.imjs

## Fixup Colinear Edges

|  |  |
---|---|
| A mesh with 2 rectangular facets. <br> Note that along the long edges there are multiple interior vertices. | ![>](./figs/PolyfaceQuery/ColinearEdgeFixup/BeforeColinearEdgeFixup.png) |
| Skeletal display with circles indicating interior vertices within the facets. | ![>](./figs/PolyfaceQuery/ColinearEdgeFixup/SectorsBefore.png) |
| After `PolyfaceQuery.cloneWithColinearEdgeFixup` <br> each rectangle only has 4 vertices | ![>](./figs/PolyfaceQuery/ColinearEdgeFixup/AfterColinearEdgeFixup.png) |
| Skeletal display with circles indicating interior vertices within the facets. | ![>](./figs/PolyfaceQuery/ColinearEdgeFixup/SectorsAfter.png) |

Note that colinearEdgeFixup and TVertexFixup have tricky interactions.  If colinearEdgeFixup is applied to the final figure (blue markup) of the TVertexFixup section (above), the locally colinear edges within the large rectangles are _not_ removed.  This the colinear edge logic will notice that those vertices are incident to other facets where the vertex is a true corner, and hence should not be removed.

Unit Test
  * source: imodeljs/core/geometry/src/test/clipping/PolyfaceQuery.test.ts
  * test name: "cloneWithColinearEdgeFixup"
  * output: imodeljs/core/geometry/src/test/output/PolyfaceQuery/cloneWithColinearEdgeFixup.imjs





