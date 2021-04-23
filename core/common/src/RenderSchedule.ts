/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { assert, CompressedId64Set, Constructor, Id64, Id64String } from "@bentley/bentleyjs-core";
import {
  ClipPlane, ClipPrimitive, ClipVector, ConvexClipPlaneSet, Matrix3d, Plane3dByOriginAndUnitNormal, Point3d, Point4d, Range1d, Transform, UnionOfConvexClipPlaneSets, Vector3d, XYAndZ,
} from "@bentley/geometry-core";
import { RgbColor } from "./RgbColor";
import { FeatureAppearance, FeatureOverrides } from "./FeatureSymbology";

function interpolate(start: number, end: number, fraction: number): number {
  return start + fraction * (end - start);
}

function interpolateRgb(start: RgbColor, end: RgbColor, fraction: number): RgbColor {
  return new RgbColor(interpolate(start.r, end.r, fraction), interpolate(start.g, end.g, fraction), interpolate(start.b, end.b, fraction));
}

/**
 * A schedule (or script)  for controlling the visibility, position and symbology of a series of elements over a period of time.
 * A schedule script is exposed through [[DisplayStyleSettingsProps]].
 * @beta
 */
export namespace RenderSchedule {
  export enum Interpolation {
    Step = 1,
    Linear = 2,
  }

  /** JSON representation of a [[TimelineEntry]]. */
  export interface TimelineEntryProps {
    /** The time point in seconds in the [Unix Epoch](https://en.wikipedia.org/wiki/Unix_time). */
    time: number;
    /** Interpolation value from synchro.  2 is linear, else currently treated as step.  */
    /** How to interpolate from this entry to the next in the timeline.
     * Currently, anything other than [[Interpolation.Linear]] is treated as [[Interpolation.Step]].
     * Additional interpolation modes may become supported in the future.
     */
    interpolation?: Interpolation;
  }

  /** JSON representation of a [[VisibilityEntry]]. */
  export interface VisibilityEntryProps extends TimelineEntryProps {
    /** Visibility of the geometry from 0 (invisible) to 100 (fully visible), with intermediate values appearing increasingly less transparent.
     * Default: 100 (fully visible).
     */
    value?: number;
  }

  /** JSON representation of a [[ColorEntry]]. */
  export interface ColorEntryProps extends TimelineEntryProps {
    /** The color applied to the geometry, with each component specified as an integer in [0, 255].
     * e.g., (0, 0, 0) represents black and (255, 255, 255) represents white.
     * If `undefined`, the geometry is displayed in its actual color.
     */
    value?: { red: number, green: number, blue: number };
  }

  /** JSON representation of a [[CuttingPlane]]. */
  export interface CuttingPlaneProps {
    /** (x,y,z) of the plane position */
    position: number[];
    /** (x, y, z) of the plane direction (towards the clip) */
    direction: number[];
    /** If true, the clip plane is ignored and the geometry is displayed unclipped. */
    visible?: boolean;
    /** If true, the clip plane is ignored and the geometry is not displayed. */
    hidden?: boolean;
  }

  /** JSON representation of a [[CuttingPlaneEntry]]. */
  export interface CuttingPlaneEntryProps extends TimelineEntryProps {
    /** The clip plane, or undefined if the geometry is not clipped. */
    value?: CuttingPlaneProps;
  }

  /** JSON representation of a [Transform]($geometry-core) associated with a [[TransformEntryProps]]. */
  export interface TransformProps {
    /** (x, y, z) of position  - applied after rotation.
     * This value is preserved but unused by iTwin.js.
     * @internal
     */
    position?: number[];
    /** quaternion representing rotation.
     * This value is preserved but unused by iTwin.js.
     * @internal
     */
    orientation?: number[];
    /** x, y, z) of pivot - applied before rotation.
     * This value is preserved but unused by iTwin.js.
     * @internal
     */
    pivot?: number[];
    /** 3 X 4 transformation matrix containing 3 arrays of matrix rows consisting of 4 numbers each: [qx qy qz ax]
     * where the fourth columnn in each row holds the translation.
     * `undefined` is equivalent to an identity transform.
     */
    transform?: number[][];
  }

