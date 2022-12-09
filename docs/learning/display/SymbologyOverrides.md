# Appearance Overrides

The [iTwin.js renderer](./index.md) provides the ability to dynamically override various aspects of the appearance of [Feature]($common)s (roughly correlating to [GeometricElement]($backend)s) within tiles. The renderer uses the [feature table](./TileFormat.md#feature-tables) embedded in each tile to produce a lookup table from which the vertex shader can obtain the overrides. The following aspects can be overridden using [FeatureOverrides]($common):

- Color and transparency.
- Line width and style.
- Visibility - whether the feature is drawn at all.
- Emphasis - a silhouette effect applied to features to make them stand out.
- Locatability - the ability for tools to interact with the feature.
- Whether or not to apply the feature's material.

Appearance overrides can be applied on the basis of any combination of model, element, subcategory, geometry class, and - for animated views - animation node Id. They are aggregated from a variety of sources including:

- The visible categories specified by the [CategorySelector]($backend);
- The per-[Model]($backend), per-[SubCategory]($backend), and per-[GeometryClass]($common) overrides specified by the display style;
- The [RenderTimeline]($backend) script controlling the view's animation;
- The display style's [PlanProjectionSettings]($common);
- [FeatureAppearanceProvider]($common)s supplied by tile trees;
- Any number of [FeatureOverrideProvider]($frontend)s registered with the [Viewport]($frontend).

Many applications make use of the higher-level but more limited [EmphasizeElements]($frontend) API to apply appearance overrides. [This sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=emphasize-elements-sample&imodel=Retail+Building+Sample) demonstrates some of the capabilities.

In the image below, [EmphasizeElements]($frontend) has applied emphasis to a handful of elements while fading out the rest of the elements by overriding their color and transparency:

![Emphasized elements](../../changehistory/assets/emphasized_elements.png)
