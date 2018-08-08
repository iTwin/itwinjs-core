/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { SampleAppIModelApp } from "../..";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { WidgetControl, WidgetControlProps } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";

import { Breadcrumb, BreadcrumbDetails } from "@bentley/ui-components";
import { BreadcrumbPath } from "@bentley/ui-components";

import { IModelConnection } from "@bentley/imodeljs-frontend";

export class BreadcrumbDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <BreadcrumbDemoWidget widgetControl={this} iModelConnection={SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection} />;
  }
}

interface Props extends WidgetControlProps {
  iModelConnection?: IModelConnection;
}

class BreadcrumbDemoWidget extends React.Component<Props> {

  public render() {
    const path = new BreadcrumbPath();
    const dataProvider = {
      getRootNodes: async (_pageOptions: any): Promise<any> => {
        return [
          { label: "Parent Node 1", iconPath: "icon-2d", hasChildren: true, id: 0 },
          { label: "Parent Node 2", iconPath: "icon-3d-cube", hasChildren: true, id: 1 },
          { label: "Parent Node 3", iconPath: "icon-3d-photo", hasChildren: true, id: 2 },
          { label: "Child Node 4", iconPath: "icon-comments", hasChildren: false, id: 2.3 },
          { label: "Child Node 5", iconPath: "icon-line-segment", hasChildren: false, id: 2.4 },
          { label: "Child Node 6", iconPath: "icon-line-segment", hasChildren: false, id: 3.5 },
        ];
      },
      getChildNodes: async (parent: any, _pageOptions: any) => {
        switch (parent.label) {
          case "Parent Node 1":
            return [{ label: "Child Node 1.1", iconPath: "icon-infinity", hasChildren: false, id: 3 }, { label: "Parent Node 1.2", iconPath: "icon-line-segment", hasChildren: true, id: 4 }, { label: "Child Node 1.3", iconPath: "icon-map", hasChildren: false, id: 5 }];
          case "Parent Node 2":
            return [{ label: "Child Node 2.1", iconPath: "icon-edit", hasChildren: false, id: 6 }, { label: "Child Node 2.2", iconPath: "icon-sync", hasChildren: false, id: 7 }, { label: "Child Node 2.3", iconPath: "icon-attach", hasChildren: false, id: 8 }];
          case "Parent Node 3":
            return [{ label: "Child Node 3.1", iconPath: "icon-apps-windows", hasChildren: false, id: 9 }, { label: "Child Node 3.2", iconPath: "icon-field-of-view", hasChildren: false, id: 10 }, { label: "Child Node 3.3", iconPath: "icon-zoom", hasChildren: false, id: 11 }];
          case "Parent Node 1.2":
            return [{ label: "Parent Node 1.2.1", iconPath: "icon-clock", hasChildren: true, id: 12 }, { label: "Child Node 1.2.2", iconPath: "icon-clipboard-cut", hasChildren: false, id: 13 }, { label: "Child Node 1.2.3", iconPath: "icon-hub", hasChildren: false, id: 14 }];
          case "Parent Node 1.2.1":
            return [{ label: "Child Node 1.2.1.1", iconPath: "icon-ifc", hasChildren: false, id: 15 }, { label: "Child Node 1.2.1.2", iconPath: "icon-comments", hasChildren: false, id: 16 }, { label: "Child Node 1.2.1.3", iconPath: "icon-project", hasChildren: false, id: 17 }];
        }
        return [];
      },
    };
    return (
      <div>
        <Breadcrumb path={path} dataProvider={dataProvider as any} delimiter={"\\"} />
        <BreadcrumbDetails path={path} />
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("BreadcrumbDemoWidget", BreadcrumbDemoWidgetControl);
