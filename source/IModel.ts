/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Elements } from "./Elements";
import { EntityMetaData } from "./EntityMetaData";
import { Models } from "./Model";
import { DgnDb, DgnDbToken, DgnDbStatus } from "@bentley/imodeljs-dgnplatform/lib/DgnDb";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Point3d, Vector3d, Range3d, YawPitchRollAngles, Point2d, Range2d, Transform, RotMatrix } from "@bentley/geometry-core/lib/PointVector";
import { Constant } from "@bentley/geometry-core/lib/Constant";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { Base64 } from "js-base64";
import { BentleyPromise, BentleyReturn } from "@bentley/bentleyjs-core/lib/Bentley";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

/** The mapping between a class name and its the metadata for that class  */
export class MetaDataRegistry {
  private reg: Map<string, EntityMetaData> = new Map<string, EntityMetaData>();
  constructor(private imodel: IModel) { }
  private static getKey(schemaName: string, className: string) { return (schemaName + "." + className).toLowerCase(); }

  /** Get the specified Entity metadata */
  public get(schemaName: string, className: string): EntityMetaData | undefined {
    const key: string = MetaDataRegistry.getKey(schemaName, className);
    let mdata = this.reg.get(key);
    if (mdata)
      return mdata;

    const { error, result: mstr } = this.imodel.getECClassMetaDataSync(schemaName, className);
    if (error || !mstr)
      return undefined;

    mdata = JSON.parse(mstr) as EntityMetaData | undefined;
    if (undefined === mdata)
      return undefined;
    this.reg.set(key, mdata);
    return mdata;
  }
}

/** An iModel database. */
export class IModel {
  private _fileName: string;
  private _db: DgnDbToken;
  private _elements: Elements;
  private _models: Models;
  private _classMetaDataRegistry: MetaDataRegistry;
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON
  public get fileName() { return this._fileName; }

  private constructor() { }

  /** Open the iModel
   * @param fileName  The name of the iModel
   * @param mode      Open mode for database
   * @return non-zero error status if the iModel could not be opened
   */
  public static async openDgnDb(fileName: string, mode: OpenMode = OpenMode.ReadWrite): BentleyPromise<DbResult, IModel> {
    return new Promise((resolve, _reject) => {
      DgnDb.callOpenDb(fileName, mode).then((res: BentleyReturn<DbResult, DgnDbToken>) => {
        if (res.error || !res.result)
          resolve({ error: res.error });
        else {
          const imodel = new IModel();
          imodel._fileName = fileName;
          imodel._db = res.result;
          resolve({ result: imodel });
        }
      });
    });
  }

  /** Close this iModel, if it is currently open */
  public closeDgnDb() {
    if (!this._db)
      return;
    // DgnDb.callCloseDb(this._db);
    (this._db as any) = undefined;  // I am deliberately violating the guarantee that _db can't be undefined. That is so that, if the caller
    // continues to use imodel IModel after closing it HE WILL BLOW UP.
    this._fileName = "";
  }

  /**
   * Get the meta data for the specified class defined in imodel iModel, blocking until the result is returned.
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  public getECClassMetaDataSync(ecschemaname: string, ecclassname: string): BentleyReturn<DgnDbStatus, string> {
    return DgnDb.callGetECClassMetaDataSync(this._db, ecschemaname, ecclassname);
  }

  /** @deprecated */
  public tempGetElementPropertiesForDisplay(eid: string): BentleyPromise<DbResult, string> {
    return DgnDb.callTempGetElementPropertiesForDisplay(this._db, eid);
  }

  /**
   * Get a JSON representation of an element.
   * @param opt A JSON string with options for loading the element
   * @return Promise that resolves to an object with a result property set to the JSON string of the element.
   * The resolved object contains an error property if the operation failed.
   */
  public getElement(opt: string): BentleyPromise<DgnDbStatus, string> {
    return DgnDb.callGetElement(this._db, opt);
  }

  /**
   * Get a JSON representation of a Model.
   * @param opt A JSON string with options for loading the model
   * @return Promise that resolves to an object with a result property set to the JSON string of the model.
   * The resolved object contains an error property if the operation failed.
   */
  public getModel(opt: string): BentleyPromise<DbResult, string> {
    return DgnDb.callGetModel(this._db, opt);
  }

