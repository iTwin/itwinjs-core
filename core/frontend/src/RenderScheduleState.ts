/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert, CompressedId64Set, Id64, Id64String } from "@bentley/bentleyjs-core";
import {
  ClipPlane, ClipPrimitive, ClipVector, ConvexClipPlaneSet, Matrix3d, Plane3dByOriginAndUnitNormal, Point3d, Point4d, Range1d, Transform,
  UnionOfConvexClipPlaneSets, Vector3d,
} from "@bentley/geometry-core";
import { FeatureAppearance, RenderSchedule, RgbColor } from "@bentley/imodeljs-common";
import { DisplayStyleState } from "./DisplayStyleState";
import { IModelApp } from "./IModelApp";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { AnimationBranchState, AnimationBranchStates } from "./render/GraphicBranch";
import { RenderClipVolume } from "./render/RenderClipVolume";

function interpolate(value0: number, value1: number, fraction: number) {
  return value0 + fraction * (value1 - value0);
}
function isNullOrUndefined(value: any) { return value === undefined || value === null; }

/** @internal */
export namespace RenderScheduleState {
  class Interval {
    constructor(public index0: number = 0, public index1: number = 0, public fraction: number = 0.0) { }
    public init(index0: number, index1: number, fraction: number) { this.index0 = index0; this.index1 = index1; this.fraction = fraction; }
  }
  export class TimelineEntry implements RenderSchedule.TimelineEntryProps {
    public time: number;
    public interpolation: number;
    constructor(props: RenderSchedule.TimelineEntryProps) {
      this.time = props.time;
      this.interpolation = props.interpolation;
    }

    public toJSON(): RenderSchedule.TimelineEntryProps {
      return {
        time: this.time,
        interpolation: this.interpolation,
      };
    }
  }

  export class VisibilityEntry extends TimelineEntry implements RenderSchedule.VisibilityEntryProps {
    public value: number = 100.0;
    constructor(props: RenderSchedule.VisibilityEntryProps) {
      super(props);
      this.value = props.value;
    }

    public toJSON(): RenderSchedule.VisibilityEntryProps {
      return {
        ...super.toJSON(),
        value: this.value,
      };
    }
  }

  export class ColorEntry extends TimelineEntry implements RenderSchedule.ColorEntryProps {
    public value: { red: number, green: number, blue: number };
    constructor(props: RenderSchedule.ColorEntryProps) {
      super(props);
      this.value = props.value;
    }

    public toJSON(): RenderSchedule.ColorEntryProps {
      return {
        ...super.toJSON(),
        value: this.value,
      };
    }
  }

  export class TransformEntry extends TimelineEntry implements RenderSchedule.TransformEntryProps {
    public value: RenderSchedule.TransformProps;
    constructor(props: RenderSchedule.TransformEntryProps) {
      super(props);
      this.value = props.value;
    }

    public toJSON(): RenderSchedule.TransformEntryProps {
      return {
        ...super.toJSON(),
        value: this.value,
      };
    }
  }

  export class CuttingPlaneEntry extends TimelineEntry implements RenderSchedule.CuttingPlaneEntryProps {
    public value: RenderSchedule.CuttingPlaneProps;
    constructor(props: RenderSchedule.CuttingPlaneEntryProps) {
      super(props);
      this.value = props.value;
    }

    public toJSON(): RenderSchedule.CuttingPlaneEntryProps {
      return {
        ...super.toJSON(),
        value: this.value,
      };
    }
  }

  export class Timeline implements RenderSchedule.TimelineProps {
    public visibilityTimeline?: VisibilityEntry[];
    public colorTimeline?: ColorEntry[];
    public transformTimeline?: TransformEntry[];
    public cuttingPlaneTimeline?: CuttingPlaneEntry[];

