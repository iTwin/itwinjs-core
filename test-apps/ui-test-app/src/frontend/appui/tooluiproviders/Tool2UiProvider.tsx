/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { SampleAppIModelApp } from "../..";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";
import { ToolUiProvider } from "@bentley/ui-framework";

class Tool2UiProvider extends ToolUiProvider {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.toolSettingsNode = <Tool2Settings />;
  }

  public execute(): void {
  }
}

class Tool2Settings extends React.Component {
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
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:tool2.month")}</td>
              <td> <input type="month" /> </td>
            </tr>
            <tr>
              <td>{SampleAppIModelApp.i18n.translate("SampleApp:tool2.number")}</td>
              <td> <input type="number" min="10" max="20" /> </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("tool2", Tool2UiProvider);
