<!---
cSpell:ignore dont
-->

# AccuDraw Source Code

AccuDraw is an aide for entering coordinate data.
The source code for the AccuDraw core is in
AccuDraw.ts and
AccuDrawTool.ts
in the `core/frontend/src` and `/tools` folders.
The source code for a UI implementation using React components is
in the `ui/framework/src/ui-framework/accudraw` folder.

## AccuDraw.ts

AccuDraw.ts contains the AccuDraw main class, which can be subclassed to provide a UI implementation for AccuDraw.

### Methods with overrides in subclasses to implement UI

Several methods within the AccuDraw class are called as status changes occur. These are overridden by a UI implementation:

- onCompassModeChange
- onRotationModeChange
- onFieldLockChange
- onFieldValueChange
- onMotion

One methods within the AccuDraw class is called to obtain status by the core. This is overridden by a UI implementation:

- hasInputFocus

Some methods within the AccuDraw class are called to perform UI functionality. These are overridden by a UI implementation:

- setFocusItem
- grabInputFocus

### Methods called by subclasses that implement UI

Some methods in the AccuDraw class are called by the UI implementation:

- processFieldInput
- getValueByIndex

### Status Properties

Some methods in the AccuDraw class provide the current status:

- compassMode
- rotationMode
- dontMoveFocus
- isEnabled
- isDeactivated

## AccuDrawTool.ts

AccuDrawTool.ts contains:

- AccuDrawShortcuts class - Contains functionality for AccuDraw shortcuts
- AccuDrawShortcutsTool abstract class - An InputCollector subclass for AccuDraw tools
- Tool classes for AccuDraw shortcuts. These tool classes subclass AccuDrawShortcutsTool.

## UI Implementation in ui-framework

Source files that contain the AccuDraw UI implementation in the `ui/framework/src/ui-framework/accudraw` folder include:

| Source File | Description
| ----------- | ------------
| AccuDrawCommandItems.ts | Contains ToolItemDef instances for AccuDraw tools, which are defined in AccuDrawTool.ts
| AccuDrawDialog.tsx | Dialog that displays an AccuDrawFieldContainer component
| AccuDrawFieldContainer.tsx | Displays an AccuDrawInputField component for each field
| AccuDrawInputField.tsx | Displays an Input component and a Lock icon along with an optional field icon
| AccuDrawKeyboardShortcuts.ts | Defines default AccuDraw Keyboard Shortcuts using ToolItemDefs from AccuDrawCommandItems
| AccuDrawUiSettings.ts | User Interface Settings for each field, including CSS styles, colors, labels & icons
| AccuDrawWidget.tsx | Widget that displays an AccuDrawFieldContainer component
| FrameworkAccuDraw.ts | Subclass of the AccuDraw core class that overrides methods, emits events for value and status changes, and processes field input

Other files in the `ui-framework/accudraw` folder, such as AccuDrawPopupManager.tsx, Calculator*, MenuButton.* and SquareButton.*, are from the AccuDraw 2.0 project. They may or may not be used in the future.

### FrameworkAccuDraw

The FrameworkAccuDraw class is a subclass of the AccuDraw core class that overrides methods to implement an AccuDraw UI.
Here are more details about these implementations:

- The implementations of the `on*` methods, such as `onMotion` and `onFieldValueChange`, `setFocusItem` and `grabInputFocus` emit events defined in FrameworkAccuDraw.ts.
- The events in FrameworkAccuDraw have listeners in either AccuDrawFieldContainer or AccuDrawInputField that update the AccuDraw UI components.
- The `hasInputFocus` implementation checks for focus inside the AccuDrawFieldContainer.
- The `getFieldDisplayValue` method determines the display value for an AccuDraw field by calling
`QuantityFormatter.findFormatterSpecByQuantityType` and `QuantityFormatter.formatQuantity`.
- The `setFieldValueFromUi` method, which is called when the user updates a value in an Input component,
calls `processFieldInput` to notify the AccuDraw core of a value update.

### FrameworkAccuDraw Setup in IModelApp

An AccuDraw class or subclass instance is setup in the IModelApp instance using `IModelApp.startup` options containing the `iModelApp.accuDraw` member. See example in `test-apps/ui-test-app/src/frontend/index.tsx`.

```ts
import { FrameworkAccuDraw } from "@itwin/appui-react";
. . .
  const opts: NativeAppOpts = {
    iModelApp: {
      . . .
      accuDraw: new FrameworkAccuDraw(),
      . . .
    },
  . . .
  // Start the app.
  await SampleAppIModelApp.startup(opts);
```

### AccuDrawFieldContainer React Component

The AccuDrawFieldContainer component displays an AccuDrawInputField component for each field. It also does the following:

- Maintains HTMLInputElement references for the 5 input fields for focus purposes
- Maintains which of the input fields should have focus based on the `setFocusItem` and `grabInputFocus` methods in the AccuDraw class
- Maintains the lock status for the input fields based on the `onFieldLockChange` method in the AccuDraw class
- Displays the appropriate fields based on the Compass Mode set by the `onCompassModeChange` method in the AccuDraw class
- Determines if the Z field should be shown based on the ViewState.is3d result
- Processes user value changes in the Input components by calling `FrameworkAccuDraw.setFieldValueFromUi`, which indirectly calls `processFieldInput` in the AccuDraw class to notify the AccuDraw core of a value update
- Processes Esc key presses by calling `KeyboardShortcutManager.setFocusToHome`
- Listens for AccuDrawUiSettingsChangedEvent, which is emitted when the `FrameworkAccuDraw.uiSettings` property is updated. Settings for each field include CSS styles, colors, labels & icons. Currently, these settings would only come from the application, not the user.

### AccuDrawInputField React Component

The AccuDrawInputField component displays an Input component and a Lock icon along with an optional field icon.
It also does the following:

- Displays the appropriate value for the field
- Calls `onValueChanged` prop method when the user changes the value. An optional delay is supported, allowing for multiple keystrokes before calling the changed method.
- Calls prop methods for Escape and Enter keys and calls `KeyboardShortcutManager.processKey` for letter keys
- Selects the text in the input field when receiving focus
