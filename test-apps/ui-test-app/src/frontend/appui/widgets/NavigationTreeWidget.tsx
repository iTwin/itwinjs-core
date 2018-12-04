/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { SampleAppIModelApp } from "../..";

import {
  ConfigurableUiManager,
  ConfigurableCreateInfo,
  WidgetControl,
} from "@bentley/ui-framework";

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Tree } from "@bentley/ui-components";
import { PresentationTreeDataProvider, withUnifiedSelection } from "@bentley/presentation-components/lib/tree";

// create a HOC tree component that supports unified selection
// tslint:disable-next-line:variable-name
const UnifiedSelectionTree = withUnifiedSelection(Tree);

export class NavigationTreeWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options && options.iModelConnection && options.rulesetId)
      this.reactElement = <NavigationTreeWidget iModelConnection={options.iModelConnection} rulesetId={options.rulesetId} />;
    else
      this.reactElement = <NavigationTreeWidget />;
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
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:zone6.month")}</td>
              <td> <input type="month" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:zone6.number")}</td>
              <td> <input type="number" min="10" max="20" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:zone6.password")}</td>
              <td> <input type="password" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:zone6.radio")}</td>
              <td> <input type="radio" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:zone6.range")}</td>
              <td> <input type="range" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:zone6.search")}</td>
              <td> <input type="search" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:zone6.Tel")}</td>
              <td> <input type="tel" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:zone6.Text")}</td>
              <td> <input type="text" /> </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  public render(): React.ReactNode {
    if (this.props.iModelConnection && this.props.rulesetId)
      return <UnifiedSelectionTree dataProvider={new PresentationTreeDataProvider(this.props.iModelConnection, this.props.rulesetId)} />;
    else
      return this.renderVariousControls();
  }
}

ConfigurableUiManager.registerControl("NavigationTreeWidget", NavigationTreeWidgetControl);
