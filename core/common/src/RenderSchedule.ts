/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import {
  assert, compareBooleans, compareNumbers, comparePossiblyUndefined, compareStrings, compareStringsOrUndefined,
  CompressedId64Set, ConcreteEntityIdSet, Constructor, Id64, Id64String, OrderedId64Iterable,
} from "@itwin/core-bentley";
import {
  ClipPlane, ClipPrimitive, ClipVector, ConvexClipPlaneSet, Matrix3d, Plane3dByOriginAndUnitNormal, Point3d, Point4d, Range1d, Transform, UnionOfConvexClipPlaneSets, Vector3d, XYAndZ,
} from "@itwin/core-geometry";
import { RgbColor } from "./RgbColor";
import { FeatureAppearance, FeatureOverrides } from "./FeatureSymbology";

function interpolate(start: number, end: number, fraction: number): number {
  return start + fraction * (end - start);
}

function interpolateRgb(start: RgbColor, end: RgbColor, fraction: number): RgbColor {
  return new RgbColor(interpolate(start.r, end.r, fraction), interpolate(start.g, end.g, fraction), interpolate(start.b, end.b, fraction));
}

function compareXYZ(lhs: XYAndZ, rhs: XYAndZ): number {
  return compareNumbers(lhs.x, rhs.x) || compareNumbers(lhs.y, rhs.y) || compareNumbers(lhs.z, rhs.z);
}

function compare4d(lhs: Point4d, rhs: Point4d): number {
  return compareNumbers(lhs.x, rhs.x) || compareNumbers(lhs.y, rhs.y) || compareNumbers(lhs.z, rhs.z) || compareNumbers(lhs.w, rhs.w);
}

const scratchVec3a = new Vector3d();
const scratchVec3b = new Vector3d();
function compareMatrices(lhs: Matrix3d, rhs: Matrix3d): number {
  return compareXYZ(lhs.columnX(scratchVec3a), rhs.columnX(scratchVec3b))
    || compareXYZ(lhs.columnY(scratchVec3a), rhs.columnY(scratchVec3b))
    || compareXYZ(lhs.columnZ(scratchVec3a), rhs.columnZ(scratchVec3b));
}

function compareDurations(lhs: Range1d, rhs: Range1d): number {
  return compareNumbers(lhs.low, rhs.low) || compareNumbers(lhs.high, rhs.high);
}

/** Namespace containing types that collectively define a script that animates the contents of a view by adjusting the visibility, position,
 * and/or symbology of groups of elements over time. A [[RenderSchedule.Script]] is hosted by a [RenderTimeline]($backend) element. The script
 * can be associated with a [DisplayStyleState]($frontend) by way of its [[DisplayStyleSettings.renderTimeline]] property.
 * @public
 */
export namespace RenderSchedule {
  /** Defines how two interpolate between two entries in a [[RenderSchedule.Timeline]].
   * @note Currently only Linear and Step are supported. Any other value is treated as Step.
   * @see [[RenderSchedule.TimelineEntry]].
   */
  export enum Interpolation {
    /** Each timeline entry's value is discrete - the timeline jumps from one entry's value directly to another. */
    Step = 1,
    /** Given two entries on the timeline and a timepoint in between them, linearly interpolate based on the timepoint's distance between the
     * two entries.
     */
    Linear = 2,
  }

  /** JSON representation of a [[RenderSchedule.TimelineEntry]]. */
  export interface TimelineEntryProps {
    /** The time point in seconds in the [Unix Epoch](https://en.wikipedia.org/wiki/Unix_time). */
    time: number;
    /** How to interpolate from this entry to the next entry in the timeline.
     * Currently, anything other than [[RenderSchedule.Interpolation.Linear]] is treated as [[RenderSchedule.Interpolation.Step]].
     * Additional interpolation modes may become supported in the future.
     */
    interpolation?: Interpolation;
  }

  /** JSON representation of a [[RenderSchedule.VisibilityEntry]]. */
  export interface VisibilityEntryProps extends TimelineEntryProps {
    /** Visibility of the geometry from 0 (invisible) to 100 (fully visible), with intermediate values appearing increasingly less transparent.
     * Default: 100 (fully visible).
     */
    value?: number;
  }

  /** JSON representation of a [[RenderSchedule.ColorEntry]]. */
  export interface ColorEntryProps extends TimelineEntryProps {
    /** The color applied to the geometry, with each component specified as an integer in [0, 255].
     * e.g., (0, 0, 0) represents black and (255, 255, 255) represents white.
     * If `undefined`, the geometry is displayed in its actual color.
     */
    value?: { red: number, green: number, blue: number };
  }

  /** JSON representation of a [[RenderSchedule.CuttingPlane]]. */
  export interface CuttingPlaneProps {
    /** (x,y,z) of a point on the plane. */
    position: number[];
    /** (x, y, z) of the plane direction (towards the clip) */
    direction: number[];
    /** If true, the clip plane is ignored and the geometry is displayed unclipped. */
    visible?: boolean;
    /** If true, the clip plane is ignored and the geometry is not displayed. */
    hidden?: boolean;
  }

  /** JSON representation of a [[RenderSchedule.CuttingPlaneEntry]]. */
  export interface CuttingPlaneEntryProps extends TimelineEntryProps {
    /** The clip plane, or undefined if the geometry is not clipped. */
    value?: CuttingPlaneProps;
  }

  /** JSON representation of a [[RenderSchedule.TransformComponents]]. */
  export interface TransformComponentsProps {
    /** (x, y, z) of position  - applied after rotation. */
    position?: number[];
    /** Quaternion representing rotation. */
    orientation?: number[];
    /** (x, y, z) of pivot - applied before rotation. */
    pivot?: number[];
  }

  /** JSON representation of a [Transform]($core-geometry) associated with a [[RenderSchedule.TransformEntryProps]]. */
  export interface TransformProps extends TransformComponentsProps {
    /** 3 X 4 transformation matrix containing 3 arrays of matrix rows consisting of 4 numbers each: [qx qy qz ax]
     * where the fourth columnn in each row holds the translation.
     * `undefined` is equivalent to an identity transform.
     * This transform is only used if position, orientation, and/or pivot are undefined.
     */
    transform?: number[][];
  }

