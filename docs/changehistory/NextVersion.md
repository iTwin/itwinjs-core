---
publish: false
---
# NextVersion

Table of contents:

- [Revert timeline changes](#revert-timeline-changes)
- [Display](#display)
  - [Instancing](#instancing)
- [Interactive Tools](#interactive-tools)
  - [Element Locate](#element-locate)
- [Presentation](#presentation)
  - [Calculated properties specification enhancements](#calculated-properties-specification-enhancements)
  - [API Deprecations](#api-deprecations)

## Revert timeline changes

At present, the sole method to reverse a defective changeset is to remove it from the iModel hub, which can lead to numerous side effects. A preferable approach would be to reverse the changeset in the timeline and introduce it as a new changeset. Although this method remains intrusive and necessitates a schema lock, it is safer because it allows for the reversal to restore previous changes, ensuring that nothing is permanently lost from the timeline.

[IModelDb.revertAndPushChanges]($core-backend) Allow to push a single changeset that undo all changeset from tip to specified changeset in history.

Some detail and requirements are as following.

- When invoking the iModel, it must not have any local modifications.
- The operation is atomic; if it fails, the database will revert to its previous state.
- The revert operation necessitates a schema lock (an exclusive lock on the iModel) because it does not lock each individual element affected by the revert.
- If no description is provided after a revert, a default description for the changeset will be created and pushed, which releases the schema lock.
- Schema changes are not reverted during SchemaSync, or they can be optionally skipped when SchemaSync is not utilized.

## Display

### Instancing

Some scenarios involve displaying the same basic graphic repeatedly. For example, imagine you are writing a [Decorator]($frontend) that displays stop signs at many intersections along a road network. You might create one [RenderGraphic]($frontend) for each individual stop sign and draw them all, but doing so would waste a lot of memory by duplicating the same geometry many times, and negatively impact your frame rate by invoking many draw calls.

WebGL provides [instanced rendering](https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html) to more efficiently support this kind of use case. You can define a single representation of the stop sign graphic, and then tell the renderer to draw it many times at different locations, orientations, and scales. iTwin.js now provides APIs that make it easy for you to create instanced graphics:

- [GraphicTemplate]($frontend) defines what the graphic should look like. You can obtain a template from [GraphicBuilder.finishTemplate]($frontend), [RenderSystem.createTemplateFromDescription]($frontend), or [readGltfTemplate]($frontend).
- [RenderInstances]($frontend) defines the set of instances of the template to draw. In addition to a [Transform]($geometry), each instance can also override aspects of the template's appearance like color and line width, along with a unique [Feature]($common) to permit each instance to behave as a discrete entity. You can create a `RenderInstances` using [RenderInstancesParamsBuilder]($frontend).
- [RenderSystem.createGraphicFromTemplate]($frontend) produces a [RenderGraphic]($frontend) from a graphic template and a set of instances.

`GraphicTemplate` and `RenderInstances` are both reusable - you can produce multiple sets of instances of a given template, and use the same set of instances with multiple different templates.

For the stop sign example described above, you might have a [glTF model](https://en.wikipedia.org/wiki/GlTF) representing a stop sign and an array containing the position of each stop sign. You could then use a function like the following to produce a graphic that draws the stop sign at each of those positions.

```ts
[[include:Gltf_Instancing]]
```

### Context Reality model visibility

Context reality models that have been attached using `DisplayStyleState.attachRealityModel`, can now be hidden by turning ON the `ContextRealityModel.invisible` flag.  Previous implementation requiered context reality models to be detached in order to hide it from the scene.

### Contour Display

A new rendering technique has been added to iTwin.js which allows a user to apply specific contour line renderings to subcategories within a scene.

iTwin.js now provides the following API to use this feature:

- [DisplayStyle3dSettings]($common) now has a `contours` property which contains all of the subcategories-to-styling association data necessary to enable this feature. That object is of type [ContourDisplay.Settings]($common).
- [ContourDisplay.Settings]($common) defines how contours are displayed in the iModel based on a list of [ContourDisplay.Terrain]($common) objects in the `terrains` property.
- [ContourDisplay.Terrain]($common) describes an assocation of subcategories to contour styling. It contains an array of subcategory IDs titled `subCategories`. Those subcategories will have the contour styling within the same terrain's [ContourDisplay.Contour]($common) `contourDef` object applied to them.
- [ContourDisplay.Contour]($common) describes the rendering styling settings that apply to a specific set of subcategories within a [ContourDisplay.Terrain]($common). This actually describes stylings for two sets of contours: major and minor. These stylings are separate from each other. The minor contour occurs at a defined interval in meters. These intervals draw at a fixed height; they are not dependent on the range of the geometry to which they are applied. The major contour is dependent on the minor contour. The interval of its occurence is not measured directly in meters; rather it is a count of minor contour intervals between its occurrences. The properties describing how major and minor contours are styled are listed here:
  - `majorColor` is the color that a major contour line will use. Defaults to [ColorDef.black]($common).
  - `minorColor` is the color that a minor contour line will use. Defaults to [ColorDef.black]($common).
  - `majorPixelWidth` is the width in pixels of a major contour line. (Range 1.5 to 9 in 0.5 increments). Defaults to 2.
  - `minorPixelWidth` is the width in pixels of a minor contour line. (Range 1.5 to 9 in 0.5 increments). Defaults to 1.
  - `majorPattern` is the pattern for a major contour line. Defaults to [LinePixels.Solid]($common).
  - `minorPattern` is the pattern for a minor contour line. Defaults to [LinePixels.Solid]($common).
  - `minorInterval` is the interval for the minor contour in the associated terrain in meters. Defaults to 1.
  - `majorIntervalCount` is the count of minor contour intervals that define a major interval (integer > 0). Defaults to 5.

Consult the following code for an example of enabling and configuring contour display in iTwin.js:

```ts
private enableAndConfigureContourDisplay(viewport: Viewport): boolean {
  const isContourDisplaySupported = (vw: ViewState) => vw.is3d();

  const view = viewport.view;

  if (!isContourDisplaySupported(view))
    return false; // Contour display settings are only valid for 3d views

  // Create a ContourDisplay.SettingsProps object with the desired contour settings
  const contourDisplaySettingsProps: ContourDisplay.SettingsProps = {
    terrains: [ // the list of terrains associating groups of subcategories with contour stylings
      {
        contourDef: {
          majorColor: ColorDef.red.toJSON(),
          minorColor: ColorDef.blue.toJSON(),
          majorPixelWidth: 3,
          minorPixelWidth: 1,
          majorPattern: LinePixels.Solid,
          minorPattern: LinePixels.Code3,
          minorInterval: 2,
          majorIntervalCount: 8,
        },
        subCategories: [ "0x5b", "0x5a" ],
      },
      {
        contourDef: {
          majorColor: ColorDef.black.toJSON(),
          minorColor: ColorDef.white.toJSON(),
          majorPixelWidth: 4,
          minorPixelWidth: 2,
          majorPattern: LinePixels.Code4,
          minorPattern: LinePixels.Solid,
          minorInterval: 1,
          majorIntervalCount: 7,
        },
        subCategories: [ "0x5c", "0x6a" ],
      },
    ],
  };

  // Create a ContourDisplay.Settings object using the props created above
  const contourDisplaySettings = ContourDisplay.Settings.fromJSON(contourDisplaySettingsProps);

  // Change the contours object on the 3d display style state to contain the new object
  (view as ViewState3d).getDisplayStyle3d().settings.contours = contourDisplaySettings;

  // Sync the viewport with the new view state
  viewport.synchWithView();

  return true;
}
```

## Interactive Tools

### Element Locate

After calling [ElementLocateManager.doLocate]($frontend), Reset may now be used to accept some elements that were obscured by another element. Previously Reset would only choose between visible elements within the locate aperture.

![locate example](./element-locate.png "Example of using reset to accept obscured element")

## Presentation

### Calculated properties specification enhancements

A new optional [`extendedData`]($docs/presentation/content/CalculatedPropertiesSpecification.md#attribute-extendeddata) attribute has been added to [calculated properties specification]($docs/presentation/content/CalculatedPropertiesSpecification.md). The attribute allows associating resulting calculated properties field with some extra information, which may be especially useful for dynamically created calculated properties.

## API deprecations

### @itwin/appui-abstract

- `LayoutFragmentProps`, `ContentLayoutProps`, `LayoutSplitPropsBase`, `LayoutHorizontalSplitProps`, `LayoutVerticalSplitProps`, and `StandardContentLayouts` have been deprecated. Use the same APIs from `@itwin/appui-react` instead.

- `BackendItemsManager` is internal and should never have been consumed. It has been deprecated and will be removed in 5.0.0. Use `UiFramework.backstage` from `@itwin/appui-react` instead.
