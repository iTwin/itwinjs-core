---
tableRowAnchors: true
jotform: true
---

# AppUI

AppUI is a React based framework consisting of APIs and components that enable iTwin.js applications to implement the AppUI design.
This design organizes the visual elements on the screen in a way that is familiar to users of desktop applications where the screen is divided into a content area surrounded by panels that contain widgets, toolbars, and status bar.
In an iTwin.js application, the content area is usually a [Viewport]($core-frontend), while information such as element properties and data hierarchies are displayed in [widgets](./configure-frontstage#widgets).

For a high level overview of different AppUI design concepts, see [UI Glossary](/ui/uiglossary).

![AppUI](../images/AppUiDarkTheme.png)

## Layout Features

Dedicated **tool settings** area at the top of the application for components that change the operational settings of the currently executing [Tool](../../learning/frontend/Tools.md). For more information, see [Tool Settings](./configure-frontstage.md#tool-settings).

![ToolSettings](../images/ToolSettings.png)

Dedicated **status bar** area at the bottom of the application for components that display notifications, messages, and other feedback to the user. For more information, see [Status Bar](./configure-frontstage.md#status-bar).

![StatusBar](../images/StatusBar.png)

Interactive **widget** components that display relevant content of the application. Here a _Conversations_ widget is floating, while _Properties_, _Categories_ and other widgets are docked into the right panel. For more information, see [Widgets](./configure-frontstage.md#widgets).

![Widgets](../images/AppUiLightTheme.png)

The main content area is overlaid by **toolbar** components. The upper left corner is dedicated to the tools that manipulate the content of the application and the upper right corner is dedicated to the tools that navigate the view. For more information, see [Toolbars](./configure-frontstage.md#toolbars).

UI elements used in the layout can be updated dynamically, for more information see [Dynamic UI Item Updates](./provide-ui-items.md#dynamic-ui-item-updates).
