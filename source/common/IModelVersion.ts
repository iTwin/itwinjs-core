/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** Option to specify the version of the iModel to be acquired and used */
export class IModelVersion {
  private _first?: boolean;
  private _latest?: boolean;
  private _afterChangeSetId?: string;
  private _versionName?: string;

  private constructor() { }

  /** Acquire the first version of the iModel */
  public static first(): IModelVersion {
    const version = new IModelVersion();
    version._first = true;
    return version;
  }

  /** Acquire the latest version of the iModel  */
  public static latest(): IModelVersion {
    const version = new IModelVersion();
    version._latest = true;
    return version;
  }

  /** Acquire a version of the iModel after applying Change Sets up to (and including) the specified Change Set */
  public static afterChangeSet(changeSetId: string): IModelVersion {
    const version = new IModelVersion();
    version._afterChangeSetId = changeSetId;
    return version;
  }

  /** Acquire a version of the iModel with the specified version name  */
  public static withName(versionName: string): IModelVersion {
    const version = new IModelVersion();
    version._versionName = versionName;
    return version;
  }

  public static fromJson(jsonObj: any): IModelVersion {
    const version = new IModelVersion();
    Object.assign(version, jsonObj);
    return version;
  }

  public isFirst(): boolean { return !!this._first; }
  public isLatest(): boolean { return !!this._latest; }
  public getAfterChangeSetId(): string | undefined { return this._afterChangeSetId; }
  public getName(): string | undefined { return this._versionName; }

}
