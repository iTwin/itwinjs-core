/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useResizeDetector } from "react-resize-detector";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { usePresentationTreeNodeLoader, useUnifiedSelectionTreeEventHandler } from "@itwin/presentation-components";
import { ControlledTree, SelectionMode, useTreeModel } from "@itwin/components-react";
import { ConfigurableCreateInfo, ConfigurableUiManager, WidgetControl } from "@itwin/appui-react";
import { Input } from "@itwin/itwinui-react";

export class NavigationTreeWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options && options.iModelConnection && options.rulesetId)
      this.reactNode = <NavigationTreeWidget iModelConnection={options.iModelConnection} />;
    else
      this.reactNode = <NavigationTreeWidget />;
  }
}

interface NavigationTreeWidgetProps {
  iModelConnection?: IModelConnection;
  rulesetId?: string;
}

class NavigationTreeWidget extends React.Component<NavigationTreeWidgetProps> {
  private renderVariousControls() {
    return (
      <div>
        <table>
          <tbody>
            <tr>
              <th>Type</th>
              <th>Input</th>
            </tr>
            <tr>
              <td>iModel Name</td>
              <td>{this.props.iModelConnection ? this.props.iModelConnection.name : ""}</td>
            </tr>
            <tr>
              <td><label htmlFor="demo-month">{IModelApp.localization.getLocalizedString("SampleApp:zone6.month")}</label></td>
              <td> <Input type="month" id="demo-month" size="small" /> </td>
            </tr>
            <tr>
              <td><label htmlFor="demo-number">{IModelApp.localization.getLocalizedString("SampleApp:zone6.number")}</label></td>
              <td> <Input type="number" id="demo-number" min="10" max="20" size="small" /> </td>
            </tr>
            <tr>
              <td><label htmlFor="demo-password">{IModelApp.localization.getLocalizedString("SampleApp:zone6.password")}</label></td>
              <td> <Input type="password" id="demo-password" size="small" /> </td>
            </tr>
            <tr>
              <td><label htmlFor="demo-radio">{IModelApp.localization.getLocalizedString("SampleApp:zone6.radio")}</label></td>
              <td> <Input type="radio" id="demo-radio" size="small" /> </td>
            </tr>
            <tr>
              <td><label htmlFor="demo-range">{IModelApp.localization.getLocalizedString("SampleApp:zone6.range")}</label></td>
              <td> <Input type="range" id="demo-range" size="small" /> </td>
            </tr>
            <tr>
              <td><label htmlFor="demo-search">{IModelApp.localization.getLocalizedString("SampleApp:zone6.search")}</label></td>
              <td> <Input type="search" id="demo-search" size="small" /> </td>
            </tr>
            <tr>
              <td><label htmlFor="demo-tel">{IModelApp.localization.getLocalizedString("SampleApp:zone6.Tel")}</label></td>
              <td> <Input type="tel" id="demo-tel" size="small" /> </td>
            </tr>
            <tr>
              <td><label htmlFor="demo-text">{IModelApp.localization.getLocalizedString("SampleApp:zone6.Text")}</label></td>
              <td> <Input type="text" id="demo-text" size="small" /> </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  public override render(): React.ReactNode {
    if (this.props.iModelConnection && this.props.rulesetId)
      return <NavigationTree iModelConnection={this.props.iModelConnection} rulesetId={this.props.rulesetId} />;
    else
      return this.renderVariousControls();
  }
}

interface NavigationTreeProps {
  iModelConnection: IModelConnection;
  rulesetId: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const NavigationTree: React.FC<NavigationTreeProps> = (props: NavigationTreeProps) => {
  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.iModelConnection,
    ruleset: props.rulesetId,
    pagingSize: 20,
  });
  const modelSource = nodeLoader.modelSource;
  const eventHandler = useUnifiedSelectionTreeEventHandler({ nodeLoader, collapsedChildrenDisposalEnabled: true });
  const treeModel = useTreeModel(modelSource);
  const { width, height, ref } = useResizeDetector();
  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {width && height ? <ControlledTree
        model={treeModel}
        nodeLoader={nodeLoader}
        selectionMode={SelectionMode.Single}
        eventsHandler={eventHandler}
        width={width}
        height={height}
      /> : null}
    </div>
  );
};

ConfigurableUiManager.registerControl("NavigationTreeWidget", NavigationTreeWidgetControl);
