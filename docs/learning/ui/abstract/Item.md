# Item

The [Item]($ui-abstract:Item) classes and interfaces are used when working with items in a Toolbar, Widget, Backstage or Context Menu.

## ConditionalBooleanValue

The [ConditionalBooleanValue]($ui-abstract) class is used to specify a boolean value that can change value during the session. When a class instance is constructed, a test function is provided and is used to update the internal boolean value. The function is run to get its initial value if the value is not explicitly set when it is constructed. The syncEventIds are used to allow the user to monitor the application for specific events which would trigger the test function to be rerun. Typically the UI container that holds the item that uses a conditional value will register to listen for the specified event Ids and call the refresh method to update its internal value.  These types of values are often used to set the items isHidden property value, as shown below.

```ts
const isHidden = new ConditionalBooleanValue(() => {
  const activeContentControl = ContentViewManager.getActiveContentControl();
  return !!activeContentControl?.viewport?.view.is2d();
}, [SyncUiEventId.ActiveContentChanged, SyncUiEventId.ActiveViewportChanged, SyncUiEventId.ViewStateChanged]);
```

## ConditionalStringValue

The [ConditionalStringValue]($ui-abstract) class is used to specify a string value that can change value during the session. When a class instance is constructed, a test function is provided and is used to update the internal string value. The function is run to get its initial value if the value is not explicitly set when it is constructed. The syncEventIds are used to allow the user to monitor the application for specific events which would trigger the test function to be rerun. Typically the UI container that holds the item that uses a conditional value will register to listen for the specified event Ids and call the refresh method to update its internal value. The example below is used to determine the icon to display based on the active content view.

```ts
const iconSpec = new ConditionalStringValue(() => {
  const activeContentControl = ContentViewManager.getActiveContentControl();
  if (activeContentControl?.viewport?.view.is2d())
    return "icon-rotate-left";
  return "icon-gyroscope";
}, [SyncUiEventId.ActiveContentChanged, SyncUiEventId.ActiveViewportChanged, SyncUiEventId.ViewStateChanged]),
```

## API Reference

- [Item]($ui-abstract:Item)
