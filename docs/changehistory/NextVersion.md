---
publish: false
---
# NextVersion

## Ambient Occlusion Improvements

The ambient occlusion effect has undergone some quality improvements.

Changes:

- The shadows cast by ambient occlusion will decrease in size the more distant the geometry is.
- The maximum distance for applying ambient occlusion now defaults to 10,000 meters instead of 100 meters.
- The effect will now fade as it approaches the maximum distance.

Old effect, as shown below:

![AO effect is the same strength in the near distance and far distance](./assets/AOOldDistance.png)

New effect, shown below:

![AO effect fades in the distance; shadows decrease in size](./assets/AONewDistance.png)

For more details, see the new descriptions of the `texelStepSize` and `maxDistance` properties of [AmbientOcclusion.Props]($common).

## Transformer API

The synchronous `void`-returning overload of [IModelTransformer.initFromExternalSourceAspects]($transformer) has been deprecated.
It will still perform the old behavior synchronously until it is removed. It will now however return a `Promise` (which should be
awaited) if invoked with the an [InitFromExternalSourceAspectsArgs]($transformer) argument, which is necessary when processing
changes instead of the full source contents.

## Presentation

### Localization Changes

Previously, some of the data produced by the Presentation library was being localized both on the backend. This behavior was dropped in favor of localizing everything on the frontend. As a result, the requirement to supply localization assets with the backend is also removed.

In case of a backend-only application, localization may be setup by providing a [localization function when initializing the Presentation backend](../presentation/advanced/Localization.md).  By default the library localizes known strings to English.

**Deprecated APIs:**

- PresentationManagerProps.localeDirectories
- PresentationManagerProps.defaultLocale
- PresentationManager.activeLocale

## Restoring Presentation tree state

It is now possible to restore previously saved Presentation tree state on component mount.

```ts
// Save current tree state
const { nodeLoader } = usePresentationTreeNodeLoader(args);
useEffect(() => exampleStoreTreeModel(nodeLoader.modelSource.getModel()), []);

// Restore tree state on component mount
const seedTreeModel = exampleRetrieveStoredTreeModel();
const { nodeLoader } = usePresentationTreeNodeLoader({ ...args, seedTreeModel });
```

## Deprecations

### @itwin/core-geometry

`BoxProps.origin` has been replaced with `BoxProps.baseOrigin` to align with the "box" JSON format.