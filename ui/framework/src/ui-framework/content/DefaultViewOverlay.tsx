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
  onPlayPause?: (playing: boolean) => void; // callback with play/pause button is pressed
}
/**
 * Default viewport overlay that shows a schedule timeline for views containing a schedule script or a solar timeline for views with solar shadow info
 */
// istanbul ignore next
export function DefaultViewOverlay(props: ViewOverlayProps) {
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [timelineDataProvider, setTimelineDataProvider] = React.useState<undefined | TimelineDataProvider>();
  const [solarDataProvider, setSolarDataProvider] = React.useState<undefined | SolarDataProvider>();
  const [viewport, setViewport] = React.useState(props.viewport);
  const [displayStyleId, setDisplayStyleId] = React.useState(viewport.displayStyle.id);

  const isSolarDataProviderCurrent = React.useCallback((): boolean => {
    return (!!solarDataProvider && solarDataProvider.viewport === viewport);
  }, [viewport, solarDataProvider]);

  const updateDataProviders = React.useCallback(() => {
    async function fetchNewDataProviders() {
      let newDataProvider: TimelineDataProvider | SolarDataProvider | undefined = await getTimelineDataProvider(viewport);
      if (newDataProvider) {
        setTimelineDataProvider(newDataProvider);
        setSolarDataProvider(undefined);
      } else if (!isSolarDataProviderCurrent()) {
        newDataProvider = await getSolarDataProvider(viewport);
        setTimelineDataProvider(undefined);
        setSolarDataProvider(newDataProvider);
      }
    }
    void fetchNewDataProviders();
  },[viewport, isSolarDataProviderCurrent]);

  const updateShowOverlayState = React.useCallback((): void => {
    let newShowOverlay = true;
    if (solarDataProvider)
      newShowOverlay = solarDataProvider.shouldShowTimeline;
    else {
      if (timelineDataProvider && (timelineDataProvider.viewport === viewport))
        newShowOverlay = !!(timelineDataProvider.viewport.view.scheduleScript) || !!(timelineDataProvider.viewport.view.analysisStyle);
      else
        newShowOverlay = false;
    }

    setShowOverlay(isInActiveContentControl(viewport) && newShowOverlay);
  },[viewport, solarDataProvider, timelineDataProvider]);

  React.useEffect(() => {
    const handleDisplayStyleChange = () => {
      // istanbul ignore else
      if (viewport.displayStyle.id === displayStyleId) return;
      setViewport(viewport);
      updateDataProviders();
      setImmediate(() => {
        // reset to beginning of animation
        if (timelineDataProvider) {
          if (timelineDataProvider.onAnimationFractionChanged)
            timelineDataProvider.onAnimationFractionChanged(0);

          if (viewport) {
            viewport.timePoint = undefined;
            viewport.analysisFraction = 0;
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        setDisplayStyleId(viewport.displayStyle.id);
        updateShowOverlayState();
      });
      viewport.onDisplayStyleChanged.addListener(handleDisplayStyleChange);
      return function cleanup() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        viewport.onDisplayStyleChanged.removeListener(handleDisplayStyleChange);
      };
    };
  }, [displayStyleId, timelineDataProvider, updateDataProviders, updateShowOverlayState, viewport]);

  React.useEffect(() => {
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
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
    return function cleanup() {
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
    };
  }, [updateShowOverlayState]);

  React.useEffect(() => {
    const handleViewChanged = (_vp: Viewport): void => {
      updateDataProviders();
    };
    viewport.onChangeView.addListener(handleViewChanged);
    return function cleanup() {
      viewport.onChangeView.removeListener(handleViewChanged);
    };
  }, [updateDataProviders, viewport]);

  React.useLayoutEffect(() => {
    updateDataProviders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  if (showOverlay) {
    if (solarDataProvider) {
      return (
        <div className="uifw-view-overlay">
          <div className="uifw-animation-overlay">
            <SolarTimeline dataProvider={solarDataProvider} />
          </div>
        </div>
      );
      // istanbul ignore else
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
// istanbul ignore next
async function getSolarDataProvider(viewport: ScreenViewport): Promise<SolarDataProvider | undefined> {
  // istanbul ignore else
  if (IModelApp.renderSystem.options.displaySolarShadows) {
    const solarDataProvider: SolarDataProvider = new SolarTimelineDataProvider(viewport.view, viewport);
    // istanbul ignore else
    if (solarDataProvider.supportsTimelineAnimation) {
      return solarDataProvider;
    }
  }

  return undefined;
}
// istanbul ignore next
async function getTimelineDataProvider(viewport: ScreenViewport): Promise<TimelineDataProvider | undefined> {
  let timelineDataProvider: TimelineDataProvider;

  timelineDataProvider = new ScheduleAnimationTimelineDataProvider(viewport.view, viewport);
  if (timelineDataProvider.supportsTimelineAnimation) {
    const dataLoaded = await timelineDataProvider.loadTimelineData();
    // istanbul ignore else
    if (dataLoaded) {
      // double the default duration
      timelineDataProvider.updateSettings({ duration: 40 * 1000 });
      return timelineDataProvider;
    }
  } else {
    timelineDataProvider = new AnalysisAnimationTimelineDataProvider(viewport.view, viewport);
    // istanbul ignore else
    if (timelineDataProvider.supportsTimelineAnimation) {
      const dataLoaded = await timelineDataProvider.loadTimelineData();
      if (dataLoaded) {
        return timelineDataProvider;
      }
    }
  }
  return undefined;
}

// istanbul ignore next
function isInActiveContentControl(viewport: Viewport): boolean {
  const activeContentControl = ContentViewManager.getActiveContentControl();
  // istanbul ignore else
  if (activeContentControl && activeContentControl.viewport && activeContentControl.viewport.view.id === viewport.view.id) {
    return true;
  }
  return false;
}
