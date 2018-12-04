/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { Range1d } from "@bentley/geometry-core";
import { RgbColor } from "./ColorDef";

export namespace RenderSchedule {

  export class SymbologyOverride {
    public rgb?: RgbColor;
    public transparency?: number;
    constructor(rgb?: RgbColor, transparency?: number) { this.rgb = rgb; this.transparency = transparency; }
  }
  class Interval {
    constructor(public index0: number = 0, public index1: number = 0, public fraction: number = 0.0) { }
    public init(index0: number, index1: number, fraction: number) { this.index0 = index0; this.index1 = index1; this.fraction = fraction; }
  }
  export interface TimelineEntryProps {
    time: number;
    interpolation: number;
  }
  export class TimelineEntry implements TimelineEntryProps {
    public time: number;
    public interpolation: number;
    constructor(props: TimelineEntryProps) {
      this.time = props.time;
      this.interpolation = props.interpolation;
    }
  }

  export interface VisibilityEntryProps extends TimelineEntryProps {
    value: number;
  }
  export class VisibilityEntry extends TimelineEntry implements VisibilityEntryProps {
    public value: number = 100.0;
    constructor(props: VisibilityEntryProps) {
      super(props);
      this.value = props.value;
    }
  }
  export interface ColorEntryProps extends TimelineEntryProps {
    value: { red: number, green: number, blue: number };
  }
  export class ColorEntry extends TimelineEntry implements ColorEntryProps {
    public value: { red: number, green: number, blue: number };
    constructor(props: ColorEntryProps) {
      super(props);
      this.value = props.value;
    }
  }
  export interface ElementTimelineProps {
    elementID: Id64String;
    visibilityTimeline?: VisibilityEntryProps[];
    colorTimeline?: ColorEntryProps[];
  }
  function interpolate(value0: number, value1: number, fraction: number) {
    return value0 + fraction * (value1 - value0);
  }
  export class ElementTimeline implements ElementTimelineProps {
    public elementID: Id64String;
    public visibilityTimeline?: VisibilityEntry[];
    public colorTimeline?: ColorEntry[];
    public get isValid() { return !Id64.isInvalid(this.elementID) && (Array.isArray(this.visibilityTimeline) && this.visibilityTimeline.length > 0) || (Array.isArray(this.colorTimeline) && this.colorTimeline.length > 0); }
    private constructor(elementId: Id64String) { this.elementID = elementId; }
    public static fromJSON(json?: ElementTimelineProps): ElementTimeline {
      if (!json)
        return new ElementTimeline("");

      const val = new ElementTimeline(json.elementID);
      if (json.visibilityTimeline) {
        val.visibilityTimeline = [];
        json.visibilityTimeline.forEach((entry) => val.visibilityTimeline!.push(new VisibilityEntry(entry)));
      }
      if (json.colorTimeline) {
        val.colorTimeline = [];
        json.colorTimeline.forEach((entry) => val.colorTimeline!.push(new ColorEntry(entry)));
      }
      return val;
    }
    public get duration() {
      const duration = Range1d.createNull();
      if (this.visibilityTimeline) this.visibilityTimeline.forEach((entry) => duration.extendX(entry.time));
      if (this.colorTimeline) this.colorTimeline.forEach((entry) => duration.extendX(entry.time));

      return duration;
    }
    public get containsFeatureOverrides() { return undefined !== this.visibilityTimeline && undefined !== this.colorTimeline; }

    private static findTimelineInterval(interval: Interval, time: number, timeline?: TimelineEntry[]) {
      if (!timeline || timeline.length === 0)
        return false;

      if (time <= timeline[0].time) {
        interval.init(0, 0, 0.0);
        return true;
      }
      const last = timeline.length - 1;
      if (time >= timeline[last].time) {
        interval.init(last, last, 0.0);
        return true;
      }
      let i: number;
      for (i = 0; i < last; i++)
        if (timeline[i].time <= time && timeline[i + 1].time >= time) {
          interval.init(i, i + 1, timeline[i].interpolation ? ((time - timeline[i].time) / (timeline[i + 1].time - timeline[i].time)) : 0.0);
          break;
        }
      return true;
    }

    public getSymbologyOverrides(overrides: Map<Id64String, SymbologyOverride>, time: number) {
      const interval = new Interval();
      let override;
      if (ElementTimeline.findTimelineInterval(interval, time, this.colorTimeline)) {
        const entry0 = this.colorTimeline![interval.index0], entry1 = this.colorTimeline![interval.index1];
        const color = new RgbColor(interpolate(entry0.value.red, entry1.value.red, interval.fraction), interpolate(entry0.value.green, entry1.value.green, interval.fraction), interpolate(entry0.value.blue, entry1.value.blue, interval.fraction));
        override = new SymbologyOverride(color);
      }
      if (ElementTimeline.findTimelineInterval(interval, time, this.visibilityTimeline)) {
        const timeline = this.visibilityTimeline!;
        if (!override) override = new SymbologyOverride();
        override.transparency = 1.0 - interpolate(timeline[interval.index0].value, timeline[interval.index1].value, interval.fraction) / 100.0;
      }
      if (override)
        overrides.set(this.elementID, override);
    }
  }

  export class Script {
    public duration: Range1d = Range1d.createNull();
    public elementTimelines?: ElementTimeline[];
    public containsFeatureOverrides: boolean = false;

    public static fromJSON(elementTimelines: ElementTimelineProps[]): Script | undefined {
      if (elementTimelines.length === 0)
        return undefined;

      const value = new Script();
      value.elementTimelines = [];
      elementTimelines.forEach((entry) => {
        const elementTimeline = ElementTimeline.fromJSON(entry);
        value.elementTimelines!.push(elementTimeline);
        value.duration.extendRange(elementTimeline.duration);
        if (elementTimeline.containsFeatureOverrides)
          value.containsFeatureOverrides = true;
      });

      return value;
    }

    public getSymbologyOverrides(time: number) {
      const overrides: Map<Id64String, SymbologyOverride> = new Map<Id64String, SymbologyOverride>();
      if (this.elementTimelines)
        this.elementTimelines.forEach((entry) => entry.getSymbologyOverrides(overrides, time));

      return overrides;
    }
  }
}