  /**
   * Get the meta data for the specified class defined in imodel iModel (asynchronously).
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  public getECClassMetaData(ecschemaname: string, ecclassname: string): BentleyPromise<DgnDbStatus, string> {
    return DgnDb.callGetECClassMetaData(this._db, ecschemaname, ecclassname);
  }

  /** Get the ClassMetaDataRegistry for this iModel */
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (!this._classMetaDataRegistry)
      this._classMetaDataRegistry = new MetaDataRegistry(this);
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
  public executeQuery(ecsql: string): BentleyPromise<DbResult, string> {
    return DgnDb.callExecuteQuery(this._db, ecsql);
  }
}

/** Properties that define a Code */
export interface CodeProps {
  spec: Id64 | string;
  scope: string;
  value?: string;
}

/** A 3 part Code that identifies an Element */
export class Code implements CodeProps {
  public spec: Id64;
  public scope: string;
  public value?: string;

  constructor(val: CodeProps) {
    this.spec = new Id64(val.spec);
    this.scope = JsonUtils.asString(val.scope, "");
    this.value = JsonUtils.asString(val.value);
  }

  /** Create an instance of the default code (1,1,undefined) */
  public static createDefault(): Code { return new Code({ spec: new Id64([1, 0]), scope: "1" }); }
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
  public isValid(): boolean {
    const max = Constant.circumferenceOfEarth; const lo = this.low; const hi = this.high;
    return !this.isNull() && lo.x > -max && lo.y > -max && lo.z > -max && hi.x < max && hi.y < max && hi.z < max;
  }
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
  public isValid(): boolean {
    const max = Constant.circumferenceOfEarth; const lo = this.low; const hi = this.high;
    return !this.isNull() && lo.x > -max && lo.y > -max && hi.x < max && hi.y < max;
  }
}

export class GeometryStream {
  public geomStream: ArrayBuffer;
  public constructor(stream: any) { this.geomStream = stream; }

  /** return false if this GeometryStream is empty. */
  public hasGeometry(): boolean { return this.geomStream.byteLength !== 0; }
  public static fromJSON(json?: any): GeometryStream | undefined { return json ? new GeometryStream(Base64.decode(json)) : undefined; }
}

/**
 * The placement of a GeometricElement3d. This includes the origin, orientation, and size (bounding box) of the element.
 * All geometry of a GeometricElement are relative to its placement.
 */
export class Placement3d {
  public constructor(public origin: Point3d, public angles: YawPitchRollAngles, public bbox: ElementAlignedBox3d) { }
  public getTransform() { return Transform.createOriginAndMatrix(this.origin, this.angles.toRotMatrix()); }
  public static fromJSON(json?: any): Placement3d {
    json = json ? json : {};
    return new Placement3d(Point3d.fromJSON(json.origin), YawPitchRollAngles.fromJSON(json.angles), ElementAlignedBox3d.fromJSON(json.bbox));
  }

  /** Determine whether this Placement3d is valid. */
  public isValid(): boolean { return this.bbox.isValid() && this.origin.maxAbs() < Constant.circumferenceOfEarth; }
}

/** The placement of a GeometricElement2d. This includes the origin, orientation, and size (bounding box) of the element. */
export class Placement2d {
  public constructor(public origin: Point2d, public angle: Angle, public bbox: ElementAlignedBox2d) { }
  public getTransform() { return Transform.createOriginAndMatrix(Point3d.createFrom(this.origin), RotMatrix.createRotationAroundVector(Vector3d.unitZ(), this.angle)!); }
  public static fromJSON(json?: any): Placement2d {
    json = json ? json : {};
    return new Placement2d(Point2d.fromJSON(json.origin), Angle.fromJSON(json.angle), ElementAlignedBox2d.fromJSON(json.bbox));
  }

  /** Determine whether this Placement2d is valid. */
  public isValid(): boolean { return this.bbox.isValid() && this.origin.maxAbs() < Constant.circumferenceOfEarth; }
}
