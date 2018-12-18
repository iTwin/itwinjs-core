/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { SampleAppIModelApp } from "../..";

import {
  ConfigurableUiManager, ConfigurableCreateInfo,
  WidgetControl,
  DragDropLayerManager,
} from "@bentley/ui-framework";

import {
  Breadcrumb, BreadcrumbProps, BreadcrumbMode, BreadcrumbDetailsProps, BreadcrumbDetails, BreadcrumbPath,
  withBreadcrumbDragDrop, withBreadcrumbDetailsDragDrop,
} from "@bentley/ui-components";

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { demoMutableTreeDataProvider, treeDragProps, treeDropProps, TreeDragTypes, DemoTreeDragDropType } from "./demodataproviders/demoTreeDataProvider";
import { TableDragTypes } from "./demodataproviders/demoTableDataProvider";
import { ChildDragLayer } from "./draglayers/ChildDragLayer";
import { ParentDragLayer } from "./draglayers/ParentDragLayer";

const DragDropBreadcrumb = withBreadcrumbDragDrop<BreadcrumbProps, DemoTreeDragDropType>(Breadcrumb); // tslint:disable-line:variable-name
const DragDropBreadcrumbDetails = withBreadcrumbDetailsDragDrop<BreadcrumbDetailsProps, DemoTreeDragDropType>(BreadcrumbDetails); // tslint:disable-line:variable-name

export class BreadcrumbDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <BreadcrumbDemoWidget iModelConnection={SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection} />;
  }
}

interface Props {
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
        <div style={{ height: "calc(100% - 22px)" }}>
          <DragDropBreadcrumb path={path} dataProvider={demoMutableTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} delimiter={"\\"}
            dragProps={dragProps} dropProps={dropProps} />
          <DragDropBreadcrumbDetails path={path}
            dragProps={dragProps} dropProps={dropProps} />
        </div>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("BreadcrumbDemoWidget", BreadcrumbDemoWidgetControl);
