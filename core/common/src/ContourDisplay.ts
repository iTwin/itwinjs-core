/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { compareNumbers, Id64String } from "@itwin/core-bentley";
import { ColorDef, ColorDefProps } from "./ColorDef";

export namespace ContourDisplay {
  export interface ContourProps {
    /** See [[Contour.majorColor]]. */
    majorColor?: ColorDefProps;
    /** See [[Contour.minorColor]]. */
    minorColor?: ColorDefProps;
    /** See [[Contour.majorPixelWidth]]. */
    majorPixelWidth?: number;
    /** See [[Contour.minorPixelWidth]]. */
    minorPixelWidth?: number;
    /** See [[Contour.MajorPatterIndex]]. */
    majorPattern?: number;
    /** See [[Contour.MinorPatterIndex]]. */
    minorPattern?: number;
    /** See [[Contour.minorInterval]]. */
    minorInterval?: number;
    /** See [[Contour.majorIntervalCount]]. */
    majorIntervalCount?: number;
  }

  export class Contour {
    /** Color that a major contour line will use. */
    public readonly majorColor: ColorDef;
    /** Color that a minor contour line will use. */
    public readonly minorColor: ColorDef;
    /** A width in pixels of a major contour line. (Range 1.5 to 9 in 0.5 increments) */
    public readonly majorPixelWidth: number;
    /** A width in pixels of a minor contour line. (Range 1.5 to 9 in 0.5 increments) */
    public readonly minorPixelWidth: number;
    /** A pattern index defining the pattern for a major contour line (0 is solid). */
    public readonly majorPattern: number;
    /** A pattern index defining the pattern for a minor contour line (0 is solid). */
    public readonly minorPattern: number;
    /** The interval for the minor contour in the associated terrain in meters. */
    public readonly minorInterval: number;
    /** The count of minor contour intervals that define a major interval (integer > 0) */
    public readonly majorIntervalCount: number;

    public static readonly defaults = new Contour({});

    public equals(other: Contour): boolean {
      if (!this.majorColor.equals(other.majorColor) || !this.minorColor.equals(other.minorColor) || this.majorPixelWidth !== other.majorPixelWidth || this.minorPixelWidth !== other.minorPixelWidth ||
         this.majorPattern !== other.majorPattern|| this.minorPattern !== other.minorPattern || this.minorInterval !== other.minorInterval  || this.majorIntervalCount !== other.majorIntervalCount ) {
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
      if ((diff = compareNumbers(lhs.majorColor.getRgb(), rhs.majorColor.getRgb())) !== 0)
        return diff;
      if ((diff = compareNumbers(lhs.minorColor.getRgb(), rhs.minorColor.getRgb())) !== 0)
        return diff;
      if ((diff = compareNumbers(lhs.majorPixelWidth, rhs.majorPixelWidth)) !== 0)
        return diff;
      if ((diff = compareNumbers(lhs.minorPixelWidth, rhs.minorPixelWidth)) !== 0)
        return diff;
      if ((diff = compareNumbers(lhs.majorPattern, rhs.majorPattern)) !== 0)
        return diff;
      if ((diff = compareNumbers(lhs.minorPattern, rhs.minorPattern)) !== 0)
        return diff;
      if ((diff = compareNumbers(lhs.minorInterval, rhs.minorInterval)) !== 0)
        return diff;
      if ((diff = compareNumbers(lhs.majorIntervalCount, rhs.majorIntervalCount)) !== 0)
        return diff;

      return diff;
    }

    private constructor(json?: ContourProps) {
      if (undefined === json) {
        this.majorColor = ColorDef.black;
        this.minorColor = ColorDef.black;
        this.majorPixelWidth = 4;
        this.minorPixelWidth = 2;
        this.majorPattern = 0;
        this.minorPattern = 0;
        this.minorInterval = 1;
        this.majorIntervalCount = 5;
      } else {
        this.majorColor = json.majorColor ? ColorDef.create(json.majorColor) : ColorDef.black;
        this.minorColor = json.minorColor ? ColorDef.create(json.minorColor) : ColorDef.black;
        this.majorPixelWidth = json.majorPixelWidth ?? 4;
        this.minorPixelWidth = json.minorPixelWidth ?? 2;
        this.majorPattern = json.majorPattern ?? 0;
        this.minorPattern = json.minorPattern ?? 0;
        this.minorInterval = json.minorInterval ?? 1;
        this.majorIntervalCount = json.majorIntervalCount ?? 5;
      }
    }

    public static fromJSON(json?: ContourProps) {
      return json ? new Contour(json) : new Contour({});
    }

    public toJSON(): ContourProps {
      const props: ContourProps = {};

      if (!this.majorColor.equals(ColorDef.black))
        props.majorColor = this.majorColor.toJSON();

      if (!this.minorColor.equals(ColorDef.black))
        props.minorColor = this.minorColor.toJSON();

      if (4 !== this.majorPixelWidth)
        props.majorPixelWidth = this.majorPixelWidth;

      if (2 !== this.minorPixelWidth)
        props.minorPixelWidth = this.minorPixelWidth;

      if (0 !== this.majorPattern)
        props.majorPattern = this.majorPattern;

      if (0 !== this.minorPattern)
        props.minorPattern = this.minorPattern;

      if (1 !== this.minorInterval)
        props.minorInterval = this.minorInterval;

      if (5 !== this.majorIntervalCount)
        props.majorIntervalCount = this.majorIntervalCount;

      return props;
    }
  }

