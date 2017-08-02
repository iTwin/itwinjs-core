/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point3d, Range3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { Elements } from "./Elements";
import { Models } from "./Model";
import { DgnDb } from "@bentley/imodeljs-dgnplatform/lib/DgnDb";
import { ECSqlStatement } from "@bentley/imodeljs-dgnplatform/lib/DgnDb";
export { ECSqlStatement } from "@bentley/imodeljs-dgnplatform/lib/DgnDb";
import { BeSQLite } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";

/** An iModel database. */
export class IModel {
  private _db: DgnDb;
  private _elements: Elements;
  private _models: Models;
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON

  /** Open the iModel
   * @param fileName  The name of the iModel
   * @param mode      Open mode for database
   * @return non-zero error status if the iModel could not be opened
   */
  public async openDgnDb(fileName: string, mode?: BeSQLite.OpenMode): Promise<BeSQLite.DbResult> {
    mode = (typeof mode === "number") ? mode : BeSQLite.OpenMode.Readonly;
    if (!this._db)
      this._db = await new DgnDb();
    return this._db.openDgnDb(fileName, mode);
  }

  /** Get the Elements of this iModel */
  public get elements(): Elements {
    if (!this._elements)
      this._elements = new Elements(this);
    return this._elements;
  }

  /** Get the Models of this iModel */
  public get models(): Models {
    if (!this._models)
      this._models = new Models(this);
    return this._models;
  }

  public get dgnDb(): DgnDb {
    return this._db;
  }

  /**
   * Get a prepared ECSqlStatement
   * @param ecsql  The ECSql statement to prepare
   * @return an ECSqlStatement.
   * @throws Error if ecsql is invalid
   */
  public getPreparedECSqlSelectStatement(ecsql: string): Promise<ECSqlStatement> {
      return this._db.getPreparedECSqlSelectStatement(ecsql);
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
   * @param bId an integer identifying the briefcase id
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

export interface CodeProps {
  spec: Id | string;
  scope: string;
  value?: string;
}

/** A 3 part Code that identifies an Element */
export class Code implements CodeProps {
  public spec: Id;
  public scope: string;
  public value?: string;

  constructor(val: CodeProps) {
    this.spec = new Id(val.spec);
    this.scope = JsonUtils.asString(val.scope, "");
    this.value = JsonUtils.asString(val.value);
  }

  /** Create an instance of the default code (1,1,null) */
  public static createDefault(): Code { return new Code({ spec: new Id(1), scope: "1" }); }
  public getValue(): string { return this.value ? this.value : ""; }
}

/** A bounding box aligned to the orientation of an Element */
export class ElementAlignedBox3d extends Range3d {
  public constructor(low: Point3d, high: Point3d) { super(low.x, low.y, low.z, high.x, high.y, high.z); }
  public get left(): number { return this.low.x; }
  public get front(): number { return this.low.y; }
  public get bottom(): number { return this.low.z; }
  public get right(): number { return this.high.x; }
  public get back(): number { return this.high.y; }
  public get top(): number { return this.high.z; }
  public get width(): number { return this.xLength(); }
  public get depth(): number { return this.yLength(); }
  public get height(): number { return this.zLength(); }
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