  /** JSON representation of a [[TransformEntry]]. */
  export interface TransformEntryProps extends TimelineEntryProps {
    /** The transformation matrix, with `undefined` corresponding to an identity matrix. */
    value?: TransformProps;
  }

  /** Timeline properties (extended by element, model and reality model timelines. */
  export interface TimelineProps {
    visibilityTimeline?: VisibilityEntryProps[];
    colorTimeline?: ColorEntryProps[];
    transformTimeline?: TransformEntryProps[];
    cuttingPlaneTimeline?: CuttingPlaneEntryProps[];
  }

  /** Animation timeline entries that apply to one or more elements. */
  export interface ElementTimelineProps extends TimelineProps {
    batchId: number;
    /** The Ids of the elements to which this timeline applies.
     * @note For a [[DisplayStyleSettingsProps]] associated with a [DisplayStyleState]($frontend) obtained via [IModelConnection.Views.load]($frontend),
     * this property will be an empty `CompressedId64Set`. They are omitted to conserve bandwidth and memory - they are not needed for display on the frontend.
     */
    elementIds: Id64String[] | CompressedId64Set;
  }

  /** Animation timeline for a single model.  */
  export interface ModelTimelineProps extends TimelineProps {
    modelId: Id64String;
    realityModelUrl?: string;     // defined only for "context" reality models (attached through display style)
    elementTimelines: ElementTimelineProps[];
  }

  export type ScriptProps = ModelTimelineProps[];

  export class TimelineEntry {
    public readonly time: number;
    public readonly interpolation: Interpolation;

    public constructor(props: TimelineEntryProps) {
      this.time = props.time;
      this.interpolation = props.interpolation === Interpolation.Linear ? props.interpolation : Interpolation.Step;
    }

    public toJSON(): TimelineEntryProps {
      const props: TimelineEntryProps = {
        time: this.time,
      };

      if (this.interpolation === Interpolation.Linear)
        props.interpolation = this.interpolation;

      return props;
    }
  }

  export class VisibilityEntry extends TimelineEntry {
    public readonly value: number;

    public constructor(props: VisibilityEntryProps) {
      super(props);
      if (typeof props.value !== "number")
        this.value = 100;
      else
        this.value = Math.max(0, Math.min(100, props.value));
    }

    public toJSON(): VisibilityEntryProps {
      const props = super.toJSON() as VisibilityEntryProps;
      if (100 !== this.value)
        props.value = this.value;

      return props;
    }
  }

  export class ColorEntry extends TimelineEntry {
    public readonly value: RgbColor | undefined;

    public constructor(props: ColorEntryProps) {
      super(props);
      if (props.value)
        this.value = new RgbColor(props.value.red, props.value.green, props.value.blue);
    }

    public toJSON(): ColorEntryProps {
      const props = super.toJSON() as ColorEntryProps;
      if (this.value) {
        props.value = {
          red: this.value.r,
          green: this.value.g,
          blue: this.value.b,
        };
      }

      return props;
    }
  }

  export class TransformEntry extends TimelineEntry {
    public readonly value: Readonly<Transform>;
    private readonly _value?: TransformProps;

    public constructor(props: TransformEntryProps) {
      super(props);
      this.value = props.value ? Transform.fromJSON(props.value.transform) : Transform.identity;
      if (props.value)
        this._value = { ...props.value };
    }

    public toJSON(): TransformEntryProps {
      const props = super.toJSON() as TransformEntryProps;
      if (this._value)
        props.value = { ...this._value };

      return props;
    }
  }

  export class CuttingPlane {
    public readonly position: XYAndZ;
    public readonly direction: XYAndZ;
    public readonly visible: boolean;
    public readonly hidden: boolean;

