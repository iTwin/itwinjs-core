---
ignore: true
---
# NextVersion

## Markers may now have HTML Decorations

Markers are used to position decorations in a view that follow a position in world coordinates. Previously they could display World Decorations and Canvas Decorations. They may now also include an optional HTML Decoration by assigning the "htmlElement" member. See [Marker]($frontend) documentation for details.

## Updates to Authorization

* [OidcBrowserClient]($frontend) now uses local storage instead of session storage to store access tokens. The state of the authorization would therefore now be preserved if the browser was closed and reopened.<br/>
**Note**: For this to work, it's required that the user not have modified the browser settings to clear local storage on exit.

* [OidcBrowserClient]($frontend) can now be used in authorization code workflows. A new responseType parameter can be set to "code" to support these workflows. This also requires a new client to be registered.
*
* [OidcAgentClient]($clients-backend) is now available as beta (it was marked internal earlier). Using the client requires an Agent registration and potential changes to the Connect Project settings - see more documentation in [OidcAgentClient]($clients-backend).

## Display system optimizations
  * The WebGL rendering system now takes advantage of Vertex Array Objects if they are available via an extension.  These provide a measurable performance increase in certain datasets.

## Enhancements to IModelDb.exportGraphics

* [IModelDb.exportGraphics]($imodeljs-backend) can now optionally return information about [GeometryPart]($imodeljs-backend) instances encountered in a [GeometryStream]($common). [IModelDb.exportPartGraphics]($imodeljs-backend) can then be used to handle this information in a more efficient manner.

* [IModelDb.exportGraphics]($imodeljs-backend) can now optionally return information about linework (or "open") geometry encountered in a GeometryStream.

* An example GLTF 2.0 exporter demonstrating these features is now available under test-apps in the iModel.js monorepo.
