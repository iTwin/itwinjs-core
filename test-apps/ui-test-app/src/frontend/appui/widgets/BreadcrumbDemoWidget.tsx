/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { SampleAppIModelApp } from "../..";

import {
  ConfigurableUiManager, ConfigurableCreateInfo,
  WidgetControl, WidgetControlProps,
  DragDropLayerManager,
} from "@bentley/ui-framework";
import {
  Breadcrumb, BreadcrumbDetails, BreadcrumbPath,
} from "@bentley/ui-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { demoMutableTreeDataProvider, treeDropTargetDropCallback, treeDragSourceEndCallback, treeCanDropTargetDropCallback } from "./demoTreeDataProvider";
import { ChildDragLayer } from "./ChildDragLayer";
import { RootDragLayer } from "./ParentDragLayer";
export class BreadcrumbDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <BreadcrumbDemoWidget widgetControl={this} iModelConnection={SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection} />;
  }
}

interface Props extends WidgetControlProps {
  iModelConnection?: IModelConnection;
}

interface State {
  checked: boolean;
}

class BreadcrumbDemoWidget extends React.Component<Props, State> {
  public readonly state: State = {
    checked: false,
  };
  public render() {
    const path = new BreadcrumbPath(demoMutableTreeDataProvider);

    const objectType = (data: any) => {
      if (data !== undefined && "type" in data && data.type)
        return data.type;
      return "";
    };

    const objectTypes = ["root", "child", ...(this.state.checked ? ["row"] : [])];

    DragDropLayerManager.registerTypeLayer("root", RootDragLayer);
    DragDropLayerManager.registerTypeLayer("child", ChildDragLayer);

    const dragProps = {
      onDragSourceEnd: treeDragSourceEndCallback,
      objectType,
    };
    const dropProps = {
      onDropTargetDrop: treeDropTargetDropCallback,
      canDropTargetDrop: treeCanDropTargetDropCallback,
      objectTypes,
    };

    return (
      <div>
        <label htmlFor="recieves_row">Can accept rows: </label>
        <input id="recieves_row" type="checkbox" onChange={(event: React.ChangeEvent) => {
            this.setState({checked: (event.target as HTMLInputElement).checked});
          }}/>
        <Breadcrumb path={path} dataProvider={demoMutableTreeDataProvider} delimiter={"\\"}
          dragProps={dragProps}
          dropProps={dropProps}
        />
        <BreadcrumbDetails path={path}
          dragProps={dragProps}
          dropProps={dropProps}
        />
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("BreadcrumbDemoWidget", BreadcrumbDemoWidgetControl);