    public extractTimelinesFromJSON(json: RenderSchedule.TimelineProps) {
      if (json.visibilityTimeline) {
        this.visibilityTimeline = [];
        json.visibilityTimeline.forEach((entry) => this.visibilityTimeline!.push(new VisibilityEntry(entry)));
      }
      if (json.colorTimeline) {
        this.colorTimeline = [];
        json.colorTimeline.forEach((entry) => this.colorTimeline!.push(new ColorEntry(entry)));
      }
      if (json.transformTimeline) {
        this.transformTimeline = [];
        json.transformTimeline.forEach((entry) => this.transformTimeline!.push(new TransformEntry(entry)));
      }
      if (json.cuttingPlaneTimeline) {
        this.cuttingPlaneTimeline = [];
        json.cuttingPlaneTimeline.forEach((entry) => this.cuttingPlaneTimeline!.push(new CuttingPlaneEntry(entry)));
      }
    }

    public toJSON(): RenderSchedule.TimelineProps {
      const visibilityTimeline = this.visibilityTimeline?.map((x) => x.toJSON());
      const colorTimeline = this.colorTimeline?.map((x) => x.toJSON());
      const transformTimeline = this.transformTimeline?.map((x) => x.toJSON());
      const cuttingPlaneTimeline = this.cuttingPlaneTimeline?.map((x) => x.toJSON());
      return {
        visibilityTimeline,
        colorTimeline,
        transformTimeline,
        cuttingPlaneTimeline,
      };
    }

    public computeDuration(): Range1d {
      const duration = Range1d.createNull();

      if (this.visibilityTimeline) this.visibilityTimeline.forEach((entry) => duration.extendX(entry.time));
      if (this.colorTimeline) this.colorTimeline.forEach((entry) => duration.extendX(entry.time));
      if (this.transformTimeline) this.transformTimeline.forEach((entry) => duration.extendX(entry.time));
      if (this.cuttingPlaneTimeline) this.cuttingPlaneTimeline.forEach((entry) => duration.extendX(entry.time));

      return duration;
    }

    public static findTimelineInterval(interval: Interval, time: number, timeline?: TimelineEntry[]) {
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
      if (undefined === this.visibilityTimeline ||
        !ElementTimeline.findTimelineInterval(interval, time, this.visibilityTimeline) && !isNullOrUndefined(this.visibilityTimeline[interval.index0].value))
        return 100.0;
      const timeline = this.visibilityTimeline;
      let visibility = timeline[interval.index0].value;
      if (visibility === undefined || visibility === null)
        return 100.0;

      if (interval.fraction > 0 && !isNullOrUndefined(timeline[interval.index1].value))
        visibility = interpolate(visibility, timeline[interval.index1].value, interval.fraction);

      return visibility;
    }

    public getColorOverride(time: number, interval: Interval): RgbColor | undefined {
      let colorOverride;
      if (undefined !== this.colorTimeline && Timeline.findTimelineInterval(interval, time, this.colorTimeline) && !isNullOrUndefined(this.colorTimeline[interval.index0].value)) {
        const entry0 = this.colorTimeline[interval.index0].value;
        if (interval.fraction > 0 && !isNullOrUndefined(this.colorTimeline[interval.index1].value)) {
          const entry1 = this.colorTimeline[interval.index1].value;
          colorOverride = new RgbColor(interpolate(entry0.red, entry1.red, interval.fraction), interpolate(entry0.green, entry1.green, interval.fraction), interpolate(entry0.blue, entry1.blue, interval.fraction));
        } else
          colorOverride = new RgbColor(entry0.red, entry0.green, entry0.blue);
      }
      return colorOverride;
    }

    public getAnimationTransform(time: number, interval: Interval): Transform | undefined {
      if (!ElementTimeline.findTimelineInterval(interval, time, this.transformTimeline) || isNullOrUndefined(this.transformTimeline![interval.index0].value))
        return undefined;

      if (interval.index0 < 0)
        return Transform.createIdentity();

      const timeline = this.transformTimeline!;
      const value = timeline[interval.index0].value;
      const transform = Transform.fromJSON(value.transform);
      if (interval.fraction > 0.0 && !isNullOrUndefined(timeline[interval.index1].value)) {
        const value1 = timeline[interval.index1].value;
        if (!isNullOrUndefined(value1.pivot) && !isNullOrUndefined(value1.orientation) && !isNullOrUndefined(value1.position)) {
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
          transform.setFromJSON({ origin: origin.interpolate(interval.fraction, origin1), matrix: interpolatedMatrix.toJSON() });
        }
      }
      return transform;
    }

