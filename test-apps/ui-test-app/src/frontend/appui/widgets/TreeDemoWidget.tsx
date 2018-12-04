/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { SampleAppIModelApp } from "../..";

import {
  ConfigurableCreateInfo,
  WidgetControl,
  DragDropLayerManager,
} from "@bentley/ui-framework";
import { Tree, TreeProps } from "@bentley/ui-components";
import { withTreeDragDrop } from "@bentley/ui-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { demoMutableTreeDataProvider, treeDragProps, treeDropProps, TreeDragTypes, DemoTreeDragDropType } from "./demodataproviders/demoTreeDataProvider";
import { TableDragTypes } from "./demodataproviders/demoTableDataProvider";
import { ParentDragLayer } from "./draglayers/ParentDragLayer";
import { ChildDragLayer } from "./draglayers/ChildDragLayer";

// tslint:disable-next-line:variable-name
const DragDropTree = withTreeDragDrop<TreeProps, DemoTreeDragDropType>(Tree);

export class TreeDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <TreeDemoWidget iModelConnection={SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection} />;
  }
}

interface Props {
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
    DragDropLayerManager.registerTypeLayer(TreeDragTypes.Parent, ParentDragLayer);
    DragDropLayerManager.registerTypeLayer(TreeDragTypes.Child, ChildDragLayer);

    let objectTypes: Array<string | symbol> = [];
    if (treeDropProps.objectTypes) {
      if (typeof treeDropProps.objectTypes !== "function")
        objectTypes = treeDropProps.objectTypes;
      else
        objectTypes = treeDropProps.objectTypes();
    }
    if (this.state.checked)
      objectTypes.push(TableDragTypes.Row);

    const dragProps = treeDragProps;
    const dropProps = {
      ...treeDropProps,
      objectTypes,
    };

    return (
      <div style={{ height: "100%" }}>
        <label htmlFor="receives_row">Can accept rows: </label>
        <input id="receives_row" type="checkbox" onChange={(event) => {
          this.setState({ checked: event.target.checked });
        }} />
        <div style={{ height: "calc(100% - 20px)" }}>
          <DragDropTree
            dataProvider={demoMutableTreeDataProvider}
            dragProps={dragProps}
            dropProps={dropProps}
          />
        </div>
      </div>
    );
  }
}
