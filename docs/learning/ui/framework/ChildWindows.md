# Child Window Manager

The [ChildWindowManager]($ui-framework) class, available via property `UiFramework.childWindowManager`, provides methods to open child windows displaying React components in another browser window. This child browser window shares the same javascript context as the single page IModelApp running in the main browser window. This manager maintains a list of all child windows and closes them when the page containing the IModelApp is unloaded.

The api will open the url `iTwinPopup.html` which must be located along side the application's index.html. A template `iTwinPopup.html` can be found in the ui\framework source in the imodeljs github repository. When the ChildWindowManager opens a child window it must immediately copy styles from the main application's document into the child window so the appearance of the child window matches that of the main window.

The ChildWindowManager does not try to save and restore child windows. The one exception is the child windows opened via the Widget "pop-out" icon. The widget system will maintain the state of the size and location of "popped-out" widgets and attempt to restore that position when the widget is subsequently popped out.

## Warning

Careful consideration must be taken when building components for use in a child popup window. At minimum components should typically not use the `window` or `document` property to register listeners as these listener will be registered for events in the main window and not in the child window. Components will need to use the `ownerDocument` and `ownerDocument.defaultView` properties to retrieve `document` and `window` properties for the child window. These requirements will limit what open source React components may be used.
