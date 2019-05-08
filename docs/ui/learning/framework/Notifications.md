# Notifications and Messages

There are several types of notifications and messages that can be displayed using **NotificationManager** methods:

|Type|Description
|-----|-----
|Element Tooltip| displays near the cursor and provides information about the iModel element the cursor is over
|Prompt| displays in or near the Status Bar and provides instructions about the usage of a Tool
|Toast message| displays above the Status Bar and automatically disappears after 3 to 4 seconds
|Sticky message| displays above the Status Bar and contains a Close button the user clicks to dismiss it
|Input Field message| displays near an input field and provides feedback about the usage of the field
|Alert message| displays in the center of the window and contains a Close button the user clicks to dismiss it
|Pointer message| displays near the cursor and provides feedback about the usage of a Tool
|Activity message| displays above the Status Bar and displays a Progress Bar and text related to a currently running activity

## NotificationManager

To display prompts and messages correctly, the AppNotificationManager subclass of NotificationManager from ui-framework should be set to `IModelAppOptions.notifications` in the application's call to `IModelApp.startup`.

```TS
    // Use the AppNotificationManager subclass from ui-framework to get prompts and messages
    IModelApp.startup({notifications:  new AppNotificationManager()});
```

## API Reference

* [Notification]($framework:Notification)
