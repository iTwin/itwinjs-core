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

## AppUI

AppUI goes major changes with 4.0, here is a non exhaustive list of the changes:

### StatusBarContext and HOC

`ConditionalFiled` and `FooterModeField`components, `withMessageCenterFieldProps` and `withStatusFieldProps` HOC were removed, along all the props they were providing, which were stored in the `StatusBarContext` react context.

`isInFooterMode` prop was removed from all `appui-react` packages as Widget mode is completely removed (isInFooterMode is always true now).

`StatusBar` is no longer control state of the fields contained in it, so each individual field is responsible to handle it's "open" state, removing the need for the `openWidget` and `onOpenWidget` props.

`targetRef` is no longer used, the message center is now using `MessageManager`, which allow direct registration of the "flyTo" element, which was the reason for `targetRef` to exist.

