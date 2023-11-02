# Define Content

## Overview

The content in AppUI is what is displayed in the back of your application, it is the main reason your application exists, to show, modify and interact with the content.

This content must be defined and is split in 3 ideas: Control, Layout and Group
You will use a combination of these to create the content that will be displayed in your app.

## Content Control

iTwin.js application typically will use a viewport to display the 2d or 3d data, and AppUI provides an IModel Viewport control to display such information. It have different feature like View Overlays, and allowing the viewer to set the viewstate and the iModel connection specifically for this viewport.

You never instantiate a content control directly, it will be instantiated by the framework when it is needed. All you need to do is tell the framework that you want it with an object satisfying the ContentProps interface:

```ts
{
  id: "main-imodel-view",
  classId: IModelViewportControl
  applicationData: {
    viewState: () => {/* some function that return a viewstate*/},
    iModelConnection: UiFramework.getIModelConnection(),
  }
}
```

Note however that you have the possibility to subclass the ViewportContentControl if you need a more fine grained control over the display, or you can even subclass directly ContentControl, where you can actually show any react component as the base of your application.

```ts
interface MyTableControlOptions {
  data: {}[];
}

class MyTableControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: MyTableControlOptions) {
    super(info, options);
    this.reactNode = <Table data={options.data} />;
  }
}
```

You would then use this component just like the IModelViewportControl:

```ts
const mainTableContent = {
  id: "main-table-content",
  classId: MyTableControl
  applicationData: {
    data: [
      {iTwinName: "My iTwin", iModelName: "My iModel"},
      {iTwinName: "Another iTwin", iModelName: "A different iModel"},
    ],
  }
}
```

## Content Layout

Multiple content controls can be displayed at the same time by an application, to determine how these content are organized on the screen,  you need to provide a layout.

AppUI provides 8 layouts out of the box that you can refer simply by name in the `StandardContentLayouts` object:

```ts
class StandardContentLayouts {
    static readonly singleView: ContentLayoutProps;
    static readonly fourQuadrants: ContentLayoutProps;
    static readonly twoVerticalSplit: ContentLayoutProps;
    static readonly twoHorizontalSplit: ContentLayoutProps;
    static readonly threeViewsTwoOnLeft: ContentLayoutProps;
    static readonly threeViewsTwoOnRight: ContentLayoutProps;
    static readonly threeViewsTwoOnBottom: ContentLayoutProps;
    static readonly threeViewsTwoOnTop: ContentLayoutProps;
}
```

However you can build these views completely by yourself using the same interface, which gives you complete control over that layout.

```ts
const myOwnLayout = {
  id: "myOwnLayout",
  description: "A 3 row content, the top row size is locked",
  horizontalSplit: {
    id: "myOwnLayout:1-23",
    percentage: 0.33,
    locked: true,
    top: 0,
    bottom: {
      horizontalSplit: {
        id: "myOwnLayout:2-3",
        percentage: 0.5,
        locked: false,
        top: 1,
        bottom: 2,
      }
    }
  }
}
```

## Content Group

Multiple content controls can be displayed at the same time by an application, so the content controls are organized in Content Groups (even if there is only one displayed!)

A content group consists of an id, a default layout, and a list of controls. When the group is displayed, the layout will be filled with instances of the content controls. If there is more controls than places in the layouts, the remaining controls will simply not be created.

```ts
new ContentGroup({
  id: "my-content-group",
  layout: myOwnLayout,
  contents: [
    mainTableContent,
    mainViewportContent,
    {
      id: "alternate-imodel-view",
      classId: IModelViewportControl,
      applicationData: {
        viewstate: () => {/* some function that return a monochrome viewstate */},
      }
    }
  ]
});
```