  export interface TerrainProps {
    /** See [[Terrain.contourDef]]. */
    contourDef?: ContourProps;
    /** See [[Terrain.subCategories]]. */
    subCategories?: Id64String[];
  }

  export class Terrain {
    /** How the contours for this terrain should appear. */
    public readonly contourDef: Contour;
    /** List of subcategory IDs to which this terrain styling will be applied. */
    public readonly subCategories: Id64String[];

    public equals(other: Terrain | undefined): boolean {
      if (this === undefined && other === undefined)
        return true;
      if (this === undefined || other === undefined)
        return false;
      if (!this.contourDef.equals(other.contourDef))
        return false;
      if (this.subCategories.length !== other.subCategories.length)
        return false;
      for (const subCategory of this.subCategories) {
        const match = other.subCategories.find((element) => element === subCategory);
        if (!match)
          return false;
      }
      return true;
    }

    private constructor(json?: TerrainProps) {
      if (undefined === json) {
        this.contourDef = Contour.fromJSON({});
        this.subCategories = [];
      } else {
        this.contourDef = json.contourDef ? Contour.fromJSON(json.contourDef) : Contour.fromJSON({});
        this.subCategories = json.subCategories ? [...json.subCategories] : [];
      }
    }

    public static fromJSON(json?: TerrainProps) {
      return json ? new Terrain(json) : new Terrain({});
    }

    public toJSON(): TerrainProps {
      const props: TerrainProps = {};

      if (!this.contourDef.equals(Contour.defaults))
        props.contourDef = this.contourDef.toJSON();

      if (this.subCategories.length > 0)
        props.subCategories = [...this.subCategories];

      return props;
    }
  }

  export interface SettingsProps {
    /** See [[ContourDisplay.terrains]]. */
    terrains?: (TerrainProps | undefined)[];
  }

  export class Settings {
    /** A list of the terrains. */
    public readonly terrains: (Terrain | undefined)[] = [];

    public equals(other: Settings): boolean {
      if (this.terrains.length !== other.terrains.length)
        return false;
      for (const terrain of this.terrains) {
        const match = other.terrains.find((element) => element?.equals(terrain));
        if (!match)
          return false;
      }
      return true;
    }

    private constructor(json?: SettingsProps) {
      if (undefined !== json && undefined !== json.terrains) {
        for (let n = 0; n < json.terrains.length; n++) {
          this.terrains[n] = (json.terrains[n] === undefined) ? undefined : Terrain.fromJSON(json.terrains[n]);
        }
      }
    }

    public static fromJSON(json?: SettingsProps) {
      return json ? new Settings(json) : new Settings({});
    }

    public toJSON(): SettingsProps {
      const props: SettingsProps = {};

      props.terrains = [];
      for (let n = 0; n < this.terrains.length; n++) {
        props.terrains[n] = this.terrains[n]?.toJSON();
      }

      return props;
    }
  }
}
