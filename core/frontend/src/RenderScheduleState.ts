/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { RenderSchedule, RgbColor } from "@bentley/imodeljs-common";
import { Range1d } from "@bentley/geometry-core";
import { Id64String } from "@bentley/bentleyjs-core";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { TileTreeModelState } from "./ModelState";

export namespace RenderScheduleState {
  class Interval {
    constructor(public index0: number = 0, public index1: number = 0, public fraction: number = 0.0) { }
    public init(index0: number, index1: number, fraction: number) { this.index0 = index0; this.index1 = index1; this.fraction = fraction; }
  }
  function interpolate(value0: number, value1: number, fraction: number) {
    return value0 + fraction * (value1 - value0);
  }
  export class TimelineEntry implements RenderSchedule.TimelineEntryProps {
    public time: number;
    public interpolation: number;
    constructor(props: RenderSchedule.TimelineEntryProps) {
      this.time = props.time;
      this.interpolation = props.interpolation;
    }
  }
  export class VisibilityEntry extends TimelineEntry implements RenderSchedule.VisibilityEntryProps {
    public value: number = 100.0;
    constructor(props: RenderSchedule.VisibilityEntryProps) {
      super(props);
      this.value = props.value;
    }
  }
  export class ColorEntry extends TimelineEntry implements RenderSchedule.ColorEntryProps {
    public value: { red: number, green: number, blue: number };
    constructor(props: RenderSchedule.ColorEntryProps) {
      super(props);
      this.value = props.value;
    }
  }

  export class TransformEntry extends TimelineEntry implements RenderSchedule.TransformEntryProps {
    public value: RenderSchedule.TransformProps;
    constructor(props: RenderSchedule.TransformEntryProps) {
      super(props);
      this.value = props.value;
    }
  }
  export class CuttingPlaneEntry extends TimelineEntry implements RenderSchedule.CuttingPlaneEntryProps {
    public value: RenderSchedule.CuttingPlaneProps;
    constructor(props: RenderSchedule.CuttingPlaneEntryProps) {
      super(props);
      this.value = props.value;
    }
  }
  export class ElementTimeline implements RenderSchedule.ElementTimelineProps {
    public elementIds: Id64String[];
    public visibilityTimeline?: VisibilityEntry[];
    public colorTimeline?: ColorEntry[];
    public transformTimeline?: TransformEntry[];
    public cuttingPlaneTimeline?: CuttingPlaneEntry[];
    public get isValid() { return this.elementIds.length > 0 && (Array.isArray(this.visibilityTimeline) && this.visibilityTimeline.length > 0) || (Array.isArray(this.colorTimeline) && this.colorTimeline.length > 0); }
    private constructor(elementIds: Id64String[]) { this.elementIds = elementIds; }
    public static fromJSON(json?: RenderSchedule.ElementTimelineProps): ElementTimeline {
      if (!json)
        return new ElementTimeline([]);

      const val = new ElementTimeline(json.elementIds);
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
    public get containsFeatureOverrides() { return undefined !== this.visibilityTimeline || undefined !== this.colorTimeline; }
    public get containsAnimation() { return undefined !== this.transformTimeline || undefined !== this.cuttingPlaneTimeline; }

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

    public getSymbologyOverrides(overrides: Map<Id64String, FeatureSymbology.Appearance>, time: number) {
      const interval = new Interval();
      let colorOverride, transparencyOverride;
      if (ElementTimeline.findTimelineInterval(interval, time, this.colorTimeline)) {
        const entry0 = this.colorTimeline![interval.index0], entry1 = this.colorTimeline![interval.index1];
        colorOverride = new RgbColor(interpolate(entry0.value.red, entry1.value.red, interval.fraction), interpolate(entry0.value.green, entry1.value.green, interval.fraction), interpolate(entry0.value.blue, entry1.value.blue, interval.fraction));
      }
      if (ElementTimeline.findTimelineInterval(interval, time, this.visibilityTimeline)) {
        const timeline = this.visibilityTimeline!;
        transparencyOverride = 1.0 - interpolate(timeline[interval.index0].value, timeline[interval.index1].value, interval.fraction) / 100.0;
      }
      if (colorOverride || transparencyOverride)
        for (let elementId of this.elementIds)
          overrides.set(elementId, FeatureSymbology.Appearance.fromJSON({ rgb: colorOverride, transparency: transparencyOverride }));
    }
  }
  export class ModelTimeline implements RenderSchedule.ModelTimelineProps {
    public modelId: Id64String;
    public elementTimelines: ElementTimeline[] = [];
    public containsFeatureOverrides: boolean = false;
    public containsAnimation: boolean = false;
    private constructor(modelId: Id64String) { this.modelId = modelId; }
    public get duration() {
      const duration = Range1d.createNull();
      this.elementTimelines.forEach((element) => duration.extendRange(element.duration));
      return duration;
    }
    public static fromJSON(json?: RenderSchedule.ModelTimelineProps) {
      if (!json)
        return new ModelTimeline("");

      const value = new ModelTimeline(json.modelId);
      if (json.elementTimelines)
        json.elementTimelines.forEach((element) => {
          const elementTimeline = ElementTimeline.fromJSON(element);
          value.elementTimelines.push(elementTimeline);
          if (elementTimeline.containsFeatureOverrides)
            value.containsFeatureOverrides = true;
          if (elementTimeline.containsAnimation)
            value.containsAnimation = true;
        });

      return value;
    }
    public getSymbologyOverrides(overrides: Map<Id64String, FeatureSymbology.Appearance>, time: number) { this.elementTimelines.forEach((entry) => entry.getSymbologyOverrides(overrides, time)); }
  }

  export class Script {
    public modelTimelines: ModelTimeline[] = [];

    public static fromJSON(modelTimelines: RenderSchedule.ModelTimelineProps[]): Script | undefined {
      const value = new Script();
      modelTimelines.forEach((entry) => value.modelTimelines.push(ModelTimeline.fromJSON(entry)));

      return value;
    }
    public get duration() {
      const duration = Range1d.createNull();
      this.modelTimelines.forEach((model) => duration.extendRange(model.duration));
      return duration;
    }
    public get containsFeatureOverrides() {
      let containsFeatureOverrides = false;
      this.modelTimelines.forEach((entry) => { if (entry.containsFeatureOverrides) containsFeatureOverrides = true; });
      return containsFeatureOverrides;
    }

    public getSymbologyOverrides(time: number) {
      const overrides: Map<Id64String, FeatureSymbology.Appearance> = new Map<Id64String, FeatureSymbology.Appearance>();
      this.modelTimelines.forEach((entry) => entry.getSymbologyOverrides(overrides, time));

      return overrides;
    }
    public forEachAnimationModel(_func: (model: TileTreeModelState) => void): void {
    }
  }
}
