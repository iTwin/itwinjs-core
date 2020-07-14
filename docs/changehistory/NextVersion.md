---
ignore: true
---
# NextVersion

## Hypermodeling marker filtering

Some iModels contain thousands of [SectionDrawingLocation]($backend)s. When hypermodeling is used with such iModels, this may result in display of thousands of [SectionMarker]($hypermodeling)s. While markers located close together will automatically cluster, and [SectionMarkerConfig]($hypermodeling) supports filtering markers based on model, category, or section type, some applications may want to apply their own filtering logic. They can now do so by implementing [SectionMarkerHandler]($hypermodeling) to customize the visibility of the markers.

## Device pixel ratio

[Device pixel ratio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) is the ratio of physical (screen) pixels to logical (CSS) pixels. For example, most mobile devices have a device pixel ratio of 2, causing UI controls to display at twice the size while still appearing sharp on the screen. Similarly, a desktop computer with a 4k monitor always has a 4k physical resolution, but the operating system may allow the UI to be arbitrarily scaled to the user's preferences. In such cases the number of logical pixels will not match the number of physical pixels.

Previously, when iModel.js computed the appropriate level of detail for tiles and decoration graphics, it exclusively used the logical resolution, ignoring device pixel ratio. On high-DPI devices this causes lower-resolution graphics to be displayed, resulting in a less detailed image.

Now, if [RenderSystem.Options.dpiAwareLOD]($frontend) is set to `true` when supplied to [IModelApp.startup]($frontend), level of detail computations will take device pixel ratio into account. This will result in a sharper image on high-DPI displays. However, it may also reduce display performance, especially on mobile devices, due to more tiles of higher resolution being displayed.

This option has no effect if [RenderSystem.Options.dpiAwareViewports]($frontend) is overridden to be `false`.
