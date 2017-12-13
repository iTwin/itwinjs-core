/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, IModelHubClient, ChangeSet } from "@bentley/imodeljs-clients";
import { IModelError } from "./IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

/** Option to specify the version of the iModel to be acquired and used */
export class IModelVersion {
  private _first?: boolean;
  private _latest?: boolean;
  private _afterChangeSetId?: string;
  private _versionName?: string;

  private constructor() { }

  /** Describes the first version of the iModel */
  public static first(): IModelVersion {
    const version = new IModelVersion();
    version._first = true;
    return version;
  }

  /** Describes the latest version of the iModel  */
  public static latest(): IModelVersion {
    const version = new IModelVersion();
    version._latest = true;
    return version;
  }

  /** Describes a version of the iModel by the last change set that needs
   * to be applied or merged to the iModel.
   * Note that all ChangeSets up to and and including the specified ChangeSet
   * needs to be applied.
   */
  public static asOfChangeSet(changeSetId: string): IModelVersion {
    const version = new IModelVersion();
    version._afterChangeSetId = changeSetId;
    return version;
  }

  /** Describes a version of the iModel with the specified version name  */
  public static named(versionName: string): IModelVersion {
    const version = new IModelVersion();
    version._versionName = versionName;
    return version;
  }

  /** Creates a version from an untyped JSON object */
  public static fromJson(jsonObj: any): IModelVersion {
    const version = new IModelVersion();
    Object.assign(version, jsonObj);
    return version;
  }

  /** Returns true if this describes the first version */
  public isFirst(): boolean { return !!this._first; }

  /** Returns true if this describes the latest version */
  public isLatest(): boolean { return !!this._latest; }

  /** Returns the last change set id to be applied to the iModel
   * to get to this specified version. @see asOfChangeSet().
   * Note that this method does not attempt to resolve the change set
   * if this describes the first version, last version, named version, etc.
   * @see evaluateChangeSet() for those use cases.
   */
  public getAsOfChangeSet(): string | undefined { return this._afterChangeSetId; }

  /** Returns the name of the version if this describes a named version. @see named() */
  public getName(): string | undefined { return this._versionName; }

  /** Evaluate the ChangeSet Id corresponding to the version. All change sets upto and including
   * the returned ChangeSet Id need to be applied to update the iModel to this version.
   * Returns an empty string if this contains the first version (before any change sets). If the
   * version was already specified as of a ChangeSet, the method simply returns
   * that Id without any validation.
   */
  public evaluateChangeSet(accessToken: AccessToken, iModelId: string): Promise<string> {
    if (this._first)
      return Promise.resolve("");

    const hubClient = new IModelHubClient( "QA"); // todo: need this supplied by some config

    if (this._afterChangeSetId) {
      return Promise.resolve(this._afterChangeSetId);
    }

    if (this._latest) {
      return IModelVersion.getLatestChangeSetId(hubClient, accessToken, iModelId);
    }

    if (this._versionName) {
      return IModelVersion.getChangeSetFromNamedVersion(hubClient, accessToken, iModelId, this._versionName);
    }

    return Promise.reject(new IModelError(BentleyStatus.ERROR));
  }

  /** Gets the last change set that was applied to the imodel */
  private static async getLatestChangeSetId(hubClient: IModelHubClient, accessToken: AccessToken, iModelId: string): Promise<string> {
    const changeSets: ChangeSet[] = await hubClient.getChangeSets(accessToken, iModelId, false /*=includeDownloadLink*/);
      // todo: Need a more efficient iModel Hub API to get this information from the Hub.

    return (changeSets.length === 0) ? "" : changeSets[changeSets.length - 1].wsgId;
  }

  /** Get the change set from the specified named version */
  private static async getChangeSetFromNamedVersion(hubClient: IModelHubClient, accessToken: AccessToken, iModelId: string, versionName: string): Promise<string> {
    const version = await hubClient.getVersion(accessToken, iModelId, {
      $select: "ChangeSetId",
      $filter: `Name+eq+'${versionName}'`,
    });

    if (!version.changeSetId) {
      return Promise.reject(new IModelError(BentleyStatus.ERROR));
    }

    return version.changeSetId;
  }

}
