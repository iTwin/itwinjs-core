# Running a Primitive Tool

The [PrimitiveTool]($frontend) class serves as the base class for tools that need to create or modify geometric elements. Because Primitive tools often target a specific type of element, it may be undesirable to install a given Primitive tool as the *active* tool without first checking if all required conditions are being met.

When [ToolRegistry.run]($frontend) is called for a Primitive tool, the following sequence of tool methods are called:

  * [isCompatibleViewport](#iscompatibleviewport)
  * [onInstall](#oninstall)
  * [onPostInstall](#onpostinstall)

```ts
[[include:PrimitiveTool_Run]]
```

## isCompatibleViewport

The very first decision the tool must make is whether to continue the install or leave the current tool active given a viewport identifying the target for graphical interaction. By default [ViewManager.selectedView]($frontend) is supplied as the target viewport by [PrimitiveTool.run]($frontend).

The tool is responsible for checking the viewport's compatibility with the tool operation, some examples below:

  * Target isn't readonly. Checks [PrimitiveTool.requireWriteableTarget]($frontend), defaults to true; assumption is that *most* Primitive tools will insert/update elements.
  * Only applicable to spatial views.
  * Requires a specific GeometricModel be included in the view's [ModelSelectorState]($frontend).

If [InteractiveTool.isCompatibleViewport]($frontend) rejects the view, then the current tool remains active and installation of the new tool stops, if the view is accepted, then we proceed to the [onInstall](#oninstall) step.

> For applications that support multiple views, [InteractiveTool.onSelectedViewportChanged]($frontend) will also call isCompatibleViewport to provide tools an opportunity to decide if they should remain active or must exit depending on their compatibility with the new selected view. The *isSelectedViewChange* parameter will be true in this situation.

```ts
[[include:PrimitiveTool_SelectedViewport]]
```

> Prior to sending a button or motion event to the active tool, isCompatibleViewport is also called. If the tool rejects the view of the would-be motion event, it still remains active and the user is presented with an *incompatible* view cursor. A data button in an incompatible view will either be ignored (not sent to the tool), or trigger a change of the selected view. The data button behavior is controlled by the state of [PrimitiveTool.targetIsLocked]($frontend). Ideally a placement tool should allow the selected view to be freely changed by the first data button as long as the new view is compatible, afterwards the target view/model will be considered locked for the tool duration, see [PrimitiveTool.autoLockTarget]($frontend).

## onInstall

Now that a target view has been accepted for the tool operation, [InteractiveTool.onInstall]($frontend) provides one last chance before being set as the active tool to check any remaining requirements. The type of checks to consider for onInstall as opposed to isCompatibleViewport would be one time only initial conditions that would not be appropriate or necessary to test on a motion event, such as:

  * Tool requires an pre-defined [SelectionSet]($frontend) of existing elements.

> Most tools don't need to override onInstall, as long as it returns true, the new tool is set as the active tool, after which [onPostInstall](#onpostinstall) will be called.

## onPostInstall

After becoming the active tool, [InteractiveTool.onPostInstall]($frontend) is used to establish the initial tool state. This may include enabling [AccuSnap]($frontend), sending [AccuDraw]($frontend) hints, and showing user prompts. Because onPostInstall is paired with [InteractiveTool.onCleanup]($frontend), it's also a good place to register listeners for events.

Refer to [AccuSnap and AccuDraw](#accusnap-and-accudraw) for examples of different types of Primitive tools.

## onRestartTool

A Primitive tool is required to provide an implementation for [PrimitiveTool.onRestartTool]($frontend). This method can be called to notify the tool after iModel changes made outside of the tool's perview have occured which *may* have invalidated the current tool state. For example, the user requests an undo of their previous action, an element the tool is currently modifying was created in the last transaction and as such no longer exists. The tool is expected to either install a new tool instance, or exit in response to this event.

Example of typical implementation for onRestartTool:

```ts
[[include:PrimitiveTool_Restart]]
```
> The default implementation of [InteractiveTool.onSelectedViewportChanged]($frontend) also calls onRestartTool to handle [isCompatibleViewport](#iscompatibleviewport) returning false. It's expected that the tool will restart with target from the new viewport if compatible, and call [InteractiveTool.exitTool]($frontend) otherwise.

## AccuSnap and AccuDraw

AccuSnap is a aide for identifying elements and pickable decorations under the cursor. A tool can choose to enable locate, snapping, or both.

### Snapping

![snapping example](./accusnap.png "Example of AccuSnap with snapping enabled")

Tools that override [InteractiveTool.onDataButtonDown]($frontend) or [InteractiveTool.onDataButtonUp]($frontend) and use [BeButtonEvent.point]($frontend) directly, in particular those that create new or modify existing elements, should call [AccuSnap.enableSnap]($frontend) with true to enable snapping. Snapping enables the user to identity locations of interest to them on existing elements or pickable decorations by choosing a [SnapMode]($frontend) and snap divisor.

> To be considered active, both tool and user must enable snapping; [AccuSnap.isSnapEnabled]($frontend) and [AccuSnap.isSnapEnabledByUser]($frontend) are both true. A user that disables snapping through AccuSnap will identify snap locatations using [TentativePoint]($frontend) instead. The default [IdleTool]($frontend) behavior of clicking the middle mouse button is to perform a tentative snap.

![tentative example](./tentative.png "Example showing Tentative snap to element")

> A tool with an understanding of connection points and how things fit together *should not* enable AccuSnap. For example, a tool to place a valve on a pipe knows to only choose pipe end points of a given diameter, it should not require the user to choose an appropriate snap point at the end of a correct pipe or try to influence AccuSnap to only generative *key points* it deems appropriate, it can already freely do this soley based on the identified [HitDetail]($frontend); AccuSnap does not add value in this scenario.

Example of [InteractiveTool.onPostInstall]($frontend) for a simple placement tool that will use AccuSnap to identify points:

```ts
[[include:PrimitiveTool_PostInstall]]
```

TODO - [Filtering Points](#filtering-points)

### Locate

![locate example](./autolocate.png "Example of AccuSnap with locate enabled")

A tool that only needs to identify elements and does not use [BeButtonEvent.point]($frontend) should not enable snapping. Instead the tool should call [AccuSnap.enableLocate]($frontend) with true to enable locating elements as the cursor moves over them. Enabling locate for AccuSnap provides the user with immediate feedback regarding the element under the cursor in the form of a tooltip. Element's will also glow to indicate they are of the type the tool is looking for, and the tooltip can be used to communicate exactly why a particular element can't be accepted.

TODO - [InteractiveTool.getToolTip]($frontend) - [Filtering Elements](#filtering-elements)

> Unlike snapping, only the tool needs to enable locate to make it active.

InteractiveTool.initLocateElements]($frontend)
InteractiveTool.changeLocateState]($frontend)

TODO - Example of simple element locate tool (delete element?)

## Filtering Points

TODO - isValidLocation
[InteractiveTool.isValidLocation]($frontend)

## Filtering Elements

TODO - filterHit
[InteractiveTool.filterHit]($frontend)

### AccuDraw

TODO - AccuDraw explanation and image
Accudraw is an aide for entering coordinate data.

TODO - Example using AccuDraw




