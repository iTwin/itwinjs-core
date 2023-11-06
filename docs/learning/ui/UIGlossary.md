---
tableRowAnchors: true
---

# Glossary of terms in iTwin.js UI

|Term | Definition
|------------|------------|
|**Backstage**|The main navigation menu of the application used to switch between frontstages, open overlays, or launch custom commands. You can use [BackstageComposer]($appui-react) to set up a backstage that displays an overlay menu along the left edge of the application.|
|**Content&nbsp;Control**|Control that is displayed in a content layout. You can use [ContentControl]($appui-react) to specify a custom React component.|
|**Content&nbsp;Group**|Defines how content controls are rendered in the content area of a frontstage. You can use [ContentGroup]($appui-react) to describe a collection of content controls and their content layout.|
|**Content&nbsp;Layout**|Describes how the content controls are arranged on the screen. You can use [StandardContentLayouts]($appui-abstract) for one of the pre-defined layouts or [ContentLayoutProps]($appui-abstract) to define a custom layout.|
|**Dialog**|A temporary interruptive UI element that overlays the application until a required action is taken by the user. You can use [Dialog](https://itwinui.bentley.com/docs/dialog) to display a custom dialog.|
|**Navigation&nbsp;Aid**|An interactive UI element that facilitates the navigation of [Viewport]($core-frontend) content. You can use [NavigationAidControl]($appui-react) to display a custom component.|
|**Frontstage**|Layout configuration that defines a page tailored to a specific task in an application. You can register a [FrontstageProvider]($appui-react) to define a custom frontstage.|
|**Status&nbsp;Bar**|A dedicated area in the user interface that displays information about the current state of the application. You can use [StatusBarComposer]($appui-react) to display a status bar as a footer at the bottom of the application.|
|**Stage&nbsp;Panel**|An interactive UI element that contains up to two panel sections and is displayed on one of the sides of the application.|
|**Stage&nbsp;Panel&nbsp;Section**|A dedicated area within a stage panel that can contain multiple widgets.|
|**Tool&nbsp;Settings**|A dedicated area in the user interface that displays properties or information related to the active tool.|
|**UI&nbsp;Items&nbsp;Provider**|A mechanism for providing UI elements such as widgets, backstage, toolbar or status bar items to the application. You can register a [UiItemsProvider]($appui-react) to provide additional items.|
|**Widget**|An interactive UI element for a custom content of an application that allows the user to view and/or modify data relevant to their current context. The content of the [Widget]($appui-react) is just a React component, but additional meta-data such as label or icon can be provided to customize or initialize the widget. Multiple widgets can be grouped and displayed in one of widget containers.<br/>**Docked** - when a widget is docked to one of stage panel sections on the side of the page.<br/>**Floating** - when a widget is displayed in a dialog like component of the page.<br/>**Popout** - when a widget is displayed in a separate popup window.|
