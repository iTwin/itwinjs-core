---
ignore: true
---
# NextVersion

## Markers may now have HTML decorations

Markers are used to position decorations in a view that follow a position in world coordinates. Previously they could display World Decorations and Canvas Decorations. They may now also include an optional HTML Decoration by assigning the "htmlElement" member. See [Marker]($frontend) documentation for details.

## Updates to authorization

* [OidcBrowserClient]($frontend) now uses local storage instead of session storage to store access tokens. The state of the authorization would therefore now be preserved if the browser was closed and reopened.
**Note**: The browser setting to clear local storage on exit must not be enabled.

* [OidcBrowserClient]($frontend) can now be used in authorization code workflows. A new responseType parameter can be set to "code" to support these workflows. This also requires a new client to be registered.

* [OidcAgentClient]($clients-backend) is now available as beta (it was marked internal earlier). Using the client requires an Agent registration and potential changes to the Connect Project settings - see more documentation in [OidcAgentClient]($clients-backend).

## Support for vertex array objects

On systems that support the [required WebGL extension](https://developer.mozilla.org/en-US/docs/Web/API/OES_vertex_array_object), vertex array objects are used to improve display performance.

## Display system bug fixes

* Fixed two bugs in which [Viewport.changeCategoryDisplay]($frontend) and [Viewport.addViewedModels]($frontend) would sometimes fail to immediately update the contents of the viewport.

* Fixed a regression that prevented the tiles comprising the background map from being reprojected using the the geocoordinate system defined in the iModel, causing the map graphics to be incorrectly aligned with the model geometry.

* Fixed the behavior of the "Data Attribution" link that, when clicked, displays copyright information for map tiles displayed in the view. Previously it would always open an empty modal dialog. Now, if any copyright information is available, it will be correctly displayed in the dialog; otherwise, a toast message will be displayed indicating the unavailability of attribution.

* Fixed a bug where specular lighting would render incorrectly in a specific case when specular exponent was zero.

## Option to discard ImageBuffer alpha channel

Functions for converting the contents of an [ImageBuffer]($frontend) into an `HTMLCanvasElement` or PNG image now take an optional argument indicating whether or not the alpha channel should be preserved. [imageBufferToCanvas]($frontend), [imageBufferToPngDataUrl]($frontend), and [imageBufferToBase64EncodedPng]($frontend) all support the new argument.

## Enhancements to IModelDb.exportGraphics

* [IModelDb.exportGraphics]($backend) can now optionally return information about [GeometryPart]($backend) instances encountered in a [GeometryStream]($common). [IModelDb.exportPartGraphics]($backend) can then be used to handle this information in a more efficient manner.

* [IModelDb.exportGraphics]($backend) can now optionally return information about linework (or "open") geometry encountered in a GeometryStream.

* An example GLTF 2.0 exporter demonstrating these features is now available under test-apps in the iModel.js monorepo.

## Added a roadmap

[High level Roadmap](./Roadmap.md) - We want your feedback, check it out and help us improve it.

## Geometry

* Various new methods for manipulating polygons and curves
  * [RegionOps.computeXYAreaMoments]($geometry)
  * [RegionOps.constructPolygonWireXYOffset]($geometry)
  * [PolylineOps.compressByChordError]($geometry)
  * [CurveCurve.intersectionXYZ]($geometry)
* Correct stroking of [BezierCurve3d]($geometry)

