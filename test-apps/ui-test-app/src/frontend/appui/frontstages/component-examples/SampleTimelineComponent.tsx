/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { TimelineComponent, TimelineMenuItemProps } from "@bentley/ui-components";

export function ItemsAppendedSampleTimeline() {
  const duration = 8 * 1000;
  const startDate = new Date(2014, 6, 6);
  const endDate = new Date(2016, 8, 12);
  const appendMenuItems: TimelineMenuItemProps[] = [
    {label: "8 seconds", timelineDuration: 8*1000 },
    {label: "5 Seconds",  timelineDuration: 5*1000 },
    {label: "3 Seconds",  timelineDuration: 3*1000 },
  ];
  return (
    <div>
      <TimelineComponent
        startDate={startDate}
        endDate={endDate}
        initialDuration={0}
        totalDuration={duration}
        minimized={true}
        showDuration={true}
        alwaysMinimized={true}
        appMenuItemOption={"append"}
        appMenuItems={appendMenuItems}
        componentId={"sampleApp-appendSampleTimeline"} // qualify id with "<appName>-" to ensure uniqueness
      />
    </div>
  );
}

export function ItemsPrefixedSampleTimeline() {
  const duration = 500;
  const startDate = new Date(2014, 6, 6);
  const endDate = new Date(2016, 8, 12);
  const prefixMenuItems: TimelineMenuItemProps[] = [
    {label: "1/2 Second", timelineDuration: 500 },
    {label: "1 Seconds",  timelineDuration: 1000 },
    {label: "2 Seconds",  timelineDuration: 2*1000 },
  ];
  return (
    <div>
      <TimelineComponent
        startDate={startDate}
        endDate={endDate}
        initialDuration={0}
        totalDuration={duration}
        minimized={true}
        showDuration={true}
        alwaysMinimized={true}
        appMenuItemOption={"prefix"}
        appMenuItems={prefixMenuItems}
        componentId={"sampleApp-prefixSampleTimeline"} // qualify id with "<appName>-" to ensure uniqueness
      />
    </div>
  );
}

export function ItemsReplacedSampleTimeline() {
  const duration = 40 * 1000;
  const startDate = new Date(2020, 6, 6);
  const endDate = new Date(2020, 8, 12);
  const replaceMenuItems: TimelineMenuItemProps[] = [
    {label: "40 Second", timelineDuration: 40*1000 },
    {label: "1 Minute",  timelineDuration: 60*1000 },
    {label: "90 Seconds",  timelineDuration: 90*1000 },
  ];
  return (
    <div className="component-examples">
      <TimelineComponent
        startDate={startDate}
        endDate={endDate}
        initialDuration={0}
        totalDuration={duration}
        minimized={true}
        showDuration={true}
        alwaysMinimized={true}
        appMenuItemOption={"replace"}
        appMenuItems={replaceMenuItems}
        componentId={"sampleApp-replaceSampleTimeline"} // qualify id with "<appName>-" to ensure uniqueness
      />
    </div>
  );
}
export function NoRepeatSampleTimeline() {
  const duration = 10 * 1000;
  const startDate = new Date(2020, 6, 6);
  const endDate = new Date(2020, 8, 12);
  return (
    <div className="component-examples">
      <TimelineComponent
        startDate={startDate}
        endDate={endDate}
        initialDuration={0}
        totalDuration={duration}
        minimized={true}
        showDuration={true}
        alwaysMinimized={true}
        includeRepeat={false}
        componentId={"sampleApp-noRepeatSampleTimeline"} // qualify id with "<appName>-" to ensure uniqueness
      />
    </div>
  );
}
