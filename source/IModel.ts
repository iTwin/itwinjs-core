/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";
import { ClassRegistry } from "./ClassRegistry";
import { Element, ElementProps } from "./Element";
import { EntityMetaData } from "./Entity";
import { IModelStatus, IModelError } from "./IModelError";
import { Model, ModelProps } from "./Model";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Point3d, Vector3d, Range3d, YawPitchRollAngles, Point2d, Range2d, Transform, RotMatrix } from "@bentley/geometry-core/lib/PointVector";
import { Constant } from "@bentley/geometry-core/lib/Constant";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { Base64 } from "js-base64";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BentleyReturn } from "@bentley/bentleyjs-core/lib/Bentley";
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";

declare function require(arg: string): any;
// tslint:disable-next-line:no-var-requires
const addonLoader = require("../scripts/addonLoader");
let dgnDbNodeAddon: any | undefined;
if (addonLoader !== undefined)
  dgnDbNodeAddon = addonLoader.loadNodeAddon(); // Note that evaluating this script has the side-effect of loading the addon

/** A token that identifies a DgnDb */
export class DgnDbToken {
  constructor(public id: string) { }
}

/** The mapping between a class name and its metadata */
export class MetaDataRegistry {
  private reg: Map<string, EntityMetaData> = new Map<string, EntityMetaData>();

  constructor(private imodel: IModel) {
    if (!(imodel instanceof IModel))
      throw new TypeError("bad imodel");
  }

  /** Get the specified Entity metadata */
  public get(classFullName: string): EntityMetaData | undefined {
    const key = classFullName.toLowerCase();
    let mdata = this.reg.get(key);
    if (mdata)
      return mdata;

    const name: string[] = classFullName.split(":");
    let mstr: string;
    try {
      mstr = this.imodel.getECClassMetaDataSync(name[0], name[1]);
    } catch (error) {
      return undefined;
    }

    mdata = new EntityMetaData(JSON.parse(mstr));
    if (undefined === mdata)
      return undefined;
    this.reg.set(key, mdata);
    return mdata;
  }
}

@MultiTierExecutionHost("@bentley/imodeljs-core/IModel")
class DgnDbNativeCode {
  private static dbs = new Map<string, any>();    // services tier only

  /**
   * Open the Db.
   * @param fileName  The name of the db file.
   * @param mode      The open mode
   * @return Promise that resolves to an object that contains an error property if the operation failed
   *          or the "token" that identifies the Db on the server if success.
   */
  @RunsIn(Tier.Services)
  public static async callOpenDb(fileName: string, mode: OpenMode): Promise<DgnDbToken> {
    let dgndb = DgnDbNativeCode.dbs.get(fileName);
    if (undefined !== dgndb) // If the file is already open, just acknowledge that
      return Promise.resolve(new DgnDbToken(fileName)); // for now, we just use the fileName as the "token" that identifies the Db

    dgndb = new dgnDbNodeAddon.DgnDb();
    const res: BentleyReturn<DbResult, void> = await dgndb.openDgnDb(fileName, mode);
    if (res.error)
      return Promise.reject(new IModelError(res.error.status));

    DgnDbNativeCode.dbs.set(fileName, dgndb);
    return new DgnDbToken(fileName); // for now, we just use the fileName as the "token" that identifies the Db
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
  public static async callGetElement(dbToken: DgnDbToken, opt: string): Promise<string> {
    const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
    if (undefined === dgndb)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    const response: BentleyReturn<IModelStatus, string> = await dgndb.getElement(opt);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  @RunsIn(Tier.Services)
  public static async callGetElementPropertiesForDisplay(dbToken: DgnDbToken, elementId: string): Promise<string> {
    const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
    if (undefined === dgndb)
      return Promise.reject(new IModelError(DbResult.BE_SQLITE_CANTOPEN));

    const response: BentleyReturn<DbResult, string> = await dgndb.getElementPropertiesForDisplay(elementId);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  @RunsIn(Tier.Services)
  public static async callInsertElement(dbToken: DgnDbToken, props: string): Promise<string> {
    const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
    if (undefined === dgndb)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // Note that inserting an element is always done synchronously. That is because of constraints
    // on the native code side. Nevertheless, we want the signature of this method to be
    // that of an asynchronous method, since it must run in the services tier and will be
    // asynchronous from a remote client's point of view in any case.
    const response: BentleyReturn<IModelStatus, string> = dgndb.insertElementSync(props);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  @RunsIn(Tier.Services)
  public static async callUpdateElement(dbToken: DgnDbToken, props: string): Promise<void> {
    const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
    if (undefined === dgndb)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // Note that updating an element is always done synchronously. That is because of constraints
    // on the native code side. Nevertheless, we want the signature of this method to be
    // that of an asynchronous method, since it must run in the services tier and will be
    // asynchronous from a remote client's point of view in any case.
    const response: BentleyReturn<IModelStatus, string> = dgndb.updateElementSync(props);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));
  }

  @RunsIn(Tier.Services)
  public static async callDeleteElement(dbToken: DgnDbToken, elemid: string): Promise<void> {
    const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
    if (undefined === dgndb)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // Note that deleting an element is always done synchronously. That is because of constraints
    // on the native code side. Nevertheless, we want the signature of this method to be
    // that of an asynchronous method, since it must run in the services tier and will be
    // asynchronous from a remote client's point of view in any case.
    const response: BentleyReturn<IModelStatus, string> = dgndb.deleteElementSync(elemid);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));
  }