  /** JSON representation of a [[RenderSchedule.TransformEntry]]. */
  export interface TransformEntryProps extends TimelineEntryProps {
    /** The transformation matrix, with `undefined` corresponding to an identity matrix. */
    value?: TransformProps;
  }

  /** JSON representation of a [[RenderSchedule.Timeline]]. */
  export interface TimelineProps {
    /** Timeline controlling the visibility of the associated geometry. */
    visibilityTimeline?: VisibilityEntryProps[];
    /** Timeline controlling the colors of the associated geometry. */
    colorTimeline?: ColorEntryProps[];
    /** Timeline applying transforms to the associated geometry. */
    transformTimeline?: TransformEntryProps[];
    /** Timeline applying [ClipVector]($core-geometry)s to the associated geometry. */
    cuttingPlaneTimeline?: CuttingPlaneEntryProps[];
  }

  /** JSON representation of an [[RenderSchedule.ElementTimeline]]. */
  export interface ElementTimelineProps extends TimelineProps {
    /** A positive integer that uniquely identifies this timeline among all element timelines in the [[RenderSchedule.Script]]. */
    batchId: number;
    /** The Ids of the elements to which this timeline applies.
     * @note Prefer the compressed representation - lists of element Ids can be comparatively enormous.
     * @note For a [[DisplayStyleSettingsProps]] associated with a [DisplayStyleState]($frontend) obtained via [IModelConnection.Views.load]($frontend),
     * this property will be an empty `CompressedId64Set`. They are omitted to conserve bandwidth and memory because they are not needed for display on the frontend.
     */
    elementIds: Id64String[] | CompressedId64Set;
  }

  /** JSON representation of a [[RenderSchedule.ModelTimeline]]. */
  export interface ModelTimelineProps extends TimelineProps {
    /** The Id of the [GeometricModelState]($frontend) to which the timeline applies. */
    modelId: Id64String;
    /** @alpha */
    realityModelUrl?: string; // defined only for "context" reality models (attached through display style)
    /** Timelines affecting groups of elements. */
    elementTimelines: ElementTimelineProps[];
  }

  /** JSON representation of a [[RenderSchedule.Script]]. */
  export type ScriptProps = ModelTimelineProps[];

  /** Describes the value of some property at a specific point along a [[RenderSchedule.Timeline]].
   * @see [[RenderSchedule.VisibilityEntry]]
   * @see [[RenderSchedule.ColorEntry]]
   * @see [[RenderSchedule.TransformEntry]]
   * @see [[RenderSchedule.CuttingPlaneEntry]]
   */
  export class TimelineEntry {
    /** The time point in seconds in the [Unix Epoch](https://en.wikipedia.org/wiki/Unix_time). */
    public readonly time: number;
    /** How to interpolate from this entry to the next entry in the timeline. */
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

    public compareTo(other: TimelineEntry): number {
      return compareNumbers(this.interpolation, other.interpolation) || compareNumbers(this.time, other.time);
    }

    public equals(other: TimelineEntry): boolean {
      return 0 === this.compareTo(other);
    }
  }

  /** A timeline entry that controls the visibility of the associated geometry. */
  export class VisibilityEntry extends TimelineEntry {
    /** The visibility of the geometry at this point on the timeline, in the range [0, 100] where 0 is completely invisible, 100 is completely visible,
     * and values in between indicate increasing opacity.
     */
    public readonly value: number;

    public constructor(props: VisibilityEntryProps) {
      super(props);
      if (typeof props.value !== "number")
        this.value = 100;
      else
        this.value = Math.max(0, Math.min(100, props.value));
    }

    public override toJSON(): VisibilityEntryProps {
      const props = super.toJSON() as VisibilityEntryProps;
      if (100 !== this.value)
        props.value = this.value;

      return props;
    }

    public override compareTo(other: VisibilityEntry): number {
      assert(other instanceof VisibilityEntry);
      return super.compareTo(other) || compareNumbers(this.value, other.value);
    }
  }

  /** A timeline entry controlling the color of the affected geometry. */
  export class ColorEntry extends TimelineEntry {
    /** If defined, the color in which to draw the geometry. If undefined, the geometry is drawn in its actual color. */
    public readonly value: RgbColor | undefined;

    public constructor(props: ColorEntryProps) {
      super(props);
      if (props.value)
        this.value = new RgbColor(props.value.red, props.value.green, props.value.blue);
    }

    public override toJSON(): ColorEntryProps {
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

    public override compareTo(other: ColorEntry): number {
      assert(other instanceof ColorEntry);
      return super.compareTo(other) || comparePossiblyUndefined((lhs, rhs) => lhs.compareTo(rhs), this.value, other.value);
    }
  }

  /** Describes the components of a [[RenderSchedule.TransformEntry]] as a rotation around a pivot point followed by a translation. */
  export class TransformComponents {
    /** Pivot point - applied before rotation. */
    public readonly pivot: Vector3d;
    /** Quaternion rotation. */
    public readonly orientation: Point4d;
    /** Translation - applied after rotation. */
    public readonly position: Vector3d;

    public constructor(position: Vector3d, pivot: Vector3d, orientation: Point4d) {
      this.position = position;
      this.pivot = pivot;
      this.orientation = orientation;
    }

    public static fromJSON(props: TransformComponentsProps): TransformComponents | undefined {
      if (props.pivot && props.position && props.orientation)
        return new TransformComponents(Vector3d.fromJSON(props.position), Vector3d.fromJSON(props.pivot), Point4d.fromJSON(props.orientation));
      else
        return undefined;
    }

    public toJSON(): TransformComponentsProps {
      return {
        position: [this.position.x, this.position.y, this.position.z],
        pivot: [this.pivot.x, this.pivot.y, this.pivot.z],
        orientation: [this.orientation.x, this.orientation.y, this.orientation.z, this.orientation.w],
      };
    }

    public compareTo(other: TransformComponents): number {
      return compareXYZ(this.pivot, other.pivot) || compareXYZ(this.position, other.position) || compare4d(this.orientation, other.orientation);
    }

    public equals(other: TransformComponents): boolean {
      return this.pivot.isAlmostEqual(other.pivot) && this.position.isAlmostEqual(other.position) && this.orientation.isAlmostEqual(other.orientation);
    }
  }