    public constructor(props: CuttingPlaneProps) {
      this.position = Point3d.fromJSON(props.position);
      this.direction = Point3d.fromJSON(props.direction);
      this.hidden = true === props.hidden;
      this.visible = true === props.visible;
    }

    public toJSON(): CuttingPlaneProps {
      const props: CuttingPlaneProps = {
        position: [ this.position.x, this.position.y, this.position.z ],
        direction: [ this.direction.x, this.direction.y, this.direction.z ],
      };

      if (this.visible)
        props.visible = true;

      if (this.hidden)
        props.hidden = true;

      return props;
    }
  }

  export class CuttingPlaneEntry extends TimelineEntry {
    public readonly value: CuttingPlane | undefined;

    public constructor(props: CuttingPlaneEntryProps) {
      super(props);
      if (props.value)
        this.value = new CuttingPlane(props.value);
    }

    public toJSON(): CuttingPlaneEntryProps {
      const props = super.toJSON() as CuttingPlaneEntryProps;
      if (this.value)
        props.value = this.value.toJSON();

      return props;
    }
  }

  export class Interval {
    public lowerIndex!: number;
    public upperIndex!: number;
    public fraction!: number;

    public constructor(lower = 0, upper = 0, fraction = 0) {
      this.init(lower, upper, fraction);
    }

    public init(lower = 0, upper = 0, fraction = 0): void {
      this.lowerIndex = lower;
      this.upperIndex = upper;
      this.fraction = fraction;
    }
  }

  export class TimelineEntryList<T extends TimelineEntry & { readonly value: V }, P extends TimelineEntryProps, V> {
    private readonly _entries: ReadonlyArray<T>;
    public readonly duration: Range1d;

    public constructor(props: P[], ctor: Constructor<T>) {
      this.duration = Range1d.createNull();
      this._entries = props.map((x) => {
        const entry = new ctor(x);
        this.duration.extendX(entry.time);
        return entry;
      });
    }

    public get length(): number {
      return this._entries.length;
    }

    public [Symbol.iterator](): Iterator<T> {
      return this._entries[Symbol.iterator]();
    }

    public getEntry(index: number): T | undefined {
      return this._entries[index];
    }

    public getValue(index: number): V | undefined {
      return this.getEntry(index)?.value;
    }

    public toJSON(): P[] {
      return this._entries.map((x) => x.toJSON() as P);
    }

    public findInterval(time: number, interval?: Interval): Interval | undefined {
      if (this.length === 0)
        return undefined;

      interval = interval ?? new Interval();
      if (time < this._entries[0].time) {
        interval.init(0, 0, 0);
        return interval;
      }

      const last = this.length - 1;
      if (time >= this._entries[last].time) {
        interval.init(last, last, 0);
        return interval;
      }

      for (let i = 0; i < last; i++) {
        const time0 = this._entries[i].time;
        const time1 = this._entries[i + 1].time;
        if (time0 <= time && time1 >= time) {
          let fraction;
          if (Interpolation.Linear === this._entries[i].interpolation)
            fraction = (time - time0) / (time1 - time0);
          else
            fraction = 0;

          interval.init(i, i + 1, fraction);
          return interval;
        }
      }

      return undefined;
    }
  }

  const scratchInterval = new Interval();

  export class VisibilityTimelineEntries extends TimelineEntryList<VisibilityEntry, VisibilityEntryProps, number> {
    public getValue(index: number): number {
      return super.getValue(index) ?? 100;
    }
  }

  export class TransformTimelineEntries extends TimelineEntryList<TransformEntry, TransformEntryProps, Readonly<Transform>> {
    public getValue(index: number): Readonly<Transform> {
      return super.getValue(index) ?? Transform.identity;
    }
  }

  export class Timeline {
    public readonly visibility?: VisibilityTimelineEntries;
    public readonly color?: TimelineEntryList<ColorEntry, ColorEntryProps, RgbColor | undefined>;
    public readonly transform?: TransformTimelineEntries;
    public readonly cuttingPlane?: TimelineEntryList<CuttingPlaneEntry, CuttingPlaneEntryProps, CuttingPlane | undefined>;
    public readonly duration: Range1d;

