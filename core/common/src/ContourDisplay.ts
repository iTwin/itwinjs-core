/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { compareBooleans, compareNumbers, CompressedId64Set, NonFunctionPropertiesOf, OrderedId64Iterable } from "@itwin/core-bentley";
import { LinePixels } from "./LinePixels";
import { RgbColor, RgbColorProps } from "./RgbColor";

/** JSON representation of a [[ContourStyle]].
 * @public
 */
export interface ContourStyleProps {
  /** See [[ContourStyle.color]]. */
  color?: RgbColorProps;
  /** See [[ContourStyle.pixelWidth]]. */
  pixelWidth?: number;
  /** See [[ContourStyle.pattern]]. */
  pattern?: LinePixels;
}

/** A type containing all of the properties of [[ContourStyle]] with none of the methods and with the `readonly` modifiers removed.
 * Used by [[ContourStyle.create]] and [[ContourStyle.clone]].
 * @public
 */
export type ContourStyleProperties = NonFunctionPropertiesOf<ContourStyle>;

/** The style settings used by either a minor or major contour.
 * @see [[Contour.majorStyle]]
 * @see [[Contour.minorStyle]]
 * @public
 */
export class ContourStyle {
  /** The color in which to draw the contour lines. Default: black. */
  public readonly color: RgbColor;
  /** The width in screen pixels of the contour lines.
   * Useful values range between 1 and 8.5, in increments of 0.5. Other values will be rounded to meet these criteria.
   * Default: 1.0.
   */
  public readonly pixelWidth: number;
  /** The pattern for a major or minor contour line. Defaults to [[LinePixels.Solid]]. */
  public readonly pattern: LinePixels;

  /** Returns true if `this` and `other` are logically equivalent. */
  public equals(other: ContourStyle): boolean {
    if (!this.color.equals(other.color) || this.pixelWidth !== other.pixelWidth || this.pattern !== other.pattern) {
      return false;
    }
    return true;
  }

  /** Performs ordered comparison of two contour styles.
   * @param lhs First contour style to compare
   * @param rhs Second contour style to compare
   * @returns 0 if lhs is equivalent to rhs, a negative number if lhs compares less than rhs, or a positive number if lhs compares greater than rhs.
   * @public
   */
  public static compare(lhs: ContourStyle, rhs: ContourStyle): number {
    let diff = 0;
    if ((diff = lhs.color.compareTo(rhs.color)) !== 0)
      return diff;
    if ((diff = compareNumbers(lhs.pixelWidth, rhs.pixelWidth)) !== 0)
      return diff;
    if ((diff = compareNumbers(lhs.pattern, rhs.pattern)) !== 0)
      return diff;

    return diff;
  }

  private constructor(props?: Partial<ContourStyleProperties>) {
    this.color = props?.color ?? RgbColor.fromJSON({r: 0, g: 0, b: 0});
    this.pixelWidth = props?.pixelWidth ?? 1;
    this.pattern = props?.pattern ?? LinePixels.Solid;
  }

  public static fromJSON(props?: ContourStyleProps) {
    if (!props)
      return new ContourStyle();

    return new this({
      color: props?.color ? RgbColor.fromJSON(props.color) : undefined,
      pixelWidth: props?.pixelWidth,
      pattern: props?.pattern,
    });
  }

  public toJSON(): ContourStyleProps {
    const props: ContourStyleProps = {};

    if (!this.color.equals(RgbColor.fromJSON({r: 0, g: 0, b: 0})))
      props.color = this.color.toJSON();

    if (1 !== this.pixelWidth)
      props.pixelWidth = this.pixelWidth;

    if (0 !== this.pattern)
      props.pattern = this.pattern;

    return props;
  }

  /** Create a new ContourStyle. Any properties not specified by `props` will be initialized to their default values. */
  public static create(props?: Partial<ContourStyleProperties>): ContourStyle {
    return props ? new this(props) : new ContourStyle();
  }

  /** Create a copy of this ContourStyle, identical except for any properties specified by `changedProps`.
   * Any properties of `changedProps` explicitly set to `undefined` will be reset to their default values.
   */
  public clone(changedProps?: Partial<ContourStyleProperties>): ContourStyle {
    if (!changedProps)
      return this;

    return ContourStyle.create({ ...this, ...changedProps });
  }
}

/** JSON representation of a [[Contour]].
 * @public
 */
