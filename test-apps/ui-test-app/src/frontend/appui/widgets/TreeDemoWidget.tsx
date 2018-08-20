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
import { Tree } from "@bentley/ui-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { demoMutableTreeDataProvider, treeDropTargetDropCallback, treeDragSourceEndCallback, treeCanDropTargetDropCallback } from "./demoTreeDataProvider";
import {ChildDropTarget} from "./ChildDropTarget";
import {ParentDropTarget} from "./ParentDropTarget";
export class TreeDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <TreeDemoWidget widgetControl={this} iModelConnection={SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection} />;
  }
}

interface Props extends WidgetControlProps {
  iModelConnection?: IModelConnection;
}

interface State {
  checked: boolean;
}

class TreeDemoWidget extends React.Component<Props, State> {
  public readonly state: State = {
    checked: false,
  };
  public render() {
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
              demoMutableTreeDataProvider.onTreeNodeChanged &&
                demoMutableTreeDataProvider.onTreeNodeChanged.raiseEvent();
            });
          }}/>
        <Tree
          dataProvider={demoMutableTreeDataProvider}
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

ConfigurableUiManager.registerControl("TreeDemoWidget", TreeDemoWidgetControl);
