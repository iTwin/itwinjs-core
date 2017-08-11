/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Elements } from "./Elements";
import { ClassMetaData } from "./ECClass";
import { Models } from "./Model";
import { DgnDb } from "@bentley/imodeljs-dgnplatform/lib/DgnDb";
import { BeSQLite } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Point3d, Range3d, YawPitchRollAngles, Point2d, Range2d } from "@bentley/geometry-core/lib/PointVector";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { Base64 } from "js-base64";

/** The mapping between a class name and its the metadata for that class  */
export class ClassMetaDataRegistry {

  private reg: Map<string, ClassMetaData> = new Map<string, ClassMetaData>();

  constructor(private imodel: IModel) {
  }

  private static getKey(schemaName: string, className: string) {
    return (schemaName + "." + className).toLowerCase();
  }

  /** Get the specified ECClass metadata */
  public get(schemaName: string, className: string): ClassMetaData | undefined {
    const key: string = ClassMetaDataRegistry.getKey(schemaName, className);
    let mdata = this.reg.get(key);
    if (null !== mdata && undefined !== mdata) {
      return mdata;
    }

    if (!this.imodel.dgnDb)
      throw new Error("IModel must be open");

    const { error, result: mstr } = this.imodel.dgnDb.getECClassMetaDataSync(schemaName, className);
    if (error || !mstr)
      return undefined;

    mdata = JSON.parse(mstr) as ClassMetaData | undefined;
    if (undefined === mdata)
      return undefined;
    this.reg.set(key, mdata);
    return mdata;
  }
}

/** An iModel database. */
export class IModel {
  private _db: DgnDb;
  private _elements: Elements;
  private _models: Models;
  private _classMetaDataRegistry: ClassMetaDataRegistry;
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON

  /** Open the iModel
   * @param fileName  The name of the iModel
   * @param mode      Open mode for database
   * @return non-zero error status if the iModel could not be opened
   */
  public async openDgnDb(fileName: string, mode?: BeSQLite.OpenMode): Promise<BeSQLite.DbResult> {
    mode = (typeof mode === "number") ? mode : BeSQLite.OpenMode.Readonly;
    if (!this._db)
      this._db = new DgnDb();
    return this._db.openDb(fileName, mode)
      .then(({error}) => error ? error.status : BeSQLite.DbResult.BE_SQLITE_OK);
  }

  /** Get the ClassMetaDataRegistry for this iModel */
  public get classMetaDataRegistry(): ClassMetaDataRegistry {
    if (!this._classMetaDataRegistry)
      this._classMetaDataRegistry = new ClassMetaDataRegistry(this);
    return this._classMetaDataRegistry;
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
   * Execute a query against this iModel
   * @param ecsql  The ECSql statement to execute
   * @return all rows in JSON syntax or the empty string if nothing was selected
   * @throws Error if the statement is invalid
   */
  public executeQuery(ecsql: string): Promise<string> {
    return this._db.executeQuery(ecsql)
      .then(({error, result}) => error ? Promise.reject(error) : Promise.resolve(result || ""));
  }

}

/** A two-part id, containing a briefcase id and a local id. */
export class Id {
  private readonly value?: string;
  private static toHex(str: string): number { const v = parseInt(str, 16); return Number.isNaN(v) ? 0 : v; }
  private static isHex(str: string): boolean { return !Number.isNaN(parseInt(str, 16)); }
  protected toJSON(): string { return this.value ? this.value : ""; }

  public get lo(): number {
    if (!this.value)
      return 0;

    let start = 2;
    const len = this.value.length;
    if (len > 12)
      start = (len - 10);

    return Id.toHex(this.value.slice(start));
  }

  public get hi(): number {
    if (!this.value)
      return 0;

    let start = 2;
    const len = this.value.length;
    if (len <= 12)
      return 0;

    start = (len - 10);
    return Id.toHex(this.value.slice(2, start));
  }

  /**
   * constructor for Id
   * @param prop either a string with a hex number, an Id, or an array of two numbers with [lo,hi]. Otherwise the Id will be invalid.
   */
  constructor(prop?: Id | number[] | string) {
    if (!prop)
      return;

    if (typeof prop === "string") {
      prop = prop.toLowerCase().trim();
      if (prop[0] !== "0" || !(prop[1] === "x")) {
        return;
      }

      let start = 2;
      const len = prop.length;
      if (len > 12) {
        start = (len - 10);
        if (!Id.isHex(prop.slice(2, start)))
          return;
      }

      if (0 !== Id.toHex(prop.slice(start)))// 0 is an illegal value for the low part of an id
        this.value = prop;

      return;
    }

    if (prop instanceof Id) {
      this.value = prop.value;
      return;
    }

    if (!Array.isArray(prop) || prop.length < 2)
      return;

    const lo = prop[0] | 0;
    if (lo === 0)
      return;
    const hi = Math.trunc(prop[1]);
    this.value = "0x" + hi.toString(16).toLowerCase() + ("0000000000" + lo.toString(16).toLowerCase()).substr(-10);
  }

