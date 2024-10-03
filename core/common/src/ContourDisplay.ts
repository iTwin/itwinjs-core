/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { compareBooleans, compareNumbers, CompressedId64Set, OrderedId64Iterable } from "@itwin/core-bentley";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { LinePixels } from "./LinePixels";

/** JSON representation of the style settings used by either a minor or major contour. */
export interface ContourStyleProps {
  color?: ColorDefProps;
  pixelWidth?: number;
  pattern?: LinePixels;
}

/** The style settings used by either a minor or major contour.
   * @see [[Contour.majorStyle]]
   * @see [[Contour.minorStyle]]
   */
export class ContourStyle {
  /** Color that a major or minor contour line will use. Defaults to [[ColorDef.black]].*/
  public readonly color: ColorDef;
  /** A width in pixels of a major or minor contour line. (Range 1.5 to 9 in 0.5 increments). Defaults to 2. */
  public readonly pixelWidth: number;
  /** The pattern for a major or minor contour line. Defaults to [[LinePixels.Solid]]. */
  public readonly pattern: LinePixels;

  public equals(other: ContourStyle): boolean {
    if (!this.color.equals(other.color) || this.pixelWidth !== other.pixelWidth || this.pattern !== other.pattern) {
      return false;
    }
    return true;
  }

  /** Compares two contour styles.
     * @param lhs First contour style to compare
     * @param rhs Second contour style to compare
     * @returns 0 if lhs is equivalent to rhs, a negative number if lhs compares less than rhs, or a positive number if lhs compares greater than rhs.
     */
  public static compare(lhs: ContourStyle, rhs: ContourStyle): number {
    let diff = 0;
    if ((diff = compareNumbers(lhs.color.getRgb(), rhs.color.getRgb())) !== 0)
      return diff;
    if ((diff = compareNumbers(lhs.pixelWidth, rhs.pixelWidth)) !== 0)
      return diff;
    if ((diff = compareNumbers(lhs.pattern, rhs.pattern)) !== 0)
      return diff;

    return diff;
  }

  private constructor(json?: ContourStyleProps) {
    if (undefined === json) {
      this.color = ColorDef.black;
      this.pixelWidth = 1;
      this.pattern = 0;
    } else {
      this.color = json.color ? ColorDef.create(json.color) : ColorDef.black;
      this.pixelWidth = json.pixelWidth ?? 1;
      this.pattern = json.pattern ?? 0;
    }
  }

  public static fromJSON(json?: ContourStyleProps) {
    return json ? new ContourStyle(json) : new ContourStyle({});
  }

  public toJSON(): ContourStyleProps {
    const props: ContourStyleProps = {};

    if (!this.color.equals(ColorDef.black))
      props.color = this.color.toJSON();

    if (2 !== this.pixelWidth)
      props.pixelWidth = this.pixelWidth;

    if (0 !== this.pattern)
      props.pattern = this.pattern;

    return props;
  }
}

/** JSON representation of the rendering styling settings that apply to a specific set of subcategories within a [[ContourGroup]]. */
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
   * The major contour is dependent on the minor contour. The interval of its occurence is not measured directly in meters; rather it is a count of minor contour intervals between its occurrences.
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

  /** Compares two contours.
     * @param lhs First contour to compare
     * @param rhs Second contour to compare
     * @returns 0 if lhs is equivalent to rhs, a negative number if lhs compares less than rhs, or a positive number if lhs compares greater than rhs.
     */
  public static compare(lhs: Contour, rhs: Contour): number {
    let diff = 0;
    if ((diff = ContourStyle.compare(lhs.majorStyle, rhs.majorStyle)) !== 0)
      return diff;
    if ((diff = ContourStyle.compare(lhs.minorStyle, rhs.minorStyle)) !== 0)
      return diff;
    if ((diff = compareNumbers(lhs.minorInterval, rhs.minorInterval)) !== 0)
      return diff;
    if ((diff = compareNumbers(lhs.majorIntervalCount, rhs.majorIntervalCount)) !== 0)
      return diff;
    if ((diff = compareBooleans(lhs.showGeometry, rhs.showGeometry)) !== 0)
      return diff;

    return diff;
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

/** JSON representation of the description of how contours should appear for a particular set of subcategories. */
export interface ContourGroupProps {
  /** See [[ContourGroup.contourDef]]. */
  contourDef?: ContourProps;
  /** See [[ContourGroup.subCategories]]. */
  subCategories?: CompressedId64Set;
}

/** Contains a description of how contours should appear for a particular set of subcategories. A contour group is an organizational concept which associates a contour appearance with a list of subcategories within an iModel.
   * @see [[Contour]]
   */
export class ContourGroup {
  private _subCategories: CompressedId64Set;

  /** A [[Contour]] object describing how the contours for this contour group should appear. Defaults to an instantation of [[Contour]] using all of its own default properties. */
  public readonly contourDef: Contour;

  /** List of subcategory IDs to which this contour group's styling will be applied. */
  public get subCategories(): OrderedId64Iterable {
    return CompressedId64Set.iterable(this._subCategories);
  }

  public equals(other: ContourGroup | undefined): boolean {
    if (this === undefined && other === undefined)
      return true;
    if (this === undefined || other === undefined)
      return false;
    if (!this.contourDef.equals(other.contourDef))
      return false;
    if (this._subCategories !== other._subCategories)
      return false;
    return true;
  }

  private constructor(json?: ContourGroupProps) {
    if (undefined === json) {
      this.contourDef = Contour.fromJSON({});
      this._subCategories = "";
    } else {
      this.contourDef = json.contourDef ? Contour.fromJSON(json.contourDef) : Contour.fromJSON({});
      this._subCategories = json.subCategories ? json.subCategories : "";
    }
  }

  public static fromJSON(json?: ContourGroupProps) {
    return json ? new ContourGroup(json) : new ContourGroup({});
  }

  public toJSON(): ContourGroupProps {
    const props: ContourGroupProps = {};

    if (!this.contourDef.equals(Contour.defaults))
      props.contourDef = this.contourDef.toJSON();

    props.subCategories = this._subCategories;
    return props;
  }
}

/** JSON representation of the contour display setup of a [[DisplayStyle3d]]. */
export interface ContourDisplayProps {
  /** See [[ContourDisplay.groups]]. */
  groups?: (ContourGroupProps | undefined)[];
}

/** The contour display setup of a [[DisplayStyle3d]].
   * Contour display allows a user to apply specific contour line renderings to subcategories within a scene.
   */
export class ContourDisplay {
  /** A list of the groups which contain their own specific contour display settings. Defaults to an empty array. */
  public readonly groups: (ContourGroup | undefined)[] = [];

  public equals(other: ContourDisplay): boolean {
    if (this.groups.length !== other.groups.length)
      return false;
    for (const group of this.groups) {
      const match = other.groups.find((element) => element?.equals(group));
      if (!match)
        return false;
    }
    return true;
  }

  private constructor(json?: ContourDisplayProps) {
    if (undefined !== json && undefined !== json.groups) {
      for (let n = 0; n < json.groups.length; n++) {
        this.groups[n] = (json.groups[n] === undefined) ? undefined : ContourGroup.fromJSON(json.groups[n]);
      }
    }
  }

  public static fromJSON(json?: ContourDisplayProps) {
    return json ? new ContourDisplay(json) : new ContourDisplay({});
  }

  public toJSON(): ContourDisplayProps {
    const props: ContourDisplayProps = {};

    props.groups = [];
    for (let n = 0; n < this.groups.length; n++) {
      props.groups[n] = this.groups[n]?.toJSON();
    }

    return props;
  }
}
