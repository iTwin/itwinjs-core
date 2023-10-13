---
publish: false
---
# NextVersion

Table of contents:

- [Electron 27 support](#electron-27-support)

## Electron 27 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 27](https://www.electronjs.org/blog/electron-27-0).

## Display

### Colorizing Clip Intersections

Geometry which intersects clip volumes can now be colorized with [ClipStyle.intersectionStyle]($common). The images below illustrate this effect, first with the intersection style turned off, second with it turned on.

![No Intersection Style](./assets/IntersectionStyle-Off.jpg "No intersection style is applied.") ![Default Intersection Style](./assets/IntersectionStyle-Default.jpg "Geometry determined to intersect the clip plane is recolored white at a width of one pixel.")

You can toggle this colorization on and off using [ClipStyle.colorizeIntersection]. The style of this colorization can be controled using [ClipStyle.intersectionStyle]($common)by defining a [ClipIntersectionStyle]($common). [ClipIntersectionStyle.color]($common) defines the color to apply to the intersecting geometry, and [ClipIntersectionStyle.width]($common) defines the number of pixels considered to be intersecting the clip volume, which will therefore be colorized. The image below illustrates an altered [ClipStyle.intersectionStyle]($common), with [ClipIntersectionStyle.color]($common) set to red, and [ClipIntersectionStyle.width]($common) set to 5.

![Altered Intersection Style](./assets/IntersectionStyle-Altered.jpg "Geometry determined to intersect the clip plane is recolored red at a width of five pixels.")
