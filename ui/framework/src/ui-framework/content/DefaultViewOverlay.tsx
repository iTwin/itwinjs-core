/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import "./DefaultViewOverlay.scss";
import * as React from "react";
import { ScreenViewport } from "@bentley/imodeljs-frontend";
import { SolarTimeline, TimelineComponent } from "@bentley/ui-components";
import { useScheduleAnimationDataProvider } from "../hooks/useScheduleAnimationDataProvider";
import { useActiveViewport } from "../hooks/useActiveViewport";
import { useSolarDataProvider } from "../hooks/useSolarDataProvider";
import { useAnalysisAnimationDataProvider } from "../hooks/useAnalysisAnimationDataProvider";

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
  const analysisAnimationTimelineDataProvider = useAnalysisAnimationDataProvider(viewport);
  const scheduleTimelineDataProvider = useScheduleAnimationDataProvider(viewport);
  const currentViewport = useActiveViewport();
  const timelineDataProvider = scheduleTimelineDataProvider ? scheduleTimelineDataProvider : analysisAnimationTimelineDataProvider;
  const isCurrentViewport = currentViewport === viewport;
  return (
    <div className="uifw-view-overlay">
      {isCurrentViewport && !timelineDataProvider && solarDataTimelineProvider &&
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
