/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point3d, Range3d, YawPitchRollAngles } from "../../geometry-core/lib/Geometry";

/** An iModel file */
export class IModel {
  constructor(public name: string) { }
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
  public r: number;
  public g: number;
  public b: number;
  public a: number;
  constructor(r?: number, g?: number, b?: number, a?: number) {
    this.r = r ? (r & 0xff) : 0;
    this.g = g ? (g & 0xff) : 0;
    this.b = b ? (b & 0xff) : 0;
    this.a = a ? (a & 0xff) : 0;
  }

  public getRgba(): number { scratchBytes[0] = this.r; scratchBytes[1] = this.g; scratchBytes[2] = this.b; scratchBytes[3] = this.a; return scratchUInt32[0]; }
  public static fromBytes(red: number, green: number, blue: number, alpha: number, result?: ColorDef) {
    if (!result) {
      return new ColorDef(red, green, blue, alpha);
    }

    result.r = red & 0xff;
    result.g = green & 0xff;
    result.b = blue & 0xff;
    result.a = alpha & 0xff;
    return result;
  }

  public static fromRgba(v: number, result?: ColorDef): ColorDef { scratchUInt32[0] = v; return ColorDef.fromBytes(scratchBytes[0], scratchBytes[1], scratchBytes[2], scratchBytes[3], result); }
  public equals(other: ColorDef): boolean { return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a; }

  public static black(): ColorDef { return new ColorDef(0, 0, 0); }
  public static white(): ColorDef { return new ColorDef(0xff, 0xff, 0xff); }
  public static red(): ColorDef { return new ColorDef(0xff, 0, 0); }
  public static green(): ColorDef { return new ColorDef(0, 0xff, 0); }
  public static blue(): ColorDef { return new ColorDef(0, 0, 0xff); }
  public static Yellow(): ColorDef { return new ColorDef(0xff, 0xff, 0); }
  public static cyan(): ColorDef { return new ColorDef(0, 0xff, 0xff); }
  public static orange(): ColorDef { return new ColorDef(0xff, 0xa5, 0); }
  public static magenta(): ColorDef { return new ColorDef(0xff, 0, 0xff); }
  public static brown(): ColorDef { return new ColorDef(0xa5, 0x2a, 0x2a); }
  public static lightGrey(): ColorDef { return new ColorDef(0xbb, 0xbb, 0xbb); }
  public static mediumGrey(): ColorDef { return new ColorDef(0x88, 0x88, 0x88); }
  public static darkGrey(): ColorDef { return new ColorDef(0x55, 0x55, 0x55); }
  public static darkRed(): ColorDef { return new ColorDef(0x80, 0, 0); }
  public static darkGreen(): ColorDef { return new ColorDef(0, 0x80, 0); }
  public static darkBlue(): ColorDef { return new ColorDef(0, 0, 0x80); }
  public static darkYellow(): ColorDef { return new ColorDef(0x80, 0x80, 0); }
  public static darkOrange(): ColorDef { return new ColorDef(0xff, 0x8c, 0); }
  public static darkCyan(): ColorDef { return new ColorDef(0, 0x80, 0x80); }
  public static darkMagenta(): ColorDef { return new ColorDef(0x80, 0, 0x80); }
  public static darkBrown(): ColorDef { return new ColorDef(0x8b, 0x45, 0x13); }
}
