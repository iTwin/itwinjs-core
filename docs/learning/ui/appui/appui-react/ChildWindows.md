# Child Window Manager

The [ChildWindowManager]($appui-react) class, available via property `UiFramework.childWindowManager`, provides methods to display React components in additional browser windows. A child browser window shares the same javascript context as the single page IModelApp running in the main browser window. The ChildWindowManager maintains a list of all child windows and closes them when the page containing the IModelApp is unloaded.

## Popup URL

There are two options when opening a child popup window, the first is to allow appui-react to open a blank URL and seed the HTML document with a div that can be targeted by React. Below is an example of code that would open a popup window using a blank URL.

```tsx
  const childWindowId="popout-widget-1";
  const title="Example Popout Widget";
  const content=(<div>Example Popout Widget</div>);
  const location={ height: 600, width: 400, left: 10, top: 50};
  const useDefaultPopoutUrl=false; // this is default if not specified
  UiFramework.childWindowManager.openChildWindow(childWindowId, title, content, location, false);
```

The second option is to pass true for the useDefaultPopoutUrl argument above. This will result in the use of the URL "/iTwinPopup.html". It is the responsibility of the application to ensure this HTML file is available at that location on the server. The minimum contents for this file is shown below. The div with `id=root` is required as it is the element that is used to host React components.

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8" />
  <style>
    html,
    body {
      height: 100%;
      width: 100%;
      margin: 0;
      overflow: hidden;
    }

    #root {
      height: 100%;
    }
  </style>
</head>

<body>
  <noscript>You need to enable JavaScript to run this app.</noscript>
  <div id="root"></div>
</body>

</html>
```

When the ChildWindowManager opens a child window it immediately copies styles from the main application's document into the child window so the appearance of the child window matches that of the main window.

The ChildWindowManager does not try to save and restore child windows. The one exception is the child windows opened via the Widget "pop-out" icon. The widget system will maintain the state of the size and location of "popped-out" widgets and attempt to restore that position when the widget is subsequently popped out.

## Warning

Careful consideration must be taken when building components for use in a child popup window. At minimum components should typically not use the `window` or `document` property to register listeners as these listener will be registered for events in the main window and not in the child window. Components will need to use the `ownerDocument` and `ownerDocument.defaultView` properties to retrieve `document` and `window` properties for the child window. These requirements will limit what open source React components may be used.

## Widgets

A Widget can specify set its `canPopout` property to true if its supports being in a child window. This allows a Widget to be "popped-out" to its own window and then re-docked in the Widget Panel when the child window is closed. See [Popout Widget Support]($docs/learning/ui/appui/appui&#8209;react/Widgets.md#popout-widget-support) for more details.

## API Reference

- [ChildWindowManager]($appui-react:ChildWindowManager)