    public constructor(props: TimelineProps) {
      this.duration = Range1d.createNull();

      if (props.visibilityTimeline) {
        this.visibility = new VisibilityTimelineEntries(props.visibilityTimeline, VisibilityEntry);
        this.duration.extendRange(this.visibility.duration);
      }

      if (props.colorTimeline) {
        this.color = new TimelineEntryList(props.colorTimeline, ColorEntry);
        this.duration.extendRange(this.color.duration);
      }

      if (props.transformTimeline) {
        this.transform = new TransformTimelineEntries(props.transformTimeline, TransformEntry);
        this.duration.extendRange(this.transform.duration);
      }

      if (props.cuttingPlaneTimeline) {
        this.cuttingPlane = new TimelineEntryList(props.cuttingPlaneTimeline, CuttingPlaneEntry);
        this.duration.extendRange(this.cuttingPlane.duration);
      }
    }

    public toJSON(): TimelineProps {
      return {
        visibilityTimeline: this.visibility?.toJSON(),
        colorTimeline: this.color?.toJSON(),
        transformTimeline: this.transform?.toJSON(),
        cuttingPlaneTimeline: this.cuttingPlane?.toJSON(),
      };
    }

    public getVisibility(time: number): number {
      let interval;
      if (!this.visibility || !(interval = this.visibility.findInterval(time, scratchInterval)))
        return 100;

      let visibility = this.visibility.getValue(interval.lowerIndex) ?? 100;
      if (interval.fraction > 0)
        visibility = interpolate(visibility, this.visibility.getValue(interval.upperIndex) ?? 100, interval.fraction);

      return visibility;
    }

    public getColor(time: number): RgbColor | undefined {
      let interval;
      if (!this.color || !(interval = this.color.findInterval(time, scratchInterval)))
        return undefined;

      const start = this.color.getValue(interval.lowerIndex);
      if (start && interval.fraction > 0) {
        const end = this.color.getValue(interval.upperIndex);
        if (end)
          return interpolateRgb(start, end, interval.fraction);
      }

      return start;
    }

    public getAnimationTransform(time: number): Readonly<Transform> {
      let interval;
      if (!this.transform || !(interval = this.transform.findInterval(time, scratchInterval)))
        return Transform.identity;

      let transform = this.transform.getValue(interval.lowerIndex);
      if (interval.fraction > 0) {
        const end = this.transform.getValue(interval.upperIndex);
        const q0 = transform.matrix.inverse()?.toQuaternion();
        const q1 = end.matrix.inverse()?.toQuaternion();
        if (q0 && q1) {
          const sum = Point4d.interpolateQuaternions(q0, interval.fraction, q1);
          const matrix = Matrix3d.createFromQuaternion(sum);

          const origin0 = Vector3d.createFrom(transform.origin);
          const origin1 = Vector3d.createFrom(end.origin);
          transform = Transform.createRefs(origin0.interpolate(interval.fraction, origin1), matrix);
        }
      }

      return transform;
    }

    public getCuttingPlane(time: number): Plane3dByOriginAndUnitNormal | undefined {
      let interval;
      if (!this.cuttingPlane || !(interval = this.cuttingPlane.findInterval(time, scratchInterval)))
        return undefined;

      const start = this.cuttingPlane.getValue(interval.lowerIndex);
      if (!start)
        return undefined;

      const position = Point3d.createFrom(start.position);
      const direction = Vector3d.createFrom(start.direction);
      const end = interval.fraction > 0 ? this.cuttingPlane.getValue(interval.upperIndex) : undefined;
      if (end) {
        position.interpolate(interval.fraction, end.position, position);
        direction.interpolate(interval.fraction, end.direction, direction);
      } else {
        if (start.hidden || start.visible)
          return undefined;
      }

      direction.negate(direction);
      direction.normalizeInPlace();

      return Plane3dByOriginAndUnitNormal.create(position, direction);
    }

