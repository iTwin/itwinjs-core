# AccuDraw User Interface

AccuDraw is an aide for entering coordinate data in editing and modeling applications.
The `@bentley/ui-framework` package contains several classes and components for displaying a UI for AccuDraw
in a Widget or Dialog.

## AccuDraw UI Implementation in ui-framework

AccuDraw UI classes and components include:

| Class or Component | Description
| ----------- | ------------
| [AccuDrawCommandItems]($ui-framework) | Contains [ToolItemDef]($ui-framework) instances for AccuDraw tools
| [AccuDrawDialog]($ui-framework) | Dialog that displays an [AccuDrawFieldContainer]($ui-framework) component
| [AccuDrawFieldContainer]($ui-framework) | Displays an [AccuDrawInputField]($ui-framework) component for each field
| [AccuDrawInputField]($ui-framework) | Displays an Input component and a Lock icon along with an optional field icon
| [AccuDrawKeyboardShortcuts]($ui-framework) | Defines default AccuDraw Keyboard Shortcuts using [ToolItemDef]($ui-framework)s from [AccuDrawCommandItems]($ui-framework)
| [AccuDrawUiSettings]($ui-framework) | User Interface Settings for each field, including CSS styles, colors, labels & icons
| [AccuDrawWidget]($ui-framework) | Widget that displays an [AccuDrawFieldContainer]($ui-framework) component
| [FrameworkAccuDraw]($ui-framework) | Subclass of the AccuDraw core class that overrides methods, emits events for value and status changes, and processes field input

## FrameworkAccuDraw Setup in IModelApp

An AccuDraw class or subclass instance is setup in the IModelApp instance using `IModelApp.startup` options containing the `iModelApp.accuDraw` member.

```ts
import { FrameworkAccuDraw } from "@bentley/ui-framework";
. . .
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

## API Reference

- [AccuDraw]($ui-framework:AccuDraw)