export interface ContourProps {
  /** See [[Contour.majorStyle]]. */
  majorStyle?: ContourStyleProps;
  /** See [[Contour.minor]]. */
  minorStyle?: ContourStyleProps;
  /** See [[Contour.minorInterval]]. */
  minorInterval?: number;
  /** See [[Contour.majorIntervalCount]]. */
  majorIntervalCount?: number;
  /** See [[Contour.showGeometry]] */
  showGeometry?: boolean;
}

/** A type containing all of the properties of [[Contour]] with none of the methods and with the `readonly` modifiers removed.
 * Used by [[Contour.create]] and [[Contour.clone]].
 * @public
 */
export type ContourProperties = NonFunctionPropertiesOf<Contour>;

/** Describes how to generate and style contour lines for geometry within a single [[ContourGroup]].
 * Contours provide a way to visualize elevation within a 3d scene by drawing lines at fixed intervals along the z-axis.
 * There are actually 2 kinds of contour lines: major and minor. Each kind can be styled independently.
 * A contour line is generated every [[minorInterval]] meters. Every `nth` line will be a *major* contour, where `n` = [[majorIntervalCount]]; the intervening lines will
 * all be *minor* contours.
 * For example, with a [[majorIntervalCount]] of `1`, every contour will be major; of `2`, every other contour will be major; and of `3`, there will be two minor contours in between
 * each major contour.
 *
 * @public
 */
export class Contour {
  /** Settings that describe how a major contour is styled. Defaults to an instantation of [[ContourStyle]] using `pixelWidth` of 2 and default values for the other properties. */
  public readonly majorStyle: ContourStyle;
  /** Settings that describe how a minor contour is styled. Defaults to an instantation of [[ContourStyle]] using default values for the properties. */
  public readonly minorStyle: ContourStyle;
  /** The interval for the minor contour occurrence in meters; these can be specified as fractional. Defaults to 1. If a value <= 0 is specified, this will be treated as 1 meter. */
  public readonly minorInterval: number;
  /** The count of minor contour intervals that define a major interval (integer > 0). A value of 1 means no minor contours will be shown, only major contours. Defaults to 5. If a value < 1 is specified, this will be treated as 1. If a non-integer value is specified, it will be treated as if it were rounded to the nearest integer. */
  public readonly majorIntervalCount: number;
  /** If true, show underlying geometry along with the associated contours. If false, only show the contours, not the underlying geometry. Defaults to true. */
  public readonly showGeometry: boolean;

  public static readonly defaults = new Contour({});

  public equals(other: Contour): boolean {
    if (!this.majorStyle.equals(other.majorStyle) || !this.minorStyle.equals(other.minorStyle) || this.minorInterval !== other.minorInterval  || this.majorIntervalCount !== other.majorIntervalCount || this.showGeometry !== other.showGeometry) {
      return false;
    }
    return true;
  }

  /** Performs ordered comparison of two contours.
     * @param lhs First contour to compare
     * @param rhs Second contour to compare
     * @returns 0 if lhs is equivalent to rhs, a negative number if lhs compares less than rhs, or a positive number if lhs compares greater than rhs.
     */
  public static compare(lhs: Contour, rhs: Contour): number {
    return ContourStyle.compare(lhs.majorStyle, rhs.majorStyle)
      || ContourStyle.compare(lhs.minorStyle, rhs.minorStyle)
      || compareNumbers(lhs.minorInterval, rhs.minorInterval)
      || compareNumbers(lhs.majorIntervalCount, rhs.majorIntervalCount)
      || compareBooleans(lhs.showGeometry, rhs.showGeometry);
  }

  private constructor(props?: Partial<ContourProperties>) {
    this.majorStyle = props?.majorStyle ?? ContourStyle.fromJSON({ pixelWidth: 2 });
    this.minorStyle = props?.minorStyle ?? ContourStyle.fromJSON();
    this.minorInterval = props?.minorInterval ?? 1;
    this.majorIntervalCount = props?.majorIntervalCount ?? 5;
    this.showGeometry = props?.showGeometry ?? true;
  }

  public static fromJSON(props?: ContourProps) {
    if (!props)
      return new Contour();

    return new this({
      majorStyle: props?.majorStyle ? ContourStyle.fromJSON(props.majorStyle) : undefined,
      minorStyle: props?.minorStyle ? ContourStyle.fromJSON(props.minorStyle) : undefined,
      minorInterval: props?.minorInterval,
      majorIntervalCount: props?.majorIntervalCount,
      showGeometry: props?.showGeometry,
    });
  }

