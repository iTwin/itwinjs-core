/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { usePresentationTreeNodeLoader, useUnifiedSelectionTreeEventHandler } from "@bentley/presentation-components";
import { ConfigurableCreateInfo, ConfigurableUiManager, WidgetControl } from "@bentley/ui-framework";
import { ControlledTree, SelectionMode, useVisibleTreeNodes } from "@bentley/ui-components";

export class NavigationTreeWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options && options.iModelConnection && options.rulesetId)
      this.reactNode = <NavigationTreeWidget iModelConnection={options.iModelConnection} rulesetId={options.rulesetId} />;
    else
      this.reactNode = <NavigationTreeWidget />;
  }
}

interface NavigationTreeWidgetProps {
  iModelConnection?: IModelConnection;
  rulesetId?: string;
}

class NavigationTreeWidget extends React.Component<NavigationTreeWidgetProps> {
  constructor(props?: any, context?: any) {
    super(props, context);
  }

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
              <td>{IModelApp.i18n.translate("SampleApp:zone6.month")}</td>
              <td> <input type="month" /> </td>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:zone6.number")}</td>
              <td> <input type="number" min="10" max="20" /> </td>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:zone6.password")}</td>
              <td> <input type="password" /> </td>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:zone6.radio")}</td>
              <td> <input type="radio" /> </td>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:zone6.range")}</td>
              <td> <input type="range" /> </td>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:zone6.search")}</td>
              <td> <input type="search" /> </td>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:zone6.Tel")}</td>
              <td> <input type="tel" /> </td>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:zone6.Text")}</td>
              <td> <input type="text" /> </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  public render(): React.ReactNode {
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

// tslint:disable-next-line: variable-name
const NavigationTree: React.FC<NavigationTreeProps> = (props: NavigationTreeProps) => {
  const nodeLoader = usePresentationTreeNodeLoader({
    imodel: props.iModelConnection,
    ruleset: props.rulesetId,
    pageSize: 20,
  });
  const modelSource = nodeLoader.modelSource;
  const eventHandler = useUnifiedSelectionTreeEventHandler({ nodeLoader, collapsedChildrenDisposalEnabled: true });
  const visibleNodes = useVisibleTreeNodes(modelSource);
  return (
    <ControlledTree
      visibleNodes={visibleNodes}
      nodeLoader={nodeLoader}
      selectionMode={SelectionMode.Single}
      treeEvents={eventHandler}
    />
  );
};

ConfigurableUiManager.registerControl("NavigationTreeWidget", NavigationTreeWidgetControl);
