/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { compareNumbers, Id64String } from "@itwin/core-bentley";
import { ColorDef, ColorDefProps } from "./ColorDef";

export interface CivilContourProps {
  /** See [[CivilContour.color]]. */
  color?: ColorDefProps;
  /** See [[CivilContour.pixelWidth]]. */
  pixelWidth?: number;
  /** See [[CivilContour.dashedPattern]]. */
  pattern?: number;
  /** See [[CivilContour.interval]]. */
  interval?: number;
}

export class CivilContour {
  /** Color that this contour line will use. */
  public readonly color: ColorDef;
  /** A width in pixels of this contour line. */
  public readonly pixelWidth: number;
  /** If non-zero, use as a 32-bit pattern for this contour line; bits that are 1 represent where the pattern is visible. */
  public readonly pattern: number;
  /** The interval for this particular contour's occurence in the associated terrain. */
  public readonly interval: number;

  public static readonly defaults = new CivilContour({});

  public equals(other: CivilContour): boolean {
    if (!this.color.equals(other.color) || this.pixelWidth !== other.pixelWidth || this.pattern !== other.pattern || this.interval !== other.interval) {
      return false;
    }
    return true;
  }

  /** Compares two contours.
   * @param lhs First contour to compare
   * @param rhs Second contour to compare
   * @returns 0 if lhs is equivalent to rhs, a negative number if lhs compares less than rhs, or a positive number if lhs compares greater than rhs.
   */
  public static compare(lhs: CivilContour, rhs: CivilContour): number {
    let diff = 0;
    if ((diff = compareNumbers(lhs.color.getRgb(), rhs.color.getRgb())) !== 0)
      return diff;
    if ((diff = compareNumbers(lhs.pixelWidth, rhs.pixelWidth)) !== 0)
      return diff;
    if ((diff = compareNumbers(lhs.pattern, rhs.pattern)) !== 0)
      return diff;
    if ((diff = compareNumbers(lhs.interval, rhs.interval)) !== 0)
      return diff;

    return diff;
  }

  private constructor(json?: CivilContourProps) {
    if (undefined === json) {
      this.color = ColorDef.black;
      this.pixelWidth = 1;
      this.pattern = 0;
      this.interval = 5;
    } else {
      this.color = json.color ? ColorDef.create(json.color) : ColorDef.black;
      this.pixelWidth = json.pixelWidth ?? 1;
      this.pattern = json.pattern ?? 0;
      this.interval = json.interval ?? 5;
    }
  }

  public static fromJSON(json?: CivilContourProps) {
    return json ? new CivilContour(json) : this.defaults;
  }

  public toJSON(): CivilContourProps {
    const props: CivilContourProps = {};

    if (!this.color.equals(ColorDef.black))
      props.color = this.color.toJSON();

    if (1 !== this.pixelWidth)
      props.pixelWidth = this.pixelWidth;

    if (0 !== this.pattern)
      props.pattern = this.pattern;

    if (5 !== this.interval)
      props.interval = this.interval;

    return props;
  }
}

export interface CivilTerrainProps {
  /** See [[CivilTerrain.majorContour]]. */
  majorContour?: CivilContourProps;
  /** See [[CivilTerrain.minorContour]]. */
  minorContour?: CivilContourProps;
  /** See [[CivilTerrain.subCategories]]. */
  subCategories?: Id64String[];
}

export class CivilTerrain {
  /** How the major contours for this terrain should appear. */
  public readonly majorContour: CivilContour;
  /** How the minor contours for this terrain should appear. */
  public readonly minorContour: CivilContour;
  /** List of subcategory IDs to which this terrain styling will be applied. */
  public readonly subCategories: Id64String[];

  public static readonly defaults = new CivilTerrain({});

  public equals(other: CivilTerrain): boolean {
    if (!this.majorContour.equals(other.majorContour) || !this.minorContour.equals(other.minorContour)) {
      return false;
    }
    if (this.subCategories.length !== other.subCategories.length)
      return false;
    for (const subCategory of this.subCategories) {
      const match = other.subCategories.find((element) => element === subCategory);
      if (!match)
        return false;
    }
    return true;
  }

  private constructor(json?: CivilTerrainProps) {
    if (undefined === json) {
      this.majorContour = CivilContour.fromJSON({});
      this.minorContour = CivilContour.fromJSON({});
      this.subCategories = [];
    } else {
      this.majorContour = json.majorContour ? CivilContour.fromJSON(json.majorContour) : CivilContour.fromJSON({});
      this.minorContour = json.minorContour ? CivilContour.fromJSON(json.minorContour) : CivilContour.fromJSON({});
      this.subCategories = json.subCategories ? [...json.subCategories] : [];
    }
  }

  public static fromJSON(json?: CivilTerrainProps) {
    return json ? new CivilTerrain(json) : this.defaults;
  }

  public toJSON(): CivilTerrainProps {
    const props: CivilTerrainProps = {};

    if (!this.majorContour.equals(CivilContour.defaults))
      props.majorContour = this.majorContour.toJSON();

    if (!this.minorContour.equals(CivilContour.defaults))
      props.minorContour = this.minorContour.toJSON();

    if (this.subCategories.length > 0)
      props.subCategories = [...this.subCategories];

    return props;
  }
}

export interface CivilContourDisplayProps {
  /** See [[CivilContourDisplay.terrains]]. */
  terrains?: CivilTerrainProps[];
}

export class CivilContourDisplay {
  /** A list of the terrains. */
  public readonly terrains: CivilTerrain[];

  public static readonly defaults = new CivilContourDisplay({});

  public equals(other: CivilContourDisplay): boolean {
    if (this.terrains.length !== other.terrains.length)
      return false;
    for (const terrain of this.terrains) {
      const match = other.terrains.find((element) => element.equals(terrain));
      if (!match)
        return false;
    }
    return true;
  }

  private constructor(json?: CivilContourDisplayProps) {
    if (undefined === json) {
      this.terrains = [];
    } else {
      this.terrains = [];
      if (undefined !== json.terrains) {
        for (const terrainProp of json.terrains)
          this.terrains.push(CivilTerrain.fromJSON(terrainProp));
      }
    }
  }

  public static fromJSON(json?: CivilContourDisplayProps) {
    return json ? new CivilContourDisplay(json) : this.defaults;
  }

  public toJSON(): CivilContourDisplayProps {
    const props: CivilContourDisplayProps = {};

    if (0 !== this.terrains.length) {
      props.terrains = [];
      for (const terrain of this.terrains) {
        props.terrains.push(terrain.toJSON());
      }
    }

    return props;
  }
}