    public getAnimationClip(time: number, interval: Interval): RenderClipVolume | undefined {
      if (!ElementTimeline.findTimelineInterval(interval, time, this.cuttingPlaneTimeline) || isNullOrUndefined(this.cuttingPlaneTimeline![interval.index0].value))
        return undefined;

      const timeline = this.cuttingPlaneTimeline!;
      const value = timeline[interval.index0].value;
      if (isNullOrUndefined(value))
        return undefined;

      const position = Point3d.fromJSON(value.position);
      const direction = Vector3d.fromJSON(value.direction);
      if (interval.fraction > 0.0 && !isNullOrUndefined(timeline[interval.index1].value)) {
        const value1 = timeline[interval.index1].value;
        position.interpolate(interval.fraction, Point3d.fromJSON(value1.position), position);
        direction.interpolate(interval.fraction, Vector3d.fromJSON(value1.direction), direction);
      } else {
        if (value.hidden || value.visible)
          return undefined;
      }

      direction.negate(direction);
      direction.normalizeInPlace();
      const plane = Plane3dByOriginAndUnitNormal.create(position, direction);
      const clipPlane = ClipPlane.createPlane(plane!);
      const clipPlaneSet = UnionOfConvexClipPlaneSets.createConvexSets([ConvexClipPlaneSet.createPlanes([clipPlane])]);
      const clipPrimitive = ClipPrimitive.createCapture(clipPlaneSet);
      const clipVector = ClipVector.createCapture([clipPrimitive]);
      return IModelApp.renderSystem.createClipVolume(clipVector);
    }
  }

  export class ElementTimeline extends Timeline implements RenderSchedule.ElementTimelineProps {
    public elementIds: Id64String[] | CompressedId64Set;
    public batchId: number;

    public get isValid() { return (Array.isArray(this.visibilityTimeline) && this.visibilityTimeline.length > 0) || (Array.isArray(this.colorTimeline) && this.colorTimeline.length > 0); }

    private constructor(elementIds: Id64String[] | CompressedId64Set, batchId: number) {
      super();
      this.elementIds = elementIds;
      this.batchId = batchId;
    }

    public static fromJSON(json?: RenderSchedule.ElementTimelineProps): ElementTimeline {
      if (!json)
        return new ElementTimeline([], 0);

      const val = new ElementTimeline(json.elementIds, json.batchId);
      val.extractTimelinesFromJSON(json);
      return val;
    }

    public toJSON(): RenderSchedule.ElementTimelineProps {
      return {
        ...super.toJSON(),
        batchId: this.batchId,
        elementIds: this.elementIds,
      };
    }

    public get containsFeatureOverrides() {
      return undefined !== this.visibilityTimeline || undefined !== this.colorTimeline;
    }

    public get containsClipping() {
      return undefined !== this.cuttingPlaneTimeline || (undefined !== this.colorTimeline && 0 !== this.batchId) || (undefined !== this.visibilityTimeline && 0 !== this.batchId);
    }

    public get containsTransform() {
      return this.transformTimeline !== undefined;
    }

    public getSymbologyOverrides(overrides: FeatureSymbology.Overrides, time: number, interval: Interval, batchId: number) {
      assert(0 !== batchId);

      const visibility = this.getVisibilityOverride(time, interval);
      if (visibility <= 0) {
        overrides.setAnimationNodeNeverDrawn(batchId);
        return;
      }

      let transparencyOverride;
      if (visibility < 100)
        transparencyOverride = 1.0 - visibility / 100.0;

      const colorOverride = this.getColorOverride(time, interval);

      if (colorOverride || transparencyOverride)
        overrides.overrideAnimationNode(batchId, FeatureAppearance.fromJSON({ rgb: colorOverride, transparency: transparencyOverride }));
    }
  }

