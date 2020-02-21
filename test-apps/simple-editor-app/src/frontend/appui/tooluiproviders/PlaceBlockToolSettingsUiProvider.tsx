/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager, ConfigurableCreateInfo, ToolUiProvider } from "@bentley/ui-framework";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { PlaceBlockTool } from "../../tools/PlaceBlockTool";

class PlaceBlockToolSettingsUiProvider extends ToolUiProvider {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.toolSettingsNode = <PlaceBlockToolSettings />;
  }

  public execute(): void {
  }
}

interface PlaceBlockToolSettingsState {
  height: number;
}

export class PlaceBlockToolSettings extends React.Component<{}, PlaceBlockToolSettingsState> {

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = { height: 2.75 };
  }

  private onHeightChanged(event: React.ChangeEvent<HTMLInputElement>) {
    const height = parseInt(event.target.value, 10);
    this.setState((prev) => ({ ...prev, height }));
    if (IModelApp.toolAdmin.activeTool)
      (IModelApp.toolAdmin.activeTool as PlaceBlockTool).height = height;
  }

  public render() {
    return (
      <div>
        <table>
          <tbody>
            <tr>
              <td>Height</td>
              <td> <input type="number" value={this.state.height} onChange={(i) => this.onHeightChanged(i)} /> </td>
            </tr>
          </tbody>
        </table>
      </div >
    );
  }

}

ConfigurableUiManager.registerControl("PlaceBlockTool", PlaceBlockToolSettingsUiProvider);
