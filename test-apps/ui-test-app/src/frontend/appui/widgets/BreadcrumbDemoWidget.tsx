/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
import {ChildDropTarget} from "./ChildDropTarget";
import {ParentDropTarget} from "./ParentDropTarget";
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

    DragDropLayerManager.registerTypeLayer("root", ParentDropTarget);
    DragDropLayerManager.registerTypeLayer("child", ChildDropTarget);

    return (
      <div>
        <label htmlFor="recieves_row">Can accept rows: </label>
        <input id="recieves_row" type="checkbox" checked={this.state.checked} onClick={() => {
            this.setState((prevState) => ({checked: !prevState.checked}), () => {
            });
          }}/>
        <Breadcrumb path={path} dataProvider={demoMutableTreeDataProvider} delimiter={"\\"}
          onDropTargetDrop={treeDropTargetDropCallback}
          onDragSourceEnd={treeDragSourceEndCallback}
          canDropTargetDrop={treeCanDropTargetDropCallback}
          objectType={objectType}
          objectTypes={objectTypes}
        />
        <BreadcrumbDetails path={path}
          onDropTargetDrop={treeDropTargetDropCallback}
          onDragSourceEnd={treeDragSourceEndCallback}
          canDropTargetDrop={treeCanDropTargetDropCallback}
          objectType={objectType}
          objectTypes={objectTypes}
        />
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("BreadcrumbDemoWidget", BreadcrumbDemoWidgetControl);
