/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import * as React from "react";
import { IModelConnection } from "@itwin/core-frontend";
import { Table } from "@itwin/components-react";
import { ConfigurableCreateInfo, UiFramework, WidgetControl } from "@itwin/appui-react";
import { Checkbox } from "@itwin/itwinui-react";
import { demoMutableTableDataProvider } from "./demodataproviders/demoTableDataProvider";

export class TableDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (UiFramework.getIModelConnection())
      this.reactNode = <TableDemoWidget iModelConnection={UiFramework.getIModelConnection()} />;
    else
      this.reactNode = null;
  }
}

interface Props {
  iModelConnection?: IModelConnection;
}

interface State {
  checked: boolean;
}

export class TableDemoWidget extends React.Component<Props, State> {
  public override readonly state: State = {
    checked: false,
  };
  public override render() {
    return (
      <div style={{ height: "100%" }}>
        <label htmlFor="receives_tree">Can accept tree nodes: </label>
        <Checkbox id="receives_tree" onChange={(event) => {
          this.setState({ checked: event.target.checked });
        }} />
        <div style={{ height: "calc(100% - 20px)" }}>
          <Table
            dataProvider={demoMutableTableDataProvider}
            reorderableColumns={true}
            showHideColumns={true}
            settingsIdentifier="Test"
          />
        </div>
      </div >
    );
  }
}