  export class ModelTimeline extends Timeline implements RenderSchedule.ModelTimelineProps {
    public modelId: Id64String;
    public realityModelUrl?: string;
    public elementTimelines: ElementTimeline[] = [];
    public containsFeatureOverrides: boolean = false;
    public containsModelClipping = false;
    public containsElementClipping = false;
    public containsTransform = false;

    private constructor(modelId: Id64String) {
      super();
      this.modelId = modelId;
    }

    public computeDuration(): Range1d {
      const duration = super.computeDuration();
      this.elementTimelines.forEach((element) => duration.extendRange(element.computeDuration()));
      return duration;
    }

    public static fromJSON(json?: RenderSchedule.ModelTimelineProps, displayStyle?: DisplayStyleState) {
      if (!json)
        return new ModelTimeline("");

      let modelId = json.modelId;
      if (undefined !== json.realityModelUrl && undefined !== displayStyle) {
        displayStyle.forEachRealityModel((realityModel) => {
          if (realityModel.url === json.realityModelUrl && undefined !== realityModel.treeRef && undefined !== realityModel.treeRef.treeOwner.tileTree)
            modelId = realityModel.treeRef.treeOwner.tileTree.modelId;
        });
      }

      const value = new ModelTimeline(modelId);
      value.realityModelUrl = json.realityModelUrl;

      value.extractTimelinesFromJSON(json);
      value.containsFeatureOverrides = undefined !== value.visibilityTimeline || undefined !== value.colorTimeline;
      value.containsModelClipping = undefined !== value.cuttingPlaneTimeline;

      if (json.elementTimelines)
        json.elementTimelines.forEach((element) => {
          const elementTimeline = ElementTimeline.fromJSON(element);
          value.elementTimelines.push(elementTimeline);
          if (elementTimeline.containsFeatureOverrides)
            value.containsFeatureOverrides = true;

          if (elementTimeline.containsClipping)
            value.containsElementClipping = true;

          if (elementTimeline.containsTransform)
            value.containsTransform = true;
        });

      return value;
    }

    public toJSON(): RenderSchedule.ModelTimelineProps {
      return {
        ...super.toJSON(),
        modelId: this.modelId,
        realityModelUrl: this.realityModelUrl,
        elementTimelines: this.elementTimelines.map((x) => x.toJSON()),
      };
    }

    public getSymbologyOverrides(overrides: FeatureSymbology.Overrides, time: number) {
      const interval = new Interval();
      let transparencyOverride;

      const visibility = this.getVisibilityOverride(time, interval);

      if (visibility < 100)
        transparencyOverride = 1.0 - visibility / 100.0;

      const colorOverride = this.getColorOverride(time, interval);

      if (colorOverride || transparencyOverride) {
        overrides.overrideModel(this.modelId, FeatureAppearance.fromJSON({ rgb: colorOverride, transparency: transparencyOverride }));
      }

      this.elementTimelines.forEach((entry) => entry.getSymbologyOverrides(overrides, time, interval, entry.batchId));
    }

    private getAnimationBranch(timeline: Timeline, branchId: number, branches: AnimationBranchStates, scheduleTime: number, interval: Interval) {
      // The transform is already applied to the AnimatedTreeReference - we don't need it here.
      const transform = undefined;
      const clip = timeline.getAnimationClip(scheduleTime, interval);
      if (clip)
        branches.set(this.modelId + ((branchId < 0) ? "" : (`_Node_${branchId.toString()}`)), new AnimationBranchState(transform, clip));
    }

