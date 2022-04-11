---
publish: false
---
# NextVersion

## Optimization of geometry in IModelImporter

The geometry produced by [connectors](https://www.itwinjs.org/learning/imodel-connectors/) and [transformation workflows](../learning/transformer/index.md) is not always ideal. One common issue is a proliferation of [GeometryPart]($backend)s to which only one reference exists. In most cases, it would be more efficient to embed the part's geometry directly into the referencing element's [geometry stream](https://www.itwinjs.org/learning/common/geometrystream/).

[IModelImporter.optimizeGeometry]($transformer) has been introduced to enable this kind of optimization. It takes an [OptimizeGeometryOptions]($transformer) object specifying which optimizations to apply, and applies them to all of the 3d geometry in the iModel. Currently, only the optimization described above is supported, but more are expected to be added in the future.

If you are using [IModelImporter]($transformer) directly, you can call `optimizeGeometry` directly. Typically you would want to do so as a post-processing step. It's simple:

```ts
  // Import all of your geometry, then:
  importer.optimizeGeometry({ inlineUniqueGeometryParts: true });
```

If you are using [IModelTransformer]($transformer), you can configure automatic geometry optimization via [IModelTransformOptions.optimizeGeometry]($transformer). If this property is defined, then [IModelTransformer.processAll]($transformer) and [IModelTransformer.processChanges]($transformer) will apply the specified optimizations after the transformation process completes. For example:

```ts
  const options = { inlineUniqueGeometryParts: true };
  const transformer = new IModelTransformer(sourceIModel, targetIModel, options);
  transformer.processAll();
```

## Presentation

### Filtering related property instances

The [related properties specification](../presentation/Content/RelatedPropertiesSpecification.md) allows including properties of related instances when requesting content  for the primary instance. However, sometimes there's a need show properties of only a few related instances rather than all of them. That can now be done by supplying an instance filter - see the [`instanceFilter` attribute section](../presentation/Content/RelatedPropertiesSpecification.md#attribute-instancefilter) for more details.

### ECExpressions for property overrides

It is now possible to set property specification [`isDisplayed` attribute](../presentation/Content/PropertySpecification.md#attribute-isdisplayed) value using [ECExpressions](../presentation/Content/ECExpressions.md#property-overrides).

### Fixed nested hierarchy rules handling

There was a bug with how [nested child node rules](../presentation/Hierarchies/Terminology.md#nested-rule) were handled. When creating children for a node created by a nested child node rule, the bug caused the library to only look for child node rules that are nested under the rule that created the parent node. The issue is now fixed and the library looks for all child node rules available at the current context.

Example:

```jsonc
{
  "id": "example",
  "rules": [{
    "ruleType": "RootNodes",
    "specifications": [{
      "specType": "CustomNode",
      "type": "child-1",
      "label": "Child 1",
      "nestedRules": [{
        "ruleType": "ChildNodes", // this rule now also returns children for `Child 1.2.1`
        "specifications": [{
          "specType": "CustomNode",
          "type": "child-1.1",
          "label": "Child 1.1"
        }, {
          "specType": "CustomNode",
          "type": "child-1.2",
          "label": "Child 1.2",
          "nestedRules": [{
            "ruleType": "ChildNodes",
            "specifications": [{
              "specType": "CustomNode",
              "type": "child-1.2.1",
              "label": "Child 1.2.1"
            }]
          }]
        }]
      }]
    }]
  }, {
    "ruleType": "ChildNodes", // this rule now also returns children for `Child 1.2.1`
    "specifications": [{
      "specType": "CustomNode",
      "type": "child-2",
      "label": "Child 2"
    }]
  }]
}
```

With the above ruleset, when creating children for `Child 1.2.1` node, the library would've found no child node rules, because there are no nested rules for its specification. After the change, the library also looks at other child node rules available in the context of the specification that created the node. The rules that are now handled are marked with a comment in the above example. If the effect is not desirable, rules should have [conditions](../presentation/Hierarchies/ChildNodeRule.md#attribute-condition) that specify what parent node they return children for.

### Detecting integrated graphics

Many computers - especially laptops - contain two graphics processing units: a low-powered "integrated" GPU such as those manufactured by Intel, and a more powerful "discrete" GPU typically manufactured by NVidia or AMD. Operating systems and web browsers often default to using the integrated GPU to reduce power consumption, but this can produce poor performance in graphics-heavy applications like those built with iTwin.js.  We recommend that users adjust their settings to use the discrete GPU if one is available.

iTwin.js applications can now check [WebGLRenderCompatibilityInfo.usingIntegratedGraphics]($webgl-compatibility) to see if the user might experience degraded performance due to the use of integrated graphics. Because WebGL does not provide access to information about specific graphics hardware, this property is only a heuristic. But it will accurately identify integrated Intel chips manufactured within the past 10 years or so, and allow the application to suggest that the user verify whether a discrete GPU is available to use instead. As a simple example:

```ts
  const compatibility = IModelApp.queryRenderCompatibility();
  if (compatibility.usingIntegratedGraphics)
    alert("Integrated graphics are in use. If a discrete GPU is available, consider switching your device or browser to use it.");
```

## ColorDef validation

[ColorDef.fromString]($common) returns [ColorDef.black]($common) if the input is not a valid color string. [ColorDef.create]($common) coerces the input numeric representation into a 32-bit unsigned integer. In either case, this occurs silently. Now, you can use [ColorDef.isValidColor]($common) to determine if your input is valid.

## ColorByName is an object, not an enum

Enums in TypeScript have some shortcomings, one of which resulted in a bug that caused [ColorDef.fromString]($common) to return [ColorDef.black]($common) for some valid color strings like "aqua". This is due to several standard color names ("aqua" and "cyan", "magenta" and "fuschia", and several "grey" vs "gray" variations) having the same numeric values. To address this, [ColorByName]($common) has been converted from an `enum` to a `namespace`. Code that accesses `ColorByName` members by name will continue to compile with no change.

## UiItemsManager Changes

When registering a UiItemsProvider with the [UiItemsManager]($appui-abstract) it is now possible to pass an additional argument to limit when the provider is called to provide its items. The interface [UiItemProviderOverrides]($appui-abstract) define the parameters that can be used to limit the provider. The example registration below will limit a provider to only be used if the active stage has an Id of "redlining".

```ts
    UiItemsManager.register(commonToolProvider, {stageIds: ["redlining"]});
```

## Widget Panel Changes

Based on usability testing, the following changes to widget panels have been implemented.

1. Only two widget panel sections will be shown in any widget panel.
2. A splitter is now provided that allows user to set the size of the widget panel sections.
3. There is no special processing of double clicks on widget tabs when the widget tab is shown in a widget panel.
4. The Widget Panel Unpin icon has been updated to make it more clear the action to be performed when the toggle is clicked.

The API impact of these updates are listed below.

1. The [UiItemsManager]($appui-abstract) will still query the [UiItemsProvider]($appui-abstract)s for widgets for the [StagePanelSection]($appui-abstract).Center but the returned widgets will be shown in the bottom panel sections. The StagePanelSection.Center enum entry has been deprecated and UiItemProviders should start using only `StagePanelSection.Start` and `StagePanelSection.End`.
2. Widgets in panels only support the [WidgetState]($appui-abstract)s WidgetState.Open or WidgetState.Hidden.
3. The UiItemProviders `provideWidgets` call can now return [AbstractWidgetProps]($appui-abstract) that specify a `defaultFloatingSize` that can be used for Widgets that use components that do not have an intrinsic size. For more details see [WidgetItem](../learning/ui/AugmentingUI.md).

## Deprecations in @itwin/components-react package

The interfaces and components [ShowHideMenuProps]($components-react), [ShowHideMenu]($components-react), [ShowHideItem]($components-react)[ShowHideID]($components-react), [ShowHideDialogProps]($components-react), and [ShowHideDialog]($components-react) are all being deprecated because they were supporting components for the now deprecated [Table]($components-react) component. This `Table` component used an Open Source component that is not being maintained so it was determined to drop it from the API. The @itwin/itwinui-react package now delivers a Table component which should be used in place of the deprecated Table.

## Deprecations in @itwin/core-react package

Using the sprite loader for SVG icons is deprecated. This includes [SvgSprite]($core-react) and the methods getSvgIconSpec() and getSvgIconSource() methods on [IconSpecUtilities]($appui-abstract). The sprite loader has been replaced with a web component [IconWebComponent]($core-react) used by [Icon]($core-react) to load SVGs onto icons.

## React icons support

In addition to toolbar buttons, React icons are now supported for use in [Widget]($appui-react) tabs, [Backstage]($appui-react) items, and [StatusBar]($appui-react) items.

## Deprecations in @itwin/core-transformer package

The beta transformer API functions [IModelTransformer.skipElement]($transformer) and [IModelTransformer.processDeferredElements]($transformer)
have been deprecated, as the transformer no longer "defers" elements until all of its references have been transformed. These now have no effect,
since no elements will be deferred, and elements will always be transformed, so skipping them to transform them later is not necessary.
