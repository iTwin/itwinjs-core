# Notifications and Messages

There are several types of notifications and messages that can be displayed using [NotificationManager]($imodeljs-frontend) methods:

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

To display prompts and messages correctly, the [AppNotificationManager]($ui-framework) subclass of NotificationManager from ui-framework
should be set to `IModelAppOptions.notifications` in the application's call to `IModelApp.startup`.
Thereafter, the NotificationManager methods are available via `IModelApp.notifications`.

```ts
// Use the AppNotificationManager subclass from ui-framework to get prompts and messages
IModelApp.startup({notifications:  new AppNotificationManager()});
```

## MessageManager and React-based Messages

The ui-framework package also contains the [MessageManager]($ui-framework), which manages messages and is used by the AppNotificationManager class.
When using the NotificationManager methods, such as `IModelApp.notifications.outputMessage`, the messages may be either a string or HTMLElement.
Some MessageManager methods add support for React components as messages.
The type declaration related to this support is [NotifyMessageType]($ui-framework).

To use React components in Toast, Sticky, Alert, Input Field, or Pointer messages, use the MessageManager `outputMessage` method and
[ReactNotifyMessageDetails]($ui-framework) instead of [NotifyMessageDetails]($imodeljs-frontend).
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

- [Notification]($ui-framework:Notification)
