/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { RenderSchedule, RgbColor } from "@bentley/imodeljs-common";
import { Range1d, Transform, Point3d, Vector3d, Matrix3d, Plane3dByOriginAndUnitNormal, ClipPlane, ClipPrimitive, ClipVector, ConvexClipPlaneSet, UnionOfConvexClipPlaneSets, Point4d } from "@bentley/geometry-core";
import { Id64String, Id64 } from "@bentley/bentleyjs-core";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { AnimationBranchStates, AnimationBranchState, RenderClipVolume } from "./render/System";

/** @internal */
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
    public currentClip?: RenderClipVolume;
    public elementIds: Id64String[];
    public batchId: number;
    public visibilityTimeline?: VisibilityEntry[];
    public colorTimeline?: ColorEntry[];
    public transformTimeline?: TransformEntry[];
    public cuttingPlaneTimeline?: CuttingPlaneEntry[];
    public get isValid() { return this.elementIds.length > 0 && (Array.isArray(this.visibilityTimeline) && this.visibilityTimeline.length > 0) || (Array.isArray(this.colorTimeline) && this.colorTimeline.length > 0); }
    private constructor(elementIds: Id64String[], batchId: number) { this.elementIds = elementIds; this.batchId = batchId; }
    public static fromJSON(json?: RenderSchedule.ElementTimelineProps): ElementTimeline {
      if (!json)
        return new ElementTimeline([], 0);

      const val = new ElementTimeline(json.elementIds, json.batchId);
      if (json.visibilityTimeline) {
        val.visibilityTimeline = [];
        json.visibilityTimeline.forEach((entry) => val.visibilityTimeline!.push(new VisibilityEntry(entry)));
      }
      if (json.colorTimeline) {
        val.colorTimeline = [];
        json.colorTimeline.forEach((entry) => val.colorTimeline!.push(new ColorEntry(entry)));
      }
      if (json.transformTimeline) {
        val.transformTimeline = [];
        json.transformTimeline.forEach((entry) => val.transformTimeline!.push(new TransformEntry(entry)));
      }
      if (json.cuttingPlaneTimeline) {
        val.cuttingPlaneTimeline = [];
        json.cuttingPlaneTimeline.forEach((entry) => val.cuttingPlaneTimeline!.push(new CuttingPlaneEntry(entry)));
      }
      return val;
    }
    public get duration() {
      const duration = Range1d.createNull();
      if (this.visibilityTimeline) this.visibilityTimeline.forEach((entry) => duration.extendX(entry.time));
      if (this.colorTimeline) this.colorTimeline.forEach((entry) => duration.extendX(entry.time));
      if (this.transformTimeline) this.transformTimeline.forEach((entry) => duration.extendX(entry.time));
      if (this.cuttingPlaneTimeline) this.cuttingPlaneTimeline.forEach((entry) => duration.extendX(entry.time));

      return duration;
    }
    public get containsFeatureOverrides() { return undefined !== this.visibilityTimeline || undefined !== this.colorTimeline; }
    public get containsAnimation() { return undefined !== this.transformTimeline || undefined !== this.cuttingPlaneTimeline; }

    private static findTimelineInterval(interval: Interval, time: number, timeline?: TimelineEntry[]) {
      if (!timeline || timeline.length === 0)
        return false;

      if (time < timeline[0].time) {
        interval.init(0, 0, 0);
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
          interval.init(i, i + 1, timeline[i].interpolation === 2 ? ((time - timeline[i].time) / (timeline[i + 1].time - timeline[i].time)) : 0.0);
          break;
        }
      return true;
    }

    public getVisibilityOverride(time: number, interval: Interval): number {
      if (!ElementTimeline.findTimelineInterval(interval, time, this.visibilityTimeline) && this.visibilityTimeline![interval.index0].value !== null)
        return 100.0;
      const timeline = this.visibilityTimeline!;
      let visibility = timeline[interval.index0].value;
      if (visibility === undefined || visibility === null)
        return 100.0;

      if (interval.fraction > 0)
        visibility = interpolate(visibility, timeline[interval.index1].value, interval.fraction);

      return visibility;
    }

    public getSymbologyOverrides(overrides: FeatureSymbology.Overrides, time: number, interval: Interval, batchId: number) {
      let colorOverride, transparencyOverride;

      const visibility = this.getVisibilityOverride(time, interval);
      if (visibility <= 0) {
        overrides.setAnimationNodeNeverDrawn(batchId);
        return;
      }
      if (visibility <= 100)
        transparencyOverride = 1.0 - visibility / 100.0;

      if (ElementTimeline.findTimelineInterval(interval, time, this.colorTimeline) && this.colorTimeline![interval.index0].value !== null) {
        const entry0 = this.colorTimeline![interval.index0].value;
        if (interval.fraction > 0) {
          const entry1 = this.colorTimeline![interval.index1].value;
          colorOverride = new RgbColor(interpolate(entry0.red, entry1.red, interval.fraction), interpolate(entry0.green, entry1.green, interval.fraction), interpolate(entry0.blue, entry1.blue, interval.fraction));
        } else
          colorOverride = new RgbColor(entry0.red, entry0.green, entry0.blue);
      }

      if (colorOverride || transparencyOverride)
        overrides.overrideAnimationNode(batchId, FeatureSymbology.Appearance.fromJSON({ rgb: colorOverride, transparency: transparencyOverride }));
    }
    public getAnimationTransform(time: number, interval: Interval): Transform | undefined {
      if (!ElementTimeline.findTimelineInterval(interval, time, this.transformTimeline) || this.transformTimeline![interval.index0].value === null)
        return undefined;

      if (interval.index0 < 0)
        return Transform.createIdentity();

      const timeline = this.transformTimeline!;
      const value = timeline[interval.index0].value;
      const transform = Transform.fromJSON(value.transform);
      if (interval.fraction > 0.0) {
        const value1 = timeline[interval.index1].value;
        if (value1.pivot !== null && value1.orientation !== null && value1.position !== null) {
          const q0 = Point4d.fromJSON(value.orientation), q1 = Point4d.fromJSON(value1.orientation);
          const sum = Point4d.interpolateQuaternions(q0, interval.fraction, q1);
          const interpolatedMatrix = Matrix3d.createFromQuaternion(sum);
          const position0 = Vector3d.fromJSON(value.position), position1 = Vector3d.fromJSON(value1.position);
          const pivot = Vector3d.fromJSON(value.pivot);
          const pre = Transform.createTranslation(pivot);
          const post = Transform.createTranslation(position0.interpolate(interval.fraction, position1));
          const product = post.multiplyTransformMatrix3d(interpolatedMatrix);
          transform.setFromJSON(product.multiplyTransformTransform(pre));
        } else {
          const transform1 = Transform.fromJSON(value1.transform);
          const q0 = transform.matrix.inverse()!.toQuaternion(), q1 = transform1.matrix.inverse()!.toQuaternion();
          const sum = Point4d.interpolateQuaternions(q0, interval.fraction, q1);
          const interpolatedMatrix = Matrix3d.createFromQuaternion(sum);

          const origin = Vector3d.createFrom(transform.origin), origin1 = Vector3d.createFrom(transform1.origin);
          transform.setFromJSON({ origin: origin.interpolate(interval.fraction, origin1), matrix: interpolatedMatrix });
        }
      }
      return transform;
    }

    public getAnimationClip(time: number, interval: Interval): RenderClipVolume | undefined {
      if (this.currentClip) {
        this.currentClip.dispose();
        this.currentClip = undefined;
      }
      if (!ElementTimeline.findTimelineInterval(interval, time, this.cuttingPlaneTimeline) || this.cuttingPlaneTimeline![interval.index0].value === null)
        return undefined;

      const timeline = this.cuttingPlaneTimeline!;
      const value = timeline[interval.index0].value;
      if (!value)
        return undefined;

      const position = Point3d.fromJSON(value.position);
      const direction = Vector3d.fromJSON(value.direction);
      if (interval.fraction > 0.0) {
        const value1 = timeline[interval.index1].value;
        position.interpolate(interval.fraction, Point3d.fromJSON(value1.position), position);
        direction.interpolate(interval.fraction, Vector3d.fromJSON(value1.direction), direction);
      } else {
        if (value.hidden || value.visible)
          return undefined;
      }

      direction.normalizeInPlace();
      const plane = Plane3dByOriginAndUnitNormal.create(position, direction);
      const clipPlane = ClipPlane.createPlane(plane!);
      const clipPlaneSet = UnionOfConvexClipPlaneSets.createConvexSets([ConvexClipPlaneSet.createPlanes([clipPlane])]);
      const clipPrimitive = ClipPrimitive.createCapture(clipPlaneSet);
      const clipVector = ClipVector.createCapture([clipPrimitive]);

      this.currentClip = IModelApp.renderSystem.createClipVolume(clipVector);
      return this.currentClip;
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
    public getSymbologyOverrides(overrides: FeatureSymbology.Overrides, time: number) { const interval = new Interval(); this.elementTimelines.forEach((entry) => entry.getSymbologyOverrides(overrides, time, interval, entry.batchId)); }
    public forEachAnimatedId(idFunction: (id: Id64String) => void): void {
      if (this.containsAnimation) {
        for (const timeline of this.elementTimelines)
          if (timeline.containsAnimation)
            for (const id of timeline.elementIds)
              idFunction(id);
      }
    }
    public getAnimationBranches(branches: AnimationBranchStates, scheduleTime: number) {
      const interval = new Interval();
      for (let i = 0; i < this.elementTimelines.length; i++) {
        const elementTimeline = this.elementTimelines[i];
        if (elementTimeline.getVisibilityOverride(scheduleTime, interval) <= 0.0) {
          branches.set(this.modelId + "_Node_" + (i + 1).toString(), new AnimationBranchState(undefined, undefined, true));
        } else {
          const transform = elementTimeline.getAnimationTransform(scheduleTime, interval);
          const clip = elementTimeline.getAnimationClip(scheduleTime, interval);
          if (transform || clip)
            branches.set(this.modelId + "_Node_" + (i + 1).toString(), new AnimationBranchState(transform, clip));
        }
      }
    }
  }

  export class Script {
    public modelTimelines: ModelTimeline[] = [];
    public iModel: IModelConnection;
    public displayStyleId: Id64String;

    constructor(displayStyleId: Id64String, iModel: IModelConnection) { this.displayStyleId = displayStyleId; this.iModel = iModel; }
    public static fromJSON(displayStyleId: Id64String, iModel: IModelConnection, modelTimelines: RenderSchedule.ModelTimelineProps[]): Script | undefined {
      const value = new Script(displayStyleId, iModel);
      modelTimelines.forEach((entry) => value.modelTimelines.push(ModelTimeline.fromJSON(entry)));
      return value;
    }
    public get containsAnimation() {
      for (const modelTimeline of this.modelTimelines)
        if (modelTimeline.containsAnimation)
          return true;
      return false;
    }
    public getAnimationBranches(scheduleTime: number): AnimationBranchStates | undefined {
      if (!this.containsAnimation)
        return undefined;

      const animationBranches = new Map<string, AnimationBranchState>();
      this.modelTimelines.forEach((modelTimeline) => modelTimeline.getAnimationBranches(animationBranches, scheduleTime));
      return animationBranches;
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

    public getSymbologyOverrides(overrides: FeatureSymbology.Overrides, time: number) {
      this.modelTimelines.forEach((entry) => entry.getSymbologyOverrides(overrides, time));
    }
    public getModelAnimationId(modelId: Id64String): Id64String | undefined {
      if (Id64.isTransient(modelId))
        return undefined;

      for (const modelTimeline of this.modelTimelines)
        if (modelTimeline.modelId === modelId && modelTimeline.containsAnimation)
          return this.displayStyleId;

      return undefined;
    }
  }
}
