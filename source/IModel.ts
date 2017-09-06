/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";
import { Elements } from "./Elements";
import { EntityMetaData } from "./Entity";
import { Models } from "./Model";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Point3d, Vector3d, Range3d, YawPitchRollAngles, Point2d, Range2d, Transform, RotMatrix } from "@bentley/geometry-core/lib/PointVector";
import { Constant } from "@bentley/geometry-core/lib/Constant";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { Base64 } from "js-base64";
import { BentleyPromise, BentleyReturn } from "@bentley/bentleyjs-core/lib/Bentley";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

declare function require(arg: string): any;
// tslint:disable-next-line:no-var-requires
const addonLoader = require("../scripts/addonLoader");
let dgnDbNodeAddon: any|undefined;
if (addonLoader !== undefined)
  dgnDbNodeAddon = addonLoader.loadNodeAddon(); // Note that evaluating this script has the side-effect of loading the addon

export const enum DgnDbStatus {
  DGNDB_ERROR_BASE = 0x10000,
  Success = 0,
  AlreadyLoaded = DGNDB_ERROR_BASE + 1,
  AlreadyOpen = DGNDB_ERROR_BASE + 2,
  BadArg = DGNDB_ERROR_BASE + 3,
  BadElement = DGNDB_ERROR_BASE + 4,
  BadModel = DGNDB_ERROR_BASE + 5,
  BadRequest = DGNDB_ERROR_BASE + 6,
  BadSchema = DGNDB_ERROR_BASE + 7,
  CannotUndo = DGNDB_ERROR_BASE + 8,
  CodeNotReserved = DGNDB_ERROR_BASE + 9,
  DeletionProhibited = DGNDB_ERROR_BASE + 10,
  DuplicateCode = DGNDB_ERROR_BASE + 11,
  DuplicateName = DGNDB_ERROR_BASE + 12,
  ElementBlockedChange = DGNDB_ERROR_BASE + 13,
  FileAlreadyExists = DGNDB_ERROR_BASE + 14,
  FileNotFound = DGNDB_ERROR_BASE + 15,
  FileNotLoaded = DGNDB_ERROR_BASE + 16,
  ForeignKeyConstraint = DGNDB_ERROR_BASE + 17,
  IdExists = DGNDB_ERROR_BASE + 18,
  InDynamicTransaction = DGNDB_ERROR_BASE + 19,
  InvalidCategory = DGNDB_ERROR_BASE + 20,
  InvalidCode = DGNDB_ERROR_BASE + 21,
  InvalidCodeSpec = DGNDB_ERROR_BASE + 22,
  InvalidId = DGNDB_ERROR_BASE + 23,
  InvalidName = DGNDB_ERROR_BASE + 24,
  InvalidParent = DGNDB_ERROR_BASE + 25,
  InvalidProfileVersion = DGNDB_ERROR_BASE + 26,
  IsCreatingRevision = DGNDB_ERROR_BASE + 27,
  LockNotHeld = DGNDB_ERROR_BASE + 28,
  Mismatch2d3d = DGNDB_ERROR_BASE + 29,
  MismatchGcs = DGNDB_ERROR_BASE + 30,  // The Geographic Coordinate Systems of the source and target are not based on equivalent projections
  MissingDomain = DGNDB_ERROR_BASE + 31,
  MissingHandler = DGNDB_ERROR_BASE + 32,
  MissingId = DGNDB_ERROR_BASE + 33,
  NoGeometry = DGNDB_ERROR_BASE + 34,
  NoMultiTxnOperation = DGNDB_ERROR_BASE + 35,
  NotDgnMarkupProject = DGNDB_ERROR_BASE + 36,
  NotEnabled = DGNDB_ERROR_BASE + 37,
  NotFound = DGNDB_ERROR_BASE + 38,
  NotOpen = DGNDB_ERROR_BASE + 39,
  NotOpenForWrite = DGNDB_ERROR_BASE + 40,
  NotSameUnitBase = DGNDB_ERROR_BASE + 41,
  NothingToRedo = DGNDB_ERROR_BASE + 42,
  NothingToUndo = DGNDB_ERROR_BASE + 43,
  ParentBlockedChange = DGNDB_ERROR_BASE + 44,
  ReadError = DGNDB_ERROR_BASE + 45,
  ReadOnly = DGNDB_ERROR_BASE + 46,
  ReadOnlyDomain = DGNDB_ERROR_BASE + 47,
  RepositoryManagerError = DGNDB_ERROR_BASE + 48,
  SQLiteError = DGNDB_ERROR_BASE + 49,
  TransactionActive = DGNDB_ERROR_BASE + 50,
  UnitsMissing = DGNDB_ERROR_BASE + 51,
  UnknownFormat = DGNDB_ERROR_BASE + 52,
  UpgradeFailed = DGNDB_ERROR_BASE + 53,
  ValidationFailed = DGNDB_ERROR_BASE + 54,
  VersionTooNew = DGNDB_ERROR_BASE + 55,
  VersionTooOld = DGNDB_ERROR_BASE + 56,
  ViewNotFound = DGNDB_ERROR_BASE + 57,
  WriteError = DGNDB_ERROR_BASE + 58,
  WrongClass = DGNDB_ERROR_BASE + 59,
  WrongDgnDb = DGNDB_ERROR_BASE + 60,
  WrongDomain = DGNDB_ERROR_BASE + 61,
  WrongElement = DGNDB_ERROR_BASE + 62,
  WrongHandler = DGNDB_ERROR_BASE + 63,
  WrongModel = DGNDB_ERROR_BASE + 64,
}

