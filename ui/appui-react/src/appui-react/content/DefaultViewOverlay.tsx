/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import "./DefaultViewOverlay.scss";
import * as React from "react";
import { ScreenViewport } from "@itwin/core-frontend";
import { SolarTimeline, TimelineComponent } from "@itwin/imodel-components-react";
import { useScheduleAnimationDataProvider } from "../hooks/useScheduleAnimationDataProvider";
import { useActiveViewport } from "../hooks/useActiveViewport";
import { useSolarDataProvider } from "../hooks/useSolarDataProvider";
import { useAnalysisAnimationDataProvider } from "../hooks/useAnalysisAnimationDataProvider";

/** Props of Viewport Overlay Control that show timelines
 * @public
 */
export interface ViewOverlayProps {
  viewport: ScreenViewport;
  onPlayPause?: (playing: boolean) => void; // callback with play/pause button is pressed
  featureOptions?: { [key: string]: any };
}

/**
 * Default viewport overlay that examines ViewState of the active view for a schedule script, analysis data, or solar data. If one of these is detected, the corresponding
 * data provider is attached to the TimelineComponent and the overlay is made visible.
 * @public
 */
// istanbul ignore next
export function DefaultViewOverlay({ viewport, onPlayPause, featureOptions }: ViewOverlayProps) {
  const solarDataTimelineProvider = useSolarDataProvider(viewport);
  const analysisAnimationTimelineDataProvider = useAnalysisAnimationDataProvider(viewport);
  const scheduleTimelineDataProvider = useScheduleAnimationDataProvider(viewport);
  const currentViewport = useActiveViewport();

  if (!currentViewport)
    return null;

  // Solar gets first shot
  if (solarDataTimelineProvider && !!featureOptions?.defaultViewOverlay?.enableSolarTimelineViewOverlay) {
    return (
      <div className="uifw-view-overlay">
        <div className="uifw-animation-overlay">
          <SolarTimeline dataProvider={solarDataTimelineProvider} />
        </div>
      </div>
    );
  }

  if (analysisAnimationTimelineDataProvider && !!featureOptions?.defaultViewOverlay?.enableAnalysisTimelineViewOverlay) {
    return (
      <div className="uifw-view-overlay">
        <div className="uifw-animation-overlay">
          <TimelineComponent
            startDate={analysisAnimationTimelineDataProvider.start}
            endDate={analysisAnimationTimelineDataProvider.end}
            initialDuration={analysisAnimationTimelineDataProvider.initialDuration}
            totalDuration={analysisAnimationTimelineDataProvider.duration}
            minimized={true}
            onChange={analysisAnimationTimelineDataProvider.onAnimationFractionChanged}
            onPlayPause={onPlayPause}
          />
        </div>
      </div>
    );
  }

  if (scheduleTimelineDataProvider && !!featureOptions?.defaultViewOverlay?.enableScheduleAnimationViewOverlay) {
    return (
      <div className="uifw-view-overlay">
        <div className="uifw-animation-overlay">
          <TimelineComponent
            startDate={scheduleTimelineDataProvider.start}
            endDate={scheduleTimelineDataProvider.end}
            initialDuration={scheduleTimelineDataProvider.initialDuration}
            totalDuration={scheduleTimelineDataProvider.duration}
            minimized={true}
            onChange={scheduleTimelineDataProvider.onAnimationFractionChanged}
            onPlayPause={onPlayPause}
          />
        </div>
      </div>
    );
  }

  return null;
}
