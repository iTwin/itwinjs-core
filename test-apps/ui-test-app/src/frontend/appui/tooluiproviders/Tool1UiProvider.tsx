/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";
import { ToolUiProvider } from "@bentley/ui-framework";

import AssistanceItem from "@bentley/ui-ninezone/lib/footer/tool-assistance/Item";
import AssistanceSeparator from "@bentley/ui-ninezone/lib/footer/tool-assistance/Separator";
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
        <AssistanceItem>
          <i className="icon icon-cursor" />
          Identify piece to trim
        </AssistanceItem>
        <AssistanceSeparator label="Inputs" />
        <AssistanceItem>
          <i className="icon icon-cursor-click" />
          Clink on element
        </AssistanceItem>
        <AssistanceItem>
          <i className="icon  icon-check-out" />
          Drag across elements
        </AssistanceItem>
        <AssistanceSeparator />
        <AssistanceItem>
          <input type="checkbox" />
          Show prompt @ cursor
        </AssistanceItem>
      </>
    );
  }
}

ConfigurableUiManager.registerControl("tool1", Tool1UiProvider);
