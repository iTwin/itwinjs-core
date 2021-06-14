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
import { SolarDataProvider, SolarTimeline, TimelineComponent } from "@bentley/ui-components";
import { SyncUiEventArgs, SyncUiEventDispatcher, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { AnalysisAnimationTimelineDataProvider } from "../timeline/AnalysisAnimationProvider";
import { ScheduleAnimationTimelineDataProvider } from "../timeline/ScheduleAnimationProvider";
import { SolarTimelineDataProvider } from "../timeline/SolarTimelineDataProvider";
import { ContentViewManager } from "./ContentViewManager";

function useCurrentContentViewport() {
  const [viewport, setViewport] = React.useState<ScreenViewport | undefined>(() => {
    const activeContentControl = ContentViewManager.getActiveContentControl();
    return activeContentControl && activeContentControl.viewport;
  });

  React.useEffect(() => {
    const syncIdsOfInterest = [SyncUiEventId.ActiveContentChanged, SyncUiEventId.ContentControlActivated, SyncUiEventId.FrontstageReady];
    const handleSyncUiEvent = (args: SyncUiEventArgs): void => {
      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value))) {
        const activeContentControl = ContentViewManager.getActiveContentControl();
        setViewport(activeContentControl && activeContentControl.viewport);
      }
    };

    return SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
  }, []);

  return viewport;
}

function useSupportsShadowDisplay(viewport: ScreenViewport | undefined) {
  const [supportsShadows, setSupportsShadows] = React.useState(!!viewport?.displayStyle?.wantShadows && !!IModelApp.renderSystem.options.displaySolarShadows);

  React.useEffect(() => {
    setSupportsShadows(!!viewport?.displayStyle?.wantShadows && !!IModelApp.renderSystem.options.displaySolarShadows);
  }, [viewport]);

  React.useEffect(() => {
    const handleViewChanged = (vp: Viewport): void => {
      setSupportsShadows(!!vp?.displayStyle?.wantShadows && !!IModelApp.renderSystem.options.displaySolarShadows);
    };
    return viewport?.onChangeView.addListener(handleViewChanged);
  }, [viewport]);

  React.useEffect(() => {
    const handleViewChanged = (vp: Viewport): void => {
      const wantShadows = !!vp.displayStyle?.wantShadows && !!IModelApp.renderSystem.options.displaySolarShadows;
      if (wantShadows !== supportsShadows)
        setSupportsShadows(wantShadows);
    };
    return viewport?.onChangeView.addListener(handleViewChanged);
  }, [viewport, supportsShadows]);

  React.useEffect(() => {
    const handleDisplayStyleChange = (vp: Viewport): void => {
      const wantShadows = !!vp.displayStyle?.wantShadows && !!IModelApp.renderSystem.options.displaySolarShadows;
      if (wantShadows !== supportsShadows)
        setSupportsShadows(wantShadows);
    };
    return viewport?.onDisplayStyleChanged.addListener(handleDisplayStyleChange);
  }, [viewport, supportsShadows]);

  return supportsShadows;
}

function useSupportsScheduleScript(viewport: Viewport | undefined) {
  const [supportsScheduleScript, setSupportsScheduleScript] = React.useState(!!viewport?.view?.scheduleScript);

  React.useEffect(() => {
    setSupportsScheduleScript(!!viewport?.view?.scheduleScript);
  }, [viewport]);

  React.useEffect(() => {
    const handleViewChanged = (vp: Viewport): void => {
      const hasScheduleScript = !!vp?.view?.scheduleScript;
      if (hasScheduleScript !== supportsScheduleScript)
        setSupportsScheduleScript(hasScheduleScript);
    };
    return viewport?.onChangeView.addListener(handleViewChanged);
  }, [supportsScheduleScript, viewport]);

  React.useEffect(() => {
    const handleDisplayStyleChange = (vp: Viewport): void => {
      const hasScheduleScript = !!vp?.view?.scheduleScript;
      if (hasScheduleScript !== supportsScheduleScript)
        setSupportsScheduleScript(hasScheduleScript);
    };
    return viewport?.onDisplayStyleChanged.addListener(handleDisplayStyleChange);
  }, [viewport, supportsScheduleScript]);
  return supportsScheduleScript;
}

function useSupportsAnalysisAnimation(viewport: Viewport | undefined) {
  const [supportsAnalysisAnimation, setSupportsAnalysisAnimation] = React.useState(!!viewport?.view?.analysisStyle);

  React.useEffect(() => {
    setSupportsAnalysisAnimation(!!viewport?.view?.analysisStyle);
  }, [viewport]);

  React.useEffect(() => {
    const handleViewChanged = (vp: Viewport): void => {
      const hasAnalysisData = !!vp?.view?.analysisStyle;
      if (hasAnalysisData !== supportsAnalysisAnimation)
        setSupportsAnalysisAnimation(hasAnalysisData);
    };
    return viewport?.onChangeView.addListener(handleViewChanged);
  }, [supportsAnalysisAnimation, viewport]);

  React.useEffect(() => {
    const handleDisplayStyleChange = (vp: Viewport): void => {
      const hasAnalysisData = !!vp?.view?.analysisStyle;
      if (hasAnalysisData !== supportsAnalysisAnimation)
        setSupportsAnalysisAnimation(hasAnalysisData);
    };
    return viewport?.onDisplayStyleChanged.addListener(handleDisplayStyleChange);
  }, [viewport, supportsAnalysisAnimation]);
  return supportsAnalysisAnimation;
}

