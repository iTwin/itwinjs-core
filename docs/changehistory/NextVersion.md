---
publish: false
---
# NextVersion

<<<<<<< HEAD
=======
Table of contents:

- [Electron 22 support](#electron-22-support)
- [Display system](#display-system)
  - [Eye-dome lighting of Point Clouds](#eye-dome-lighting-of-point-clouds)

## Electron 22 support

In addition to already supported Electron versions, iTwin.js now supports [Electron 22](https://www.electronjs.org/blog/electron-22-0).

## Display system

### Eye-Dome Lighting of Point Clouds

You can now apply eye-dome lighting (EDL) to point cloud reality models. This effect helps accentuate the depth, shape, and surface of a point cloud model. This is particularly helpful when a point cloud model lacks color data and would otherwise appear fully monochrome. The EDL settings are specified independently for each point cloud.

Note: EDL only applies when camera is enabled in the view.

To apply eye-dome lighting to a point cloud, you must apply a [RealityModelDisplaySettings]($common) to the model, customizing its point cloud display settings to utilize the eye-dome lighting properties, described below:

- [PointCloudDisplaySettings.edlMode]($common) specifies the mode to use for EDL. This defaults to "off". See [PointCloudEDLMode]($common) for more details.
- [PointCloudDisplaySettings.edlStrength]($common) specifies the strength value for the EDL effect, a positive floating point number. This defaults to 5.0.
- [PointCloudDisplaySettings.edlRadius]($common) specifies a radius value for the EDL effect, a positive floating point number which determines how far away in pixels to sample for depth change. This defaults to 2.0.
- [PointCloudDisplaySettings.edlFilter]($common) specifies a flag for whether or not to apply a filtering pass in the EDL effect; this only applies if edlMode is "full". This defaults to 1.0.
- [PointCloudDisplaySettings.edlMixWts1]($common) specifies a weighting value (a floating point number between 0 and 1 inclusive) to apply to the full image when combining it with the half and quarter sized ones; this only applies if edlMode is "full". This defaults to 1.0.
- [PointCloudDisplaySettings.edlMixWts2]($common) specifies a weighting value (a floating point number between 0 and 1 inclusive) to apply to the half image when combining it with the full and quarter sized ones; this only applies if edlMode is "full". This defaults to 0.5.
- [PointCloudDisplaySettings.edlMixWts4]($common) specifies a weighting value (a floating point number between 0 and 1 inclusive) to apply to the full image when combining it with the full and half sized ones; this only applies if edlMode is "full". This defaults to 0.25.
>>>>>>> 5b86047289 (Add Eye dome lighting for point clouds (#4530))
