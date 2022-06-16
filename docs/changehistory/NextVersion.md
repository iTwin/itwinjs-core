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

## Compression of certain RPC operation responses

Some [RpcInterfaces](https://www.itwinjs.org/learning/rpcinterface/) define operations that may return so much data, that downloading it becomes a significant part of a Web request duration. Such operations can now utilize `gzip` compression to cut download time by an order of magnitude on large JSON responses.

This enhancement relies on request's `Accept-Encoding` header not gettting stripped before it reaches the backend server.

## Display

### Batching of pickable graphics

[Pickable decorations](../learning/frontend/ViewDecorations#pickable-view-graphic-decorations) associate an [Id64String]($bentley) with a [RenderGraphic]($frontend), enabling the graphic to be interacted with using mouse or touch inputs and to have its [appearance overridden](../learning/display/SymbologyOverrides.md). Previously, a [GraphicBuilder]($frontend) accepted only a single pickable Id. [Decorator]($frontend)s that produce many pickable objects were therefore required to create a separate graphic for each pickable Id. This can negatively impact display performance by increasing the number of draw calls.

Now, [GraphicBuilder.activatePickableId]($frontend) and [GraphicBuilder.activateFeature]($frontend) enable any number of pickable objects can be batched together into one graphic, improving performance. The following simple example illustrates how to batch a pickable sphere and a pickable box into one graphic.

```ts
  class MyDecorator implements Decorator {
    boxId: Id64String;
    sphereId: Id64String;

    public constructor(iModel: IModelConnection) {
      // reserve pickable Ids for each of our features.
      this.boxId = iModel.transientIds.next;
      this.sphereId = iModel.transientIds.next;
    }

    public decorate(context: DecorateContext): void {
      // We must supply a PickableGraphicOptions when creating the GraphicBuilder.
      // Any geometry added to the builder will use this.boxId as its pickable Id.
      const builder = context.createGraphic({
        type: GraphicType.Scene,
        pickable: { id: boxId },
      };

      // Add a box.
      const box = Box.createRange(new Range3d(0, 0, 0, 1, 1, 1))!;
      builder.addSolidPrimitive(box);

      // Change the pickable Id. Any subsequently-added geometry will use this.sphereId as its pickable Id.
      builder.activatePickableId(this.sphereId);

      // Add a sphere.
      const sphere = Sphere.createCenterRadius(new Point3d(0, 0, 0), 1)!;
      builder.addSolidPrimitive(sphere);

      // Add the finished graphic to the viewport.
      context.addDecorationFromBuilder(builder);
    }
  }
```

### Detecting integrated graphics

Many computers - especially laptops - contain two graphics processing units: a low-powered "integrated" GPU such as those manufactured by Intel, and a more powerful "discrete" GPU typically manufactured by NVidia or AMD. Operating systems and web browsers often default to using the integrated GPU to reduce power consumption, but this can produce poor performance in graphics-heavy applications like those built with iTwin.js.  We recommend that users adjust their settings to use the discrete GPU if one is available.

iTwin.js applications can now check [WebGLRenderCompatibilityInfo.usingIntegratedGraphics]($webgl-compatibility) to see if the user might experience degraded performance due to the use of integrated graphics. Because WebGL does not provide access to information about specific graphics hardware, this property is only a heuristic. But it will accurately identify integrated Intel chips manufactured within the past 10 years or so, and allow the application to suggest that the user verify whether a discrete GPU is available to use instead. As a simple example:

```ts
  const compatibility = IModelApp.queryRenderCompatibility();
  if (compatibility.usingIntegratedGraphics)
    alert("Integrated graphics are in use. If a discrete GPU is available, consider switching your device or browser to use it.");
```

### Polyface edges

A [Polyface]($geometry) can optionally specify the visibility of the edges of each of its faces. If present, this edge visibility information - accessed via [PolyfaceData.edgeVisible]($geometry) - is used when producing graphics from the polyface to determine which edges should be drawn. If the edge visibility information is not present, however, then the display system must try to decide which edges should be drawn.

Previously, the display system would attempt to infer the visibility of each interior edge based on the angle between its two adjacent faces. For example, an edge between two faces of a cube would be visible, whereas an edge between two nearly-coplanar faces would be invisible. However, this inference does not work well for polyfaces with smoother topology. Now, instead of attempting to infer edge visibility, the display system will simply render the edges of all faces visible.

The images below illustrate the improvement. Note that edge inference is inconsistent - small variations in angles between faces produce discontinuities where continuous edges are expected. By drawing all edges, the topology of the mesh is readily apparent. Of course, the ideal results are achieved by explicitly specifying the visibility of each edge in the [Polyface]($geometry).

| Inferred edges (previous behavior) | All edges (new behavior) |
| ---------------------------------- | ------------------------ |
| ![Edge visibility is inferred](./assets/infer-polyface-edges.jpg) | ![All edges are visible](./assets/all-polyface-edges.jpg) |

If for some reason you wish to revert to the previous behavior, you can set [TileAdmin.Props.generateAllPolyfaceEdges]($frontend) to `false` when calling [IModelApp.startup]($frontend).

## Presentation

### Filtering related property instances

The [related properties specification](../presentation/Content/RelatedPropertiesSpecification.md) allows including properties of related instances when requesting content  for the primary instance. However, sometimes there's a need show properties of only a few related instances rather than all of them. That can now be done by supplying an instance filter - see the [`instanceFilter` attribute section](../presentation/Content/RelatedPropertiesSpecification.md#attribute-instancefilter) for more details.

### ECExpressions for property overrides

It is now possible to set property specification [`isDisplayed` attribute](../presentation/Content/PropertySpecification.md#attribute-isdisplayed) value using [ECExpressions](../presentation/Content/ECExpressions.md#property-overrides).

### Fixed nested hierarchy rules handling

There was a bug with how [nested child node rules](../presentation/Hierarchies/Terminology.md#nested-rule) were handled. When creating children for a node created by a nested child node rule, the bug caused the library to only look for child node rules that are nested under the rule that created the parent node. The issue is now fixed and the library looks for child node rules nested under the parent node rule and at the root level of the ruleset.

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
        "ruleType": "ChildNodes",
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

With the above ruleset, when creating children for `Child 1.2.1` node, the library would've found no child node rules, because there are no nested rules for its specification. After the change, the library also looks at child node rules at the root level of the ruleset. The rules that are now handled are marked with a comment in the above example. If the effect is not desirable, rules should have [conditions](../presentation/Hierarchies/ChildNodeRule.md#attribute-condition) that specify what parent node they return children for.

### Fixed inconsistent property representation in a property grid

Previously, when using [RelatedPropertiesSpecification.nestedRelatedProperties]($presentation-common) attribute, the properties were loaded differently based on whether parent specification included any properties or not. Now the behavior is consistent.

```json
{
  "id": "example",
  "rules": [{
      "ruleType": "Content",
      "specifications": [{
          "specType": "ContentInstancesOfSpecificClasses",
          "classes": { "schemaName": "BisCore", "classNames": ["GeometricModel3d"], "arePolymorphic": true }
        }]
    }, {
      "ruleType": "ContentModifier",
      "class": {
        "schemaName": "BisCore",
        "className": "Model"
      },
      "relatedProperties": [{
          "propertiesSource": {
            "relationship": { "schemaName": "BisCore", "className": "ModelContainsElements" },
            "direction": "Forward",
            "targetClass": { "schemaName": "Generic", "className": "PhysicalObject" }
          },
          "properties": "_none_",
          "nestedRelatedProperties": [{
              "propertiesSource": {
                "relationship": { "schemaName": "BisCore", "className": "GeometricElement3dIsInCategory" },
                "direction": "Forward"
              }
            }]
        }]
    }]
}
```

| Value of `"properties"` attribute | before                                                                                                                            | after                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `"_none_"`                        | ![Properties of Spatial Category are merged](./media/SpatialCategoryPropertiesMerged.png)                                         | ![Properties of Spatial Category not merged](./media/SpatialCategoryPropertiesNotMerged.png)                                      |
| `["UserLabel"]`                   | ![Properties of Physical Object and Spatial Category not merged](./media/PhysicalObjectAndSpatialCategoryPropertiesNotMerged.png) | ![Properties of Physical Object and Spatial Category not merged](./media/PhysicalObjectAndSpatialCategoryPropertiesNotMerged.png) |

### Fixed a bug that prevented disabling `relatedProperties` specifications

The bug made it impossible to remove related properties if a lower priority rule specified that the property should be included.

For example, the [default BisCore supplemental ruleset](https://github.com/iTwin/itwinjs-core/blob/504a7b88e9ade29cc306bd55d093be1d76ddad43/presentation/backend/assets/supplemental-presentation-rules/BisCore.PresentationRuleSet.json#L372-L419) automatically includes `ExternalSourceAspect.Identifier` property to all Elements' content when they have such aspect. It's now possible to disable that rule using one of these approaches:

- Set `"properties"` to `"_none_"` or `[]`:

  ```json
  {
    "ruleType": "ContentModifier",
    "class": { "schemaName": "BisCore", "className": "Element" },
    "relatedProperties": [{
        "propertiesSource": {
          "relationship": { "schemaName": "BisCore", "className": "ElementOwnsMultiAspects" },
          "direction": "Forward",
          "targetClass": { "schemaName": "BisCore", "className": "ExternalSourceAspect" }
        },
        "properties": "_none_"
      }
    ]
  }
  ```

- Disable property display:

  ```json
  {
    "ruleType": "ContentModifier",
    "class": { "schemaName": "BisCore", "className": "Element" },
    "relatedProperties": [{
        "propertiesSource": {
          "relationship": { "schemaName": "BisCore", "className": "ElementOwnsMultiAspects" },
          "direction": "Forward",
          "targetClass": { "schemaName": "BisCore", "className": "ExternalSourceAspect" }
        },
        "properties": [{
          "name": "Identifier",
          "isDisplayed": false
        }]
      }
    ]
  }
  ```

### Property override enhancements

It is now possible to override values of [`isReadOnly`](../presentation/Content/PropertySpecification.md#attribute-isreadonly) and [`priority`](../presentation/Content/PropertySpecification.md#attribute-priority) property attributes.

### Fixed incorrect categories of property fields when intermediate classes are different

Previously, nested related properties of different intermediate classes were all categorized under the first intermediate class. Now the properties are categorized under the intermediate classes to which they belong.

```json
{
  "id": "example",
  "rules": [{
      "ruleType": "Content",
      "specifications": [{
          "specType": "ContentInstancesOfSpecificClasses",
          "classes": { "schemaName": "BisCore", "classNames": ["GeometricModel3d"], "arePolymorphic": true }
        }]
    }, {
      "ruleType": "ContentModifier",
      "class": { "schemaName": "BisCore", "className": "Model" },
      "relatedProperties": [{
          "propertiesSource": {
            "relationship": { "schemaName": "BisCore", "className": "ModelContainsElements" },
            "direction": "Forward",
            "targetClass": { "schemaName": "BisCore", "className": "GeometricElement3d" }
          },
          "properties": "_none_",
          "nestedRelatedProperties": [{
              "propertiesSource": {
                "relationship": { "schemaName": "BisCore", "className": "GeometricElement3dIsInCategory" },
                "direction": "Forward"
              }
            }],
          "handleTargetClassPolymorphically": true
        }]
    }]
}
```

| before                                                                                         | after                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ![All properties fall under one category](./media/AllSpatialCategoriesUnderPhysicalObject.png) | ![Properties fall under different categories](./media/SpatialCategoriesUnderPhysicalObjectAndTestClass.png) |

### Relationship properties

It is now possible to include relationship properties into content using a newly added [`RelatedPropertiesSpecification.relationshipProperties`](../presentation/content/RelatedPropertiesSpecification.md#attribute-relationshipproperties) attribute. Properties of the relationship and category of the target class are categorized under relationship category if any relationship properties are included.

It's now also possible to move related properties under a relationship category even when there are no relationship properties. To force this behavior, the new [`RelatedPropertiesSpecification.forceCreateRelationshipProperties`](../presentation/content/RelatedPropertiesSpecification.md#attribute-forcecreaterelationshipcategory) attribute can be used.

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

## Deprecations in @itwin/core-geometry package

The low-level [PolyfaceBuilder]($core-geometry) methods `findOrAddPoint`, `findOrAddPointXYZ`, `findOrAddParamXY`, and `findOrAddParamInGrowableXYArray` are deprecated in favor of the more appropriately named new methods `addPoint`, `addPointXYZ`, `addParamXY` and `addParamInGrowableXYArray`. These methods always add their inputs to the relevant builder array, rather than searching it and returning the index of a duplicate. The intent is to enable efficient `IndexedPolyface` construction by allowing duplicate data to be accumulated as facets are added, and to compress the data when done with `claimPolyface`.

## Deprecations in @itwin/core-react package

Using the sprite loader for SVG icons is deprecated. This includes [SvgSprite]($core-react) and the methods getSvgIconSpec() and getSvgIconSource() methods on [IconSpecUtilities]($appui-abstract). The sprite loader has been replaced with a web component [IconWebComponent]($core-react) used by [Icon]($core-react) to load SVGs onto icons.

## React icons support

In addition to toolbar buttons, React icons are now supported for use in [Widget]($appui-react) tabs, [Backstage]($appui-react) items, and [StatusBar]($appui-react) items.

## Deprecations in @itwin/core-transformer package

The beta transformer API functions [IModelTransformer.skipElement]($transformer) and [IModelTransformer.processDeferredElements]($transformer)
have been deprecated, as the transformer no longer "defers" elements until all of its references have been transformed. These now have no effect,
since no elements will be deferred, and elements will always be transformed, so skipping them to transform them later is not necessary.

## ArcGIS OAuth2 support

It's now possible to connect to an ArcGIS MapService protected by OAuth2 authentication.  To enable this feature, the new `@itwin/map-layers-auth` package must be loaded by the hosting application, and an `ArcGgisAccessClient` must be created and configured properly.

For example:
```ts
  const enterpriseClientIds = [{
      serviceBaseUrl: SampleAppIModelApp.testAppConfiguration.arcGisEnterpriseBaseUrl,
      clientId: SampleAppIModelApp.testAppConfiguration?.arcGisEnterpriseClientId,
    }];
  const accessClient = new ArcGisAccessClient();
  const initStatus = accessClient.initialize({
    redirectUri: "http://localhost:3000/esri-oauth2-callback",
    clientIds: {
      arcgisOnlineClientId: SampleAppIModelApp?.testAppConfiguration?.arcGisOnlineClientId,
      enterpriseClientIds,
    }});
  IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", accessClient);
```
The hosting application must be registered in either the ArcGIS Online server (cloud offering) or an ArcGIS enterprise server (on-premise). The registered application must then provide it's associated clientID and redirectUri to the `ArcGgisAccessClient` object.  The ui-test-app application provides a complete sample configuration. 

The maplayers widget has also been updated to support OAuth2: if needed, a popup window will be displayed to trigger the external OAuth process with the remote ArcGIS server. When the process completes, the focus returns to the map-layers widget and layer is ready to be added/displayed.

More details on how to configure the ArcGis Server can be found in the [ESRI documentation](https://developers.arcgis.com/documentation/mapping-apis-and-services/security/tutorials/register-your-application/)

## Resuming transformations

The functions [IModelTransformer.saveStateToFile]($transformer) and [IModelTransformer.resumeTransformation]($transformer) have been
added to the transformer, and can be used to save the transformer internal state to a file. This can then be used, in combination with a
target at the same state as it was when the transformer state file was made, to "resume" a transformation.
[IModelTransformer.resumeTransformation]($transformer) will create a new transformer instance upon which calling
[IModelTransformer.processAll]($transformer) or [IModelTransformer.processChanges]($transformer) will start the transformation but not re-export
already inserted entities. This can be useful in some cases where a transformation is a long running process and may need to be paused and resumed.