function useScheduleAnimationTimelineDataProvider(viewport: ScreenViewport | undefined) {
  const supportsScheduleScript = useSupportsScheduleScript(viewport);
  const [scheduleAnimationTimelineDataProvider, setScheduleAnimationTimelineDataProvider] = React.useState<ScheduleAnimationTimelineDataProvider | undefined>();
  const isMountedRef = React.useRef(false);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  React.useEffect(() => {
    async function fetchNewDataProvider() {
      const newProvider = (supportsScheduleScript && viewport) ? new ScheduleAnimationTimelineDataProvider(viewport.view, viewport) : undefined;
      if (newProvider?.supportsTimelineAnimation) {
        const dataLoaded = await newProvider.loadTimelineData();
        if (isMountedRef.current)
          setScheduleAnimationTimelineDataProvider(dataLoaded ? newProvider : undefined);
      } else {
        setScheduleAnimationTimelineDataProvider(undefined);
      }
    }
    void fetchNewDataProvider();
  }, [supportsScheduleScript, viewport]);

  return scheduleAnimationTimelineDataProvider;
}

function useAnalysisAnimationTimelineDataProvider(viewport: ScreenViewport | undefined) {
  const supportsAnalysisAnimation = useSupportsAnalysisAnimation(viewport);
  const [analysisAnimationTimelineDataProvider, setAnalysisAnimationTimelineDataProvider] = React.useState<AnalysisAnimationTimelineDataProvider | undefined>();
  const isMountedRef = React.useRef(false);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  React.useEffect(() => {
    async function fetchNewDataProvider() {
      const newProvider = (supportsAnalysisAnimation && viewport) ? new AnalysisAnimationTimelineDataProvider(viewport.view, viewport) : undefined;
      if (newProvider?.supportsTimelineAnimation) {
        const dataLoaded = await newProvider.loadTimelineData();
        if (isMountedRef.current)
          setAnalysisAnimationTimelineDataProvider(dataLoaded ? newProvider : undefined);
      }
    }
    void fetchNewDataProvider();
  }, [supportsAnalysisAnimation, viewport]);

  return analysisAnimationTimelineDataProvider;
}

function useSolarDataProvider(viewport: ScreenViewport | undefined): SolarDataProvider | undefined {
  const supportsShadowDisplay = useSupportsShadowDisplay(viewport);
  const [solarDataProvider, setSolarDataProvider] = React.useState(() => {
    return (supportsShadowDisplay && viewport) ? new SolarTimelineDataProvider(viewport.view, viewport) : undefined;
  });

  React.useEffect(() => {
    const newSolarDataProvider = (supportsShadowDisplay && viewport) ? new SolarTimelineDataProvider(viewport.view, viewport) : undefined;
    setSolarDataProvider(newSolarDataProvider);
  }, [supportsShadowDisplay, viewport]);

  return solarDataProvider;
}

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
export function DefaultViewOverlay({ viewport, onPlayPause }: ViewOverlayProps) {
  const solarDataTimelineProvider = useSolarDataProvider(viewport);
  const analysisAnimationTimelineDataProvider = useAnalysisAnimationTimelineDataProvider(viewport);
  const scheduleTimelineDataProvider = useScheduleAnimationTimelineDataProvider(viewport);

  // const [dataProvider, setDataProvider] = React.useState<TimelineDataProvider | SolarDataProvider | undefined>();
  const currentViewport = useCurrentContentViewport();
  const showSolarTimeline = solarDataTimelineProvider && !scheduleTimelineDataProvider && !analysisAnimationTimelineDataProvider;
  const timelineDataProvider = scheduleTimelineDataProvider ? scheduleTimelineDataProvider : analysisAnimationTimelineDataProvider;
  const isCurrentViewport = currentViewport === viewport;
  return (
    <div className="uifw-view-overlay">
      {isCurrentViewport && showSolarTimeline && solarDataTimelineProvider &&
        <div className="uifw-animation-overlay">
          <SolarTimeline dataProvider={solarDataTimelineProvider} />
        </div>
      }
      {isCurrentViewport && timelineDataProvider &&
        <div className="uifw-animation-overlay">
          <TimelineComponent
            startDate={timelineDataProvider.start}
            endDate={timelineDataProvider.end}
            initialDuration={timelineDataProvider.initialDuration}
            totalDuration={timelineDataProvider.duration}
            minimized={true}
            onChange={timelineDataProvider.onAnimationFractionChanged}
            onPlayPause={onPlayPause}
          />
        </div>
      }
    </div>
  );
}
