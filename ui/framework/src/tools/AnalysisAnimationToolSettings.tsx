/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import * as React from "react";

// cSpell:Ignore configurableui
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { ToolUiProvider } from "../configurableui/ToolUiProvider";
import { ContentViewManager } from "../configurableui/ContentViewManager";
import ToolbarIcon from "@bentley/ui-ninezone/lib/toolbar/item/Icon";
import { Icon } from "../configurableui/IconComponent";
import Toolbar from "@bentley/ui-ninezone/lib/toolbar/Toolbar";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";
import { UiFramework } from "../UiFramework";
import "./AnalysisAnimationToolSettings.scss";

/** State for [[AnalysisAnimationToolSettings]] */
interface AnimationState {
  animationDuration: number;
  elapsedTime: number;
  isAnimationPaused: boolean;
  isAnimating: boolean;
  isLooping: boolean;
  animationSliderValue: string;
}

/** ToolSetting for AnalysisAnimationTool */
export class AnalysisAnimationToolSettings extends React.Component<{}, AnimationState> {
  private _timeLastCycle = 0;
  private _unmounted = false;
  private _requestFrame = 0;

  constructor(props: {}) {
    super(props);
    this.state = {
      animationDuration: 3000,  // 3 seconds
      elapsedTime: 0,
      animationSliderValue: "0",
      isAnimating: false,
      isAnimationPaused: false,
      isLooping: true,
    };
  }

  public componentWillUnmount() {
    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      activeContentControl.viewport.animationFraction = 0;
      window.cancelAnimationFrame(this._requestFrame);
    }
    this._unmounted = true;
  }

  private _updateAnimation = () => {
    if (this.state.isAnimationPaused && !this._unmounted) {
      this._requestFrame = window.requestAnimationFrame(this._updateAnimation);
      return;
    }

    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      const now = (new Date()).getTime();
      let elapsedTime = this.state.elapsedTime + (now - this._timeLastCycle);
      this._timeLastCycle = now;
      activeContentControl.viewport.animationFraction = elapsedTime / this.state.animationDuration;
      const userHitStop = !this.state.isAnimating;

      if (elapsedTime >= this.state.animationDuration || userHitStop) { // stop the animation!
        elapsedTime = 0;
        activeContentControl.viewport.animationFraction = 0;

        if (!userHitStop && this.state.isLooping) { // only loop if user did not hit stop (naturally finished animation)
          this._startAnimation();
          return;
        } else {
          this.setState({ elapsedTime, isAnimating: false, isAnimationPaused: false });
          activeContentControl.viewport.animationFraction = 0;
          window.cancelAnimationFrame(this._requestFrame);

          return;
        }

      } else { // continue the animation - request the next frame
        this._requestFrame = window.requestAnimationFrame(this._updateAnimation);
      }

      this.setState({ elapsedTime });
    }
  }

  private _startAnimation = () => {
    this._timeLastCycle = new Date().getTime();

    if (this.state.isAnimationPaused) { // resume animation
      this.setState({ isAnimationPaused: false, isAnimating: true });
      return;
    }

    this.setState({ isAnimating: true, isAnimationPaused: false, elapsedTime: 0 });
    this._requestFrame = window.requestAnimationFrame(this._updateAnimation);
  }

  private _pauseAnimation = () => {
    if (!this.state.isAnimating)
      return; // already not animating!
    this.setState({ isAnimationPaused: true });
  }

  private _stopAnimation = () => {
    if (!this.state.isAnimating)
      return; // already not animating!
    this.setState({ isAnimating: false, isAnimationPaused: false, elapsedTime: 0 });

    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      activeContentControl.viewport.animationFraction = 0;
    }
    window.cancelAnimationFrame(this._requestFrame);
  }

  private _handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      const elapsedTime = parseInt(event.target.value, undefined);
      if (elapsedTime === 0) {
        this.setState({ elapsedTime });
        this._stopAnimation();
        return;
      }

      activeContentControl.viewport.animationFraction = elapsedTime / this.state.animationDuration;
      this.setState({ elapsedTime });
    }
  }

  private _handleLoopChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const value = target.checked;
    this.setState({ isLooping: value });
  }

  private _handleDurationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const value = parseInt(target.value, undefined);
    // min 1 sec, max 30 seconds
    const animationDuration = (value <= 1) ? 1000 : (value >= 30) ? 30000 : value * 1000;
    this.setState({ animationDuration });
  }

  public render(): React.ReactNode {
    return (
      <div>
        <div className="toolSettingsRow">
          {UiFramework.i18n.translate("UiFramework:tools.AnalysisAnimation.ToolSettings.duration")}
          <input type="number" min="1" max="30" step="1" value={(this.state.animationDuration / 1000).toString()}
            className="toolSettings-animationDuration" id="animationDuration" onChange={this._handleDurationChange} />
          {UiFramework.i18n.translate("UiFramework:tools.AnalysisAnimation.ToolSettings.seconds")}
        </div>
        <div className="toolSettingsRow">
          <input id="animationLoop" type="checkbox" checked={this.state.isLooping} onChange={this._handleLoopChange} />
          {UiFramework.i18n.translate("UiFramework:tools.AnalysisAnimation.ToolSettings.loop")}
        </div>
        <div className="toolSettingsRow toolSettings-stretch">
          <input type="range" min="0" max={this.state.animationDuration.toString()} value={this.state.elapsedTime.toString()}
            className="toolSettings-sliderStretch" id="animationSlider" onChange={this._handleSliderChange} />
        </div>
        <div className="toolSettingsRow toolSettings-toolbar">
          <Toolbar
            expandsTo={Direction.Bottom}
            items={
              <>
                <ToolbarIcon
                  isActive={this.state.isAnimating && !this.state.isAnimationPaused}
                  title={UiFramework.i18n.translate("UiFramework:tools.AnalysisAnimation.ToolSettings.play")}
                  key="animationPlay"
                  onClick={this._startAnimation}
                  icon={<Icon iconSpec="icon-media-controls-circular-play" />}
                />
                <ToolbarIcon
                  isActive={this.state.isAnimationPaused}
                  title={UiFramework.i18n.translate("UiFramework:tools.AnalysisAnimation.ToolSettings.pause")}
                  key="animationPause"
                  onClick={this._pauseAnimation}
                  icon={<Icon iconSpec="icon-media-controls-circular-pause" />}
                />
                <ToolbarIcon
                  isActive={!this.state.isAnimating}
                  title={UiFramework.i18n.translate("UiFramework:tools.AnalysisAnimation.ToolSettings.stop")}
                  key="animationStop"
                  onClick={this._stopAnimation}
                  icon={<Icon iconSpec="icon-media-controls-circular-stop" />}
                />
              </>
            }
          />
        </div>
      </div >
    );
  }
}

/** ToolUiProvider class that informs ConfigurableUi that Tool Settings are provided for the specified tool. */
export class AnalysisAnimationToolSettingsProvider extends ToolUiProvider {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.toolSettingsNode = <AnalysisAnimationToolSettings />;
  }

  public execute(): void {
  }
}
