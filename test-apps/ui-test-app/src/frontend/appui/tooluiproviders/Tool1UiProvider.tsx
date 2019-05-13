/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager, ConfigurableCreateInfo, ToolUiProvider } from "@bentley/ui-framework";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";
import { HSVColor, ColorDef } from "@bentley/imodeljs-common";
import { ColorSwatch, HueSlider, AlphaSlider, SaturationPicker, ColorPickerButton, WeightPickerButton } from "@bentley/ui-components";
import { ToolAssistanceItem, ToolAssistanceSeparator } from "@bentley/ui-ninezone";

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
  alpha: number;    // slider value from 0 to 1 (ColorDef want 0-255)
  hsv: HSVColor;
  userColor: ColorDef;
  userWeight: number;
}

class Tool1Settings extends React.Component<{}, State> {
  constructor(props: any) {
    super(props);
    const hsv = new HSVColor();
    hsv.h = 30;
    hsv.s = 30;
    hsv.v = 30;
    const alpha = .5;
    const userColor = hsv.toColorDef();
    userColor.setAlpha(alpha * 255);
    const userWeight = 3;
    this.state = { alpha, hsv, userColor, userWeight };
  }

  private _handleWeightChange = (weight: number) => {
    const msg = `Weight set to ${weight}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
    this.setState({ userWeight: weight });
  }

  private _handleColorChange = (color: ColorDef) => {
    const msg = `Color set to ${color.toRgbString()} alpha=${(color.getAlpha() / 255) * 100}%`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  private _handleHueChange = (hue: HSVColor) => {
    const userColor = hue.toColorDef();
    userColor.setAlpha(this.state.alpha * 255);
    const msg = `Hue set to ${userColor.toRgbString()} alpha=${(userColor.getAlpha() / 255) * 100}%`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
    this.setState({ hsv: hue, userColor });
  }

  private _handleSaturationChange = (saturation: HSVColor) => {
    const userColor = saturation.toColorDef();
    userColor.setAlpha(this.state.alpha * 255);
    const msg = `Saturation set to ${userColor.toRgbString()} alpha=${(userColor.getAlpha() / 255) * 100}%`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
    this.setState({ hsv: saturation, userColor });
  }

  private _handleAlphaChange = (alpha: number) => {
    const msg = `Alpha set to ${JSON.stringify(alpha * 100)}%`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
    const userColor = this.state.userColor.clone();
    userColor.setAlpha(alpha * 255);
    this.setState({ alpha, userColor });
  }

  private _onColorPick = (color: ColorDef) => {
    const msg = `Color set to ${color.toRgbString()} alpha=${(color.getAlpha() / 255) * 100}%`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
    const hsvColor = HSVColor.fromColorDef(color);
    this.setState({ userColor: color, hsv: hsvColor });
  }

  public render(): React.ReactNode {
    // const vertDivStyle: React.CSSProperties = {
    //  height: `120px`,
    // };

    const satDivStyle: React.CSSProperties = {
      width: `200px`,
      height: `200px`,
    };

    /*
    <tr>
      <td>Green</td>
      <td> <ColorSwatch color="rgb(0%,100%,0%)" onColorPick={this._handleColorChange} /> </td>
    </tr>
    */

    const redDef = ColorDef.from(255, 0, 0, 0);
    const blueDef = ColorDef.from(0, 0, 255, 0);
    const purpleDef = new ColorDef("#800080");

    return (
      <div>
        <table>
          <tbody>
            <tr>
              <th>Type</th>
              <th>Input</th>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:tool1.month")}</td>
              <td> <input type="month" /> </td>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:tool1.number")}</td>
              <td> <input type="number" min="10" max="20" /> </td>
            </tr>
            <tr>
              <td>{IModelApp.i18n.translate("SampleApp:tool1.password")}</td>
              <td> <input type="password" /> </td>
            </tr>
            <tr>
              <td><label htmlFor="radio">{IModelApp.i18n.translate("SampleApp:tool1.radio")}</label></td>
              <td> <input name="radio" type="radio" /> </td>
            </tr>
            <tr>
              <td><label htmlFor="range">{IModelApp.i18n.translate("SampleApp:tool1.range")}</label></td>
              <td> <input name="range" type="range" min="1" max="100" step="5" /> </td>
            </tr>
            <tr>
              <td>Red</td>
              <td> <ColorSwatch colorDef={redDef} onColorPick={this._handleColorChange} /> </td>
            </tr>
            <tr>
              <td>Blue</td>
              <td> <ColorSwatch colorDef={blueDef} onColorPick={this._handleColorChange} /> </td>
            </tr>
            <tr>
              <td>Purple</td>
              <td> <ColorSwatch colorDef={purpleDef} onColorPick={this._handleColorChange} round={true} /> </td>
            </tr>
            <tr>
              <td>User Color</td>
              <td> <ColorSwatch colorDef={this.state.userColor} onColorPick={this._handleColorChange} round={true} /> </td>
            </tr>
            <tr>
              <td>Hue</td>
              <td> <HueSlider hsv={this.state.hsv} onHueChange={this._handleHueChange} isHorizontal={true} /> </td>
            </tr>
            <tr>
              <td>Alpha</td>
              <td> <AlphaSlider alpha={this.state.alpha} onAlphaChange={this._handleAlphaChange} isHorizontal={true} /> </td>
            </tr>
            <tr>
              <td>Saturation</td>
              <td> <div style={satDivStyle}><SaturationPicker hsv={this.state.hsv} onSaturationChange={this._handleSaturationChange} /></div> </td>
            </tr>
            <tr>
              <td>Color Picker</td>
              <td> <ColorPickerButton activeColor={this.state.userColor} onColorPick={this._onColorPick} /></td>
            </tr>
            <tr>
              <td>Weight Picker</td>
              <td> <WeightPickerButton activeWeight={this.state.userWeight} onLineWeightPick={this._handleWeightChange} /></td>
            </tr>
          </tbody>
        </table>
      </div >
    );
  }
}

/*
  <td> <WeightPickerButton colorDef={blueDef} activeWeight={this.state.userWeight} onLineWeightPick={this._handleWeightChange} /></td>

   <td> <AlphaSlider alpha={this.state.alpha} onAlphaChange={this._handleAlphaChange} isHorizontal={true} /> </td>
    <td> <div style={vertDivStyle}><AlphaSlider alpha={this.state.alpha} onAlphaChange={this._handleAlphaChange} isHorizontal={false} /></div> </td>
    <td> <div style={vertDivStyle}><HueSlider hsv={this.state.hsv} onHueChange={this._handleHueChange} isHorizontal={false} /></div> </td>
*/
class Tool1Assistance extends React.Component {
  public render(): React.ReactNode {
    return (
      <>
        <ToolAssistanceItem>
          <i className="icon icon-cursor" />
          Identify piece to trim
        </ToolAssistanceItem>
        <ToolAssistanceSeparator>Inputs</ToolAssistanceSeparator>
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
