/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  ConfigurableUiManager,
  ConfigurableCreateInfo,
  WidgetControl,
  VisibilityTree,
} from "@bentley/ui-framework";
import { IModelConnection, IModelApp, Viewport, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";

export class VisibilityTreeWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    if (options && options.iModelConnection)
      this.reactElement = <VisibilityTreeWidget iModelConnection={options.iModelConnection} />;
    else
      this.reactElement = "no imodel";
  }
}

interface VisibilityTreeWidgetProps {
  iModelConnection: IModelConnection;
}
interface VisibilityTreeWidgetState {
  activeViewport?: Viewport;
}
class VisibilityTreeWidget extends React.Component<VisibilityTreeWidgetProps, VisibilityTreeWidgetState> {
  public constructor(props: VisibilityTreeWidgetProps, context?: any) {
    super(props, context);
    this.state = { activeViewport: IModelApp.viewManager.selectedView };
  }
  public componentDidMount() {
    IModelApp.viewManager.onSelectedViewportChanged.addListener(this.onSelectedViewportChanged);
  }
  public componentWillUnmount() {
    IModelApp.viewManager.onSelectedViewportChanged.removeListener(this.onSelectedViewportChanged);
  }
  // tslint:disable-next-line: naming-convention
  private onSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
    this.setState({ activeViewport: args.current });
  }
  public render() {
    return (<VisibilityTree
      imodel={this.props.iModelConnection}
      activeView={this.state.activeViewport}
    />);
  }
}

ConfigurableUiManager.registerControl("VisibilityTreeWidget", VisibilityTreeWidgetControl);