  public toJSON(): ContourProps {
    const props: ContourProps = {};

    if (!this.majorStyle.equals(ContourStyle.fromJSON({ pixelWidth: 2 })))
      props.majorStyle = this.majorStyle.toJSON();

    if (!this.minorStyle.equals(ContourStyle.fromJSON()))
      props.minorStyle = this.minorStyle.toJSON();

    if (1 !== this.minorInterval)
      props.minorInterval = this.minorInterval;

    if (5 !== this.majorIntervalCount)
      props.majorIntervalCount = this.majorIntervalCount;

    if (true !== this.showGeometry)
      props.showGeometry = this.showGeometry;

    return props;
  }

  /** Create a new Contour. Any properties not specified by `props` will be initialized to their default values. */
  public static create(props?: Partial<ContourProperties>): Contour {
    return props ? new this(props) : new Contour();
  }

  /** Create a copy of this Contour, identical except for any properties specified by `changedProps`.
   * Any properties of `changedProps` explicitly set to `undefined` will be reset to their default values.
   */
  public clone(changedProps?: Partial<ContourProperties>): Contour {
    if (!changedProps)
      return this;

    return Contour.create({ ...this, ...changedProps });
  }
}

/** JSON representation of a [[ContourGroup]].
 * @public
 */
export interface ContourGroupProps {
  /** See [[ContourGroup.contourDef]]. */
  contourDef?: ContourProps;
  /** See [[ContourGroup.subCategories]]. */
  subCategories?: CompressedId64Set;
  /** See [[ContourGroup.name]]. */
  name?: string;
}

/** A type containing all of the properties of [[ContourGroup]] with none of the methods and with the `readonly` modifiers removed.
 * Used by [[ContourGroup.create]] and [[ContourGroup.clone]].
 * @public
 */
export type ContourGroupProperties = NonFunctionPropertiesOf<ContourGroup>;

/** Defines a group of objects to which to apply [[Contour]] lines in a particular style.
 * The [[ContourDisplay]] settings can contain multiple groups.
 * Each group is described by a set of [SubCategory]($backend)'s; all geometry belonging to any of those subcategories belongs to the group.
 * An empty set of subcategories indicates that this is a default group, implicitly containing all subcategories that are not explicitly included in another group.
 * Each group has an optional, non-user-facing name that applications can use to assign semantics to particular groups.
 * @public
 */
export class ContourGroup {
  private _subCategories: CompressedId64Set;

  /** Describes the appearance of all of the contours applied to geometry belonging to this group. */
  public readonly contourDef: Contour;
  /** An optional, non-user-facing name that applications can use to assign semantics to particular groups.
   * Default: an empty string.
   */
  public readonly name: string;

  /** The set of subcategories belonging to this group, or an empty set if this is a default group. If more than one empty set exists in the [[ContourDisplay]] object's `groups` array, the last entry in that array is used for rendering the default styling.
   * @see [[isDefaultGroup]] to test if this is a default group.
   */
  public get subCategories(): OrderedId64Iterable {
    return CompressedId64Set.iterable(this._subCategories);
  }

  /** Returns true if [[subCategories]] is an empty set, indicating that any subcategory not included in any other [[ContourGroup]] is implicitly
   * included in this group.
   */
  public get isDefaultGroup(): boolean {
    return OrderedId64Iterable.isEmptySet(this._subCategories);
  }

  /** Returns true if `this` and `other` contain the exact same set of subcategories. */
  public subCategoriesEqual(other: ContourGroup): boolean {
    return this._subCategories === other._subCategories;
  }

  /** Returns true if `this` and `other` are logically equivalent, having the same styling, name, and set of subcategories. */
  public equals(other: ContourGroup | undefined): boolean {
    if (this === undefined && other === undefined)
      return true;
    if (this === undefined || other === undefined)
      return false;
    if (!this.contourDef.equals(other.contourDef))
      return false;
    if (this._subCategories !== other._subCategories)
      return false;
    if (this.name !== other.name)
      return false;
    return true;
  }

  private constructor(props?: Partial<ContourGroupProperties>) {
    this.contourDef = props?.contourDef ?? Contour.fromJSON();
    this._subCategories = props?.subCategories ? CompressedId64Set.sortAndCompress(props.subCategories) : "";
    this.name = props?.name ?? "";
  }

  public static fromJSON(props?: ContourGroupProps) {
    if (!props)
      return new ContourGroup();

    return new this({
      contourDef: props?.contourDef ? Contour.fromJSON(props.contourDef) : undefined,
      name: props?.name,
      subCategories: props?.subCategories ? CompressedId64Set.iterable(props.subCategories) : undefined,
    });
  }

  public toJSON(): ContourGroupProps {
    const props: ContourGroupProps = {};

    if (!this.contourDef.equals(Contour.defaults))
      props.contourDef = this.contourDef.toJSON();

    if (this.name)
      props.name = this.name;

    props.subCategories = this._subCategories;
    return props;
  }

