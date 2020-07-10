---
ignore: true
---
# NextVersion

## Multiple feature override providers

[Viewport]($frontend) now allows multiple [FeatureOverrideProvider]($frontend)s to be registered at any given time. Use [Viewport.addFeatureOverrideProvider]($frontend) to register a provider and [Viewport.dropFeatureOverrideProvider]($frontend) to unregister it. To query for a registered provider, use [Viewport.findFeatureOverrideProvider]($frontend) or [Viewport.findFeatureOverrideProviderOfType]($frontend).

When multiple providers are registered, no attempt is made to reconcile conflicts between two providers overriding the same [Feature]($common) - that is left to the application. Note that most [FeatureSymbology.Overrides]($frontend) methods like `overrideModel` take an optional `replaceExisting` argument indicating whether or not to replace an existing override for the same entity, so if you have two providers, one of which should never overwrite changes made by the other, that one should pass `false` for `replaceExisting` while the other one should pass `true` (the default).

This change necessitates the deprecation of [Viewport.featureOverrideProvider]($frontend), previously used to get or set the sole provider. This property will be removed in a future version. For now, the getter will return a provider if and only if exactly one provider is currently registered. The setter will remove all existing providers and, if a new provider is supplied, register it as the sole provider. We recommend migrating to the new APIs. You can do so as follows:
- Replace `viewport.featureOverrideProvider = myProvider` with `viewport.addFeatureOverrideProvider(myProvider)`.
- Replace `viewport.featureOverrideProvider = undefined` with `viewport.dropFeatureOverrideProvider(myProvider)`.
- Replace calls to the getter with a call to `findFeatureOverrideProvider` or `findFeatureOverrideProviderOfType`. For example:
```ts
  class MyProvider implements FeatureOverrideProvider {
    public id: string;
    public addFeatureOverrides(ovrs: FeatureSymbology.Overrides, vp: Viewport): void { /* ... */ }
  }

  // If you know that at most one provider of type MyProvider should be registered at any one time:
  let provider = viewport.findFeatureOverrideProviderOfType<MyProvider>(MyProvider);
  // Or, if you can identify your provider by some other means, like a property:
  provider = viewport.findFeatureOverrideProvider((x) => x instanceof MyProvider && x.id === "my provider");
```

## Hypermodeling marker filtering

Some iModels contain thousands of [SectionDrawingLocation]($backend)s. When hypermodeling is used with such iModels, this may result in display of thousands of [SectionMarker]($hypermodeling)s. While markers located close together will automatically cluster, and [SectionMarkerConfig]($hypermodeling) supports filtering markers based on model, category, or section type, some applications may want to apply their own filtering logic. They can now do so by implementing [SectionMarkerHandler]($hypermodeling) to customize the visibility of the markers.

## Device pixel ratio

[Device pixel ratio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) is the ratio of physical (screen) pixels to logical (CSS) pixels. For example, most mobile devices have a device pixel ratio of 2, causing UI controls to display at twice the size while still appearing sharp on the screen. Similarly, a desktop computer with a 4k monitor always has a 4k physical resolution, but the operating system may allow the UI to be arbitrarily scaled to the user's preferences. In such cases the number of logical pixels will not match the number of physical pixels.

Previously, when iModel.js computed the appropriate level of detail for tiles and decoration graphics, it exclusively used the logical resolution, ignoring device pixel ratio. On high-DPI devices this causes lower-resolution graphics to be displayed, resulting in a less detailed image.

Now, if [RenderSystem.Options.dpiAwareLOD]($frontend) is set to `true` when supplied to [IModelApp.startup]($frontend), level of detail computations will take device pixel ratio into account. This will result in a sharper image on high-DPI displays. However, it may also reduce display performance, especially on mobile devices, due to more tiles of higher resolution being displayed.

This option has no effect if [RenderSystem.Options.dpiAwareViewports]($frontend) is overridden to be `false`.