  /** A timeline entry that applies rotation, scaling, and/or translation to the affected geometry. */
  export class TransformEntry extends TimelineEntry {
    /** The transform matrix to be applied to the geometry, used only if [[components]] is not defined. */
    public readonly value: Readonly<Transform>;
    /** The transform represented as a rotation about a pivot point followed by a translation. If undefined, [[value]] is used instead. */
    public readonly components?: TransformComponents;

    public constructor(props: TransformEntryProps) {
      super(props);
      this.value = props.value ? Transform.fromJSON(props.value.transform) : Transform.identity;
      if (props.value)
        this.components = TransformComponents.fromJSON(props.value);
    }

    public override toJSON(): TransformEntryProps {
      const props = super.toJSON() as TransformEntryProps;
      if (this.components) {
        props.value = this.components.toJSON();
        props.value.transform = this.value.toRows();
      } else {
        props.value = { transform: this.value.toRows() };
      }

      return props;
    }

    public override compareTo(other: TransformEntry): number {
      assert(other instanceof TransformEntry);
      const cmp = super.compareTo(other);
      if (0 !== cmp)
        return cmp;

      if (this.components || other.components) {
        if (!this.components || !other.components)
          return this.components ? 1 : -1;

        return this.components.compareTo(other.components);
      }

      return compareXYZ(this.value.origin, other.value.origin) || compareMatrices(this.value.matrix, other.value.matrix);
    }
  }

  /** Defines a [ClipPlane]($core-geometry) associated with a [[RenderSchedule.CuttingPlaneEntry]]. */
  export class CuttingPlane {
    /** A point on the plane. */
    public readonly position: XYAndZ;
    /** The direction perpendicular to the plane pointing toward the clip. */
    public readonly direction: XYAndZ;
    /** If true, the clip plane is ignored and the geometry is never clipped. */
    public readonly visible: boolean;
    /** If true, the clip plane is ignored and the geometry is always clipped. */
    public readonly hidden: boolean;

    public constructor(props: CuttingPlaneProps) {
      this.position = Point3d.fromJSON(props.position);
      this.direction = Point3d.fromJSON(props.direction);
      this.hidden = true === props.hidden;
      this.visible = true === props.visible;
    }

    public toJSON(): CuttingPlaneProps {
      const props: CuttingPlaneProps = {
        position: [this.position.x, this.position.y, this.position.z],
        direction: [this.direction.x, this.direction.y, this.direction.z],
      };

      if (this.visible)
        props.visible = true;

      if (this.hidden)
        props.hidden = true;

      return props;
    }

    public compareTo(other: CuttingPlane): number {
      return compareXYZ(this.position, other.position) || compareXYZ(this.direction, other.direction) || compareBooleans(this.visible, other.visible) || compareBooleans(this.hidden, other.hidden);
    }

    public equals(other: CuttingPlane): boolean {
      return 0 === this.compareTo(other);
    }
  }

  /** A timeline entry that applies a [ClipPlane]($core-geometry) to the affected geometry. */
  export class CuttingPlaneEntry extends TimelineEntry {
    /** The definition of the [ClipPlane]($core-geometry), or undefined if this entry applies no clipping. */
    public readonly value: CuttingPlane | undefined;

    public constructor(props: CuttingPlaneEntryProps) {
      super(props);
      if (props.value)
        this.value = new CuttingPlane(props.value);
    }

    public override toJSON(): CuttingPlaneEntryProps {
      const props = super.toJSON() as CuttingPlaneEntryProps;
      if (this.value)
        props.value = this.value.toJSON();

      return props;
    }

    public override compareTo(other: CuttingPlaneEntry): number {
      assert(other instanceof CuttingPlaneEntry);
      return super.compareTo(other) || comparePossiblyUndefined((x, y) => x.compareTo(y), this.value, other.value);
    }
  }

  /** Identifies a fractional position along a [[RenderSchedule.Timeline]] between any two [[RenderSchedule.TimelineEntry]]'s within a [[RenderSchedule.TimelineEntryList]].
   * @internal
   */
  export class Interval {
    /** The index of the first timeline entry within the list. */
    public lowerIndex!: number;
    /** The index of the second timeline entry within the list. */
    public upperIndex!: number;
    /** The normalized distance between the two timeline entries. */
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

  /** A list of the [[RenderSchedule.TimelineEntry]] objects within a [[RenderSchedule.Timeline]]. The type parameters are:
   *  - T, a subclass of TimelineEntry with a `value` property specifying the value of the property controlled by the timeline at that entry's time point.
   *  - P, the JSON representation from which T is to be constructed.
   *  - V, the type of `T.value`.
   */
  export class TimelineEntryList<T extends TimelineEntry & { readonly value: V }, P extends TimelineEntryProps, V> implements Iterable<T> {
    private readonly _entries: ReadonlyArray<T>;
    /** The total time period represented by the entries in this list. */
    public readonly duration: Range1d;

    public constructor(props: P[], ctor: Constructor<T>) {
      this.duration = Range1d.createNull();
      this._entries = props.map((x) => {
        const entry = new ctor(x);
        this.duration.extendX(entry.time);
        return entry;
      });
    }

    /** The number of entries in the list. */
    public get length(): number {
      return this._entries.length;
    }

    /** An iterator over the entries in the list. */
    public [Symbol.iterator](): Iterator<T> {
      return this._entries[Symbol.iterator]();
    }

    /** Look up an entry by its position in the list. */
    public getEntry(index: number): T | undefined {
      return this._entries[index];
    }

    /** Look up the value of an entry by its position in the list. */
    public getValue(index: number): V | undefined {
      return this.getEntry(index)?.value;
    }

    public toJSON(): P[] {
      return this._entries.map((x) => x.toJSON() as P);
    }

    public compareTo(other: TimelineEntryList<T, P, V>): number {
      let cmp = compareNumbers(this._entries.length, other._entries.length) || compareDurations(this.duration, other.duration);
      if (0 === cmp) {
        for (let i = 0; i < this.length; i++)
          if (0 !== (cmp = this._entries[i].compareTo(other._entries[i])))
            break;
      }

      return cmp;
    }

    public equals(other: TimelineEntryList<T, P, V>): boolean {
      return 0 === this.compareTo(other);
    }

    /** @internal */
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

