# Content Views, Controls, Groups and Layouts

A **Content View** is a representation of an iModel's data. It is the main graphics or data view in an iTwin.js application.
There may be multiple Content Views displayed at the same time.
When more than one Content View is displayed, they are usually separated by splitters, allowing the user to resize the views.
There are three constructs used to manage and lay out Content Views:

|Construct|Description
|-----|-----
|**Content Control** | A class that specifies the React component to display for a Content View
|**Content Group** | A collection of Content Controls
|**Content Layout** | A layout configuration of Content Views

Content Groups and Layouts may be defined locally in a Frontstage or they may be defined centrally and registered by id with the ConfigurableUiManager.

## Defining Content Controls

A Content Control will either subclass [ViewportContentControl]($ui-framework) if the view is a ScreenViewport or [ContentControl]($ui-framework) if the view is a data view.

### Subclassing ViewportContentControl

The following shows a sample Viewport content control that subclasses ViewportContentControl. It imports a local **ViewportComponent** implementation and sets `this.reactNode`. The `options` parameter to the constructor comes from the `applicationData` values set in a Content Group.

```ts
import * as React from "react";

import {
  ConfigurableCreateInfo,
  ViewportContentControl,
} from "@bentley/ui-framework";

import { ScreenViewport } from "@bentley/imodeljs-frontend";

import SimpleViewportComponent from "../components/Viewport";

/**
 * iModel Viewport content
 */
export class ViewportContent extends ViewportContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options.iModelConnection && options.viewId) {
      this.reactNode = (
        <SimpleViewportComponent
          viewportRef={(v: ScreenViewport) => { this.viewport = v; }}
          imodel={options.iModelConnection}
          viewDefinitionId={options.viewId}
          rulesetId={options.rulesetId} />
      );
    }
  }
}
```

**Note:** It is important to provide a `viewportRef` Prop to the **ViewportComponent** implementation. The `viewportRef` function should set `this.viewport`. This is important in determining when the Frontstage is ready for use.

```js
viewportRef={(v: ScreenViewport) => { this.viewport = v; }}
```

### Subclassing ContentControl

The following shows a sample content control that subclasses ContentControl and displays a Table data component.

```ts
import * as React from "react";

import {
  ConfigurableCreateInfo,
  ContentControl,
} from "@bentley/ui-framework";

import SimpleTableComponent from "../components/Table";

/**
 * Table content
 */
export class TableContent extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options.iModelConnection) {
      this.reactNode = <SimpleTableComponent imodel={options.iModelConnection} rulesetId={options.rulesetId} />;
    }
  }
}
```

## Defining Content Groups

When defining Content Groups, the **ContentProps** and **ContentGroupProps** interfaces and **ContentGroup** class are used.

The following shows a sample Content Group with a single entry that references the ViewportContent defined above. The Content Group is loaded and registered into ConfigurableUiManager and can be referenced by its id by any Frontstage.

```ts
const one2dIModelViewport: ContentGroupProps = {
  id: "one2dIModelViewport",
  contents: [
    {
      classId: ViewportContent,
    },
  ],
};

const contentGroup = new ContentGroup(one2dIModelViewport);
ConfigurableUiManager.loadContentGroup(contentGroup);
```

The following shows a sample with two entries that reference the ViewportContent and TableContent defined above. `applicationData` is defined for each content control, which is provided to the ContentControl constructor via the `options` parameter.

```ts
contentGroup = new ContentGroup({
  contents: [
    {
      classId: ViewportContent,
      applicationData: {
        viewId: this.viewIds[0],
        iModelConnection: NineZoneSampleApp.store.getState().sampleAppState!.currentIModelConnection,
        rulesetId: this._rulesetId,
      },
    },
    {
      classId: TableContent,
      applicationData: {
        iModelConnection: NineZoneSampleApp.store.getState().sampleAppState!.currentIModelConnection,
        rulesetId: this._rulesetId,
      },
    }
  ],
});
```

## Defining Content Layouts

When defining Content Layouts, the **ContentLayoutProps** interface and **ContentLayoutDef** class are used. The ContentLayoutDef can be referenced directly by a Frontstage or it may be registered and referenced by id. The Content Layout uses index numbers to reference content within a Content Group. Both the Content Layout and the Content Group are provided as properties to a Frontstage.

### A single view

The following shows a sample layout with a single piece of content. The Content Layout is loaded and registered into ConfigurableUiManager and can be referenced by its id by any Frontstage.

```ts
const singleContent: ContentLayoutProps = {
  id: "SingleContent",
};

const contentLayoutDef = new ContentLayoutDef(singleContent);
ConfigurableUiManager.loadContentLayout(contentLayoutDef);
```

### Two views, one beside the other

The following shows a sample layout with two pieces of content that are side by side, sized evenly and divided by a vertical splitter. The `left` content references index 0 in the Content Group and the `right` content references index 1 in the Content Group.

```ts
const twoHalvesVertical: ContentLayoutProps = {
  id: "TwoHalvesVertical",
  verticalSplit: { percentage: 0.50, left: 0, right: 1 },
};
```

### Two views, one above the other

The following shows a sample layout with two pieces of content, one above the other, sized evenly and divided by a horizontal splitter. The `top` content references index 0 in the Content Group and the `bottom` content references index 1 in the Content Group.

```ts
const twoHalvesHorizontal: ContentLayoutProps = {
  id: "TwoHalvesHorizontal",
  horizontalSplit: { percentage: 0.50, top: 0, bottom: 1 },
};
```

### Three views, one on the left, two stacked on the right

The following shows a sample layout with three pieces of content. The `left` side takes up half of the window, and the `right` side takes up the other half. The right side displays two pieces of content, one above the other and are sized evenly. The `left` content references index 0 in the Content Group, the `top` content references index 1, and the `bottom` content references index 2 in the Content Group.

```ts
const threeRightStacked: ContentLayoutProps = {
  id: "ThreeRightStacked",
  verticalSplit: {
    percentage: 0.50,
    left: 0,
    right: { horizontalSplit: { percentage: 0.50, top: 1, bottom: 2 } },
  },
};
```

### Four views laid out in quadrants

The following shows a sample layout with four pieces of content. There is a `top` half and a `bottom` half. Each of these halves contain two pieces of content that are side by side and sized evenly.

```ts
const fourQuadrants: ContentLayoutProps = {
  id: "FourQuadrants",
  horizontalSplit: {
    percentage: 0.50,
    top: { verticalSplit: { percentage: 0.50, left: 0, right: 1 } },
    bottom: { verticalSplit: { percentage: 0.50, left: 2, right: 3 } },
  },
};
```

## API Reference

- [Content Views]($ui-framework:ContentView)
