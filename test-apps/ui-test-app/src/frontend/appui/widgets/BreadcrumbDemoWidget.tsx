/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelConnection } from "@itwin/core-frontend";
import { Breadcrumb, BreadcrumbDetails, BreadcrumbMode, BreadcrumbPath } from "@itwin/components-react";
import { ConfigurableCreateInfo, ConfigurableUiManager, UiFramework, WidgetControl } from "@itwin/appui-react";
import { demoMutableTreeDataProvider } from "./demodataproviders/demoTreeDataProvider";

export class BreadcrumbDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (UiFramework.getIModelConnection())
      this.reactNode = <BreadcrumbDemoWidget iModelConnection={UiFramework.getIModelConnection()} />;
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

class BreadcrumbDemoWidget extends React.Component<Props, State> {
  public override readonly state: State = {
    checked: false,
  };
  public override render() {
    const path = new BreadcrumbPath(demoMutableTreeDataProvider); // eslint-disable-line deprecation/deprecation

    return (
      <div style={{ height: "100%" }}>
        <label htmlFor="receives_row">Can accept rows: </label>
        <input id="receives_row" type="checkbox" onChange={(event) => {
          this.setState({ checked: event.target.checked });
        }} />
        <div style={{ height: "calc(100% - 22px)" }}>
          {/* eslint-disable-next-line deprecation/deprecation */}
          <Breadcrumb path={path} dataProvider={demoMutableTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} delimiter={"\\"} />
          {/* eslint-disable-next-line deprecation/deprecation */}
          <BreadcrumbDetails path={path} />
        </div>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("BreadcrumbDemoWidget", BreadcrumbDemoWidgetControl);