  /** A list of [[RenderSchedule.VisibilityEntry]]s within a [[RenderSchedule.Timeline]]. */
  export class VisibilityTimelineEntries extends TimelineEntryList<VisibilityEntry, VisibilityEntryProps, number> {
    /** Returns the visibility value for the entry at the specified position in the list, or 100 (fully-visible) if no such entry exists. */
    public override getValue(index: number): number {
      return super.getValue(index) ?? 100;
    }
  }

  /** A list of [[RenderSchedule.TransformEntry]]s within a [[RenderSchedule.Timeline]]. */
  export class TransformTimelineEntries extends TimelineEntryList<TransformEntry, TransformEntryProps, Readonly<Transform>> {
    /** Returns the transform for the entry at the specified position in the list, or an identity transform if no such entry exists. */
    public override getValue(index: number): Readonly<Transform> {
      return super.getValue(index) ?? Transform.identity;
    }
  }

  /** Specifies how to animate a set of geometry over time within a [[RenderSchedule.Script]].
   * A [[RenderSchedule.Script]] can contain any number of [[RenderSchedule.Timeline]]s, each affecting different sets of geometry.
   * @see [[RenderSchedule.ElementTimeline]] and [[RenderSchedule.ModelTimeline]].
   */
  export class Timeline {
    /** Sequence controlling the visibility of the geometry. */
    public readonly visibility?: VisibilityTimelineEntries;
    /** Sequence controlling the color of the geometry. */
    public readonly color?: TimelineEntryList<ColorEntry, ColorEntryProps, RgbColor | undefined>;
    /** Sequence controlling the position, orientation, and/or scale of the geometry. */
    public readonly transform?: TransformTimelineEntries;
    /** Sequence controlling how the geometry is clipped. */
    public readonly cuttingPlane?: TimelineEntryList<CuttingPlaneEntry, CuttingPlaneEntryProps, CuttingPlane | undefined>;
    /** The total time period represented by this timeline. */
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

    public compareTo(other: Timeline): number {
      const cmp = compareDurations(this.duration, other.duration);
      if (0 !== cmp)
        return cmp;

      // Do cheaper checks before iterating through timeline entries
      if (!!this.visibility !== !!other.visibility)
        return this.visibility ? 1 : -1;
      else if (!!this.color !== !!other.color)
        return this.color ? 1 : -1;
      else if (!!this.transform !== !!other.transform)
        return this.transform ? 1 : -1;
      else if (!!this.cuttingPlane !== !!other.cuttingPlane)
        return this.cuttingPlane ? 1 : -1;

      return comparePossiblyUndefined((x, y) => x.compareTo(y), this.visibility, other.visibility) || comparePossiblyUndefined((x, y) => x.compareTo(y), this.color, other.color)
        || comparePossiblyUndefined((x, y) => x.compareTo(y), this.transform, other.transform) || comparePossiblyUndefined((x, y) => x.compareTo(y), this.cuttingPlane, other.cuttingPlane);
    }

    public equals(other: Timeline): boolean {
      return 0 === this.compareTo(other);
    }

    /** Get the visibility of the geometry at the specified time point. */
    public getVisibility(time: number): number {
      let interval;
      if (!this.visibility || !(interval = this.visibility.findInterval(time, scratchInterval)))
        return 100;

      let visibility = this.visibility.getValue(interval.lowerIndex) ?? 100;
      if (interval.fraction > 0)
        visibility = interpolate(visibility, this.visibility.getValue(interval.upperIndex) ?? 100, interval.fraction);

      return visibility;
    }

    /** Get the color of the geometry at the specified time point, or undefined if the color is not overridden at that time point. */
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

    /** Get the transform applied to the geometry at the specified time point. */
    public getAnimationTransform(time: number): Readonly<Transform> {
      let interval;
      if (!this.transform || !(interval = this.transform.findInterval(time, scratchInterval)))
        return Transform.identity;

      let transform = this.transform.getValue(interval.lowerIndex);
      if (interval.fraction > 0) {
        const comp0 = this.transform.getEntry(interval.lowerIndex)?.components;
        const comp1 = this.transform.getEntry(interval.upperIndex)?.components;
        if (comp0 && comp1) {
          const sum = Point4d.interpolateQuaternions(comp0.orientation, interval.fraction, comp1.orientation);
          const matrix = Matrix3d.createFromQuaternion(sum);
          const pre = Transform.createTranslation(comp0.pivot);
          const post = Transform.createTranslation(comp0.position.interpolate(interval.fraction, comp1.position));
          const product = post.multiplyTransformMatrix3d(matrix);
          product.multiplyTransformTransform(pre, product);
          transform = product;
        } else {
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
      }

      return transform;
    }

    /** Get the clipping plane applied to the geometry at the specified time point, or undefined if the geometry is unclipped at that time point. */
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

    /** Create a ClipVector from the [[RenderSchedule.CuttingPlane]] applied to the geometry at the specified time point, if any. */
    public getClipVector(time: number): ClipVector | undefined {
      const plane = this.getCuttingPlane(time);
      if (!plane)
        return undefined;

      const cp = ClipPlane.createPlane(plane);
      const cps = UnionOfConvexClipPlaneSets.createConvexSets([ConvexClipPlaneSet.createPlanes([cp])]);
      const prim = ClipPrimitive.createCapture(cps);
      return ClipVector.createCapture([prim]);
    }

    /** @internal */
    protected getFeatureAppearance(visibility: number, time: number): FeatureAppearance | undefined {
      const transparency = visibility < 100 ? (1 - visibility / 100) : undefined;
      const rgb = this.getColor(time);
      return undefined !== rgb || undefined !== transparency ? FeatureAppearance.fromJSON({ rgb, transparency }) : undefined;
    }
  }

  /** Specifies how to animate the geometry belonging to a set of [GeometricElement]($backend)s as part of a [[RenderSchedule.Script]]. */
  export class ElementTimeline extends Timeline {
    /** A positive integer that uniquely identififes this timeline among all ElementTimelines in the [[RenderSchedule.Script]]. */
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

    public override toJSON(): ElementTimelineProps {
      return {
        ...super.toJSON(),
        batchId: this.batchId,
        elementIds: this._elementIds,
      };
    }

    public get containsElementIds(): boolean {
      return this._elementIds.length > 0;
    }

