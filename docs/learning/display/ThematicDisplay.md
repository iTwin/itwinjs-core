# Thematic Display

Thematic display applies a color gradient to the scene to help visualize attributes of the geometry within the scene. The following attributes are supported:

- Elevation: color is assigned based on the Z position in world space.
- Slope: color is assigned based on the angle between the surface and a given axis (often, the world up-vector).
- Hill shade: color is assigned based on the direction of the sun shining on the surface.
- Sensor distance: given any number of sensors positioned in the scene and providing a sensor reading value, color is assigned based on the values provided by the sensors, weighted by distance from each sensor.

The gradient can be applied smoothly, or using discrete steps. The stepped gradient can optionally display delimiters between each discrete color; or the delimiters can be displayed by themselves producing an isoline visualization. It can be applied to design models, reality models, and 3d terrain meshes.

## Example images

Thematic height - stepped:

![Thematic height - stepped](../../changehistory/assets/thematic_stepped.png)

Thematic height - stepped with delimiters:

![Thematic height - stepped with delimiters](../../changehistory/assets/thematic_steppedWithDelimiter.png)

Thematic height - isolines:

![Thematic height - isolines](../../changehistory/assets/thematic_isolines.png)

Thematic hillshade:

![Thematic hillshade](../../changehistory/assets/thematic_hillshade.png)

Thematic slope:

![Thematic slope](../../changehistory/assets/thematic_slope.png)
