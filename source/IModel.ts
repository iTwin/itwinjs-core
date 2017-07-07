/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point3d, Range3d, YawPitchRollAngles } from "../../geometry-core/lib/PointVector";
import { Elements } from "./Elements"

// *** NEEDS WORK: Somehow, get a different implementation of dgnNative, dependening on whether we are in node or not and whether we are in the UI thread or not.
/// <reference path="../node_modules/imodeljsnode/iModelJsNodeAddon.d.ts"/>
import * as dgnNative from "../node_modules/imodeljsnode/iModelJsNodeAddon.js";

/** An iModel file */
export class IModel {
  _db: dgnNative.DgnDb;
  _elements: Elements;

  public constructor() {
    this._db = new dgnNative.DgnDb();
  }

  /** open the iModel
   * @param fileName  The name of the iModel
   * @param mode      Open mode
   * @return non-zero error status if the iModel could not be opened
   */
  public openDgnDb(fileName: string, mode?: dgnNative.DgnDb_OpenMode): dgnNative.BeSQLite_DbResult {
    if (!mode)
      mode = dgnNative.DgnDb_OpenMode.Readonly;
    return this._db.openDgnDb(fileName, mode)
  }

  /** Get access to the Elements in the iModel */
  public get Elements(): Elements {
    if (!this._elements)
      this._elements = new Elements(this);
    return this._elements;
  }
}

/** A bounding box aligned to the orientation of an Element */
export class ElementAlignedBox3d extends Range3d {
  public constructor(low: Point3d, high: Point3d) { super(low.x, low.y, low.z, high.x, high.y, high.z); }

  public getLeft(): number { return this.low.x; }
  public getFront(): number { return this.low.y; }
  public getBottom(): number { return this.low.z; }
  public getRight(): number { return this.high.x; }
  public getBack(): number { return this.high.y; }
  public getTop(): number { return this.high.z; }
  public getWidth(): number { return this.xLength(); }
  public getDepth(): number { return this.yLength(); }
  public getHeight(): number { return this.zLength(); }
}

export class GeometryStream {
  public geomStream: ArrayBuffer;

  // return false if this GeometryStream is empty.
  public hasGeometry(): boolean { return this.geomStream.byteLength !== 0; }
}

export class Placement3d {
  public constructor(public origin?: Point3d, public angles?: YawPitchRollAngles, public boundingBox?: ElementAlignedBox3d) { }
}

const scratchBytes: Uint8Array = new Uint8Array(4);
const scratchUInt32: Uint32Array = new Uint32Array(scratchBytes.buffer);

/** an RGBA value for a color */
export class ColorDef {
  private _rgba: number;

  public constructor(rgba: number) { this.rgba = rgba; }

  public static from(r: number, g: number, b: number, a?: number, result?: ColorDef) {
    scratchBytes[0] = r;
    scratchBytes[1] = g;
    scratchBytes[2] = b;
    scratchBytes[3] = a ? a : 0;
    if (result)
      result.rgba = scratchUInt32[0];
    else
      result = new ColorDef(scratchUInt32[0]);
    return result;
  }

  public getColors() { scratchUInt32[0] = this._rgba; return { r: scratchBytes[0], g: scratchBytes[1], b: scratchBytes[2], a: scratchBytes[3] }; }
  public get rgba(): number { return this._rgba; }
  public set rgba(rgba: number) { this._rgba = rgba | 0; }

  public equals(other: ColorDef): boolean { return this._rgba === other._rgba; }

  public static black(): ColorDef { return ColorDef.from(0, 0, 0); }
  public static white(): ColorDef { return ColorDef.from(0xff, 0xff, 0xff); }
  public static red(): ColorDef { return ColorDef.from(0xff, 0, 0); }
  public static green(): ColorDef { return ColorDef.from(0, 0xff, 0); }
  public static blue(): ColorDef { return ColorDef.from(0, 0, 0xff); }
  public static Yellow(): ColorDef { return ColorDef.from(0xff, 0xff, 0); }
  public static cyan(): ColorDef { return ColorDef.from(0, 0xff, 0xff); }
  public static orange(): ColorDef { return ColorDef.from(0xff, 0xa5, 0); }
  public static magenta(): ColorDef { return ColorDef.from(0xff, 0, 0xff); }
  public static brown(): ColorDef { return ColorDef.from(0xa5, 0x2a, 0x2a); }
  public static lightGrey(): ColorDef { return ColorDef.from(0xbb, 0xbb, 0xbb); }
  public static mediumGrey(): ColorDef { return ColorDef.from(0x88, 0x88, 0x88); }
  public static darkGrey(): ColorDef { return ColorDef.from(0x55, 0x55, 0x55); }
  public static darkRed(): ColorDef { return ColorDef.from(0x80, 0, 0); }
  public static darkGreen(): ColorDef { return ColorDef.from(0, 0x80, 0); }
  public static darkBlue(): ColorDef { return ColorDef.from(0, 0, 0x80); }
  public static darkYellow(): ColorDef { return ColorDef.from(0x80, 0x80, 0); }
  public static darkOrange(): ColorDef { return ColorDef.from(0xff, 0x8c, 0); }
  public static darkCyan(): ColorDef { return ColorDef.from(0, 0x80, 0x80); }
  public static darkMagenta(): ColorDef { return ColorDef.from(0x80, 0, 0x80); }
  public static darkBrown(): ColorDef { return ColorDef.from(0x8b, 0x45, 0x13); }
}
