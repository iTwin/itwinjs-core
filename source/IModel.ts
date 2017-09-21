
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ClassRegistry } from "./ClassRegistry";
import { Element, ElementProps } from "./Element";
import { EntityMetaData } from "./Entity";
import { DgnDbStatus, IModelError } from "./IModelError";
import { Model, ModelProps } from "./Model";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Point3d, Vector3d, Range3d, YawPitchRollAngles, Point2d, Range2d, Transform, RotMatrix } from "@bentley/geometry-core/lib/PointVector";
import { Constant } from "@bentley/geometry-core/lib/Constant";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { Base64 } from "js-base64";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { AccessToken } from "@bentley/imodeljs-clients";
import { BriefcaseToken, BriefcaseManager, IModelVersion, KeepBriefcase } from "./service-utils/BriefcaseManager";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";

/** The mapping between a class name and its the metadata for that class  */
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

    mdata = JSON.parse(mstr) as EntityMetaData | undefined;
    if (undefined === mdata)
      return undefined;
    this.reg.set(key, mdata);
    return mdata;
  }
}

/** An iModel database. */
export class IModel {
  private _briefcaseKey: BriefcaseToken|undefined;
  public elements: Elements;
  public models: Models;
  private _classMetaDataRegistry: MetaDataRegistry;
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON
  public get briefcaseKey(): BriefcaseToken|undefined { return this._briefcaseKey; }

  private constructor() {
    this.elements = new Elements(this);
    this.models = new Models(this);
  }

  /** Open the iModel from a local file
   * @param fileName  The name of the iModel
   * @param openMode      Open mode for database
   */
  public static async openStandalone(fileName: string, openMode: OpenMode = OpenMode.ReadWrite): Promise<IModel> {
    const iModel = new IModel();
    iModel._briefcaseKey = await BriefcaseManager.openStandalone(fileName, openMode);
    return iModel;
  }

  /**
   * Open the iModel from the Hub
   */
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModel> {
    const iModel = new IModel();
    iModel._briefcaseKey = await BriefcaseManager.open(accessToken, iModelId, openMode, version);
    return iModel;
  }

  /**
   * Close this iModel, if it is currently open
   * @description This needs to be called only for read-write iModels. For read-only iMdodels this is a no-op.
   */
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    if (!this.briefcaseKey)
      return;
    await BriefcaseManager.close(accessToken, this.briefcaseKey, keepBriefcase);
  }

  /** Close this iModel, if it is currently open */
  public closeStandalone() {
    if (!this.briefcaseKey)
      return;
    BriefcaseManager.closeStandalone(this.briefcaseKey);
  }

  /**
   * Get the meta data for the specified class defined in imodel iModel, blocking until the result is returned.
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  public getECClassMetaDataSync(ecschemaname: string, ecclassname: string): string {
    if (!this.briefcaseKey)
      throw new IModelError(DgnDbStatus.NotOpen);
    return BriefcaseManager.getECClassMetaDataSync(this.briefcaseKey, ecschemaname, ecclassname);
  }

  /** @deprecated */
  public getElementPropertiesForDisplay(elementId: string): Promise<string> {
    if (!this.briefcaseKey)
      return Promise.reject(new IModelError(DgnDbStatus.NotOpen));
    return BriefcaseManager.getElementPropertiesForDisplay(this.briefcaseKey, elementId);
  }

  /**
   * Get the meta data for the specified class defined in imodel iModel (asynchronously).
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @return On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  public getECClassMetaData(ecschemaname: string, ecclassname: string): Promise<string> {
    if (!this.briefcaseKey)
      return Promise.reject(new IModelError(DgnDbStatus.NotOpen));
    return BriefcaseManager.getECClassMetaData(this.briefcaseKey, ecschemaname, ecclassname);
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
  public executeQuery(ecsql: string): Promise<string> {
    if (!this.briefcaseKey)
      return Promise.reject(new IModelError(DgnDbStatus.NotOpen));
    return BriefcaseManager.executeQuery(this.briefcaseKey, ecsql);
  }
}

/** The collection of Models in an iModel  */
export class Models {
  private _iModel: IModel;
  private _loaded: LRUMap<string, Model>;

  public constructor(iModel: IModel, max: number = 500) { this._iModel = iModel; this._loaded = new LRUMap<string, Model>(max); }

  public async getModel(modelId: Id64): Promise<Model> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(DgnDbStatus.NotOpen));

    // first see if the model is already in the local cache.
    const loaded = this._loaded.get(modelId.toString());
    if (loaded)
      return loaded;

    // Must go get the model from the iModel. Start by requesting the model's data.
    const json: string = await BriefcaseManager.getModel(this._iModel.briefcaseKey, JSON.stringify({ id: modelId }));
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
  private async doGetElement(opts: ElementLoadParams): Promise<Element> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(DgnDbStatus.NotOpen));

    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    // Must go get the element from the iModel. Start by requesting the element's data.
    const json = await BriefcaseManager.getElement(this._iModel.briefcaseKey, JSON.stringify(opts));
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

  /** Get an element by Id, FederationGuid, or Code */
  public getElement(elementId: Id64 | Guid | Code): Promise<Element> {
    if (elementId instanceof Id64) return this.doGetElement({ id: elementId });
    if (elementId instanceof Guid) return this.doGetElement({ federationGuid: elementId.toString() });
    if (elementId instanceof Code) return this.doGetElement({ code: elementId });
    assert(false);
    return Promise.reject(new IModelError(DgnDbStatus.BadArg));
  }

  public async insertElement(el: Element): Promise<Id64> {
    if (!this._iModel.briefcaseKey)
      return Promise.reject(new IModelError(DgnDbStatus.NotOpen));

    if (el.isPersistent()) {
      assert(false); // you cannot insert a persistent element. call copyForEdit
      return new Id64();
    }
    const json: string = await BriefcaseManager.insertElement(this._iModel.briefcaseKey, JSON.stringify(el));
    return new Id64(JSON.parse(json).id);
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
