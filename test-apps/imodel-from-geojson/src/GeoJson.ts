/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import * as path from "path";

/** Class that loads GeoJSON data from an input file. */
export class GeoJson {
  public readonly data: any;
  public readonly title: string;
  public constructor(inputFileName: string) {
    this.data = JSON.parse(fs.readFileSync(inputFileName, "utf8"));
    this.title = path.parse(inputFileName).name;
    if (!Array.isArray(this.data.features)) {
      throw new Error("Invalid GeoJSON");
    }
  }
}

/** Constants associated with GeoJson. */
export namespace GeoJson { // eslint-disable-line no-redeclare
  export type Geometry = any;
  export type Polygon = any;
  export type LineString = any;
  export type Point = any;

  export enum GeometryType {
    multiPolygon = "MultiPolygon",
    polygon = "Polygon",
    linestring = "LineString",
    point = "Point",
  }
}
