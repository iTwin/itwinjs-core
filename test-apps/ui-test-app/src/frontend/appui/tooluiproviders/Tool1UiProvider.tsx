/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager, ConfigurableCreateInfo, ToolUiProvider } from "@bentley/ui-framework";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";

import { ColorSwatch, HueSlider, HSLAColor } from "@bentley/ui-components";
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

interface State {
  hsl: HSLAColor;
}

class Tool1Settings extends React.Component<{}, State> {
  constructor(props: any) {
    super(props);
    this.state = { hsl: new HSLAColor(59, 1.0, .50, 1) };
  }

  private _handleColorChange = (color: string) => {
    const msg = `Color set to ${color}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  private _handleHueChange = (hue: HSLAColor) => {
    const msg = `Hue set to ${JSON.stringify(hue)}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
    this.setState({ hsl: hue });
  }

  public render(): React.ReactNode {
    // const hueDivStyle: React.CSSProperties = {
    //   height: `120px`,
    // };

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
            <tr>
              <td>Red</td>
              <td> <ColorSwatch color="rgba(255,0,0,255)" onColorPick={this._handleColorChange} /> </td>
            </tr>
            <tr>
              <td>Green</td>
              <td> <ColorSwatch color="rgb(0%,100%,0%)" onColorPick={this._handleColorChange} /> </td>
            </tr>
            <tr>
              <td>Blue</td>
              <td> <ColorSwatch color="#0000ff" onColorPick={this._handleColorChange} /> </td>
            </tr>
            <tr>
              <td>Purple</td>
              <td> <ColorSwatch color="#800080ff" onColorPick={this._handleColorChange} round={true} /> </td>
            </tr>
            <tr>
              <td>Brown</td>
              <td> <ColorSwatch color="hsl(59,67%,30%)" onColorPick={this._handleColorChange} round={true} /> </td>
            </tr>
            <tr>
              <td>Hue</td>
              <td> <HueSlider hsl={this.state.hsl} onHueChange={this._handleHueChange} isHorizontal={true} /> </td>
            </tr>
          </tbody>
        </table>
      </div >
    );
  }
}

/*
              <td> <div style={hueDivStyle}><HueSlider hsl={this.state.hsl} onHueChange={this._handleHueChange} isHorizontal={false} /></div> </td>
*/
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
