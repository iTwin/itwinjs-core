/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, compareNumbers } from "@itwin/core-bentley";
import { Angle, AngleSweep, Range2d } from "@itwin/core-geometry";
import { Cartographic } from "@itwin/core-common";
import { MapTilingScheme } from "../internal";

const scratchCartographic1 = Cartographic.createZero();
const scratchCartographic2 = Cartographic.createZero();

/** @internal */
export class QuadId {
  public level: number;
  public column: number;
  public row: number;
  public get isValid() { return this.level >= 0; }

  public static createFromContentId(stringId: string) {
    const idParts = stringId.split("_");
    if (3 !== idParts.length) {
      assert(false, "Invalid quad tree ID");
      return new QuadId(-1, -1, -1);
    }

    return new QuadId(parseInt(idParts[0], 10), parseInt(idParts[1], 10), parseInt(idParts[2], 10));
  }

  public get contentId(): string { return `${this.level}_${this.column}_${this.row}`; }
  public get debugString(): string { return `Level: ${this.level} Column: ${this.column} Row: ${this.row}`; }

  public constructor(level: number, column: number, row: number) {
    this.level = level;
    this.column = column;
    this.row = row;
  }
  public getChildIds(columnCount = 2, rowCount = 2): QuadId[] {
    const childIds = [];
    const level = this.level + 1;
    const column = this.column * 2;
    const row = this.row * 2;
    for (let j = 0; j < rowCount; j++)
      for (let i = 0; i < columnCount; i++)
        childIds.push(new QuadId(level, column + i, row + j));

    return childIds;
  }

  // Not used in display - used only to tell whether this tile overlaps the range provided by a tile provider for attribution.
  public getLatLongRange(mapTilingScheme: MapTilingScheme): Range2d {
    const range = Range2d.createNull();
    mapTilingScheme.tileXYToCartographic(this.column, this.row, this.level, scratchCartographic1);
    range.extendXY(scratchCartographic1.longitude * Angle.degreesPerRadian, scratchCartographic1.latitude * Angle.degreesPerRadian);
    mapTilingScheme.tileXYToCartographic(this.column + 1, this.row + 1, this.level, scratchCartographic2);
    range.extendXY(scratchCartographic2.longitude * Angle.degreesPerRadian, scratchCartographic2.latitude * Angle.degreesPerRadian);

    return range;
  }

  public getAngleSweep(mapTilingScheme: MapTilingScheme): { longitude: AngleSweep, latitude: AngleSweep } {
    mapTilingScheme.tileXYToCartographic(this.column, this.row, this.level, scratchCartographic1);
    mapTilingScheme.tileXYToCartographic(this.column + 1, this.row + 1, this.level, scratchCartographic2);
    return { longitude: AngleSweep.createStartEndRadians(scratchCartographic1.longitude, scratchCartographic2.longitude), latitude: AngleSweep.createStartEndRadians(Cartographic.parametricLatitudeFromGeodeticLatitude(scratchCartographic1.latitude), Cartographic.parametricLatitudeFromGeodeticLatitude(scratchCartographic2.latitude)) };
  }

  public bordersSouthPole(mapTilingScheme: MapTilingScheme) {
    return mapTilingScheme.tileBordersSouthPole(this.row, this.level);
  }

  public bordersNorthPole(mapTilingScheme: MapTilingScheme) {
    return mapTilingScheme.tileBordersNorthPole(this.row, this.level);
  }
  public compare(other: QuadId): number {
    let cmp = compareNumbers(this.level, other.level);
    if (0 === cmp) {
      cmp = compareNumbers(this.row, other.row);
      if (0 === cmp)
        cmp = compareNumbers(this.column, other.column);
    }
    return cmp;
  }
}