  /** convert this Id to a string */
  public toString(): string { return this.value ? this.value : ""; }

  /** Determine whether this Id is valid */
  public isValid(): boolean { return this.value !== undefined; }

  /** Test whether two Ids are the same
   * @param other the other id to test
   */
  public equals(other: Id): boolean { return this.value === other.value; }

  public static areEqual(a: Id | undefined, b: Id | undefined): boolean { return (a === b) || (a != null && b != null && a.equals(b)); }
}

/** properties that define a Code */
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

  /** Create an instance of the default code (1,1,undefined) */
  public static createDefault(): Code { return new Code({ spec: new Id([1, 0]), scope: "1" }); }
  public getValue(): string { return this.value ? this.value : ""; }
  public equals(other: Code): boolean { return this.spec.equals(other.spec) && this.scope === other.scope && this.value === other.value; }
}

/** A bounding box aligned to the orientation of a 3d Element */
export class ElementAlignedBox3d extends Range3d {
  public constructor(low: Point3d, high: Point3d) { super(low.x, low.y, low.z, high.x, high.y, high.z); }
  public get left(): number { return this.low.x; }
  public get bottom(): number { return this.low.y; }
  public get front(): number { return this.low.z; }
  public get right(): number { return this.high.x; }
  public get top(): number { return this.high.y; }
  public get back(): number { return this.high.z; }
  public get width(): number { return this.xLength(); }
  public get depth(): number { return this.yLength(); }
  public get height(): number { return this.zLength(); }
  public static fromJSON(json?: any): ElementAlignedBox3d {
    json = json ? json : {};
    return new ElementAlignedBox3d(Point3d.fromJSON(json.low), Point3d.fromJSON(json.high));
  }
}

/** A bounding box aligned to the orientation of a 2d Element */
export class ElementAlignedBox2d extends Range2d {
  public constructor(low: Point2d, high: Point2d) { super(low.x, low.y, high.x, high.y); }
  public get left(): number { return this.low.x; }
  public get bottom(): number { return this.low.y; }
  public get right(): number { return this.high.x; }
  public get top(): number { return this.high.y; }
  public get width(): number { return this.xLength(); }
  public get depth(): number { return this.yLength(); }
  public static fromJSON(json?: any): ElementAlignedBox2d {
    json = json ? json : {};
    return new ElementAlignedBox2d(Point2d.fromJSON(json.low), Point2d.fromJSON(json.high));
  }
}

export class GeometryStream {
  public geomStream: ArrayBuffer;

  public constructor(stream: any) { this.geomStream = stream; }

  /** return false if this GeometryStream is empty. */
  public hasGeometry(): boolean { return this.geomStream.byteLength !== 0; }
  public static fromJSON(json?: any): GeometryStream | undefined { return json ? new GeometryStream(Base64.decode(json)) : undefined; }
}

/** The placement of a GeometricElement3d. This includes the origin, orientation, and size (bounding box) of the element.
 * All geometry of a GeometricElement are relative to its placement.
 */
export class Placement3d {
  public constructor(public origin: Point3d, public angles: YawPitchRollAngles, public boundingBox: ElementAlignedBox3d) { }
  public static fromJSON(json?: any): Placement3d {
    json = json ? json : {};
    return new Placement3d(Point3d.fromJSON(json.origin), YawPitchRollAngles.fromJSON(json.angles), ElementAlignedBox3d.fromJSON(json.bbox));
  }
}
/** The placement of a GeometricElement2d. This includes the origin, orientation, and size (bounding box) of the element. */
export class Placement2d {
  public constructor(public origin: Point2d, public angle: Angle, public boundingBox: ElementAlignedBox2d) { }
  public static fromJSON(json?: any): Placement2d {
    json = json ? json : {};
    return new Placement2d(Point2d.fromJSON(json.origin), Angle.fromJSON(json.angle), ElementAlignedBox2d.fromJSON(json.bbox));
  }
}
