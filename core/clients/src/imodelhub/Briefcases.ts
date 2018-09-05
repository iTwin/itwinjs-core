/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelHubClientError } from "./Errors";

import { AccessToken } from "../Token";
import { Logger, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { Config } from "../Config";
import { Query, addSelectFileAccessKey } from "./Query";
import { FileHandler } from "../FileHandler";
import { ProgressInfo } from "../Request";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Controls whether the user has exclusive or shared access to a local briefcase */
export enum BriefcaseAccessMode {
  Shared = 0,
  Exclusive = 1,
}

/**
 * Briefcase is a copy of the master file, that user acquires to work with the iModel. Briefcase instance represents metadata about a copy of iModel's master file.
 *
 * File properties describe the file that would be downloaded through downloadUrl. It is the most recently updated copy of master file that is stored on iModelHub. These copies do not necessarily have the latest [[ChangeSet]] applied to them.
 *
 * briefcaseId is the id that user needs to write into the local copy of master file and use for other iModelHub requests. briefcaseId ranges from 2 to 16777215, see [BriefcaseId]($backend).
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Briefcase", { schemaPropertyName: "schemaName", classPropertyName: "className" })
@ECJsonTypeMap.classToJson("ecdb", "ServiceStore.Briefcase", { classKeyPropertyName: "className" })
export class Briefcase extends WsgInstance {
  /** File name of the master file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileName")
  public fileName?: string;

  /** Description of the master file. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileDescription")
  public fileDescription?: string;

  /** Size of the latest copy of the master file in iModelHub. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileSize")
  public fileSize?: string;

  /** FileId of the master file. See [BriefcaseEntry.fileId]($backend). */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileId")
  public fileId?: string;

  /** Id of the briefcase. See [BriefcaseId]($backend) */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.BriefcaseId")
  @ECJsonTypeMap.propertyToJson("ecdb", "briefcaseId")
  public briefcaseId?: number;

  /** Id of the user that acquired this briefcase. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.UserOwned")
  @ECJsonTypeMap.propertyToJson("ecdb", "userId")
  public userId?: string;

  /** Id of the last [[ChangeSet]] that was merged into the latest copy of master file on iModelHub. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.MergedChangeSetId")
  public mergedChangeSetId?: string;

  /** Date when this briefcase was acquired. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AcquiredDate")
  public acquiredDate?: string;

  /** Shows whether the user who acquired this briefcase can perform write operations. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsReadOnly")
  @ECJsonTypeMap.propertyToJson("ecdb", "isReadOnly")
  public isReadOnly?: boolean;

  /** URL that can be used to download the latest copy of master file from iModelHub. See [[BriefcaseQuery.selectDownloadUrl]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.DownloadUrl")
  public downloadUrl?: string;

  @ECJsonTypeMap.propertyToJson("ecdb", "accessMode")
  public accessMode?: BriefcaseAccessMode;

  @ECJsonTypeMap.propertyToJson("ecdb", "localPathname")
  public localPathname?: string;

  @ECJsonTypeMap.propertyToJson("ecdb", "lastAccessedAt")
  public lastAccessedAt?: Date;

  @ECJsonTypeMap.propertyToJson("ecdb", "iModelId")
  public iModelId?: string;
}

/**
 * Query object for getting [[Briefcase]]s. You can use this to modify the [[BriefcaseHandler.get]] results.
 */
export class BriefcaseQuery extends Query {
  private _byId?: number;
  /**
   * Query single [[Briefcase]] by its id. If briefcase is not found, request will be rejected with a [[WsgError]] and status [WSStatus.InstanceNotFound]($bentley).
   * @param id Id of the Briefcase.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if id is undefined or it is not a valid Briefcase id value.
   */
  public byId(id: number): this {
    ArgumentCheck.validBriefcaseId("id", id);
    this._byId = id;
    return this;
  }

  /**
   * Used by handler to get the id that is queried.
   * @returns Value that was set with byId method.
   * @hidden
   */
  public getId(): number | undefined {
    return this._byId;
  }

  /**
   * Query will additionally select [[Briefcase]] file download URL. This is needed to use the Briefcase object with [[BriefcaseHandler.download]].
   * @returns This query.
   */
  public selectDownloadUrl(): this {
    addSelectFileAccessKey(this._query);
    return this;
  }
}

/**
 * Handler for managing [[Briefcase]]s. Use [[IModelClient.Briefcases]] to get an instance of this class.
 *
 * In most cases, you should use [IModelDb]($backend) or [BriefcaseManager]($backend) methods instead.
 */
export class BriefcaseHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;

  /**
   * Constructor for BriefcaseHandler. Use [[IModelClient]] instead of directly constructing this.
   * @hidden
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
  }

  /**
   * Get relative url for Briefcase requests.
   * @hidden
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param briefcaseId Id of the briefcase.
   */
  private getRelativeUrl(imodelId: string, briefcaseId?: number) {
    return `/Repositories/iModel--${imodelId}/iModelScope/Briefcase/${briefcaseId || ""}`;
  }

  /**
   * Acquire a [[Briefcase]] for the specified iModel. This assigns you a new briefcaseId and returns you a download link.
   *
   * A briefcase is automatically acquired when calling [IModelDb.open]($backend) or [IModelDb.create]($backend). You should use this method only when you want to acquire the briefcaseId without downloading the file. If you need just the download link, you can call [[BriefcaseHandler.get]] with [[BriefcaseQuery.selectDownloadUrl]].
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @returns The acquired Briefcase instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.MaximumNumberOfBriefcasesPerUser]($bentley) or [IModelHubStatus.MaximumNumberOfBriefcasesPerUserPerMinute]($bentley) if a limit of Briefcases for that user was reached. Users should use the Briefcases they have previously acquired. If that is no longer possible, they should delete them, to be able to acquire new ones.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string): Promise<Briefcase> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Acquiring briefcase for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    let briefcase: Briefcase = new Briefcase();

    briefcase = await this._handler.postInstance<Briefcase>(alctx, Briefcase, token, this.getRelativeUrl(imodelId), briefcase);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Acquired briefcase ${briefcase.briefcaseId!} for iModel ${imodelId}`);

    return briefcase;
  }

  /**
   * Delete the [[Briefcase]] from iModelHub. This frees up the id to be reused later and allows user to acquire additional briefcases if one of the briefcase limits was reached.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param briefcaseId Id of the Briefcase to be deleted.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async delete(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, briefcaseId: number): Promise<void> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Deleting briefcase ${briefcaseId} from iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);

    await this._handler.delete(alctx, token, this.getRelativeUrl(imodelId, briefcaseId));
    alctx.enter();
    Logger.logTrace(loggingCategory, `Deleted briefcase ${briefcaseId} from iModel ${imodelId}`);
  }

  /**
   * Get the [[Briefcase]]s.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param query Optional query object to filter the queried Briefcases or select different data from them.
   * @returns Briefcases that match the query.
   * @throws [[WsgError]] with [WSStatus.InstanceNotFound]($bentley) if [[BriefcaseQuery.byId]] is used and a Briefcase with the specified id could not be found.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, query: BriefcaseQuery = new BriefcaseQuery()): Promise<Briefcase[]> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Querying briefcases for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const id = query.getId();

    const briefcases = await this._handler.getInstances<Briefcase>(alctx, Briefcase, token, this.getRelativeUrl(imodelId, id), query.getQueryOptions());
    alctx.enter();
    for (const briefcase of briefcases) {
      briefcase.iModelId = imodelId;
    }

    Logger.logTrace(loggingCategory, `Queried ${briefcases.length} briefcases for iModel ${imodelId}`);

    return briefcases;
  }

  /**
   * Download the latest copy of master file. This only downloads the file and does not write the [[Briefcase]] id into it. Use [IModelDb.open]($backend) instead if you want to get a Briefcase file you can work with.
   *
   * This method does not work on the browser. Directory containing the Briefcase file is created if it does not exist. If there is an error during download, any partially downloaded file is deleted from disk.
   * @param briefcase Briefcase to download. This needs to include a download link. See [[BriefcaseQuery.selectDownloadUrl]].
   * @param downloadToPathname Directory where the Briefcase should be downloaded.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.NotSupportedInBrowser]($bentley) if called in a browser.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.FileHandlerNotSet]($bentley) if [[FileHandler]] instance was not set for [[IModelClient]].
   * @throws [[ResponseError]] if the briefcase cannot be downloaded.
   */
  public async download(alctx: ActivityLoggingContext, briefcase: Briefcase, downloadToPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Downloading briefcase ${briefcase.wsgId} for iModel ${briefcase.iModelId}`);
    ArgumentCheck.defined("briefcase", briefcase);
    ArgumentCheck.defined("downloadToPathname", downloadToPathname);

    if (Config.isBrowser)
      return Promise.reject(IModelHubClientError.browser());

    if (!this._fileHandler)
      return Promise.reject(IModelHubClientError.fileHandler());

    if (!briefcase.downloadUrl)
      return Promise.reject(IModelHubClientError.missingDownloadUrl("briefcase"));

    await this._fileHandler.downloadFile(alctx, briefcase.downloadUrl, downloadToPathname, parseInt(briefcase.fileSize!, 10), progressCallback);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Downloading briefcase ${briefcase.wsgId} for iModel ${briefcase.iModelId}`);
  }
}
