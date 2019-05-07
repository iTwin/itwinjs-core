/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  TimelineDataProvider,
  TimelineComponent,
} from "@bentley/ui-components";
import {
  ContentViewManager,
  SyncUiEventDispatcher,
  SyncUiEventArgs,
  SyncUiEventId,
  ScheduleAnimationTimelineDataProvider,
  AnalysisAnimationTimelineDataProvider,
} from "@bentley/ui-framework";
import { ScreenViewport } from "@bentley/imodeljs-frontend";

import "./AnimationViewOverlay.scss";

/** iModel Viewport Control
 */
interface AnimationOverlayProps {
  viewport: ScreenViewport;
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
    this._setTimelineDataProvider(this.props.viewport);
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
      if (activeContentControl.viewport.view.id === this.props.viewport.view.id) {
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

  private _getTimelineDataProvider(viewport: ScreenViewport): TimelineDataProvider | undefined {
    let timelineDataProvider: TimelineDataProvider;

    timelineDataProvider = new ScheduleAnimationTimelineDataProvider(viewport.view, viewport);
    if (timelineDataProvider.supportsTimelineAnimation) {
      if (timelineDataProvider.loadTimelineData())
        return timelineDataProvider as TimelineDataProvider;
    } else {
      timelineDataProvider = new AnalysisAnimationTimelineDataProvider(viewport.view, viewport);
      if (timelineDataProvider.supportsTimelineAnimation) {
        if (timelineDataProvider.loadTimelineData())
          return timelineDataProvider as TimelineDataProvider;
      }
    }
    return undefined;
  }

  private _setTimelineDataProvider(viewport: ScreenViewport): boolean {
    const dataProvider = this._getTimelineDataProvider(viewport);
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
            initialDuration={this.state.dataProvider.initialDuration}
            totalDuration={this.state.dataProvider.duration}
            milestones={this.state.dataProvider.getMilestones()}
            minimized={true}
            onChange={this.state.dataProvider.onAnimationFractionChanged}
            onPlayPause={this.props.onPlayPause} />
        </div>
      </div>
    );
  }
}
