---
ignore: true
---
# NextVersion

## Color mix property added to thematic gradient settings

Thematic display gradient properties now supports a colorMix value for mixing the color of background map terrain or point clouds in with the thematic gradient color.  The `colorMix` property of [ThematicGradientSettings]($common) is a value between 0.0 and 1.0, defaulting to 0.0, which determines the percentage of the original color to blend in with the thematic gradient color (so 0.0 will be only the thematic gradient color, and 1.0 will be only the original terrain map or point cloud color).

![thematic rendering of background map terrain with colorMix set to 0.0, 0.33, and 0.67](./assets/thematicTerrainColorMix.png)
<p align="center">Thematic rendering of background map terrain with colorMix set to 0.0, 0.33, and 0.67</p>
