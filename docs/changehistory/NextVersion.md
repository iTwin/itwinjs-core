---
publish: false
---
# NextVersion

## Clipping enhancements

The contents of a [ViewState]($frontend) can be clipped by applying a [ClipVector]($geometry-core) to the view via [ViewState.setViewClip]($frontend). Several enhancements have been made to this feature:

### Colorization

[ClipStyle.insideColor]($common) and [ClipStyle.outsideColor]($common) can be used to colorize geometry based on whether it is inside or outside of the clip volume. If the outside color is defined, then that geometry will be drawn in the specified color instead of being clipped. These properties replace the beta [Viewport]($frontend) methods `setInsideColor` and `setOutsideColor` and are saved in the [DisplayStyle]($backend).

### Model clip groups

[ModelClipGroups]($common) can be used to apply additional clip volumes to groups of models. Try it out with an [interactive demo](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=swiping-viewport-sample). Note that [ViewFlags.clipVolume]($common) applies **only** to the view clip - model clips apply regardless of view flags.

### Nested clip volumes

Clip volumes now nest. For example, if you define a view clip, a model clip group, and a schedule script that applies its own clip volume, then geometry will be clipped by the **intersection** of all three clip volumes. Previously, only one clip volume could be active at a time.

## Promoted APIs

The following APIs have been promoted to `public`. Public APIs are guaranteed to remain stable for the duration of the current major version of a package.

### @bentley/webgl-compatibility

* The WebGL compatibility module API has been promoted to public. This API allows a user to determine the client system's level of compatibility with the iTwin.js rendering system's requirements for various features, both required and optional.
* See [queryRenderCompatibility]($webgl-compatibility) for an overview of how to query the client's compatibility.
* See [WebGLRenderCompatibilityInfo]($webgl-compatibility) for a description of the client's compatibility.
