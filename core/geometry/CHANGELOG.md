# Change Log - @bentley/geometry-core

This log was last generated on Fri, 22 Nov 2019 14:03:34 GMT and should not be manually modified.

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- PolyfaceQuery services: PolyfaceQuery.markAllEdgeVisibility PolyfaceQuery.markPairedEdgesInvisible PolyfaceQuery.setSingleEdgeVisibility PolyfaceQuery.computeFacetUnitNormal 
- BUG#211602 Correct sectioning of meshes with (a) nonconvex facets and (b) multicomponent plane intersections
- Feature#211247 Intersect Ray with Sphere
- Spherical patch range; optional result in range3d.corners()
- Refactor analysis of range of a+b sin(theta) + c sin(theta)
- Added missing topic descriptions
- Added earthRadiusWGS84 constants

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- #193588 bugs in PolygonOffsetContext
- Mesh support: TVertexFixup and ColinearEdgeFixup
- Lightweight iterator over Point3ds contained in an IndexedXYZCollection; Transform.multiplyRange() returns a null range if input is a null range.

## 1.6.0
Wed, 09 Oct 2019 20:28:42 GMT

### Updates

- BUG#184729 and BUG#185436
- (TASK#175760 Triangulate between linestrings) (TASK#184495 consolidateAdjacentPrimitives) (TASK#184489 Test if points are a rectangle)
- BUG#184729 General matrix4d inverse

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- Eliminate use of Math.hypot
- add copyright headers to recent new files
- Task#175760 and Task#175773
- Polyface mesh "split to components"
- Fast range filtering for cutFill (and other) searches
- Incremental Edge Flipping, optimize Delauney circle test
- Explicit undefined initialization for HalfEdge
- upgrade to TypeScript 3.6.2

## 1.4.0
Tue, 10 Sep 2019 12:09:49 GMT

### Updates

- Region "in/on/out" tests
- Triangulation of isolated point array
- RegionOps methods to split curve sets
- PolyfaceClip.computeCutFill method
- New method ray3d.intersectionWithRange3d
- Added AnyGeometryQuery and AnySolidPrimitive union types; added type discriminator fields to GeometryQuery, SolidPrimitive, CurvePrimitive, and CurveCollection; tightened `any` return types for IModelJson.Reader methods.

## 1.3.0
Tue, 13 Aug 2019 20:25:53 GMT

### Updates

- WireMoment computation; polyline filters for short edge, small triangle, perpendicular projection
- Triangulate cut faces in polyface clip.  Variant point data parse.  Bilinear Patch ray intersection"
- Construct offset from path with curves.
- Mesh principal axis computation.
- Document unit length rows/cols requirement of Matrix3d.toQuaternion
- Correct point4d normalization to handle small w values (NPC)
- #151464 Improved grid display performance.

## 1.2.0
Wed, 24 Jul 2019 11:47:26 GMT

### Updates

- When compressing linestrings, detect first/last segment colinear case.
- Consistent stroke counts on BezierCurve3d, BezierCurve3dH
- Full 3d intersection CurveCurve.intersectionXYZ (no bsplines)
- New method for polyline wire offset.
- WIP (1) improve duplicated edge handling in polygon booleans (2) improve variant point array handling
- Polyline simplification by Puecker-Douglas (chord distance)

## 1.1.0
Mon, 01 Jul 2019 19:04:29 GMT

### Updates

- Export bilinear patch (used by bing elevation)
- Removed missing group descriptions
- Add "extend" support to various CurvePrimitive.closestPoint methods.
- Add PolyfaceQuery methods to drape linestring to facets
- Priority queue sweep logic in HalfEdgeGraph
- (imodeljs-markup merge)
- PolarData class for x-y-r-theta constraint solve.   CurvePathWithDistanceIndex expose path with getter.
- Region centroid and polygon boolean methods
- TransitionSpiral bug fixes in transform, use of active interval
- Prevent triangle flip hang
- Bspline Curve chord tolerance
- Add quick-exit completion tests in earcut triangulation
- Update to TypeScript 3.5

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- PolyfaceQuery::sweepLinestringToFacetsXYreturnSweptFacets
- Correct (undocumented) methods
- PolyfaceClip class with plane, convex set clips.
- point/vector coverage
- Detect high-multiplicity knots when saturating a bspline. Skip those intervals in stroking.

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Adds parameter for api-extractor to validate missing release tags
- Fix for PolygonOps.centroidAreaNormal.
- View clip fixes and start of tools.
- Range1dArray coverage
- Coverage; enable public/internal verification.
- y
- Add doc to many methods.  Modernize ray intersect clip plane logic and methods.
- closestApproachRay3dRay3d.  centroid bugs
- ClipPlane enhancements;  method to compute clip faces for convex set intersection with range
- ClipPrimitive modernization
- Debug json clip plane usage
- add docs for methods in Arc3d, CurvePrimitive, Newton
- Add comments to (undocumented) methods
- LineString3d code coverage
- public and internal doc markup
- @public markup
- In FrustumAnimation, detect true center of rotationn
- Reduce memory allocations in clipping.
- Method docs, ConvexClipPlaneSetIntersectRange enhancements
- new method to check of clipper intersects range, with quick exit
-  ClipVector and ClipUtilities test and enhancements
- Triangulation bug (multiple holes not linked correctly)
- Fix broken links
- Put sourcemap in npm package.
- Setup a generic context for tracking client requests, and made various related enhancements to logging, usage tracking and authorization. 
- New code for regularizing a single face.
- Upgrade TypeDoc dependency to 0.14.2

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Rename/Refactor triangulation

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

-  geometry-core camel case
- allow subclasses of Range to use static methods
- Changes package.json to include api-extractor and adds api-extractor.json
- Use new buildIModelJsBuild script
- AxisAlignedBox and ElementAlignedBox are now typed to Range3d rather than classes
- clone methods are no longer generic
- Remove unneeded typedoc plugin dependency
- PolyfaceBuilder solid primitive improvements
- PolyfaceBuilder improvements.  Construct normals for sweeps.  Mesh pairing closure test.
- PolyfaceBuilder creates params and normals for all Solid types
- Mesh Normal bugs, some @internal markup
- Consistent naming of "get" methods in Growable arrays.
- Distribute .test.ts files to subdirectories
- Improve polygon triangulations quality by early flipping behind the earcut front
- added freeze methods to Angle and Point2d
- bug fixes in PolyfaceBuilder
- update for geometry GrowableXYArray usage
- New class SmoothTransformBetweenFrusta for smooth frustum animation
- Save BUILD_SEMVER to globally accessible map
- add optional argument to SmoothTransformBetweenFrusta
- upgrade to TypeScript 3.2.2

## 0.188.0
Wed, 16 Jan 2019 16:36:09 GMT

*Version update only*

## 0.187.0
Tue, 15 Jan 2019 15:18:59 GMT

*Version update only*

## 0.186.0
Mon, 14 Jan 2019 23:09:10 GMT

*Version update only*

## 0.185.0
Fri, 11 Jan 2019 18:29:00 GMT

*Version update only*

## 0.184.0
Thu, 10 Jan 2019 22:46:17 GMT

### Updates

- code coverage.  sphere and torus derivative errors. solids reject singular transforms.
- Add to quaternion tests

## 0.183.0
Mon, 07 Jan 2019 21:49:21 GMT

*Version update only*

## 0.182.0
Mon, 07 Jan 2019 13:31:34 GMT

*Version update only*

## 0.181.0
Fri, 04 Jan 2019 13:02:40 GMT

### Updates

- Suppress geometry test console output (except performance)

## 0.180.0
Wed, 02 Jan 2019 15:18:23 GMT

### Updates

- Special case logic for opening bspline arcs (which are pre-saturated in bezier form)
- Add quaternion methods
- Add quaternion tests - fix transpose

## 0.179.0
Wed, 19 Dec 2018 18:26:14 GMT

*Version update only*

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

*Version update only*

## 0.177.0
Wed, 12 Dec 2018 17:21:31 GMT

*Version update only*

## 0.176.0
Mon, 10 Dec 2018 21:19:45 GMT

*Version update only*

## 0.175.0
Mon, 10 Dec 2018 17:08:55 GMT

*Version update only*

## 0.174.0
Mon, 10 Dec 2018 13:24:09 GMT

*Version update only*

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

### Updates

- Custom imodelJs noDirectImport lint rule implemented, noDuplicateImport lint rule turned on.

## 0.172.0
Tue, 04 Dec 2018 17:24:39 GMT

*Version update only*

## 0.171.0
Mon, 03 Dec 2018 18:52:58 GMT

### Updates

- Geometry Coverage

## 0.170.0
Mon, 26 Nov 2018 19:38:42 GMT

*Version update only*

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

*Version update only*

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

*Version update only*

## 0.167.0
Fri, 16 Nov 2018 21:45:44 GMT

### Updates

- Coverage
- AnalyticRoots and Polynomial coverage

## 0.166.0
Mon, 12 Nov 2018 16:42:10 GMT

*Version update only*

## 0.165.0
Mon, 12 Nov 2018 15:47:00 GMT

### Updates

- bspline docs.    Add bezier curve left and right subdivision methods"
- Correct return value (undefined is right!) for LineString3d.pointAt (index)

## 0.164.0
Thu, 08 Nov 2018 17:59:20 GMT

### Updates

- Complete analysis import test application
- Add support for PolyfaceAuxData to PolyfaceVisitor
- implement curve method "moveSignedDistanceFromFraction"
- polyface.compress performance problem -- extraneous reallocations
- CurveChainWithDistanceIndex derivative and distance methods
- PolyfaceAuxData documentation
- Updated to TypeScript 3.1

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

### Updates

- CurveChainWithDistanceIndex WIP
- fromJSON tests.    Geometry.isAlmostEqualNumber uses smallAngleRadians as absolute minimum tolerance.
- Add tests for fromJSON methods (small classes)
- Expand test coverage.    Use small absolute tolerance in Geometry.isAlmostEqualNumber.  "w" component of BezierCurve3d.getPolePoint4d.

## 0.162.0
Wed, 24 Oct 2018 19:20:06 GMT

### Updates

- Merge
- fromJSON tests.    Geometry.isAlmostEqualNumber uses smallAngleRadians as absolute minimum tolerance.
- rename PNG files as png

## 0.161.0
Fri, 19 Oct 2018 13:04:14 GMT

*Version update only*

## 0.160.0
Wed, 17 Oct 2018 18:18:38 GMT

*Version update only*

## 0.159.0
Tue, 16 Oct 2018 14:09:09 GMT

*Version update only*

## 0.158.0
Mon, 15 Oct 2018 19:36:09 GMT

*Version update only*

## 0.157.0
Sun, 14 Oct 2018 17:20:06 GMT

*Version update only*

## 0.156.0
Fri, 12 Oct 2018 23:00:10 GMT

### Updates

- Initial release