  /**
   * Get a JSON representation of a Model.
   * @param opt A JSON string with options for loading the model
   * @return Promise that resolves to an object with a result property set to the JSON string of the model.
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static async callGetModel(dbToken: DgnDbToken, opt: string): Promise<string> {
    const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
    if (undefined === dgndb)
      return Promise.reject(new IModelError(DbResult.BE_SQLITE_CANTOPEN));

    const response: BentleyReturn<DbResult, string> = await dgndb.getModel(opt);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  /**
   * Execute an ECSql select statement
   * @param ecsql The ECSql select statement to prepare
   * @return Promise that resolves to an object with a result property set to a JSON array containing the rows returned from the query
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static async callExecuteQuery(dbToken: DgnDbToken, ecsql: string): Promise<string> {
    const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
    if (undefined === dgndb)
      return Promise.reject(new IModelError(DbResult.BE_SQLITE_CANTOPEN));

    const response: BentleyReturn<DbResult, string> = await dgndb.executeQuery(ecsql);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  /**
   * Get the meta data for the specified ECClass from the schema in this DgnDbNativeCode.
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return Promise that resolves to an object with a result property set to a the meta data in JSON format
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static async callGetECClassMetaData(dbToken: DgnDbToken, ecschemaname: string, ecclassname: string): Promise<string> {
    const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
    if (undefined === dgndb)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    const response: BentleyReturn<IModelStatus, string> = await dgndb.getECClassMetaData(ecschemaname, ecclassname);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  /**
   * Get the meta data for the specified ECClass from the schema in this iModel, blocking until the result is returned.
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  @RunsIn(Tier.Services, { synchronous: true })
  public static callGetECClassMetaDataSync(dbToken: DgnDbToken, ecschemaname: string, ecclassname: string): string {
    const dgndb = DgnDbNativeCode.dbs.get(dbToken.id);
    if (undefined === dgndb)
      throw new IModelError(IModelStatus.NotOpen);

    const response: BentleyReturn<IModelStatus, string> = dgndb.getECClassMetaDataSync(ecschemaname, ecclassname);
    if (response.error)
      throw new IModelError(response.error.status);

    return response.result!;
  }
}

/** An iModel database. */
export class IModel {
  private _fileName: string;
  private _dbToken: DgnDbToken;
  public elements: Elements;
  public models: Models;
  private _classMetaDataRegistry: MetaDataRegistry;
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON
  public get fileName(): string { return this._fileName; }
  public get dbToken(): DgnDbToken { return this._dbToken; }

  private constructor() {
    this.elements = new Elements(this);
    this.models = new Models(this);
  }

  /** Open the iModel
   * @param fileName  The name of the iModel
   * @param mode      Open mode for database
   * @throws [[IModelError]]
   */
  public static async openDgnDb(fileName: string, mode: OpenMode = OpenMode.ReadWrite): Promise<IModel> {
    const dbToken: DgnDbToken = await DgnDbNativeCode.callOpenDb(fileName, mode);
    const iModel = new IModel();
    iModel._fileName = fileName;
    iModel._dbToken = dbToken;
    return iModel;
  }

  /** Close this iModel, if it is currently open */
  public closeDgnDb() {
    if (!this._dbToken)
      return;
    DgnDbNativeCode.callCloseDb(this._dbToken);
    (this._dbToken as any) = undefined;  // I am deliberately violating the guarantee that _dbToken can't be undefined. That is so that, if the caller
    // continues to use the IModel after closing it HE WILL BLOW UP.
    this._fileName = "";
  }

  /**
   * Get the meta data for the specified class defined in imodel iModel, blocking until the result is returned.
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  public getECClassMetaDataSync(ecschemaname: string, ecclassname: string): string {
    return DgnDbNativeCode.callGetECClassMetaDataSync(this.dbToken, ecschemaname, ecclassname);
  }

  /** @deprecated */
  public GetElementPropertiesForDisplay(elementId: string): Promise<string> {
    return DgnDbNativeCode.callGetElementPropertiesForDisplay(this.dbToken, elementId);
  }

  /**
   * Get the meta data for the specified class defined in imodel iModel (asynchronously).
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return The class meta data in JSON format.
   * @throws [[IModelError]]
   */
  public getECClassMetaData(ecschemaname: string, ecclassname: string): Promise<string> {
    return DgnDbNativeCode.callGetECClassMetaData(this.dbToken, ecschemaname, ecclassname);
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
   * @throws [[IModelError]] If the statement is invalid
   */
  public executeQuery(ecsql: string): Promise<string> {
    return DgnDbNativeCode.callExecuteQuery(this.dbToken, ecsql);
  }
}

/** The collection of Models in an iModel  */
export class Models {
  private _iModel: IModel;
  private _loaded: LRUMap<string, Model>;

