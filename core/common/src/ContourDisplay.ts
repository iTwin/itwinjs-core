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

  private constructor(json?: ContourStyleProps) {
    if (undefined === json) {
      this.color = RgbColor.fromJSON({r: 0, g: 0, b: 0});
      this.pixelWidth = 1;
      this.pattern = 0;
    } else {
      this.color = json.color ? RgbColor.fromJSON(json.color) : RgbColor.fromJSON({r: 0, g: 0, b: 0});
      this.pixelWidth = json.pixelWidth ?? 1;
      this.pattern = json.pattern ?? 0;
    }
  }

  public static fromJSON(json?: ContourStyleProps) {
    return json ? new ContourStyle(json) : new ContourStyle({});
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

/** The rendering styling settings that apply to a specific set of subcategories within a [[ContourGroup]].
 * This actually describes stylings for two sets of contours: major and minor. These stylings are separate from each other.
 * The minor contour occurs at a defined interval in meters. These intervals draw at a fixed height; they are not dependent on the range of the geometry to which they are applied.
 * The major contour is dependent on the minor contour. The interval of its occurence is not measured directly in meters; rather its occurence is determined by the major interval count thusly: every nth contour will be styled as a major contour where n = the major interval count. For example, if you set this number to 1, every contour will be styled as a major contour. When it is 2, every other contour will be styled as a major contour, and so on.
 * @public
 */
export class Contour {
  /** Settings that describe how a major contour is styled. Defaults to an instantation of [[ContourStyle]] using `pixelWidth` of 2 and default values for the other properties. */
  public readonly majorStyle: ContourStyle;
  /** Settings that describe how a minor contour is styled. Defaults to an instantation of [[ContourStyle]] using default values for the properties. */
  public readonly minorStyle: ContourStyle;
  /** The interval for the minor contour occurrence in meters. Defaults to 1. */
  public readonly minorInterval: number;
  /** The count of minor contour intervals that define a major interval (integer > 0). Defaults to 5. */
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

  private constructor(json?: ContourProps) {
    if (undefined === json) {
      this.majorStyle = ContourStyle.fromJSON({ pixelWidth: 2 });
      this.minorStyle = ContourStyle.fromJSON();
      this.minorInterval = 1;
      this.majorIntervalCount = 5;
      this.showGeometry = true;
    } else {
      this.majorStyle = json.majorStyle ? ContourStyle.fromJSON(json.majorStyle) : ContourStyle.fromJSON({ pixelWidth: 2 });
      this.minorStyle = json.minorStyle ? ContourStyle.fromJSON(json.minorStyle) : ContourStyle.fromJSON();
      this.minorInterval = json.minorInterval ?? 1;
      this.majorIntervalCount = json.majorIntervalCount ?? 5;
      this.showGeometry = json.showGeometry ?? true;
    }
  }

  public static fromJSON(json?: ContourProps) {
    return json ? new Contour(json) : new Contour({});
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

  /** The set of subcategories belonging to this group, or an empty set if this is a default group.
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

  private constructor(json?: ContourGroupProps) {
    if (undefined === json) {
      this.contourDef = Contour.fromJSON({});
      this._subCategories = "";
      this.name = "";
    } else {
      this.contourDef = json.contourDef ? Contour.fromJSON(json.contourDef) : Contour.fromJSON({});
      this._subCategories = json.subCategories ? json.subCategories : "";
      this.name = json.name ? json.name : "";
    }
  }

  public static fromJSON(json?: ContourGroupProps) {
    return json ? new ContourGroup(json) : new ContourGroup({});
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
      groups,
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
}
