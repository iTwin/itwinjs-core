---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Frontend](#frontend)
    - [Planar clip mask and classifier textures are sized to the viewport](#planar-clip-mask-and-classifier-textures-are-sized-to-the-viewport)

## Frontend

### Planar clip mask and classifier textures are sized to the viewport

The off-screen texture used to render planar clip masks and [spatial classifiers]($docs/learning/display/Classification.md) was always allocated at the maximum supported size (up to 4096x4096 texels), so every frame paid for rasterizing it regardless of the viewport size. It is now sized to twice the viewport's larger dimension (rounded up to a multiple of 256 and still capped at the maximum), matching how background map draping is sized. Viewports of 2048 pixels or more in either dimension are unaffected; smaller viewports use less GPU memory and render masked and classified frames faster, most noticeably on software renderers.
