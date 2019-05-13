/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ConfigurableUiManager, ConfigurableCreateInfo, ToolUiProvider } from "@bentley/ui-framework";
import { IModelApp } from "@bentley/imodeljs-frontend";

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
              <td>{IModelApp.i18n.translate("SampleApp:tool2.month")}</td>
              <td> <input type="month" /> </td>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:tool2.number")}</td>
              <td> <input type="number" min="10" max="20" /> </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("Tool2", Tool2UiProvider);