    public getClipVector(time: number): ClipVector | undefined {
      const plane = this.getCuttingPlane(time);
      if (!plane)
        return undefined;

      const cp = ClipPlane.createPlane(plane);
      const cps = UnionOfConvexClipPlaneSets.createConvexSets([ConvexClipPlaneSet.createPlanes([cp])]);
      const prim = ClipPrimitive.createCapture(cps);
      return ClipVector.createCapture([prim]);
    }

    protected getFeatureAppearance(visibility: number, time: number): FeatureAppearance | undefined {
      const transparency = visibility < 100 ? (1 - visibility / 100) : undefined;
      const rgb = this.getColor(time);
      return undefined !== rgb || undefined !== transparency ? FeatureAppearance.fromJSON({ rgb, transparency }) : undefined;
    }
  }

  export class ElementTimeline extends Timeline {
    public readonly batchId: number;
    private readonly _elementIds: Id64String[] | CompressedId64Set;

    private constructor(props: ElementTimelineProps) {
      super(props);
      this.batchId = props.batchId;
      this._elementIds = props.elementIds;
    }

    public static fromJSON(props?: ElementTimelineProps): ElementTimeline {
      return new ElementTimeline(props ?? { elementIds: [], batchId: 0 });
    }

    public toJSON(): ElementTimelineProps {
      return {
        ...super.toJSON(),
        batchId: this.batchId,
        elementIds: this._elementIds,
      };
    }

    public get elementIds(): Iterable<Id64String> {
      if (typeof this._elementIds === "string")
        return CompressedId64Set.iterable(this._elementIds);
      else
        return this._elementIds;
    }

    public get containsFeatureOverrides(): boolean {
      return undefined !== this.visibility || undefined !== this.color;
    }

    public get containsClipping(): boolean {
      if (this.cuttingPlane)
        return true;

      return this.batchId !== 0 && (undefined !== this.color || undefined !== this.visibility);
    }

    public get containsTransform(): boolean {
      return undefined !== this.transform;
    }

    public addSymbologyOverrides(overrides: FeatureOverrides, time: number): void {
      assert(0 !== this.batchId);

      const vis = this.getVisibility(time);
      if (vis <= 0) {
        overrides.setAnimationNodeNeverDrawn(this.batchId);
        return;
      }

      const appearance = this.getFeatureAppearance(vis, time);
      if (appearance)
        overrides.overrideAnimationNode(this.batchId, appearance);
    }
  }

  export class ModelTimeline extends Timeline {
    public readonly modelId: Id64String;
    public readonly realityModelUrl?: string;
    public readonly elementTimelines: ReadonlyArray<ElementTimeline>;
    public readonly transformBatchIds: ReadonlyArray<number>;
    public readonly containsFeatureOverrides: boolean;
    public readonly containsModelClipping: boolean;
    public readonly containsElementClipping: boolean;
    public readonly containsTransform: boolean;

    private constructor(props: ModelTimelineProps) {
      super(props);

      this.modelId = props.modelId;
      this.realityModelUrl = props.realityModelUrl;
      this.containsModelClipping = undefined !== this.cuttingPlane;

      let containsFeatureOverrides = undefined !== this.visibility || undefined !== this.color;
      let containsElementClipping = false;
      let containsTransform = false;

      const transformBatchIds: number[] = [];
      const elementTimelines: ElementTimeline[] = [];

      for (const elProps of props.elementTimelines) {
        const el = ElementTimeline.fromJSON(elProps);
        elementTimelines.push(el);

        this.duration.extendRange(el.duration);

        if (el.containsTransform) {
          containsTransform = true;
          if (el.batchId)
            transformBatchIds.push(el.batchId);
        }

        containsFeatureOverrides ||= el.containsFeatureOverrides;
        containsElementClipping ||= el.containsClipping;
      }

      this.elementTimelines = elementTimelines;
      this.transformBatchIds = transformBatchIds;

      this.containsFeatureOverrides = containsFeatureOverrides;
      this.containsElementClipping = containsElementClipping;
      this.containsTransform = containsTransform;
    }

