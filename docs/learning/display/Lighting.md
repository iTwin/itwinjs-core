# Lighting, materials, and environment

The [iTwin.js renderer](./frontend-overview.md) is designed for efficient visualization of large infrastructure digital twins in a constrained browser environment. Photorealistic rendering is **not** part of that design - many of the techniques required for producing more lifelike images are unsupported or impractically expensive using WebGL. Solutions like [LumenRT](https://www.bentley.com/en/products/brands/lumenrt) and `[Unity](###TODO Matt more info?)` can apply more advanced rendering techniques to iModels.

However, the renderer does provide a wide variety of options for customizing the look of your iTwin.

## Lighting and environment

- @[LightSettings]($common) can define directional, portrait, ambient, and hemisphere light sources; as well as control over specular, cel-shading, and Fresnel effects.
- @[SolarShadowSettings]($common) produce shadows based on the real-world sun position at a given location and date.
- @[AmbientOcclusion]($common) can simulate shadows.
- An [Environment]($common) can provide a decorative sky box or sky sphere.

[This sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=display-styles-sample&imodel=Villa) provides examples of various display styles utilizing a variety of these settings.

## Materials

@[RenderMaterialElement]($backend)s in an iModel can store many material properties for use by a renderer. However, the WebGL-based renderer currently supports only a small number of these properties:

- Diffuse color and weight
- Transparency
- Specular color, exponent, and weight
- Texture mapping and weight
