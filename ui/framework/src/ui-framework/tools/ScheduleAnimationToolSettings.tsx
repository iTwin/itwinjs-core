/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import * as React from "react";

// cSpell:Ignore configurableui
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { ToolUiProvider } from "../zones/toolsettings/ToolUiProvider";
import { ContentViewManager } from "../content/ContentViewManager";
import { Item, Direction, Toolbar } from "@bentley/ui-ninezone";
import { Range1d } from "@bentley/geometry-core";
import { Icon } from "../shared/IconComponent";
import { UiFramework } from "../UiFramework";
import { ScreenViewport } from "@bentley/imodeljs-frontend";

import "./ScheduleAnimationToolSettings.scss";
import { FrontstageManager, ContentControlActivatedEventArgs } from "../frontstage/FrontstageManager";

/** State for [[ScheduleAnimationToolSettings]] */
interface AnimationState {
  animationDuration: number;
  elapsedTime: number;
  isAnimationPaused: boolean;
  isAnimating: boolean;
  isLooping: boolean;
  animationSliderValue: string;
  startDate?: Date;
  endDate?: Date;
  timeRange?: Range1d;
}

/** ToolSetting for ScheduleAnimationTool */
export class ScheduleAnimationToolSettings extends React.Component<{}, AnimationState> {
  private _timeLastCycle = 0;
  private _unmounted = false;
  private _requestFrame = 0;

  constructor(props: {}) {
    super(props);
    this.state = {
      animationDuration: 20000,  // 20 seconds
      elapsedTime: 0,
      animationSliderValue: "0",
      isAnimating: false,
      isAnimationPaused: false,
      isLooping: true,
    };
  }

  private _setStateForContentControl(viewport: ScreenViewport | undefined) {
    if (undefined === viewport || undefined === viewport.view || undefined === viewport.view.scheduleScript) {
      this.setState(() => ({ isAnimating: false }));
      return;
    }

    const timeRange = viewport.view.scheduleScript.duration;  // in seconds since 1/1/1970
    const startDate = new Date(timeRange.low * 1000);
    const endDate = new Date(timeRange.high * 1000);
    this.setState(() => ({ timeRange, startDate, endDate }));
  }

  private _handleContentControlActivatedEvent = (args: ContentControlActivatedEventArgs) => {
    if (args.activeContentControl !== args.oldContentControl || undefined === this.state.startDate) {
      this._setStateForContentControl(args.activeContentControl ? args.activeContentControl.viewport : undefined);
    }
  }

  public componentDidMount() {
    FrontstageManager.onContentControlActivatedEvent.addListener(this._handleContentControlActivatedEvent);
    const activeContentControl = ContentViewManager.getActiveContentControl();
    this._setStateForContentControl(activeContentControl ? activeContentControl.viewport : undefined);
  }

  public componentWillUnmount() {
    FrontstageManager.onContentControlActivatedEvent.removeListener(this._handleContentControlActivatedEvent);

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
    // min 1 sec, max 180 seconds
    const animationDuration = (value <= 1) ? 1000 : (value >= 180) ? 180000 : value * 1000;
    this.setState({ animationDuration });
  }

  public render(): React.ReactNode {
    if (undefined === this.state.startDate || undefined === this.state.endDate || undefined === this.state.timeRange)
      return null;

    const animationFraction = this.state.elapsedTime / this.state.animationDuration;
    const currentTime = this.state.timeRange.fractionToPoint(animationFraction);
    const currentDate = new Date(currentTime * 1000).toLocaleDateString();

    const dateLabel = `${currentDate}`;
    return (
      <div>
        <div className="toolSettingsRow">
          {UiFramework.i18n.translate("UiFramework:tools.ScheduleAnimation.ToolSettings.duration")}
          <input type="number" min="1" max="180" step="1" value={(this.state.animationDuration / 1000).toString()}
            className="toolSettings-animationDuration" id="animationDuration" onChange={this._handleDurationChange} />
          {UiFramework.i18n.translate("UiFramework:tools.ScheduleAnimation.ToolSettings.seconds")}
        </div>
        <div className="toolSettingsRow">
          <input id="animationLoop" type="checkbox" checked={this.state.isLooping} onChange={this._handleLoopChange} />
          {UiFramework.i18n.translate("UiFramework:tools.ScheduleAnimation.ToolSettings.loop")}
        </div>
        <div className="toolSettingsRow toolSettings-stretch">
          {dateLabel}
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
                <Item
                  isActive={this.state.isAnimating && !this.state.isAnimationPaused}
                  title={UiFramework.i18n.translate("UiFramework:tools.ScheduleAnimation.ToolSettings.play")}
                  key="animationPlay"
                  onClick={this._startAnimation}
                  icon={<Icon iconSpec="icon-media-controls-circular-play" />}
                />
                <Item
                  isActive={this.state.isAnimationPaused}
                  title={UiFramework.i18n.translate("UiFramework:tools.ScheduleAnimation.ToolSettings.pause")}
                  key="animationPause"
                  onClick={this._pauseAnimation}
                  icon={<Icon iconSpec="icon-media-controls-circular-pause" />}
                />
                <Item
                  isActive={!this.state.isAnimating}
                  title={UiFramework.i18n.translate("UiFramework:tools.ScheduleAnimation.ToolSettings.stop")}
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
export class ScheduleAnimationToolSettingsProvider extends ToolUiProvider {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.toolSettingsNode = <ScheduleAnimationToolSettings />;
  }

  public execute(): void {
  }
}