    private compareElementIds(other: ElementTimeline): number {
      if (typeof this._elementIds === typeof other._elementIds) {
        const cmp = compareNumbers(this._elementIds.length, other._elementIds.length);
        if (0 !== cmp)
          return cmp;

        if (typeof this._elementIds === "string") {
          assert(typeof other._elementIds === "string");
          return compareStrings(this._elementIds, other._elementIds);
        }
      }

      // One or both are stored as arrays, in which case they might contain the same Ids in different orders. We will consider them different in that case.
      const mine = this.elementIds[Symbol.iterator]();
      const theirs = other.elementIds[Symbol.iterator]();
      while (true) {
        const a = mine.next();
        const b = theirs.next();
        if (a.done !== b.done)
          return compareBooleans(!!a.done, !!b.done);
        else if (a.done)
          return 0;

        const cmp = compareStrings(a.value, b.value);
        if (0 !== cmp)
          return cmp;
      }
    }

    public override compareTo(other: ElementTimeline): number {
      assert(other instanceof ElementTimeline);
      return compareNumbers(this.batchId, other.batchId) || this.compareElementIds(other) || super.compareTo(other);
    }

    /** @internal */
    public static getElementIds(ids: Id64String[] | CompressedId64Set): Iterable<Id64String> {
      if (typeof ids === "string")
        return CompressedId64Set.iterable(ids);
      else if (Array.isArray(ids)) {
        return ids;
      } else {
        return [];
      }
    }

    /** The Ids of the elements controlled by this timeline. */
    public get elementIds(): Iterable<Id64String> {
      return ElementTimeline.getElementIds(this._elementIds);
    }

    /** True if this timeline affects the color or transparency of the elements. */
    public get containsFeatureOverrides(): boolean {
      return undefined !== this.visibility || undefined !== this.color;
    }

    /** If true, applying this timeline requires special tiles to be generated in which groups of elements are batched into nodes.
     * @internal
     */
    public get requiresBatching(): boolean {
      if (this.cuttingPlane)
        return true;

      return this.batchId !== 0 && (undefined !== this.color || undefined !== this.visibility);
    }

    /** True if this timeline affects the position, orientation, or scale of the elements. */
    public get containsTransform(): boolean {
      return undefined !== this.transform;
    }

    /** @internal */
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

  /** Specifies how to animate the geometry within a [GeometricModel]($backend) as part of a [[RenderSchedule.Script]]. */
  export class ModelTimeline extends Timeline {
    /** The Id of the [GeometricModel]($backend) to be animated. */
    public readonly modelId: Id64String;
    /** @internal */
    public readonly realityModelUrl?: string;
    /** Timelines specifying how to animate groups of [GeometricElement]($backend)s within the model. */
    public readonly elementTimelines: ReadonlyArray<ElementTimeline>;
    /** @internal */
    public readonly transformBatchIds: ReadonlyArray<number>;
    /** True if this timeline affects the color or transparency of the geometry. */
    public readonly containsFeatureOverrides: boolean;
    /** True if this timeline applies clipping to the model. */
    public readonly containsModelClipping: boolean;
    /** If true, applying this timeline requires special tiles to be generated in which groups of elements are batched into nodes.
     * @internal
     */
    public readonly requiresBatching: boolean;
    /** True if this timeline affects the position, orientation, or scale of the geometry. */
    public readonly containsTransform: boolean;
    /** True if any [[RenderSchedule.ElementTimeline]]s exist and none of them contain any element Ids. This generally indicates that
     * the backend was instructed to omit the Ids to save space when supplying the script.
     */
    public readonly omitsElementIds: boolean;
    private _maxBatchId?: number;
    /** Tile tree suppliers perform **very** frequent ordered comparisons of ModelTimelines. They need to be fast. */
    private readonly _cachedComparisons = new WeakMap<ModelTimeline, number>();
    /** When loading tiles we need to quickly map element Ids to batch Ids. This map is initialized on first call to [[getTimelineForElement]] to facilitate that lookup. */
    private _idPairToElementTimeline?: Id64.Uint32Map<ElementTimeline>;
    private _discreteBatchIds?: Set<number>;

    private constructor(props: ModelTimelineProps) {
      super(props);

      this.modelId = props.modelId;
      this.realityModelUrl = props.realityModelUrl;
      this.containsModelClipping = undefined !== this.cuttingPlane;

      let containsFeatureOverrides = undefined !== this.visibility || undefined !== this.color;
      let requiresBatching = false;
      let containsTransform = false;

      const transformBatchIds: number[] = [];
      const elementTimelines: ElementTimeline[] = [];
      let containsElementIds = false;
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
        requiresBatching ||= el.requiresBatching;
        containsElementIds = containsElementIds || el.containsElementIds;
      }

      this.elementTimelines = elementTimelines;
      this.transformBatchIds = transformBatchIds;
      this.omitsElementIds = elementTimelines.length > 0 && !containsElementIds;

      this.containsFeatureOverrides = containsFeatureOverrides;
      this.requiresBatching = requiresBatching;
      this.containsTransform = containsTransform;
    }

    public static fromJSON(props?: ModelTimelineProps): ModelTimeline {
      return new ModelTimeline(props ?? { elementTimelines: [], modelId: Id64.invalid });
    }

    public override toJSON(): ModelTimelineProps {
      return {
        ...super.toJSON(),
        modelId: this.modelId,
        realityModelUrl: this.realityModelUrl,
        elementTimelines: this.elementTimelines.map((x) => x.toJSON()),
      };
    }

    public override compareTo(other: ModelTimeline): number {
      if (this === other)
        return 0;

      const cached = this._cachedComparisons.get(other);
      if (undefined !== cached)
        return cached;

      assert(other instanceof ModelTimeline);
      let cmp = compareStrings(this.modelId, other.modelId) || compareStringsOrUndefined(this.realityModelUrl, other.realityModelUrl)
        || compareNumbers(this.elementTimelines.length, other.elementTimelines.length) || compareBooleans(this.containsFeatureOverrides, other.containsFeatureOverrides)
        || compareBooleans(this.containsModelClipping, other.containsModelClipping) || compareBooleans(this.containsTransform, other.containsTransform)
        || super.compareTo(other);

      if (0 === cmp) {
        for (let i = 0; i < this.elementTimelines.length; i++)
          if (0 !== (cmp = this.elementTimelines[i].compareTo(other.elementTimelines[i])))
            break;
      }

      this._cachedComparisons.set(other, cmp);
      other._cachedComparisons.set(this, -cmp);
      return cmp;
    }

