/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { SampleAppIModelApp } from "../..";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { WidgetControl, WidgetComponentProps } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";

import { IModelConnection } from "@bentley/imodeljs-frontend";

export class NavigationTreeWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = (
      <NavigationTreeWidget
        widgetControl={this}
      />
    );
  }
}

interface NavigationTreeProps extends WidgetComponentProps {
  iModelConnection?: IModelConnection;
}

class NavigationTreeWidget extends React.Component<NavigationTreeProps> {
  constructor(props?: any, context?: any) {
    super(props, context);
  }

  private renderVariousControls() {
    const imodel = SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection;

    return (
      <div>
        <table>
          <tbody>
            <tr>
              <th>Type</th>
              <th>Input</th>
            </tr>
            <tr>
              <td>iModelConnection</td>
              <td>{imodel ? imodel.name : ""}</td>
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
    return this.renderVariousControls();
  }
}

ConfigurableUiManager.registerControl("NavigationTreeWidget", NavigationTreeWidgetControl);
