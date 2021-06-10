/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import "./DefaultViewOverlay.scss";
import * as React from "react";
import { IModelApp, ScreenViewport, Viewport } from "@bentley/imodeljs-frontend";
import { SolarDataProvider, SolarTimeline, TimelineComponent, TimelineDataProvider } from "@bentley/ui-components";
import { SyncUiEventArgs, SyncUiEventDispatcher, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { AnalysisAnimationTimelineDataProvider } from "../timeline/AnalysisAnimationProvider";
import { ScheduleAnimationTimelineDataProvider } from "../timeline/ScheduleAnimationProvider";
import { SolarTimelineDataProvider } from "../timeline/SolarTimelineDataProvider";
import { ContentViewManager } from "./ContentViewManager";

/** Props of Viewport Overlay Control that show timelines
 */
export interface ViewOverlayProps {
  viewport: ScreenViewport;
  timelineDataProvider?: TimelineDataProvider;
  solarDataProvider?: SolarDataProvider;
  onPlayPause?: (playing: boolean) => void; // callback with play/pause button is pressed
}
/**
 *
 */
export function DefaultViewOverlay(props: ViewOverlayProps) {
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [timelineDataProvider, setTimelineDataProvider] = React.useState(props.timelineDataProvider);
  const [solarDataProvider, setSolarDataProvider] = React.useState(props.solarDataProvider);
  const [viewport] = React.useState(props.viewport);
  const [viewId, setViewId] = React.useState("");

  React.useEffect(() => {
    async function setNewDataProvider() {
      let newDataProvider: TimelineDataProvider | SolarDataProvider | undefined = await getTimelineDataProvider(viewport);
      if (newDataProvider && newDataProvider.supportsTimelineAnimation) {
        setTimelineDataProvider(newDataProvider);
        setSolarDataProvider(undefined);
      } else {
        newDataProvider = await getSolarDataProvider(viewport, solarDataProvider);
        if (newDataProvider) {
          setTimelineDataProvider(undefined);
          setSolarDataProvider(newDataProvider);
        }
      }
      setShowOverlay(isInActiveContentControl(viewport));
    }

    const updateShowOverlayState = (): void => {
      let updateOverlay = isInActiveContentControl(viewport);
      if (updateOverlay && solarDataProvider)
        updateOverlay = solarDataProvider.shouldShowTimeline;
      if (updateOverlay !== showOverlay) setShowOverlay(updateOverlay);
    };

    const handleSyncUiEvent = (args: SyncUiEventArgs): void => {
      // istanbul ignore if
      if (args.eventIds.has(SyncUiEventId.ActiveContentChanged)) {
        updateShowOverlayState();
      }
      if (args.eventIds.has(SyncUiEventId.ContentControlActivated)) {
        updateShowOverlayState();
      }
      if (args.eventIds.has(SyncUiEventId.FrontstageReady)) {
        updateShowOverlayState();
      }
    };

    const handleViewChanged = (vp: Viewport): void => {
      if (viewId !== vp.view.id){
        setViewId(vp.view.id);
        // setNewDataProvider().then;
      }
    };

    setNewDataProvider().then;

    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
    viewport.onViewChanged.addListener(handleViewChanged);
    return function cleanup() {
      viewport.onViewChanged.removeListener(handleViewChanged);
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
    };
  }, [viewport, viewId, solarDataProvider, showOverlay]);

  if (showOverlay) {
    if (solarDataProvider) {
      return (
        <div className="uifw-view-overlay">
          <div className="uifw-animation-overlay">
            <SolarTimeline dataProvider={solarDataProvider} />
          </div>
        </div>
      );
    } else if (timelineDataProvider) {
      return (
        <div className="uifw-view-overlay">
          <div className="uifw-animation-overlay">
            <TimelineComponent
              startDate={timelineDataProvider.start}
              endDate={timelineDataProvider.end}
              initialDuration={timelineDataProvider.initialDuration}
              totalDuration={timelineDataProvider.duration}
              minimized={true}
              onChange={timelineDataProvider.onAnimationFractionChanged}
              onPlayPause={props.onPlayPause}
            />
          </div>
        </div>
      );
    }
  }
  return (
    <div className="uifw-view-overlay"/>
  );
}
async function getSolarDataProvider(viewport: ScreenViewport, dataProvider: SolarDataProvider | undefined): Promise<SolarDataProvider | undefined> {
  if (IModelApp.renderSystem.options.displaySolarShadows) {
    if (dataProvider && dataProvider.viewport === viewport)
      return dataProvider;

    const solarDataProvider: SolarDataProvider = new SolarTimelineDataProvider(viewport.view, viewport);
    if (solarDataProvider.supportsTimelineAnimation) {
      return solarDataProvider;
    }
  }

  return undefined;
}
async function getTimelineDataProvider(viewport: ScreenViewport): Promise<TimelineDataProvider | undefined> {
  let timelineDataProvider: TimelineDataProvider;

  timelineDataProvider = new ScheduleAnimationTimelineDataProvider(viewport.view, viewport);
  if (timelineDataProvider.supportsTimelineAnimation) {
    const dataLoaded = await timelineDataProvider.loadTimelineData();
    if (dataLoaded) {
      // double the default duration
      timelineDataProvider.updateSettings({ duration: 40 * 1000 });
      return timelineDataProvider;
    }
  } else {
    timelineDataProvider = new AnalysisAnimationTimelineDataProvider(viewport.view, viewport);
    if (timelineDataProvider.supportsTimelineAnimation) {
      const dataLoaded = await timelineDataProvider.loadTimelineData();
      if (dataLoaded) {
        return timelineDataProvider;
      }
    }
  }
  return undefined;
}

function isInActiveContentControl(viewport: Viewport): boolean {
  const activeContentControl = ContentViewManager.getActiveContentControl();
  if (activeContentControl && activeContentControl.viewport) {
    if (activeContentControl.viewport.view.id === viewport.view.id) {
      return true;
    }
  }
  return false;
}
