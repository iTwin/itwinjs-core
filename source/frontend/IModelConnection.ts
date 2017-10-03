/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModel } from "../IModel";
import { IModelVersion } from "../IModelVersion";
import { Model } from "../Model";
import { BriefcaseManager, KeepBriefcase } from "../backend/BriefcaseManager"; // WIP: cannot include backend classes in the frontend

/** A connection to an iModel database hosted on the backend. */
export class IModelConnection extends IModel {
  public models: IModelConnectionModels;
  public elements: IModelConnectionElements;

  private constructor() {
    super();
    this.models = new IModelConnectionModels(this);
    this.elements = new IModelConnectionElements(this);
  }

  /** Open an iModel from the iModelHub */
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModelConnection> {
    const iModel = new IModelConnection();
    iModel._briefcaseKey = await BriefcaseManager.open(accessToken, iModelId, openMode, version);
    return iModel;
  }

  /** Close this iModel */
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    if (!this.briefcaseKey)
      return;
    await BriefcaseManager.close(accessToken, this.briefcaseKey, keepBriefcase);
  }
}

/** The collection of models in an [[IModelConnection]]. */
export class IModelConnectionModels {
  private _iModel: IModelConnection;
  private _loaded: LRUMap<string, Model>;

  /** @hidden */
  public constructor(iModel: IModelConnection, max: number = 500) { this._iModel = iModel; this._loaded = new LRUMap<string, Model>(max); }

  /** The Id of the repository model. */
  public get repositoryModelId(): Id64 { return new Id64("0x1"); }
}

/** The collection of elements in an [[IModelConnection]]. */
export class IModelConnectionElements {
  private _iModel: IModelConnection;
  private _loaded: LRUMap<string, Element>;

  /** get the map of loaded elements */
  public get loaded() { return this._loaded; }

  /** @hidden */
  public constructor(iModel: IModelConnection, maxElements: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Element>(maxElements); }

  /** The Id of the root subject element. */
  public get rootSubjectId(): Id64 { return new Id64("0x1"); }
}
