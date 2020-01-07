/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import * as React from "react";

import { TimelineDataProvider, TimelineComponent, SolarTimeline, SolarDataProvider } from "@bentley/ui-components";
import { IModelApp, ScreenViewport, Viewport } from "@bentley/imodeljs-frontend";
import { SyncUiEventDispatcher, SyncUiEventArgs, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { ScheduleAnimationTimelineDataProvider } from "../timeline/ScheduleAnimationProvider";
import { AnalysisAnimationTimelineDataProvider } from "../timeline/AnalysisAnimationProvider";
import { SolarTimelineDataProvider } from "../timeline/SolarTimelineDataProvider";
import { ContentViewManager } from "./ContentViewManager";

import "./DefaultViewOverlay.scss";

/** Props of Viewport Overlay Control that show timelines
 */
interface Props {
  viewport: ScreenViewport;
  onPlayPause?: (playing: boolean) => void; // callback with play/pause button is pressed
}

interface State {
  showOverlay: boolean;
  dataProvider?: TimelineDataProvider;
  solarDataProvider?: SolarDataProvider;
}

/** Overlay for iModel Viewport that will show either schedule, analysis, or solar timelines.
 * @alpha
 */
// istanbul ignore next
export class DefaultViewOverlay extends React.Component<Props, State> {
  private _componentMounted = false;
  private _removeListener?: () => void | undefined;

  constructor(props: any) {
    super(props);

    this.state = { dataProvider: undefined, showOverlay: false };
  }

  private _handleDisplayStyleChange = async () => {
    setImmediate(() => {
      // reset to beginning of animation
      if (this.state.dataProvider) {
        if (this.state.dataProvider.onAnimationFractionChanged)
          this.state.dataProvider.onAnimationFractionChanged(0);

        if (this.props.viewport)
          this.props.viewport.scheduleScriptFraction = 0;
      }
      this._setTimelineDataProvider(this.props.viewport as ScreenViewport);
    });
  }
  public async componentDidMount() {
    this._setTimelineDataProvider(this.props.viewport);
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
    this._removeListener = this.props.viewport.onDisplayStyleChanged.addListener(this._handleDisplayStyleChange, this);
    this._componentMounted = true;
  }

  private setShowOverlayState(): void {
    let showOverlay = this.isInActiveContentControl();
    if (showOverlay && this.state.solarDataProvider)
      showOverlay = this.state.solarDataProvider.shouldShowTimeline;
    if (showOverlay !== this.state.showOverlay) this.setState({ showOverlay });
  }

  private _onHandleViewChanged = (vp: Viewport) => {
    const viewId = this.state.dataProvider
      ? this.state.dataProvider.viewId
      : this.state.solarDataProvider
        ? this.state.solarDataProvider.viewId
        : "";
    if (vp.view.id !== viewId) {
      setImmediate(() => {
        this._setTimelineDataProvider(vp as ScreenViewport);
      });
    } else {
      this.setShowOverlayState();
    }
  }

  public componentWillUnmount() {
    this._componentMounted = false;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
    if (this.state.solarDataProvider && this.state.solarDataProvider.viewport) {
      if (this.state.solarDataProvider.viewport.onViewChanged)
        this.state.solarDataProvider.viewport.onViewChanged.removeListener(
          this._onHandleViewChanged,
        );
    }

    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      activeContentControl.viewport.scheduleScriptFraction = 0;
    }
    if (this._removeListener)
      this._removeListener();
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
    if (this._componentMounted) return;

    // since this is a tool button automatically monitor the activation of tools so the active state of the button is updated.
    if (args.eventIds.has(SyncUiEventId.ActiveContentChanged)) {
      this.setShowOverlayState();
    }
    if (args.eventIds.has(SyncUiEventId.ContentControlActivated)) {
      this.setShowOverlayState();
    }
    if (args.eventIds.has(SyncUiEventId.FrontstageReady)) {
      this.setShowOverlayState();
    }
  }

  private _getTimelineDataProvider(viewport: ScreenViewport): TimelineDataProvider | undefined {
    let timelineDataProvider: TimelineDataProvider;

    timelineDataProvider = new ScheduleAnimationTimelineDataProvider(viewport.view, viewport);
    if (timelineDataProvider.supportsTimelineAnimation) {
      if (timelineDataProvider.loadTimelineData()) {
        // double the default duration
        timelineDataProvider.updateSettings({ duration: 40 * 1000 });
        viewport.onViewChanged.removeListener(this._onHandleViewChanged);
        viewport.onViewChanged.addListener(this._onHandleViewChanged);
        return timelineDataProvider as TimelineDataProvider;
      }
    } else {
      timelineDataProvider = new AnalysisAnimationTimelineDataProvider(viewport.view, viewport);
      if (timelineDataProvider.supportsTimelineAnimation) {
        if (timelineDataProvider.loadTimelineData()) {
          viewport.onViewChanged.removeListener(this._onHandleViewChanged);
          viewport.onViewChanged.addListener(this._onHandleViewChanged);
          return timelineDataProvider as TimelineDataProvider;
        }
      }
    }
    return undefined;
  }

  private _getSolarDataProvider(viewport: ScreenViewport): SolarDataProvider | undefined {
    if (IModelApp.renderSystem.options.displaySolarShadows) {
      let solarDataProvider: SolarDataProvider;

      solarDataProvider = new SolarTimelineDataProvider(viewport.view, viewport);
      if (solarDataProvider.supportsTimelineAnimation) {
        viewport.onViewChanged.removeListener(this._onHandleViewChanged);
        viewport.onViewChanged.addListener(this._onHandleViewChanged);
        return solarDataProvider as SolarDataProvider;
      }
    }

    return undefined;
  }

  private _setTimelineDataProvider(viewport: ScreenViewport): boolean {
    const dataProvider = this._getTimelineDataProvider(viewport);
    if (dataProvider && dataProvider.supportsTimelineAnimation) {
      this.setState({
        dataProvider,
        showOverlay: this.isInActiveContentControl(),
        solarDataProvider: undefined,
      });
      return true;
    }
    const solarDataProvider = this._getSolarDataProvider(viewport);
    if (solarDataProvider && solarDataProvider.supportsTimelineAnimation) {
      let showOverlay = this.isInActiveContentControl();
      if (showOverlay && !solarDataProvider.shouldShowTimeline) showOverlay = false;
      this.setState({ solarDataProvider, showOverlay, dataProvider: undefined });
      return true;
    }
    this.setState({
      dataProvider: undefined,
      showOverlay: false,
      solarDataProvider: undefined,
    });

    return false;
  }

  public render(): React.ReactNode {
    if (this.state.showOverlay) {
      if (this.state.solarDataProvider) {
        return (
          <div className="uifw-view-overlay">
            <div className="uifw-animation-overlay">
              <SolarTimeline dataProvider={this.state.solarDataProvider} />
            </div>
          </div>
        );
      }

      // handle both schedule and analysis animations
      if (this.state.dataProvider) {
        return (
          <div className="uifw-view-overlay">
            <div className="uifw-animation-overlay">
              <TimelineComponent
                startDate={this.state.dataProvider.start}
                endDate={this.state.dataProvider.end}
                initialDuration={this.state.dataProvider.initialDuration}
                totalDuration={this.state.dataProvider.duration}
                milestones={this.state.dataProvider.getMilestones()}
                minimized={true}
                alwaysMinimized={this.state.dataProvider.getMilestonesCount() > 0}
                onChange={this.state.dataProvider.onAnimationFractionChanged}
                onPlayPause={this.props.onPlayPause}
              />
            </div>
          </div>
        );
      }
    }
    return null;
  }
}
