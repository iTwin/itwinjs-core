# Blank IModelConnection

A [BlankConnection]($frontend) is an [IModelConnection]($frontend) that is **not** connected to an [IModelDb]($backend) backend.

## Background

Much of the iTwin.js frontend package is designed to communicate with a backend serving an iModel through an [IModelConnection]($frontend) via various RPC interfaces (e.g. [IModelReadRpcInterface]($common)). However, there are some cases where it is useful create Viewports *without* an iModel. The [BlankConnection.create]($frontend) method can be used to create a valid `IModelConnection` that is *not* actually associated with an iModel.

## Uses

Many services in the iTwin.js frontend package display information from sources other than an iModel. If you wish to open a viewport to show just that type of information, use a blank IModelConnection. For example:

- reality meshes (e.g. ContextCapture models)
- point clouds
- background maps
- terrain data
- markers
- decorations

## Restrictions

A blank IModelConnection can be used for creating Viewports that show graphics from sources other than an iModel, but remember that they *do not* have a backend. Therefore, it is not legal to attempt RPC requests against a blank IModelConnection. Most such operations will simply return nothing, but some will throw an exception. For example, all of the various forms of ECSQL queries will throw errors if attempted with a blank IModelConnection.

You can test whether an IModelConnection is blank, by using [IModelConnection.isBlank]($frontend). Note that `isOpen` will always be false for a `BlankConnection`, and `isBlank` will be true [N.B. The distinction is that isOpen will also return false for an IModelConnection that was originally opened against a backend but subsequently closed.]

## Example

To open a new blank connection, you can do something like this:

```ts
[[include:BlankConnection.open]]
```

then, to create a blank spatial view to show data from sources other than iModels, do something like this:

  ```ts
  [[include:CreateBlankView]]
  ```
