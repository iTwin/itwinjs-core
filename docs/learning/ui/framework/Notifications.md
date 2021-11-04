# Notifications and Messages

There are several types of notifications and messages that can be displayed using [NotificationManager]($core-frontend) methods:

|Type|Description
|-----|-----
|Element Tooltip| displays near the cursor and provides information about the iModel element the cursor is over
|Prompt and Tool Assistance | displays in or near the Status Bar and provides instructions about the usage of a Tool
|Toast message| displays above the Status Bar and automatically disappears after 3 to 4 seconds
|Sticky message| displays above the Status Bar and contains a Close button the user clicks to dismiss it
|Alert message| displays in the center of the window and contains a Close button the user clicks to dismiss it
|Input Field message| displays near an input field and provides feedback about the usage of the field
|Pointer message| displays near the cursor and provides feedback about the usage of a Tool
|Activity message| displays above the Status Bar and displays a Progress Bar and text related to a currently running activity

## AppNotificationManager

To display prompts and messages correctly, the [AppNotificationManager]($appui-react) subclass of NotificationManager from appui-react
should be set to `iModelApp.notifications` in the application's call to `IModelApp.startup`.
Thereafter, the NotificationManager methods are available via `IModelApp.notifications`.

```ts
// Use the AppNotificationManager subclass from appui-react to get prompts and messages
import { AppNotificationManager } from "@itwin/appui-react";
. . .
  const opts: NativeAppOpts = {
    iModelApp: {
      . . .
      notifications: new AppNotificationManager(),
      . . .
    },
  . . .
  // Start the app.
  await SampleAppIModelApp.startup(opts);
```

## MessageManager and React-based Messages

The appui-react package also contains the [MessageManager]($appui-react), which manages messages and is used by the AppNotificationManager class.
When using the NotificationManager methods, such as `IModelApp.notifications.outputMessage`, the messages may be either a string or HTMLElement.
Some MessageManager methods add support for React components as messages.
The type declaration related to this support is [NotifyMessageType]($appui-react).

To use React components in Toast, Sticky, Alert, Input Field, or Pointer messages, use the MessageManager `outputMessage` method and
[ReactNotifyMessageDetails]($appui-react) instead of [NotifyMessageDetails]($core-frontend).
React components may also be used in Element Tooltips and Activity messages.

The following example displays a link in a Sticky message:

```tsx
const reactNode = (
  <span>
    For more details, <UnderlinedButton onClick={this._handleLink}>click here</UnderlinedButton>.
  </span>
);
const reactMessage = { reactNode };
MessageManager.outputMessage(
  new ReactNotifyMessageDetails(OutputMessagePriority.Info,
    "This is an info message", reactMessage, OutputMessageType.Sticky));
```

```ts
private _handleLink = () => {
  window.alert("The link was clicked");
}
```

## API Reference

- [Notification]($appui-react:Notification)
