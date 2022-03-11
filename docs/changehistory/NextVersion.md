---
publish: false
---
# NextVersion

## @itwin/webgl-compatibility changes

### Detecting integrated graphics

A `usingIntegratedGraphics` property has been added to [WebGLRenderCompatibilityInfo]($webgl-compatibility). If true, there is a likelihood that integrated graphics are being used. This can be used to warn users on systems with both integrated graphics and dedicated graphics that they should try to switch to their dedicated graphics for better performance. Please note this property has the possibility of providing false positives and negatives. A user should use this property mainly as a hint and manually verify what graphics chip is being used.
