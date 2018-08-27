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
import { Table } from "@bentley/ui-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { demoMutableTableDataProvider, tableDropTargetDropCallback, tableDragSourceEndCallback, tableCanDropTargetDropCallback } from "./demoTableDataProvider";
import {RowDropTarget} from "./RowDropTarget";
export class TableDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <TableDemoWidget widgetControl={this} iModelConnection={SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection} />;
  }
}

interface Props extends WidgetControlProps {
  iModelConnection?: IModelConnection;
}

interface State {
  checked: boolean;
}

class TableDemoWidget extends React.Component<Props, State> {
  public readonly state: State = {
    checked: false,
  };
  public render() {
    const objectType = (data: any) => {
      if (data !== undefined && "type" in data && data.type)
        return data.type;
      return "";
    };

    const objectTypes = [...(this.state.checked ? ["root", "child"] : []), "row"];

    DragDropLayerManager.registerTypeLayer("row", RowDropTarget);

    return (
      <div>
        <label htmlFor="recieves_tree">Can accept tree nodes: </label>
        <input id="recieves_tree" type="checkbox" checked={this.state.checked} onClick={() => {
            this.setState((prevState) => ({checked: !prevState.checked}), () => {
              demoMutableTableDataProvider.onRowsChanged.raiseEvent();

            });
          }}/>
        <Table
          dataProvider={demoMutableTableDataProvider}
          onDropTargetDrop={tableDropTargetDropCallback}
          onDragSourceEnd={tableDragSourceEndCallback}
          canDropTargetDrop={tableCanDropTargetDropCallback}
          objectType={objectType}
          objectTypes={objectTypes}
        />
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("TableDemoWidget", TableDemoWidgetControl);
