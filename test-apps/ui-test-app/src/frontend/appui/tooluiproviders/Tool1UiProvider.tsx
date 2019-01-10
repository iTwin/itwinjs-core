/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager, ConfigurableCreateInfo, ToolUiProvider } from "@bentley/ui-framework";

import { ToolAssistanceItem, ToolAssistanceSeparator } from "@bentley/ui-ninezone";
import { SampleAppIModelApp } from "../..";

class Tool1UiProvider extends ToolUiProvider {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.toolSettingsNode = <Tool1Settings />;
    this.toolAssistanceNode = <Tool1Assistance />;
  }

  public execute(): void {
  }
}

class Tool1Settings extends React.Component {
  public render(): React.ReactNode {
    return (
      <div>
        <table>
          <tbody>
            <tr>
              <th>Type</th>
              <th>Input</th>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:tool1.month")}</td>
              <td> <input type="month" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:tool1.number")}</td>
              <td> <input type="number" min="10" max="20" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:tool1.password")}</td>
              <td> <input type="password" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:tool1.radio")}</td>
              <td> <input type="radio" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:tool1.range")}</td>
              <td> <input type="range" /> </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

class Tool1Assistance extends React.Component {
  public render(): React.ReactNode {
    return (
      <>
        <ToolAssistanceItem>
          <i className="icon icon-cursor" />
          Identify piece to trim
        </ToolAssistanceItem>
        <ToolAssistanceSeparator label="Inputs" />
        <ToolAssistanceItem>
          <i className="icon icon-cursor-click" />
          Clink on element
        </ToolAssistanceItem>
        <ToolAssistanceItem>
          <i className="icon  icon-check-out" />
          Drag across elements
        </ToolAssistanceItem>
        <ToolAssistanceSeparator />
        <ToolAssistanceItem>
          <input type="checkbox" />
          Show prompt @ cursor
        </ToolAssistanceItem>
      </>
    );
  }
}

ConfigurableUiManager.registerControl("Tool1", Tool1UiProvider);
