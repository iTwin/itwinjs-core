# Contour Display

Contour display allows a user to apply specific contour line renderings to subcategories within a scene.

iTwin.js provides the following API to use this feature:

- [DisplayStyle3dSettings]($common) now has a `contours` property which contains all of the subcategories-to-styling association data necessary to enable this feature. That object is of type [ContourDisplay]($common).
- [ContourDisplay]($common) defines how contours are displayed in the iModel based on a list of [ContourGroup]($common) objects in the `groups` property. Whether or not contours will be displayed in the viewport is controlled by this object's `displayContours` property, which defaults to false.
- [ContourGroup]($common) describes an association of subcategories to contour styling. It contains a set of subcategory IDs titled `subCategories`. Those subcategories will have the contour styling within the same group's [Contour]($common) `contourDef` object applied to them.
- [Contour]($common) describes the rendering settings that apply to a specific set of subcategories within a [ContourGroup]($common). This actually describes stylings for two sets of contours: major and minor. These stylings are separate from each other. The minor contour occurs at a defined interval in meters. These intervals draw at a fixed height; they are not dependent on the range of the geometry to which they are applied. The major contour is dependent on the minor contour. The interval of its occurence is not measured directly in meters; rather its occurence is determined by the major interval count thusly: every nth contour will be styled as a major contour where n = the major interval count. For example, if you set this number to 1, every contour will be styled as a major contour. When it is 2, every other contour will be styled as a major contour, and so on. The properties describing how major and minor contours are styled are listed here:
  - `majorStyle` is the style that a major contour line will use. Defaults to an instantation of [ContourStyle]($common) using `pixelWidth` of 2 and default values for the other properties.
  - `minorStyle` is the style that a minor contour line will use. Defaults to an instantation of [ContourStyle]($common) using default values for the properties.
  - `minorInterval` is the interval for the minor contour occurrence in meters; these can be specified as fractional. Defaults to 1. If a value <= 0 is specified, this will be treated as 1 meter.
  - `majorIntervalCount` is the count of minor contour intervals that define a major interval (integer > 0). A value of 1 means no minor contours will be shown, only major contours. Defaults to 5. If a value < 1 is specified, this will be treated as 1.
  - `showGeometry`, if true, shows underlying geometry along with the associated contours. If false, only shows the contours, not the underlying geometry. Defaults to true.
- [ContourStyle]($common) describes the style settings used by either a major or minor contour. It contains the following properties:
  - `color` is a color used by the major or minor contour of type [RgbColor]($common). Defaults to black.
  - `pixelWidth` is the width in pixels of a major or minor contour line, using range 1 to 8.5 in 0.5 increments. Defaults to 1.
  - `pattern` is the line pattern applied to a major or minor contour line of type [LinePixels]($common). Defaults to [LinePixels.Solid]($common).

Consult the following code for an example of enabling and configuring contour display in iTwin.js:

```ts
[[include:Setup_ContourDisplay]]
```

Here is a sample screenshot of applying some contour display settings to a terrain iModel:

![contour display example](../../changehistory/assets/contour-display.png "Example of applying contour line settings to an iModel of some terrain")