/** A token that identifies a DgnDb */
export class DgnDbToken {
  constructor(public id: string) { }
}

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

@MultiTierExecutionHost("@bentley/imodeljs-core/IModel")
class DgnDbNativeCode {
  private static dbs = new Map<string, any>();    // services tier only


private static getReturnError<StatusType, ResType>(s: StatusType, m: string): BentleyReturn<StatusType, ResType> {
    return { error: { status: s, message: m } };
}

private static getPromiseError<StatusType, ResType>(s: StatusType, m: string): BentleyPromise<StatusType, ResType> {
    return Promise.resolve(DgnDbNativeCode.getReturnError(s, m));
}

// *** NEEDS WORK: What is the correct DbResult for "the db is not open"?
private static getNotOpenDbResultPromise<ResType>(): BentleyPromise<DbResult, ResType> {
    return Promise.resolve(DgnDbNativeCode.getReturnError(DbResult.BE_SQLITE_CANTOPEN, ""));
}

  /**
   * Open the Db.
   * @param fileName  The name of the db file.
   * @param mode      The open mode
   * @return Promise that resolves to an object that contains an error property if the operation failed
   *          or the "token" that identifies the Db on the server if success.
   */
  @RunsIn(Tier.Services)
  public static callOpenDb(fileName: string, mode: OpenMode): BentleyPromise<DbResult, DgnDbToken> {
      let dgndb = DgnDbNativeCode.dbs.get(fileName);
      if (undefined !== dgndb)    // If the file is already open, just acknowledge that
          return Promise.resolve({ result: new DgnDbToken(fileName) }); // for now, we just use the fileName as the "token" that identifies the Db
      return new Promise((resolve, _reject) => {
          dgndb = new dgnDbNodeAddon.DgnDb();
          dgndb.openDgnDb(fileName, mode).then((res: BentleyReturn<DbResult, void>) => {
              if (res.error)
                  resolve({ error: res.error });
              else {
                  DgnDbNativeCode.dbs.set(fileName, dgndb);
                  resolve({ result: new DgnDbToken(fileName) });        // for now, we just use the fileName as the "token" that identifies the Db
              }
          });
      });
  }

  @RunsIn(Tier.Services, { synchronous: true })
  public static callCloseDb(dbToken: DgnDbToken) {
      const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
      if (undefined === dgndb) {
          return;
      }
      dgndb.closeDgnDb();
      DgnDbNativeCode.dbs.delete(dbToken.id);
  }

  /**
   * Get a JSON representation of an element.
   * @param opt A JSON string with options for loading the element
   * @return Promise that resolves to an object with a result property set to the JSON string of the element.
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static callGetElement(dbToken: DgnDbToken, opt: string): BentleyPromise<DgnDbStatus, string> {
      const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
      if (undefined === dgndb) {
          return DgnDbNativeCode.getPromiseError(DgnDbStatus.NotOpen, "");
      }
      return dgndb.getElement(opt);
  }

  @RunsIn(Tier.Services)
  public static callGetElementPropertiesForDisplay(dbToken: DgnDbToken, eid: string): BentleyPromise<DbResult, string> {
      const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
      if (undefined === dgndb) {
          return DgnDbNativeCode.getNotOpenDbResultPromise();
      }
      return dgndb.getElementPropertiesForDisplay(eid);
  }
  /**
   * Insert a new element into the DgnDb.
   * @param props A JSON string with properties of new element
   * @return Promise that resolves to an object with
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static callInsertElement(dbToken: DgnDbToken, props: string): BentleyPromise<DgnDbStatus, string> {
      const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
      if (undefined === dgndb) {
          return DgnDbNativeCode.getPromiseError(DgnDbStatus.NotOpen, "");
      }
      return dgndb.insertElement(props);
  }

  /**
   * Get a JSON representation of a Model.
   * @param opt A JSON string with options for loading the model
   * @return Promise that resolves to an object with a result property set to the JSON string of the model.
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static callGetModel(dbToken: DgnDbToken, opt: string): BentleyPromise<DbResult, string> {
      const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
      if (undefined === dgndb) {
          return DgnDbNativeCode.getNotOpenDbResultPromise();
      }
      return dgndb.getModel(opt);
  }

  /**
   * Execute an ECSql select statement
   * @param ecsql The ECSql select statement to prepare
   * @return Promise that resolves to an object with a result property set to a JSON array containing the rows returned from the query
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static callExecuteQuery(dbToken: DgnDbToken, ecsql: string): BentleyPromise<DbResult, string> {
      const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
      if (undefined === dgndb) {
          return DgnDbNativeCode.getNotOpenDbResultPromise();
      }
      return dgndb.executeQuery(ecsql);
  }

  /**
   * Get the meta data for the specified ECClass from the schema in this DgnDbNativeCode.
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return Promise that resolves to an object with a result property set to a the meta data in JSON format
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static callGetECClassMetaData(dbToken: DgnDbToken, ecschemaname: string, ecclassname: string): BentleyPromise<DgnDbStatus, string> {
      const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
      if (undefined === dgndb) {
          return DgnDbNativeCode.getPromiseError(DgnDbStatus.NotOpen, "");
      }
      return dgndb.getECClassMetaData(ecschemaname, ecclassname);
  }

  /**
   * Get the meta data for the specified ECClass from the schema in this iModel, blocking until the result is returned.
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  @RunsIn(Tier.Services, { synchronous: true })
  public static callGetECClassMetaDataSync(dbToken: DgnDbToken, ecschemaname: string, ecclassname: string): BentleyReturn<DgnDbStatus, string> {
      const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
      if (undefined === dgndb) {
          return DgnDbNativeCode.getReturnError(DgnDbStatus.NotOpen, "");
      }
      return dgndb.getECClassMetaDataSync(ecschemaname, ecclassname);
  }
}

/** An iModel database. */
export class IModel {
  private _fileName: string;
  private _db: DgnDbToken;
  public elements: Elements;
  public models: Models;
  private _classMetaDataRegistry: MetaDataRegistry;
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON
  public get fileName() { return this._fileName; }

