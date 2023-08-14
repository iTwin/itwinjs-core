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

/** Identifies a node within a [quad tree](https://en.wikipedia.org/wiki/Quadtree), such as a [[MapTile]] within a [[MapTileTree]].
 * A quad tree recursively sub-divides a two-dimensional space along the X and Y axes such that each node on level L has four child nodes on
 * level L+1.
 * @public
 */
export class QuadId {
  /** The level of the node within the tree, increasing with each subdivision, as a non-negative integer. */
  public level: number;
  /** The node's position along the X axis as a non-negative integer. */
  public column: number;
  /** The node's position along the Y axis as a non-negative integer. */
  public row: number;

  /** @alpha */
  public get isValid() {
    return this.level >= 0;
  }

  /** @alpha */
  public static createFromContentId(stringId: string) {
    const idParts = stringId.split("_");
    assert(idParts.length === 3);
    if (3 !== idParts.length)
      return new QuadId(-1, -1, -1);

    return new QuadId(parseInt(idParts[0], 10), parseInt(idParts[1], 10), parseInt(idParts[2], 10));
  }

  /** @alpha */
  public get contentId(): string {
    return  QuadId.getTileContentId(this.level, this.column, this.row);
  }

  /** @alpha */
  public static getTileContentId(level: number, column: number, row: number): string {
    return `${level}_${column}_${row}`;
  }

  /** @alpha */
  public get debugString(): string {
    return `Level: ${this.level} Column: ${this.column} Row: ${this.row}`;
  }

  /** Construct a new QuadId. The inputs are expected to be non-negative integers. */
  public constructor(level: number, column: number, row: number) {
    this.level = level;
    this.column = column;
    this.row = row;
  }

  /** Compute the QuadIds corresponding to this node's four child nodes. */
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

  /** Compute the region of the surface of the Earth represented by this node according to the specified tiling scheme. */
  public getLatLongRangeDegrees(mapTilingScheme: MapTilingScheme): Range2d {
    return this._getLatLongRange(mapTilingScheme, "degrees");
  }

  /** Compute the region of the surface of the Earth represented by this node according to the specified tiling scheme. */
  public getLatLongRangeRadians(mapTilingScheme: MapTilingScheme): Range2d {
    return this._getLatLongRange(mapTilingScheme, "radians");
  }

  private _getLatLongRange(mapTilingScheme: MapTilingScheme, units: "radians" | "degrees"): Range2d {
    const range = Range2d.createNull();
    const factor = "degrees" === units ? Angle.degreesPerRadian : 1;

    mapTilingScheme.tileXYToCartographic(this.column, this.row, this.level, scratchCartographic1);
    range.extendXY(scratchCartographic1.longitude * factor, scratchCartographic1.latitude * factor);
    mapTilingScheme.tileXYToCartographic(this.column + 1, this.row + 1, this.level, scratchCartographic2);
    range.extendXY(scratchCartographic2.longitude * factor, scratchCartographic2.latitude * factor);

    return range;
  }

  /** @alpha */
  public getAngleSweep(mapTilingScheme: MapTilingScheme): { longitude: AngleSweep, latitude: AngleSweep } {
    mapTilingScheme.tileXYToCartographic(this.column, this.row, this.level, scratchCartographic1);
    mapTilingScheme.tileXYToCartographic(this.column + 1, this.row + 1, this.level, scratchCartographic2);
    return {
      longitude: AngleSweep.createStartEndRadians(scratchCartographic1.longitude, scratchCartographic2.longitude),
      latitude: AngleSweep.createStartEndRadians(
        Cartographic.parametricLatitudeFromGeodeticLatitude(scratchCartographic1.latitude),
        Cartographic.parametricLatitudeFromGeodeticLatitude(scratchCartographic2.latitude),
      ),
    };
  }

  /** Returns true if this node is adjacent to the south pole according to the specified tiling scheme. */
  public bordersSouthPole(mapTilingScheme: MapTilingScheme) {
    return mapTilingScheme.tileBordersSouthPole(this.row, this.level);
  }

  /** Returns true if this node is adjacent to the north pole according to the specified tiling scheme. */
  public bordersNorthPole(mapTilingScheme: MapTilingScheme) {
    return mapTilingScheme.tileBordersNorthPole(this.row, this.level);
  }

  /** Compares this Id to another according to the conventions of an [OrderedComparator]($bentley). */
  public compare(other: QuadId): number {
    return compareNumbers(this.level, other.level) ||
      compareNumbers(this.row, other.row) ||
      compareNumbers(this.column, other.column);
  }
}
