/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  TimelineDataProvider,
  BaseTimelineDataProvider, PlaybackSettings, TimelineDetail, Milestone,
} from "@bentley/ui-components";
import { ContentViewManager, SyncUiEventDispatcher, SyncUiEventArgs, SyncUiEventId } from "@bentley/ui-framework";
import { ViewState } from "@bentley/imodeljs-frontend";
import { TimelineComponent } from "../timeline/TimelineComponent";

import "./AnimationViewOverlay.scss";

/** ScheduleAnimation Timeline Data Provider - handles View that define 'scheduleScript' data. */
export class ScheduleAnimationTimelineDataProvider extends BaseTimelineDataProvider {
  private _viewState: ViewState;

  constructor(viewState: ViewState) {
    super();
    this._viewState = viewState;
    if (viewState && viewState.scheduleScript) {
      this.supportsTimelineAnimation = true;
    }
  }

  public async loadTimelineData(): Promise<boolean> {
    // if animationFraction is set pointer should match
    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      if (activeContentControl.viewport.view.id === this._viewState.id) {
        this.animationFraction = activeContentControl.viewport.animationFraction;
      }
    }

    if (this.supportsTimelineAnimation && this._viewState.scheduleScript) {
      // for now just initial settings
      this.updateSettings({
        duration: 20 * 1000,      // this is playback duration
        loop: true,
        displayDetail: TimelineDetail.Medium,
      });

      const timeRange = this._viewState.scheduleScript!.duration;
      this.start = new Date(timeRange.low * 1000);
      this.end = new Date(timeRange.high * 1000);

      const quarter = (this.end.getTime() - this.start.getTime()) / 4;
      const milestones: Milestone[] = [];
      milestones.push({ id: "1", label: "1st Floor Concrete", date: new Date(this.start.getTime() + quarter), readonly: true });
      milestones.push({ id: "2", label: "2nd Floor Concrete", date: new Date(this.end.getTime() - quarter), readonly: true });
      this._milestones = milestones;

      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  // const fraction = (animationFraction.getTime() - this.start.getTime()) / (this.end.getTime() - this.start.getTime());

  public onAnimationFractionChanged = (animationFraction: number) => {
    this.animationFraction = animationFraction;
    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      activeContentControl.viewport.animationFraction = animationFraction;
    }
  }

  public onPlaybackSettingChanged = (settings: PlaybackSettings) => {
    this.updateSettings(settings);
  }
}

/**  Analysis Timeline Data Provider - handles View that define 'analysisStyle' data. */

export class AnalysisAnimationTimelineDataProvider extends BaseTimelineDataProvider {
  private _viewState: ViewState;

  constructor(viewState: ViewState) {
    super();
    this._viewState = viewState;
    if (viewState && viewState.analysisStyle) {
      this.supportsTimelineAnimation = true;
    }
  }

  public async loadTimelineData(): Promise<boolean> {
    if (this.supportsTimelineAnimation && this._viewState.analysisStyle) {
      // if animationFraction is set pointer should match
      const activeContentControl = ContentViewManager.getActiveContentControl();
      if (activeContentControl && activeContentControl.viewport) {
        if (activeContentControl.viewport.view.id === this._viewState.id) {
          this.animationFraction = activeContentControl.viewport.animationFraction;
        }
      }

      // for now just initial settings
      this.updateSettings({
        duration: 5 * 1000,
        loop: true,
        displayDetail: TimelineDetail.Minimal,
      });

      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  public onAnimationFractionChanged = (animationFraction: number) => {
    this.animationFraction = animationFraction;
    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      activeContentControl.viewport.animationFraction = animationFraction;
    }
  }

  public onPlaybackSettingChanged = (settings: PlaybackSettings) => {
    this.updateSettings(settings);
  }
}

/** iModel Viewport Control
 */
interface AnimationOverlayProps {
  viewState: ViewState;
  onPlayPause?: (playing: boolean) => void; // callback with play/pause button is pressed
}

interface AnimationOverlayState {
  showOverlay: boolean;
  dataProvider?: TimelineDataProvider;
}

/** iModel Viewport React component */
export class AnimationViewOverlay extends React.Component<AnimationOverlayProps, AnimationOverlayState> {
  public dataProvider?: TimelineDataProvider;
  private _componentUnmounting = false;

  constructor(props: any) {
    super(props);

    this.state = ({ dataProvider: undefined, showOverlay: false });
  }

  public async componentDidMount() {
    this._setTimelineDataProvider(this.props.viewState);
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
  }

  public componentWillUnmount() {
    this._componentUnmounting = true;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);

    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      activeContentControl.viewport.animationFraction = 0;
    }
  }

  private isInActiveContentControl(): boolean {
    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      if (activeContentControl.viewport.view.id === this.props.viewState.id) {
        return true;
      }
    }
    return false;
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    // istanbul ignore if
    if (this._componentUnmounting)
      return;

    // since this is a tool button automatically monitor the activation of tools so the active state of the button is updated.
    if (args.eventIds.has(SyncUiEventId.ActiveContentChanged)) {
      const showOverlay = this.isInActiveContentControl();
      if (showOverlay !== this.state.showOverlay)
        this.setState({ showOverlay });
    }
  }

  private _getTimelineDataProvider(viewState: ViewState): TimelineDataProvider | undefined {
    let timelineDataProvider: TimelineDataProvider;

    timelineDataProvider = new ScheduleAnimationTimelineDataProvider(viewState);
    if (timelineDataProvider.supportsTimelineAnimation) {
      if (timelineDataProvider.loadTimelineData())
        return timelineDataProvider as TimelineDataProvider;
    } else {
      timelineDataProvider = new AnalysisAnimationTimelineDataProvider(viewState);
      if (timelineDataProvider.supportsTimelineAnimation) {
        if (timelineDataProvider.loadTimelineData())
          return timelineDataProvider as TimelineDataProvider;
      }
    }
    return undefined;
  }

  private _setTimelineDataProvider(viewState: ViewState): boolean {
    const dataProvider = this._getTimelineDataProvider(viewState);
    if (dataProvider && dataProvider.supportsTimelineAnimation) {
      this.setState({ dataProvider, showOverlay: this.isInActiveContentControl() });
      return true;
    }
    return false;
  }

  public render(): React.ReactNode {
    if (!this.state.dataProvider || !this.state.showOverlay)
      return null;

    return (
      <div className="testapp-view-overlay">
        <div className="testapp-animation-overlay">
          <TimelineComponent
            startDate={this.state.dataProvider.start}
            endDate={this.state.dataProvider.end}
            initialDuration={this.state.dataProvider.getInitialDuration()}
            totalDuration={this.state.dataProvider.getSettings().duration}
            milestones={this.state.dataProvider.getMilestones()}
            minimized={true}
            onChange={this.state.dataProvider.onAnimationFractionChanged}
            onPlayPause={this.props.onPlayPause} />
        </div>
      </div>
    );
  }
}
