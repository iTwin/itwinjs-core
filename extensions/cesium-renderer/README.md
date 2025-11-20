# @itwin/cesium-renderer

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/cesium-renderer__ package provides an alternative CesiumJS-based renderer for iTwin.js.

## Documentation

See the [iTwin.js](https://www.itwinjs.org) and [CesiumJS](https://cesium.com/learn/cesiumjs/ref-doc/) documentation for more information.

## Running the Example

1. Follow the instructions on [how to run display-test-app](https://github.com/iTwin/itwinjs-core/tree/master/test-apps/display-test-app#getting-started)
2. Set the environment variable `IMJS_USE_CESIUM=1`
3. Click the star-shaped icon in the top toolbar of the UI.
4. Observe that the Cesium globe renders. Some test decorations are rendered on top of it.
5. To control the Cesium camera you can use the following keyboard shortcuts:
  1. Press `ctrl` + `w`, `a`, `s`, `d` to move in and out and rotate
  2. Press `ctrl` + arrow keys to pan

6. To control the camera using the default iTwin.js mouse controls, you need to make some small code changes:
  1. Replace the following line in core/frontend/src/tools/EventController.ts which adds listeners for DOM events:

```typescript
this.addDomListeners(["mousedown", "mouseup", "mousemove", "mouseover", "mouseout", "wheel", "touchstart", "touchend", "touchcancel", "touchmove"], element);
```

With these lines that add support for pointer events:

```typescript
const pointerSupported = window.PointerEvent !== undefined;
if (pointerSupported) {
  this.addDomListeners(["pointerdown", "pointerup", "pointermove"], element);
} else {
  this.addDomListeners(["mousedown", "mouseup", "mousemove"], element);
}
this.addDomListeners(["mouseover", "mouseout", "wheel", "touchstart", "touchend", "touchcancel", "touchmove"], element);
```

  2. To the following if statement in core/frontend/src/tools/ToolAdmin.ts, in the `ToolAdmin.tryReplace()` method:

```typescript
if (lastType !== ev.type || (lastType !== "mousemove" && lastType !== "touchmove"))
```

Change the condition to this:

```typescript
if (lastType !== ev.type || (lastType !== "mousemove" && lastType !== "touchmove" && lastType !== "pointermove"))
```

  3. Also, add the following cases to the switch statement in `ToolAdmin.processNextEvent()` to call `ToolAdmin` methods for pointer events:

```typescript
case "pointerdown": return this.onMouseButton(event, true);
case "pointerup": return this.onMouseButton(event, false);
case "pointermove": return this.onMouseMove(event);
```

>Note: see [this PR discussion](https://github.com/iTwin/itwinjs-core/pull/8697#discussion_r2482620677) for why these pointer event `EventController` and `ToolAdmin` changes may affect iTwin.js tools and why they are not merged into main.
