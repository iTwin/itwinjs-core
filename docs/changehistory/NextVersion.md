---
publish: false
---
# NextVersion

Table of contents:

- [Updated minimum requirements](#updated-minimum-requirements)
  - [Node.js](#nodejs)
  - [WebGL](#webgl)
  - [Electron](#electron)
- [Mesh offset](#mesh-offset)
- [Mesh intersection with ray](#mesh-intersection-with-ray)
- [Presentation](#presentation)
  - [Stopped "eating" errors on the frontend](#stopped-eating-errors-on-the-frontend)
  - [Hierarchy level filtering and limiting](#hierarchy-level-filtering-and-limiting)

## Updated minimum requirements

A new major release of iTwin.js affords us the opportunity to update our requirements to continue to provide modern, secure, and featureful libraries. Please visit our [Supported Platforms](../learning/SupportedPlatforms) documentation for a full breakdown.

### Node.js

Node 12 reached [end-of-life](https://github.com/nodejs/release#end-of-life-releases) in 2020, and Node 14 as well as Node 16 will do so shortly. iTwin.js 4.0 requires a minimum of Node 18.12.0, though we recommend using the latest long-term-support version.

### WebGL

Web browsers display 3d graphics using an API called [WebGL](https://en.wikipedia.org/wiki/WebGL), which comes in 2 versions: WebGL 1, released 11 years ago; and WebGL 2, released 6 years ago. WebGL 2 provides many more capabilities than WebGL 1. Because some browsers (chiefly Safari) did not provide support for WebGL 2, iTwin.js has maintained support for both versions, which imposed some limitations on the features and efficiency of its rendering system.

Over a year ago, support for WebGL 2 finally became [available in all major browsers](https://www.khronos.org/blog/webgl-2-achieves-pervasive-support-from-all-major-web-browsers). iTwin.js now **requires** WebGL 2 - WebGL 1 is no longer supported. This change will have no effect on most users, other than to improve their graphics performance. However, users of iOS will need to make sure they have upgraded to iOS 15 or newer to take advantage of WebGL 2 (along with the many other benefits of keeping their operating system up to date).

[IModelApp.queryRenderCompatibility]($frontend) will now produce [WebGLRenderCompatibilityStatus.CannotCreateContext]($webgl-compatibility) for a client that does not support WebGL 2.

### Electron

Electron versions from 14 to 17 reached their end-of-life last year, and for this reason, support for these versions was dropped. To be able to drop Node 16, Electron 22 was also dropped. iTwin.js now supports only Electron 23.

## Mesh offset

The new static method [PolyfaceQuery.cloneOffset]($core-geometry) creates a mesh with facets offset by a given distance. The image below illustrates the basic concepts.

![Offset Example 1](./assets/cloneOffsetMeshBoxes.png "Original box mesh, offset box, and chamfered offset box")

At left is the original box, size 3 x 5 in the large face and 2 deep. The middle is constructed by `cloneOffset` with offset of 0.15 and default options. Note that it maintains the original sharp corners. The right box is constructed with [OffsetMeshOptions.chamferAngleBetweenNormals]($core-geometry) of 80 degrees. This specifies that when the original angle between normals of adjacent facets exceeds 80 degrees the corner should be chamfered, creating the slender chamfer faces along the edges and the triangles at the vertices. The default 120 degree chamfer threshold encourages corners to be extended to intersection rather than chamfered.

The image below illustrates results with a more complex cross section.

![Offset Example 2](./assets/cloneOffsetMeshExample2.png "Offset with sharp corners and with chamfers.")

The lower left is the original (smaller, inside) mesh with the (transparent) offset mesh around it with all sharp corners. At upper right the offset has chamfers, again due to setting the `chamferAngleBetweenNormals` to 120 degrees.

## Mesh intersection with ray

New functionality computes the intersection(s) of a [Ray3d]($core-geometry) with a [Polyface]($core-geometry). By default, [PolyfaceQuery.intersectRay3d]($core-geometry) returns a [FacetLocationDetail]($core-geometry) for the first found facet that intersects the infinite line parameterized by the ray. A callback can be specified in the optional [FacetIntersectOptions]($core-geometry) parameter to customize intersection processing, e.g., to filter and collect multiple intersections. Other options control whether to populate the returned detail with interpolated auxiliary vertex data: normals, uv parameters, colors, and/or the barycentric scale factors used to interpolate such data.

There is also new support for intersecting a `Ray3d` with a triangle or a polygon. [BarycentricTriangle.intersectRay3d]($core-geometry) and [BarycentricTriangle.intersectSegment]($core-geometry) return a [TriangleLocationDetail]($core-geometry) for the intersection point of the plane of the triangle with the infinite line parameterized by a ray or segment. Similarly, [PolygonOps.intersectRay3d]($core-geometry) returns a [PolygonLocationDetail]($core-geometry) for the intersection point in the plane of the polygon. Both returned detail objects contain properties classifying where the intersection point lies with respect to the triangle/polygon, including `isInsideOrOn` and closest edge data.

## Presentation

### Stopped "eating" errors on the frontend

The [PresentationManager]($presentation-frontend) used to "eat" errors and return default value instead of re-throwing and exposing them to consumers. This made it impossible for consumer code to know that an error occurred, which could cause it to make wrong decisions. The decision has been re-considered and now Presentation manager lets consumers catch the errors. This affects the following APIs:

- [PresentationManager.getNodes]($presentation-frontend)
- [PresentationManager.getNodesAndCount]($presentation-frontend)
- [PresentationManager.getContent]($presentation-frontend)
- [PresentationManager.getContentAndSize]($presentation-frontend)
- [PresentationManager.getPagedDistinctValues]($presentation-frontend)
- [PresentationManager.getDisplayLabelDefinitions]($presentation-frontend)

Consumers of these APIs should make sure they're wrapped with try/catch blocks and the errors are handled appropriately.

### Hierarchy level filtering and limiting

Two new features have been made available to help working with very large hierarchies - hierarchy level filtering and limiting. Filtering was already available since `3.6` and has been promoted to `@beta`, limiting has been newly added as `@beta`. See [hierarchy filtering and limiting page](../presentation/hierarchies/FilteringLimiting.md) for more details.
