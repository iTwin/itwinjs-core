/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Slider, Input, Icon } from "@bentley/ui-core";
import { ConfigurableUiManager, ConfigurableCreateInfo, ToolUiProvider } from "@bentley/ui-framework";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";

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
        <table style={{ marginRight: "10px" }}>
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
            <tr>
              <td>Slider</td>
              <td>
                <Slider min={0} max={100} values={[50]} step={1} showMinMax={true} maxImage={<Icon iconSpec="icon-placeholder" />}
                  showTooltip onChange={(values: ReadonlyArray<number>) => this.showSliderValues(values)} />
              </td>
            </tr>
            <tr>
              <td>Slider w/ Ticks</td>
              <td>
                <Slider min={0} max={100} values={[30, 70]} step={5} mode={2}
                  showTicks getTickCount={() => 10}
                  showTooltip formatTooltip={(value: number) => Math.round(value).toString()}
                  onChange={(values: ReadonlyArray<number>) => this.showSliderValues(values)} />
              </td>
            </tr>
            <tr>
              <td>Input</td>
              <td> <Input /> </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  private showSliderValues(values: ReadonlyArray<number>) {
    const msg = `Slider values: ${values}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

}

ConfigurableUiManager.registerControl("Tool2", Tool2UiProvider);
