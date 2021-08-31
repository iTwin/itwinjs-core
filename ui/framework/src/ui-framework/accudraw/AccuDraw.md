<!---
cSpell:ignore dont
-->

# AccuDraw Source Code

AccuDraw is an aide for entering coordinate data.
The source code for the AccuDraw core is in
[AccuDraw.ts](../../../../../core/frontend/src/AccuDraw.ts) and
[AccuDrawTool.ts](../../../../../core/frontend/src/tools/AccuDrawTool.ts).
The source code for a UI implementation using React components is in [ui/framework](../../accudraw).

## AccuDraw.ts

[AccuDraw.ts](../../../../../core/frontend/src/AccuDraw.ts) contains the AccuDraw main class, which can be subclassed to provide a UI implementation for AccuDraw.
An AccuDraw class instance is setup in the IModelApp instance using `IModelApp.startup` options containing the `iModelApp.accuDraw` member.

### Methods with overrides in subclasses to implement UI

Several methods within the AccuDraw class are called as status changes occur. These are overridden by a UI implementation.

- onCompassModeChange
- onRotationModeChange
- onFieldLockChange
- onFieldValueChange
- onMotion

One methods within the AccuDraw class is called to obtain status by the core. This is overridden by a UI implementation.

- hasInputFocus

Some methods within the AccuDraw class are called to perform UI functionality. These are overridden by a UI implementation.

- setFocusItem
- grabInputFocus

### Methods called by subclasses that implement UI

Some methods in the AccuDraw class are called by the UI implementation.

- processFieldInput
- getValueByIndex

### Status Properties

Some methods in the AccuDraw class provide the current status status.

- compassMode
- rotationMode
- dontMoveFocus
- isEnabled
- isDeactivated

## UI Implementation in ui/framework

Source files that contain the AccuDraw UI implementation include:

| Source File | Description
| ----------- | ------------
| [AccuDrawCommandItems.ts](../AccuDrawCommandItems.ts) | Contains ToolItemDef instances for AccuDraw tools
| [AccuDrawDialog.tsx](../AccuDrawDialog.tsx) | Dialog that displays AccuDrawFieldContainer
| [AccuDrawFieldContainer.tsx](../AccuDrawFieldContainer.tsx) | Displays an AccuDrawInputField component for each field
| [AccuDrawInputField.tsx](../AccuDrawInputField.tsx) | Displays an Input component and a Lock icon along with an optional field icon
| [AccuDrawKeyboardShortcuts.ts](../AccuDrawKeyboardShortcuts.ts) | Defines default AccuDraw Keyboard Shortcuts using ToolItemDefs from AccuDrawCommandItems
| [AccuDrawUiSettings.ts](../AccuDrawUiSettings.ts) | User Interface Settings for each field, including CSS styles, colors, labels & icons
| [AccuDrawWidget.tsx](../AccuDrawWidget.tsx) | Widget that displays AccuDrawFieldContainer
| [FrameworkAccuDraw.ts](../FrameworkAccuDraw.ts) | Subclass of the AccuDraw core class that sends events for UI and status changes

### FrameworkAccuDraw Setup in IModelApp

```ts
  const opts: WebViewerAppOpts & NativeAppOpts = {
    iModelApp: {
      . . .
      accuDraw: new FrameworkAccuDraw(),
      . . .
    },
  . . .
  // Start the app.
  await SampleAppIModelApp.startup(opts);
```