  /** Create a new ContourGroup. Any properties not specified by `props` will be initialized to their default values. */
  public static create(props?: Partial<ContourGroupProperties>): ContourGroup {
    return props ? new this(props) : new ContourGroup();
  }

  /** Create a copy of this ContourGroup, identical except for any properties specified by `changedProps`.
   * Any properties of `changedProps` explicitly set to `undefined` will be reset to their default values.
   */
  public clone(changedProps?: Partial<ContourGroupProperties>): ContourGroup {
    if (!changedProps)
      return this;

    return ContourGroup.create({ ...this, ...changedProps });
  }
}

/** JSON representation of [[ContourDisplay]] settings.
 * @public
 */
export interface ContourDisplayProps {
  /** See [[ContourDisplay.groups]]. */
  groups?: ContourGroupProps[];
  /** See [[ContourDisplay.displayContours]]. */
  displayContours?: boolean;
}

/** A type containing all of the properties of [[ContourDisplay]] with none of the methods and with the `readonly` modifiers removed.
 * Used by [[ContourDisplay.create]] and [[ContourDisplay.clone]].
 * @public
 */
export type ContourDisplayProperties = NonFunctionPropertiesOf<ContourDisplay>;

/** Settings that specify how to apply [contour lines]($docs/learning/display/ContourDisplay.md) to groups of geometry
 * within a 3d scene.
 * @see [[DisplayStyle3dSettings.contours]] to associate contour settings with a display style.
 * @public
 */
export class ContourDisplay {
  /** A list of the groups, each describing their own specific contour display settings. Defaults to an empty array.
   * @note The display system supports no more than [[ContourDisplay.maxContourGroups]]. Entries in this array exceeding that maximum will
   * have no effect on the display of contour lines.
   */
  public readonly groups: ContourGroup[];
  /** Whether to display the contour lines described by these settings. Default: false.
   * @see [[withDisplayContours]] to change this flag.
   */
  public readonly displayContours: boolean;
  /** The maximum number of contour groups that the system will allow. Any contour groups added to the [[groups]] array beyond this number will be ignored
   * for display purposes.
   */
  public static readonly maxContourGroups = 5;

  /** Returns true if `this` and `other` are logically equivalent, having the same groups and styling. */
  public equals(other: ContourDisplay): boolean {
    if (this.displayContours !== other.displayContours)
      return false;
    if (this.groups.length !== other.groups.length)
      return false;
    for (let index = 0, len = this.groups.length; index < len && index < ContourDisplay.maxContourGroups; ++index) {
      const match = this.groups[index].equals(other.groups[index]);
      if (!match)
        return false;
    }
    return true;
  }

  private constructor(props?: Partial<ContourDisplayProperties>) {
    this.displayContours = props?.displayContours ?? false;
    this.groups = props?.groups ?? [];
  }

  public static fromJSON(props?: ContourDisplayProps) {
    if (!props)
      return new ContourDisplay();

    const groups: ContourGroup[] = [];
    if (undefined !== props && undefined !== props.groups) {
      for (let n = 0; n < props.groups.length; n++) {
        groups[n] = ContourGroup.fromJSON(props.groups[n]);
      }
    }

    return new this({
      displayContours: props?.displayContours,
      groups: props.groups ? groups : undefined,
    });
  }

  public toJSON(): ContourDisplayProps {
    const props: ContourDisplayProps = {};

    props.groups = [];
    for (let n = 0; n < this.groups.length; n++) {
      props.groups[n] = this.groups[n].toJSON();
    }

    props.displayContours = this.displayContours;
    return props;
  }

  /** Create a new ContourDisplay. Any properties not specified by `props` will be initialized to their default values. */
  public static create(props?: Partial<ContourDisplayProperties>): ContourDisplay {
    return props ? new this(props) : new ContourDisplay();
  }

  /** Create a copy of these settings, changing the `displayContours` flag as specified. */
  public withDisplayContours(displayContours: boolean): ContourDisplay {
    return displayContours === this.displayContours ? this : ContourDisplay.create({ ...this, displayContours });
  }

  /** Create a copy of this ContourDisplay, identical except for any properties specified by `changedProps`.
   * Any properties of `changedProps` explicitly set to `undefined` will be reset to their default values.
   */
  public clone(changedProps?: Partial<ContourDisplayProperties>): ContourDisplay {
    if (!changedProps)
      return this;

    return ContourDisplay.create({ ...this, ...changedProps });
  }
}
