---
publish: false
---
# NextVersion

Table of contents:

- [Display system](#display-system)
  - [Reality model display customization](#reality-model-display-customization)
- [AppUi](#appui)
  - [Setting allowed panel zones for widgets](#setting-allowed-panel-zones-for-widgets)

## Display system

### Reality model display customization

You can now customize various aspects of how a reality model is displayed within a [Viewport]($frontend) by applying your own [RealityModelDisplaySettings]($common) to the model. For contextual reality models, use [ContextRealityModel.displaySettings]($common); for persistent reality [Model]($backend)s, use [DisplayStyleSettings.setRealityModelDisplaySettings]($common).

For all types of reality models, you can customize how the model's color is mixed with a color override applied by a [FeatureAppearance]($common) or a [SpatialClassifier]($common). [RealityModelDisplaySettings.overrideColorRatio]($common) defaults to 0.5, mixing the two colors equally, but you can adjust it to any value between 0.0 (use only the model's color) and 1.0 (use only the override color).

Point clouds provide the following additional customizations:
- [PointCloudDisplaySettings.sizeMode]($common) controls how the size of each point in the cloud is computed - either as a specific radius in pixels via [PointCloudDisplaySettings.pixelSize]($common), or based on the [Tile]($frontend)'s voxel size in meters.
- When using voxel size mode, points can be scaled using [PointCloudDisplaySettings.voxelScale]($common) and clamped to a range of pixel sizes using [PointCloudDisplaySettings.minPixelsPerVoxel]($common) and [PointCloudDisplaySettings.maxPixelsPerVoxel]($common).
- [PointCloudDisplaySettings.shape]($common) specifies whether to draw rounded points or square points.
Table of contents:

## AppUi

### Setting allowed panel zones for widgets

When defining a Widget with AbstractWidgetProperties, you can now specify on which sides of the ContentArea the it can be docked. The optional prop allowedPanelTargets is an array of any of the following: "left", "right", "top", "bottom". By default, all regions are allowed. You must specify at least one allowed target in the array.