    /** Look up the element timeline with the specified batch Id. */
    public findByBatchId(batchId: number): ElementTimeline | undefined {
      return this.elementTimelines.find((x) => x.batchId === batchId);
    }

    /** @internal */
    public addSymbologyOverrides(overrides: FeatureOverrides, time: number): void {
      const appearance = this.getFeatureAppearance(this.getVisibility(time), time);
      if (appearance)
        overrides.override({ modelId: this.modelId, appearance });

      for (const timeline of this.elementTimelines)
        timeline.addSymbologyOverrides(overrides, time);
    }

    /** Obtain the transform applied to the model at the specified time point, if any. */
    public getTransform(batchId: number, time: number): Readonly<Transform> | undefined {
      return this.findByBatchId(batchId)?.getAnimationTransform(time);
    }

    /** Get the highest batchId of any ElementTimeline in this timeline. */
    public get maxBatchId(): number {
      if (undefined === this._maxBatchId) {
        this._maxBatchId = 0;
        for (const elem of this.elementTimelines)
          this._maxBatchId = Math.max(this._maxBatchId, elem.batchId);
      }

      return this._maxBatchId;
    }

    /** Given the two halves of an [Id64]($bentley) return the [[ElementTimeline]] containing the corresponding element.
     * @note The first call to this method populates a mapping for fast lookup.
     * @alpha
     */
    public getTimelineForElement(idLo: number, idHi: number): ElementTimeline | undefined {
      if (!this._idPairToElementTimeline) {
        this._idPairToElementTimeline = new Id64.Uint32Map<ElementTimeline>();
        for (const timeline of this.elementTimelines) {
          for (const elementId of timeline.elementIds) {
            // NB: a malformed script may place the same element Id into multiple timelines. We're not going to check for such data errors here.
            this._idPairToElementTimeline.setById(elementId, timeline);
          }
        }
      }

      return this._idPairToElementTimeline.get(idLo, idHi);
    }

    /** The batch Ids of the subset of [[elementTimelines]] that apply a transform and/or cutting plane.
     * @alpha
     */
    public get discreteBatchIds(): Set<number> {
      if (!this._discreteBatchIds) {
        this._discreteBatchIds = new Set<number>(this.transformBatchIds);
        for (const timeline of this.elementTimelines)
          if (!timeline.containsTransform && undefined !== timeline.cuttingPlane)
            this._discreteBatchIds.add(timeline.batchId);
      }

      return this._discreteBatchIds;
    }
  }

  /** Specifies how to animate the contents of a [ViewState]($frontend) over time. The script contains any number of [[RenderSchedule.ModelTimeline]]s, each describing how
   * to animate one of the models in the view.
   * @see [RenderTimeline]($backend) to create an [Element]($backend) to host a script.
   * @see [[DisplayStyleSettings.renderTimeline]] to associate a [RenderTimeline]($backend)'s script with a [DisplayStyle]($backend).
   * @see [DisplayStyleState.scheduleScript]($frontend) to obtain the script associated with a display style.
   * @see [[RenderSchedule.ScriptBuilder]] to define a new script.
   */
  export class Script {
    /** Timelines specifying how to animate individual models within the view. */
    public readonly modelTimelines: ReadonlyArray<ModelTimeline>;
    /** True if this script applies clipping to any models. */
    public readonly containsModelClipping: boolean;
    /** If true, applying this timeline requires special tiles to be generated in which groups of elements are batched into nodes.
     * @internal
     */
    public readonly requiresBatching: boolean;
    /** True if this script affects the position, orientation, or scale of the geometry. */
    public readonly containsTransform: boolean;
    /** True if this script affects the color or transparency of the geometry. */
    public readonly containsFeatureOverrides: boolean;
    /** The total time period over which this script animates. */
    public readonly duration: Range1d;
    /** The batchIds of all nodes in all timelines that apply a transform.
     * @internal
     */
    public readonly transformBatchIds: ReadonlySet<number>;
    /** Tile tree references perform **very** frequent ordered comparisons of Scripts. They need to be fast. */
    private readonly _cachedComparisons = new WeakMap<Script, number>();

    public compareTo(other: Script): number {
      if (this === other)
        return 0;

      const cached = this._cachedComparisons.get(other);
      if (undefined !== cached)
        return cached;

      let cmp = compareNumbers(this.modelTimelines.length, other.modelTimelines.length) || compareBooleans(this.containsModelClipping, other.containsModelClipping)
        || compareBooleans(this.requiresBatching, other.requiresBatching) || compareBooleans(this.containsTransform, other.containsTransform)
        || compareBooleans(this.containsFeatureOverrides, other.containsFeatureOverrides) || compareDurations(this.duration, other.duration);

      if (0 === cmp) {
        for (let i = 0; i < this.modelTimelines.length; i++)
          if (0 !== (cmp = this.modelTimelines[i].compareTo(other.modelTimelines[i])))
            break;
      }

      this._cachedComparisons.set(other, cmp);
      other._cachedComparisons.set(this, -cmp);
      return cmp;
    }
    public equals(other: Script): boolean {
      return 0 === this.compareTo(other);
    }

    protected constructor(props: Readonly<ScriptProps>) {
      this.duration = Range1d.createNull();
      const transformBatchIds = new Set<number>();

      const modelTimelines: ModelTimeline[] = [];
      let containsModelClipping = false;
      let requiresBatching = false;
      let containsTransform = false;
      let containsFeatureOverrides = false;

      for (const modelProps of props) {
        const model = ModelTimeline.fromJSON(modelProps);
        modelTimelines.push(model);

        this.duration.extendRange(model.duration);

        containsModelClipping ||= model.containsModelClipping;
        requiresBatching ||= model.requiresBatching;
        containsTransform ||= model.containsTransform;
        containsFeatureOverrides ||= model.containsFeatureOverrides;

        for (const batchId of model.transformBatchIds)
          transformBatchIds.add(batchId);
      }

      this.modelTimelines = modelTimelines;
      this.containsModelClipping = containsModelClipping;
      this.containsTransform = containsTransform;
      this.requiresBatching = requiresBatching || this.containsTransform;
      this.containsFeatureOverrides = containsFeatureOverrides;
      this.transformBatchIds = transformBatchIds;
    }