  private constructor() {
    this.elements = new Elements(this);
    this.models = new Models(this);
  }

  /** Open the iModel
   * @param fileName  The name of the iModel
   * @param mode      Open mode for database
   * @return non-zero error status if the iModel could not be opened
   */
  public static async openDgnDb(fileName: string, mode: OpenMode = OpenMode.ReadWrite): BentleyPromise<DbResult, IModel> {
    return new Promise((resolve, _reject) => {
      DgnDbNativeCode.callOpenDb(fileName, mode).then((res: BentleyReturn<DbResult, DgnDbToken>) => {
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
    DgnDbNativeCode.callCloseDb(this._db);
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
    return DgnDbNativeCode.callGetECClassMetaDataSync(this._db, ecschemaname, ecclassname);
  }

  /** @deprecated */
  public GetElementPropertiesForDisplay(eid: string): BentleyPromise<DbResult, string> {
    return DgnDbNativeCode.callGetElementPropertiesForDisplay(this._db, eid);
  }

  /**
   * Get a JSON representation of an element.
   * @param opt A JSON string with options for loading the element
   * @return Promise that resolves to an object with a result property set to the JSON string of the element.
   * The resolved object contains an error property if the operation failed.
   */
  public getElement(opt: string): BentleyPromise<DgnDbStatus, string> {
    return DgnDbNativeCode.callGetElement(this._db, opt);
  }

  /** Insert a new Element into the iModel. */
  public async insertElement(el: string): Promise<Id64> {
    const stat = await DgnDbNativeCode.callInsertElement(this._db, el);
    return stat.error ? Promise.reject(stat.error) : new Id64(JSON.parse(stat.result!).id);
  }

  /**
   * Get a JSON representation of a Model.
   * @param opt A JSON string with options for loading the model
   * @return Promise that resolves to an object with a result property set to the JSON string of the model.
   * The resolved object contains an error property if the operation failed.
   */
  public getModel(opt: string): BentleyPromise<DbResult, string> {
    return DgnDbNativeCode.callGetModel(this._db, opt);
  }

  /**
   * Get the meta data for the specified class defined in imodel iModel (asynchronously).
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  public getECClassMetaData(ecschemaname: string, ecclassname: string): BentleyPromise<DgnDbStatus, string> {
    return DgnDbNativeCode.callGetECClassMetaData(this._db, ecschemaname, ecclassname);
  }

  /** Get the ClassMetaDataRegistry for this iModel */
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (!this._classMetaDataRegistry)
      this._classMetaDataRegistry = new MetaDataRegistry(this);
    return this._classMetaDataRegistry;
  }

  /**
   * Execute a query against this iModel
   * @param ecsql  The ECSql statement to execute
   * @return all rows in JSON syntax or the empty string if nothing was selected
   * @throws Error if the statement is invalid
   */
  public executeQuery(ecsql: string): BentleyPromise<DbResult, string> {
    return DgnDbNativeCode.callExecuteQuery(this._db, ecsql);
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
  public toJSON(): any { return Base64.encode(this.geomStream as any); }

  /** return false if this GeometryStream is empty. */
  public hasGeometry(): boolean { return this.geomStream.byteLength !== 0; }
  public static fromJSON(json?: any): GeometryStream | undefined {
    return json ? new GeometryStream(json instanceof GeometryStream ? json.geomStream : Base64.decode(json)) : undefined;
  }
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