    public static fromJSON(props?: ModelTimelineProps): ModelTimeline {
      return new ModelTimeline(props ?? { elementTimelines: [], modelId: Id64.invalid });
    }

    public toJSON(): ModelTimelineProps {
      return {
        ...super.toJSON(),
        modelId: this.modelId,
        realityModelUrl: this.realityModelUrl,
        elementTimelines: this.elementTimelines.map((x) => x.toJSON()),
      };
    }

    public findByBatchId(batchId: number): ElementTimeline | undefined {
      return this.elementTimelines.find((x) => x.batchId === batchId);
    }

    public addSymbologyOverrides(overrides: FeatureOverrides, time: number): void {
      const appearance = this.getFeatureAppearance(this.getVisibility(time), time);
      if (appearance)
        overrides.overrideModel(this.modelId, appearance);

      for (const timeline of this.elementTimelines)
        timeline.addSymbologyOverrides(overrides, time);
    }

    public getTransform(batchId: number, time: number): Readonly<Transform> | undefined {
      return this.findByBatchId(batchId)?.getAnimationTransform(time);
    }
  }

  export class Script {
    public readonly modelTimelines: ReadonlyArray<ModelTimeline>;
    public readonly containsModelClipping: boolean;
    public readonly containsElementClipping: boolean;
    public readonly containsTransform: boolean;
    public readonly duration: Range1d;

    protected constructor(props: ScriptProps) {
      this.duration = Range1d.createNull();

      const modelTimelines: ModelTimeline[] = [];
      let containsModelClipping = false;
      let containsElementClipping = false;
      let containsTransform = false;

      for (const modelProps of props) {
        const model = ModelTimeline.fromJSON(modelProps);
        modelTimelines.push(model);

        this.duration.extendRange(model.duration);

        containsModelClipping ||= model.containsModelClipping;
        containsElementClipping ||= model.containsElementClipping;
        containsTransform ||= model.containsTransform;
      }

      this.modelTimelines = modelTimelines;
      this.containsModelClipping = containsModelClipping;
      this.containsElementClipping = containsElementClipping;
      this.containsTransform = containsTransform;
    }

    public static fromJSON(props: ScriptProps): Script | undefined {
      if (!Array.isArray(props) || props.length === 0)
        return undefined;

      return new Script(props);
    }

    public toJSON(): ScriptProps {
      return this.modelTimelines.map((x) => x.toJSON());
    }

    public find(modelId: Id64String): ModelTimeline | undefined {
      return this.modelTimelines.find((x) => x.modelId === modelId);
    }

    public getTransformBatchIds(modelId: Id64String): ReadonlyArray<number> | undefined {
      return this.find(modelId)?.transformBatchIds;
    }

    public getTransform(modelId: Id64String, batchId: number, time: number): Readonly<Transform> | undefined {
      return this.find(modelId)?.getTransform(batchId, time);
    }

    public addSymbologyOverrides(overrides: FeatureOverrides, time: number): void {
      for (const timeline of this.modelTimelines)
        timeline.addSymbologyOverrides(overrides, time);
    }
  }

  export class ScriptReference {
    public readonly sourceId: Id64String;
    public readonly script: Script;

    public constructor(sourceId: Id64String, script: Script) {
      this.sourceId = sourceId;
      this.script = script;
    }

    public getModelAnimationId(modelId: Id64String): Id64String | undefined {
      // Only if the script contains animation (cutting plane, transform or visibility by node ID) do we require separate tilesets for animations.
      if (Id64.isTransient(modelId))
        return undefined;

      for (const modelTimeline of this.script.modelTimelines)
        if (modelTimeline.modelId === modelId && (modelTimeline.containsElementClipping || modelTimeline.containsTransform))
          return this.sourceId;

      return undefined;
    }
  }
}