    public static fromJSON(props: Readonly<ScriptProps>): Script | undefined {
      if (!Array.isArray(props) || props.length === 0)
        return undefined;

      return new Script(props);
    }

    public toJSON(): ScriptProps {
      return this.modelTimelines.map((x) => x.toJSON());
    }

    /** Look up the timeline that animates the specified model, if any. */
    public find(modelId: Id64String): ModelTimeline | undefined {
      return this.modelTimelines.find((x) => x.modelId === modelId);
    }

    /** @internal */
    public getTransformBatchIds(modelId: Id64String): ReadonlyArray<number> | undefined {
      return this.find(modelId)?.transformBatchIds;
    }

    /** @internal */
    public getTransform(modelId: Id64String, batchId: number, time: number): Readonly<Transform> | undefined {
      return this.find(modelId)?.getTransform(batchId, time);
    }

    /** @internal */
    public addSymbologyOverrides(overrides: FeatureOverrides, time: number): void {
      for (const timeline of this.modelTimelines)
        timeline.addSymbologyOverrides(overrides, time);
    }

    /** Used by the [Element.collectReferenceIds]($backend) method overrides in RenderTimeline and DisplayStyle.
     * @internal
     */
    public discloseIds(ids: ConcreteEntityIdSet | Set<Id64String>) {
      const entitySet = ConcreteEntityIdSet.unifyWithRawIdsSet(ids);
      for (const model of this.modelTimelines) {
        entitySet.addModel(model.modelId);
        for (const element of model.elementTimelines)
          for (const id of element.elementIds)
            entitySet.addElement(id);
      }
    }

    /** @internal */
    public modelRequiresBatching(modelId: Id64String): boolean {
      // Only if the script contains animation (cutting plane, transform or visibility by node ID) do we require separate tilesets for animations.
      return this.requiresBatching && this.modelTimelines.some((x) => x.modelId === modelId && x.requiresBatching);
    }
  }

  /** A reference to a [[RenderSchedule.Script]], optionally identifying the source of the script.
   * @see [DisplayStyle.loadScheduleScript]($backend) and [DisplayStyleState.scheduleScript]($frontend) to obtain the script reference for a display style on the frontend
   * and backend respectively.
   * @see [DisplayStyleState.scheduleScript]($frontend) or [DisplayStyleState.changeRenderTimeline]($frontend) to change a display style's script on the frontend.
   */
  export class ScriptReference {
    /** The Id of the element - if any - from which the script originated.
     * A schedule script may originate from one of the following sources:
     *  - A [RenderTimeline]($backend) element stored in the iModel; or
     *  - The `scheduleScript` JSON property of a [DisplayStyle]($backend) element stored in the iModel; or
     *  - Any other source outside of the iModel, such as code that generates the script on the frontend, a script obtained from some server, etc.
     *
     * The [[sourceId]] property identifies the Id of the element from which the script originated; an empty or invalid [Id64String]($bentley) indicates the script did not
     * originate from any persistent element. If the Id is valid, the contents of [[script]] are assumed to match those stored on the source element.
     */
    public readonly sourceId: Id64String;
    /** The script defining the rendering timelines to be applied. */
    public readonly script: Script;

    /** Create a reference to a [[script]] with no [[sourceId]]. */
    public constructor(script: Script);

    /** Create a reference to a [[script]] with the specified [[sourceId]]. */
    public constructor(sourceId: Id64String, script: Script);

    /** @internal Use one of the public constructor overloads which forward to this one. */
    public constructor(sourceIdOrScript: Id64String | Script, scriptIfSourceId?: Script);

    /** @internal Use one of the public constructor overloads which forward to this one. */
    public constructor(sourceIdOrScript: Id64String | Script, scriptIfSourceId?: Script) {
      if (typeof sourceIdOrScript === "string") {
        assert(scriptIfSourceId instanceof Script);
        this.sourceId = sourceIdOrScript;
        this.script = scriptIfSourceId;
      } else {
        assert(undefined === scriptIfSourceId);
        this.script = sourceIdOrScript;
        this.sourceId = Id64.invalid;
      }
    }
  }

  /** Used as part of a [[RenderSchedule.ScriptBuilder]] to define a [[RenderSchedule.Timeline]].
   * @see [[RenderSchedule.ElementTimelineBuilder]] and [[RenderSchedule.ModelTimelineBuilder]].
   */
  export class TimelineBuilder {
    /** Timeline controlling visibility. */
    public visibility?: VisibilityEntryProps[];
    /** Timeline controlling color. */
    public color?: ColorEntryProps[];
    /** Timeline controlling position and orientation. */
    public transform?: TransformEntryProps[];
    /** Timeline controlling clipping. */
    public cuttingPlane?: CuttingPlaneEntryProps[];

    /** Append a new [[RenderSchedule.VisibilityEntry]] to the timeline. */
    public addVisibility(time: number, visibility: number | undefined, interpolation = Interpolation.Linear): void {
      if (!this.visibility)
        this.visibility = [];

      this.visibility.push({ time, value: visibility, interpolation });
    }

    /** Append a new [[RenderSchedule.ColorEntry]] to the timeline. */
    public addColor(time: number, color: RgbColor | { red: number, green: number, blue: number } | undefined, interpolation = Interpolation.Linear): void {
      if (!this.color)
        this.color = [];

      const value = color instanceof RgbColor ? { red: color.r, green: color.g, blue: color.b } : color;
      this.color.push({ time, value, interpolation });
    }

    /** Append a new [[RenderSchedule.CuttingPlaneEntry]] to the timeline. */
    public addCuttingPlane(time: number, plane: { position: XYAndZ, direction: XYAndZ, visible?: boolean, hidden?: boolean } | undefined, interpolation = Interpolation.Linear): void {
      if (!this.cuttingPlane)
        this.cuttingPlane = [];

      let value: CuttingPlaneProps | undefined;
      if (plane) {
        value = {
          position: [plane.position.x, plane.position.y, plane.position.z],
          direction: [plane.direction.x, plane.direction.y, plane.direction.z],
        };

        if (plane.visible)
          value.visible = true;

        if (plane.hidden)
          value.hidden = true;
      }

      this.cuttingPlane.push({ time, value, interpolation });
    }

