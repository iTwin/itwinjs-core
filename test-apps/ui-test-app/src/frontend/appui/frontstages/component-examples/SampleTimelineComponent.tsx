/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { TimelineComponent, TimelineMenuItemProps } from "@bentley/ui-components";
export function ItemsAppendedSampleTimeline() {
  const duration = 8 * 1000;
  const startDate = new Date(2014, 6, 6);
  const endDate = new Date(2017, 8, 12);
  const appendMenuItems: TimelineMenuItemProps[] = [
    {label: "8 Seconds", timelineDuration: 8*1000 },
    {label: "5 Seconds",  timelineDuration: 5*1000 },
    {label: "3 Seconds",  timelineDuration: 3*1000 },
  ];
  return (
    <div style={{width:"100%", height:"auto"}}>
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
  const endDate = new Date(2017, 8, 12);
  const prefixMenuItems: TimelineMenuItemProps[] = [
    {label: "70 Seconds", timelineDuration: 70*100 },
    {label: "1 Minute",  timelineDuration: 60*1000 },
    {label: "50 Seconds",  timelineDuration: 50*1000 },
  ];
  return (
    <div style={{width:"100%", height:"auto"}}>
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
  const startDate = new Date(2018, 6, 6);
  const endDate = new Date(2021, 8, 12);
  const replaceMenuItems: TimelineMenuItemProps[] = [
    {label: "40 Seconds", timelineDuration: 40*1000 },
    {label: "1 Minute",  timelineDuration: 60*1000 },
    {label: "90 Seconds",  timelineDuration: 90*1000 },
  ];
  return (
    <div style={{width:"100%", height:"auto"}}>
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
  const startDate = new Date(2018, 6, 6);
  const endDate = new Date(2021, 8, 12);
  return (
    <div style={{width:"100%", height:"auto"}}>
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
export function NoLocalizedTimeSampleTimeline() {
  const duration = 10 * 1000;
  const startDate = new Date("July 1, 2016, 00:00:00 GMT -0000");
  const endDate = new Date("July 1, 2016, 20:30:45 GMT -0000");
  return (
    <div style={{width:"100%", height:"auto"}}>
      <TimelineComponent
        startDate={startDate}
        endDate={endDate}
        initialDuration={0}
        totalDuration={duration}
        minimized={true}
        showDuration={false }
        alwaysMinimized={true}
        timeZoneOffset={0}
        componentId={"sampleApp-noLocalizedTimeSampleTimeline"} // qualify id with "<appName>-" to ensure uniqueness
      />
    </div>
  );
}

export function LocalizedTimeSampleTimeline() {
  const duration = 10 * 1000;
  const startDate = new Date("July 1, 2016, 00:00:00 GMT -0000");
  const endDate = new Date("July 1, 2016, 20:30:45 GMT -0000");
  return (
    <div style={{width:"100%", height:"auto"}}>
      <TimelineComponent
        startDate={startDate}
        endDate={endDate}
        initialDuration={0}
        totalDuration={duration}
        minimized={true}
        showDuration={false }
        alwaysMinimized={true}
        componentId={"sampleApp-localizedTimeSampleTimeline"} // qualify id with "<appName>-" to ensure uniqueness
      />
    </div>
  );
}