    public getAnimationBranches(branches: AnimationBranchStates, scheduleTime: number) {
      const interval = new Interval();
      this.getAnimationBranch(this, -1, branches, scheduleTime, interval);
      for (let i = 0; i < this.elementTimelines.length; i++) {
        const elementTimeline = this.elementTimelines[i];
        if (elementTimeline.getVisibilityOverride(scheduleTime, interval) <= 0.0) {
          branches.set(`${this.modelId}_Node_${(i + 1).toString()}`, new AnimationBranchState(undefined, undefined, true));
        } else {
          this.getAnimationBranch(elementTimeline, i + 1, branches, scheduleTime, interval);

        }
      }
    }

    public getTransformNodeIds(): number[] | undefined {
      const transformNodeIds = new Array<number>();
      for (const elementTimeline of this.elementTimelines)
        if (elementTimeline.containsTransform && elementTimeline.batchId)
          transformNodeIds.push(elementTimeline.batchId);

      return transformNodeIds.length ? transformNodeIds : undefined;
    }

    public getTransform(nodeId: number, time: number): Transform | undefined {
      const interval = new Interval();
      const elementTimeline = this.elementTimelines.find((timeline) => timeline.batchId === nodeId);
      return elementTimeline?.getAnimationTransform(time, interval);
    }
  }

  export class Script {
    public modelTimelines: ModelTimeline[] = [];
    public displayStyleId: Id64String;
    public containsElementClipping = false;
    public containsModelClipping = false;
    public containsTransform = false;
    private _cachedDuration?: Range1d;

    constructor(displayStyleId: Id64String) {
      this.displayStyleId = displayStyleId;
    }

    public static fromJSON(displayStyleId: Id64String, modelTimelines: Readonly<RenderSchedule.ModelTimelineProps[]>): Script | undefined {
      const value = new Script(displayStyleId);
      modelTimelines.forEach((entry) => value.modelTimelines.push(ModelTimeline.fromJSON(entry)));

      for (const modelTimeline of value.modelTimelines) {
        if (modelTimeline.containsModelClipping)
          value.containsModelClipping = true;

        if (modelTimeline.containsElementClipping)
          value.containsElementClipping = true;

        if (modelTimeline.containsTransform)
          value.containsTransform = true;
      }

      return value;
    }

    public toJSON(): RenderSchedule.ModelTimelineProps[] {
      return this.modelTimelines.map((x) => x.toJSON());
    }

    public getAnimationBranches(scheduleTime: number): AnimationBranchStates | undefined {
      if (!this.containsModelClipping && !this.containsElementClipping)
        return undefined;

      const animationBranches = new Map<string, AnimationBranchState>();
      this.modelTimelines.forEach((modelTimeline) => modelTimeline.getAnimationBranches(animationBranches, scheduleTime));
      return animationBranches;
    }

    public getTransformNodeIds(modelId: Id64String): number[] | undefined {
      const modelTimeline = this.modelTimelines.find((timeline) => timeline.modelId === modelId);
      return modelTimeline?.getTransformNodeIds();
    }

    public getTransform(modelId: Id64String, nodeId: number, time: number): Transform | undefined {
      const modelTimeline = this.modelTimelines.find((timeline) => timeline.modelId === modelId);
      return modelTimeline?.getTransform(nodeId, time);
    }

    public computeDuration(): Range1d {
      const duration = Range1d.createNull();
      this.modelTimelines.forEach((model) => duration.extendRange(model.computeDuration()));
      return duration;
    }

    /** This duration remains valid until the timelines' durations are altered. */
    public getCachedDuration(): Range1d {
      if (!this._cachedDuration)
        this._cachedDuration = this.computeDuration();

      return this._cachedDuration;
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
      // Only if the script contains animation (cutting plane, transform or visibility by node ID) do we require separate tilesets for animations.
      if (Id64.isTransient(modelId))
        return undefined;

      for (const modelTimeline of this.modelTimelines)
        if (modelTimeline.modelId === modelId && (modelTimeline.containsElementClipping || modelTimeline.containsTransform))
          return this.displayStyleId;

      return undefined;
    }
  }
}
