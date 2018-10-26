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

The tool is responsibie for checking the viewport's compatibility with the tool operation, some examples below:

  * Target isn't readonly. Checks [PrimitiveTool.requireWriteableTarget]($frontend), defaults to true; assumption is that *most* Primitive tools insert/update elements.
  * Only applicable to spatial views.
  * Requires a specific GeometricModel be included in the view's [ModelSelectorState]($frontend).

If isCompatibleViewport rejects the view, then the current tool remains active and installation of the new tool stops, if the view is accepted, then we proceed to the [onInstall](#oninstall) step.

> For applications that support multiple views, [InteractiveTool.onSelectedViewportChanged]($frontend) will also call isCompatibleViewport to provide tools an opportunity to decide if they should remain active or must exit depending on their compatibility with the new selected view. The *isSelectedViewChange* parameter will be true in this situation.

```ts
[[include:PrimitiveTool_SelectedViewport]]
```

> Prior to sending any button or motion event to the active tool, isCompatibleViewport is also called. If the tool rejects the view of the would-be motion event, it still remains active; instead the user is presented with an *incompatible* view cursor. A data button in an incompatible view will either be ignored (not sent to the tool), or trigger a change of the selected view. The data button behavior is controlled by the state of [PrimitiveTool.targetIsLocked]($frontend). A typical placement tool should allow the selected view to be freely changed by the first data button, afterwards the target view/model will be considered locked for the tool duration, see [PrimitiveTool.autoLockTarget]($frontend).

## onInstall

Now that the target view has been deemed acceptable to the tool operation, [InteractiveTool.onInstall]($frontend) provides one last chance before being set as the active tool to check any remaining requirements. The type of checks to consider for onInstall as opposed to isCompatibleViewport are ones that are not appropriate to a motion or button event, such as:

  * Tool requires an pre-defined [SelectionSet]($frontend) of existing elements.

> Most tools don't need to override onInstall, as long as it returns true, the new tool is set as the active tool, after which [onPostInstall](#onpostinstall) will be called.

## onPostInstall

After becomming the active tool, [InteractiveTool.onPostInstall]($frontend) is used to establish the initial tool state. This may include enabling [AccuSnap]($frontend), sending [AccuDraw]($frontend) hints, and showing user prompts. Because onPostInstall is paired with [InteractiveTool.onCleanup]($frontend), it's also a good place to register listeners for events.

Refer to [AccuSnap and AccuDraw](#accusnap-and-accudraw) for examples of different types of Primitive tools.

## onRestartTool

A Primitive tool is required to provide an implementation for [PrimitiveTool.onRestartTool]($frontend). It's purpose is to notify the tool after iModel changes made outside of the tool's perview have occured which *may* have invalidated the current tool state. For example, the user requests an undo of their previous action, an element the tool is currently modifying was created in the last transaction and as such no longer exists. The tool is expected to either install a new tool instance, or exit in response to this event.

Example of typical implementation for onRestartTool:

```ts
[[include:PrimitiveTool_Restart]]
```
> The default implementation of [InteractiveTool.onSelectedViewportChanged]($frontend) also calls onRestartTool to handle [isCompatibleViewport](#iscompatibleviewport) returning false. It's expected that the tool will restart with target from the new viewport if compatible, and call [InteractiveTool.exitTool]($frontend) otherwise.

## AccuSnap and AccuDraw

TODO - AccuSnap/auto-locate explanation and image

[AccuSnap.isSnapEnabled]($frontend) and [AccuSnap.isSnapEnabledByUser]($frontend)

TODO - AccuDraw explanation and image

InteractiveTool.initLocateElements]($frontend)
InteractiveTool.changeLocateState]($frontend)

Example of [InteractiveTool.onPostInstall]($frontend) for a simple placement tool that will use AccuSnap to identify points:

```ts
[[include:PrimitiveTool_PostInstall]]
```

TODO - Example of simple element locate tool
TODO - Example using AccuDraw

## Filtering Elements and Points

TODO - isValidLocation and filterHit

InteractiveTool.isValidLocation]($frontend)
InteractiveTool.filterHit]($frontend)



