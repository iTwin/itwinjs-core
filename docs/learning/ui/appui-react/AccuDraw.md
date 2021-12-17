# AccuDraw User Interface

AccuDraw is an aide for entering coordinate data in editing and modeling applications.
The `@itwin/appui-react` package contains several classes and components for displaying a UI for AccuDraw
in a Widget or Dialog.

## AccuDraw UI Implementation in appui-react

AccuDraw UI classes and components include:

| Class or Component | Description
| ----------- | ------------
| [AccuDrawCommandItems]($appui-react) | Contains [ToolItemDef]($appui-react) instances for AccuDraw tools
| [AccuDrawDialog]($appui-react) | Dialog that displays an [AccuDrawFieldContainer]($appui-react) component
| [AccuDrawFieldContainer]($appui-react) | Displays an [AccuDrawInputField]($appui-react) component for each field
| [AccuDrawInputField]($appui-react) | Displays an Input component and a Lock icon along with an optional field icon
| [AccuDrawKeyboardShortcuts]($appui-react) | Defines default AccuDraw Keyboard Shortcuts using [ToolItemDef]($appui-react)s from [AccuDrawCommandItems]($appui-react)
| [AccuDrawUiSettings]($appui-react) | User Interface Settings for each field, including CSS styles, colors, labels & icons
| [AccuDrawWidget]($appui-react) | Widget that displays an [AccuDrawFieldContainer]($appui-react) component
| [FrameworkAccuDraw]($appui-react) | Subclass of the AccuDraw core class that overrides methods, emits events for value and status changes, and processes field input

## FrameworkAccuDraw Setup in IModelApp

An AccuDraw class or subclass instance is setup in the IModelApp instance using `IModelApp.startup` options containing the `iModelApp.accuDraw` member.

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

## API Reference

- [AccuDraw]($appui-react:AccuDraw)