  public constructor(iModel: IModel, max: number = 500) { this._iModel = iModel; this._loaded = new LRUMap<string, Model>(max); }

  /** Get the Model with the specified identifier.
   * @param modelId The Model identifier.
   * @throws [[IModelError]]
   */
  public async getModel(modelId: Id64): Promise<Model> {
    // first see if the model is already in the local cache.
    const loaded = this._loaded.get(modelId.toString());
    if (loaded)
      return loaded;

    // Must go get the model from the iModel. Start by requesting the model's data.
    const json: string = await DgnDbNativeCode.callGetModel(this._iModel.dbToken, JSON.stringify({ id: modelId }));
    const props = JSON.parse(json) as ModelProps;
    props.iModel = this._iModel;

    const entity = await ClassRegistry.createInstance(props);
    assert(entity instanceof Model);
    const model = entity as Model;

    // We have created the model. Cache it before we return it.
    model.setPersistent(); // models in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this._loaded.set(model.id.toString(), model);
    return model;
  }

  /** Get the sub-model of the specified Element.
   * @param elementId The Element identifier.
   * @throws [[IModelError]]
   */
  public async getSubModel(modeledElementId: Id64 | Guid | Code): Promise<Model> {
    const modeledElement: Element = await this._iModel.elements.getElement(modeledElementId);
    return this.getModel(modeledElement.id);
  }

  /** The Id of the repository model. */
  public get repositoryModelId(): Id64 { return new Id64("0x1"); }
}

/** Parameters to specify what element to load. */
export interface ElementLoadParams {
  id?: Id64 | string;
  code?: Code;
  federationGuid?: string;
  /** if true, do not load the geometry of the element */
  noGeometry?: boolean;
}

/** The collection of Elements in an iModel  */
export class Elements {
  private _iModel: IModel;
  private _loaded: LRUMap<string, Element>;

  /** get the map of loaded elements */
  public get loaded() { return this._loaded; }

  public constructor(iModel: IModel, maxElements: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Element>(maxElements); }

  /** Private implementation details of getElement */
  private async _doGetElement(opts: ElementLoadParams): Promise<Element> {
    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    // Must go get the element from the iModel. Start by requesting the element's data.
    const json = await DgnDbNativeCode.callGetElement(this._iModel.dbToken, JSON.stringify(opts));
    const props = JSON.parse(json) as ElementProps;
    props.iModel = this._iModel;

    const entity = await ClassRegistry.createInstance(props);
    const el = entity as Element;
    assert(el instanceof Element);

    // We have created the element. Cache it before we return it.
    el.setPersistent(); // elements in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this._loaded.set(el.id.toString(), el);
    return el;
  }

  /** Get an element by Id, FederationGuid, or Code
   * @throws [[IModelError]]
   */
  public getElement(elementId: Id64 | Guid | Code): Promise<Element> {
    if (elementId instanceof Id64) return this._doGetElement({ id: elementId });
    if (elementId instanceof Guid) return this._doGetElement({ federationGuid: elementId.toString() });
    if (elementId instanceof Code) return this._doGetElement({ code: elementId });
    assert(false);
    return Promise.reject(new IModelError(IModelStatus.BadArg));
  }

  /** Insert a new element.
   * @param el  The data for the new element.
   * @return The newly inserted element's Id.
   * @throws [[IModelError]]
   */
  public async insertElement(el: Element): Promise<Id64> {
    if (el.isPersistent()) {
      assert(false); // you cannot insert a persistent element. call copyForEdit
      return new Id64();
    }
    const json: string = await DgnDbNativeCode.callInsertElement(this._iModel.dbToken, JSON.stringify(el));
    return new Id64(JSON.parse(json).id);
  }

  /** Update an existing element.
   * @param el  An editable copy of the element, containing the new/proposed data.
   * @throws [[IModelError]]
   */
  public async updateElement(el: Element): Promise<void> {
    if (el.isPersistent()) {
      assert(false); // you cannot insert a persistent element. call copyForEdit
      return;
    }
    await DgnDbNativeCode.callUpdateElement(this._iModel.dbToken, JSON.stringify(el));

    // Discard from the cache, to make sure that the next fetch see the updated version.
    this._loaded.delete(el.id.toString());
  }

  /** Delete an existing element.
   * @param el  The element to be deleted
   * @throws [[IModelError]]
   */
  public async deleteElement(el: Element): Promise<void> {
    await DgnDbNativeCode.callDeleteElement(this._iModel.dbToken, el.id.toString());

    // Discard from the cachex
    this._loaded.delete(el.id.toString());
  }

  /** The Id of the root subject element. */
  public get rootSubjectId(): Id64 { return new Id64("0x1"); }

  /** Get the root subject element. */
  public getRootSubject(): Promise<Element> { return this.getElement(this.rootSubjectId); }
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