    /** Append a new [[RenderSchedule.TransformEntry]] to the timeline. */
    public addTransform(time: number, transform: Readonly<Transform> | undefined, components?: { pivot: XYAndZ, orientation: Point4d, position: XYAndZ }, interpolation = Interpolation.Linear): void {
      if (!this.transform)
        this.transform = [];

      const value: TransformProps = { transform: transform?.toRows() };
      if (components) {
        value.pivot = [components.pivot.x, components.pivot.y, components.pivot.z];
        value.orientation = components.orientation.toJSON();
        value.position = [components.position.x, components.position.y, components.position.z];
      }

      this.transform.push({ time, value, interpolation });
    }

    /** Obtain the JSON representation of the [[RenderSchedule.Timeline]] produced by this builder.
     * @see [[RenderSchedule.ScriptBuilder.finish]] to obtain the JSON for the entire [[RenderSchedule.Script]].
     */
    public finish(): TimelineProps {
      const props: TimelineProps = {};
      if (this.visibility?.length)
        props.visibilityTimeline = this.visibility;

      if (this.color?.length)
        props.colorTimeline = this.color;

      if (this.transform?.length)
        props.transformTimeline = this.transform;

      if (this.cuttingPlane?.length)
        props.cuttingPlaneTimeline = this.cuttingPlane;

      return props;
    }
  }

  /** As part of a [[RenderSchedule.ScriptBuilder]], assembles a [[RenderSchedule.ElementTimeline]].
   * @see [[RenderSchedule.ModelTimelineBuilder.addElementTimeline]].
   */
  export class ElementTimelineBuilder extends TimelineBuilder {
    /** A positive integer that uniquely identifies this timeline among all element timelines in the [[RenderSchedule.Script]].
     * [[RenderSchedule.ScriptBuilder]] ensures each ElementTimelineBuilder receives a unique batch Id.
     */
    public readonly batchId: number;
    /** The compressed set of Ids of the elements affected by this timeline. */
    public readonly elementIds: CompressedId64Set;

    /** Constructor - typically not used directly.
     * @see [[RenderSchedule.ModelTimelineBuilder.addElementTimeline]] to create an ElementTimelineBuilder.
     */
    public constructor(batchId: number, elementIds: CompressedId64Set) {
      super();
      this.batchId = batchId;
      this.elementIds = elementIds;
    }

    /** Obtain the JSON representation of the [[RenderSchedule.ElementTimeline]] produced by this builder.
     * @see [[RenderSchedule.ScriptBuilder.finish]] to obtain the JSON for the entire [[RenderSchedule.Script]].
     */
    public override finish(): ElementTimelineProps {
      const props = super.finish() as ElementTimelineProps;
      props.batchId = this.batchId;
      props.elementIds = this.elementIds;
      return props;
    }
  }

  /** As part of a [[RenderSchedule.ScriptBuilder, assembles a [[RenderSchedule.ModelTimeline]].
   * @see [[RenderSchedule.ScriptBuilder.addModelTimeline]].
   */
  export class ModelTimelineBuilder extends TimelineBuilder {
    /** The Id of the model affected by this timeline. */
    public readonly modelId: Id64String;
    /** @internal */
    public realityModelUrl?: string;
    private readonly _obtainNextBatchId: () => number;
    private readonly _elements: ElementTimelineBuilder[] = [];

    /** Constructor - typically not used directly.
     * @see [[RenderSchedule.ScriptBuilder.addModelTimeline]] to create a ModelTimelineBuilder.
     */
    public constructor(modelId: Id64String, obtainNextBatchId: () => number) {
      super();
      this.modelId = modelId;
      this._obtainNextBatchId = obtainNextBatchId;
    }

    /** Add a new [[RenderSchedule.ElementTimeline]] to be applied to the specified elements.
     * This function will sort and compress the Ids if they are not already compressed.
     *
     */
    public addElementTimeline(elementIds: CompressedId64Set | Iterable<Id64String>): ElementTimelineBuilder {
      const batchId = this._obtainNextBatchId();
      let ids: CompressedId64Set;

      // It's far too easy to accidentally pass a single Id (compiler can't help).
      if (typeof elementIds === "string" && Id64.isValidId64(elementIds))
        elementIds = [elementIds];

      if (typeof elementIds === "string") {
        // Already compressed.
        ids = elementIds;
      } else {
        const sorted = Array.from(elementIds);
        OrderedId64Iterable.sortArray(sorted);
        ids = CompressedId64Set.compressIds(sorted);
      }

      const builder = new ElementTimelineBuilder(batchId, ids);
      this._elements.push(builder);
      return builder;
    }

    /** Obtain the JSON representation of the [[RenderSchedule.ModelTimeline]] produced by this builder.
     * @see [[RenderSchedule.ScriptBuilder.finish]] to obtain the JSON for the entire [[RenderSchedule.Script]].
     */
    public override finish(): ModelTimelineProps {
      const props = super.finish() as ModelTimelineProps;
      props.modelId = this.modelId;
      if (undefined !== this.realityModelUrl)
        props.realityModelUrl = this.realityModelUrl;

      props.elementTimelines = this._elements.map((x) => x.finish());
      return props;
    }
  }

  /** Assembles the JSON representation for a new [[RenderSchedule.Script]]. As an extremely simple example, the following code produces a script that changes the color of a single element:
   * ```ts
   *  const script = new ScriptBuilder();
   *  const model = script.addModelTimeline("0x123");
   *  const element = model.addElementTimeline([ "0x456" ]);
   *  element.addColor(Date.now(), new RgbColor(0xff, 0x7f, 0));
   *  const scriptProps = script.finish();
   * ```
   */
  export class ScriptBuilder {
    private _nextBatchId = 1;
    private readonly _models: ModelTimelineBuilder[] = [];

    /** Add a new [[RenderSchedule.ModelTimeline]] to be applied to the specified model. */
    public addModelTimeline(modelId: Id64String): ModelTimelineBuilder {
      const builder = new ModelTimelineBuilder(modelId, () => this._nextBatchId++);
      this._models.push(builder);
      return builder;
    }

    /** Obtain the JSON representation of the [[RenderSchedule.Script]] produced by this builder.
     * @see [RenderTimeline.scriptProps]($backend) to assign the new script to a RenderTimeline element.
     */
    public finish(): ScriptProps {
      return this._models.map((x) => x.finish());
    }
  }
}
