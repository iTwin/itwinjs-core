---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Frontend](#frontend)
    - [Planar clip mask and classifier textures are sized to the viewport](#planar-clip-mask-and-classifier-textures-are-sized-to-the-viewport)

## Frontend

### Planar clip mask and classifier textures are sized to the viewport

The off-screen texture used to render planar clip masks and [spatial classifiers]($docs/learning/display/Classification.md) was always allocated at the maximum supported size (up to 4096x4096 texels), so every frame paid for rasterizing it regardless of the viewport size. It is now sized to four times the viewport's larger dimension (rounded up to a multiple of 256 and still capped at the maximum), which preserves the texel density the fixed-size texture provided to a 1024-pixel viewport. Viewports of 1024 pixels or more in either dimension are unaffected; smaller viewports use less GPU memory and render masked and classified frames faster, most noticeably on software renderers.
