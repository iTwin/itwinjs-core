---
publish: false
---
# NextVersion

Table of contents:

- [Geometry](#geometry)
  - [Clip any curve](#clip-any-curve)
- [Electron 26 support](#electron-26-support)
- [Locating and serializing schemas](#locating-and-serializing-schemas)

## Geometry

### Clip any curve

The new method [ClipUtilities.clipAnyCurve]($core-geometry) clips the input curve or region. One just needs to pass an [AnyCurve]($core-geometry) and a [Clipper]($core-geometry), and the method returns the clipped curves or regions that lie inside the clipper.

Here is an example of clipping a union region:
![Clip union region](./assets/clip-union-region.jpg "A union region clipped by a 3D clipper")
and an example of clipping a parity region:
![Clip parity region](./assets/clip-parity-region.jpg "A parity region clipped by a 3D clipper")

## Electron 26 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 26](https://www.electronjs.org/blog/electron-26-0).

## Locating and serializing schemas

New APIs like [SchemaLoader]($ecschema-metadata) allow you to [locate schemas](../learning/serializing-xml-schemas.md/#schemas-from-an-imodel) in the context of an iModel.
You can serialize schemas using the new functions [SchemaXml.writeFile]($ecschema-locaters) and [SchemaXml.writeString]($ecschema-locaters).
