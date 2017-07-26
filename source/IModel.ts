/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point3d, Range3d, YawPitchRollAngles } from "../../geometry-core/lib/PointVector";
import { Elements } from "./Elements";
import { DgnDb } from "@bentley/imodeljs-dgnplatform/lib/DgnDb";
import { BeSQLite } from "@bentley/bentleyjs-common/lib/BeSQLite";

/** An iModel file */
export class IModel {
  private db: DgnDb;
  private elements: Elements;

  /** open the iModel
   * @param fileName  The name of the iModel
   * @param mode      Open modedgndbnodeaddon
   * @return non-zero error status if the iModel could not be opened
   */
  public async openDgnDb(fileName: string, mode?: BeSQLite.OpenMode): Promise<BeSQLite.DbResult> {
    if (!mode)
      mode = BeSQLite.OpenMode.Readonly;
    if (!this.db)
      this.db = await new DgnDb();
    return this.db.openDgnDb(fileName, mode);
  }

  /** Get access to the Elements in the iModel */
  public get Elements(): Elements {
    if (!this.elements)
      this.elements = new Elements(this);
    return this.elements;
  }

  public getDgnDb(): DgnDb {
    return this.db;
  }
}

/** A two-part id, containing a IModel id and a local id. */
export class Id {
  public readonly hi: number;
  public readonly lo: number;

  private static parseHex(str: string): number {
    const v = parseInt(str, 16);
    return Number.isNaN(v) ? 0 : v;
  }
  protected toJSON(): string { return this.toString(); }

  /**
   * constructor for Id
   * @param bId an integer identifying the IModel id
   * @param lId an integer with the local id
   */
  constructor(bId?: Id | number | number[] | string, lId?: number) {
    if (bId instanceof Id) {
      this.hi = bId.hi;
      this.lo = bId.lo;
      return;
    }

    if (Array.isArray(bId)) {
      this.hi = bId[0] | 0;
      this.lo = Math.trunc(bId[1]);
      return;
    }

    if (typeof bId === "string") {
      if (bId[0] !== "0" || !(bId[1] === "x" || bId[1] === "X")) {
        this.hi = this.lo = 0;
        return;
      }

      let start = 2;
      const len = bId.length;
      if (len > 12) {
        start = (len - 10);
        const bcVal = bId.slice(2, start);
        this.hi = Id.parseHex(bcVal);
      } else {
        this.hi = 0;
      }

      this.lo = Id.parseHex(bId.slice(start));
      return;
    }

    this.hi = bId ? bId | 0 : 0;
    this.lo = lId ? Math.trunc(lId) : 0;
  }

  /** convert this Id to a string */
  public toString(): string {
    if (!this.isValid())
      return "";
    return "0X" + this.hi.toString(16) + ("0000000000" + this.lo.toString(16)).substr(-10);
  }

  /** Determine whether this Id is valid */
  public isValid(): boolean {
    return this.lo !== 0;
  }

  /** Test whether two Ids are the same
   * @param other the other id to test
   */
  public equals(other: Id): boolean {
    return this.hi === other.hi && this.lo === other.lo;
  }

  public static areEqual(a: Id | undefined, b: Id | undefined): boolean {
    return (a === b) || (a != null && b != null && a.equals(b));
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
  public static fromJSON(json?: any): ElementAlignedBox3d {
    json = json ? json : {};
    return new ElementAlignedBox3d(Point3d.fromJSON(json.low), Point3d.fromJSON(json.high));
  }
}

export class GeometryStream {
  public geomStream: ArrayBuffer;

  /** return false if this GeometryStream is empty. */
  public hasGeometry(): boolean { return this.geomStream.byteLength !== 0; }
}

/** The "placement" of a GeometricElement. This includes the origin, orientation, and size (bounding box) of the element. 
 * All geometry of a GeometricElement are relative to its placement.
 */
export class Placement3d {
  public constructor(public origin?: Point3d, public angles?: YawPitchRollAngles, public boundingBox?: ElementAlignedBox3d) { }
  public static fromJSON(json?: any): Placement3d {
    json = json ? json : {};
    return new Placement3d(Point3d.fromJSON(json.origin), YawPitchRollAngles.fromJSON(json.angles), ElementAlignedBox3d.fromJSON(json.boundingBox));
  }
}
