---
publish: false
---
# NextVersion

## @itwin/core-ecschema-metadata

### Additions

- Added [FormatSetFormatsProvider]($ecschema-metadata) class that implements [MutableFormatsProvider]($quantity) to manage format definitions within a format set. This provider supports adding and removing formats at runtime and automatically updates the underlying format set when changes are made.

## Display

### Draco decoding

Draco decoding in iTwin.js has been changed so that the loaders.gl dependency will no longer use a CDN to request the draco-decoder source files. Instead, we now bundle those resources into iTwin.js from a new draco3d dependency. We ask the loaders.gl library to locally use those resources.
