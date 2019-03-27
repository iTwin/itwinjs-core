/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { GuidString, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";
import { FileHandler } from "../FileHandler";
import { LoggerCategory } from "../LoggerCategory";
import { ProgressInfo } from "../Request";
import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck, IModelHubClientError } from "./Errors";
import { addSelectFileAccessKey, Query } from "./Query";

const loggerCategory: string = LoggerCategory.IModelHub;

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
  public fileId?: GuidString;

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
  public iModelId?: GuidString;
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

  /** Used by handler to get the id that is queried.
   * @returns Value that was set with byId method.
   * @internal
   */
  public getId(): number | undefined {
    return this._byId;
  }

  /** Query will additionally select [[Briefcase]] file download URL. This is needed to use the Briefcase object with [[BriefcaseHandler.download]].
   * @returns This query.
   */
  public selectDownloadUrl(): this {
    addSelectFileAccessKey(this._query);
    return this;
  }
}

/** Handler for managing [[Briefcase]]s. Use [[IModelClient.Briefcases]] to get an instance of this class.
 * In most cases, you should use [IModelDb]($backend) or [BriefcaseManager]($backend) methods instead.
 */
export class BriefcaseHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;

  /** Constructor for BriefcaseHandler. Use [[IModelClient]] instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   * @internal
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
  }

  /** Get relative url for Briefcase requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param briefcaseId Id of the briefcase.
   * @internal
   */
  private getRelativeUrl(iModelId: GuidString, briefcaseId?: number) {
    return `/Repositories/iModel--${iModelId}/iModelScope/Briefcase/${briefcaseId || ""}`;
  }

  /** Acquire a [[Briefcase]] for the specified iModel. This assigns you a new briefcaseId and returns you a download link.
   * A briefcase is automatically acquired when calling [IModelDb.open]($backend) or [IModelDb.create]($backend). You should use this method only when you want to acquire the briefcaseId without downloading the file. If you need just the download link, you can call [[BriefcaseHandler.get]] with [[BriefcaseQuery.selectDownloadUrl]].
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @returns The acquired Briefcase instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.MaximumNumberOfBriefcasesPerUser]($bentley) or [IModelHubStatus.MaximumNumberOfBriefcasesPerUserPerMinute]($bentley) if a limit of Briefcases for that user was reached. Users should use the Briefcases they have previously acquired. If that is no longer possible, they should delete them, to be able to acquire new ones.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<Briefcase> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Acquiring briefcase for iModel", () => ({ iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);

    let briefcase: Briefcase = new Briefcase();

    briefcase = await this._handler.postInstance<Briefcase>(requestContext, Briefcase, this.getRelativeUrl(iModelId), briefcase);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Acquired briefcase for iModel", () => briefcase);
    return briefcase;
  }

  /** Delete the [[Briefcase]] from iModelHub. This frees up the id to be reused later and allows user to acquire additional briefcases if one of the briefcase limits was reached.
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param briefcaseId Id of the Briefcase to be deleted.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async delete(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, briefcaseId: number): Promise<void> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Deleting briefcase from iModel", () => ({ iModelId, briefcaseId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);

    await this._handler.delete(requestContext, this.getRelativeUrl(iModelId, briefcaseId));
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Deleted briefcase from iModel", () => ({ iModelId, briefcaseId }));
  }

  /** Get the [[Briefcase]]s.
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried Briefcases or select different data from them.
   * @returns Briefcases that match the query.
   * @throws [[WsgError]] with [WSStatus.InstanceNotFound]($bentley) if [[BriefcaseQuery.byId]] is used and a Briefcase with the specified id could not be found.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, query: BriefcaseQuery = new BriefcaseQuery()): Promise<Briefcase[]> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Querying briefcases for iModel", () => ({ iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);

    const id = query.getId();

    const briefcases = await this._handler.getInstances<Briefcase>(requestContext, Briefcase, this.getRelativeUrl(iModelId, id), query.getQueryOptions());
    requestContext.enter();
    for (const briefcase of briefcases) {
      briefcase.iModelId = iModelId;
    }

    Logger.logTrace(loggerCategory, "Queried briefcases for iModel", () => ({ iModelId, count: briefcases.length }));
    return briefcases;
  }

  /** Download the latest copy of master file. This only downloads the file and does not write the [[Briefcase]] id into it. Use [IModelDb.open]($backend) instead if you want to get a Briefcase file you can work with.
   * This method does not work on the browser. Directory containing the Briefcase file is created if it does not exist. If there is an error during download, any partially downloaded file is deleted from disk.
   * @param requestContext The client request context
   * @param briefcase Briefcase to download. This needs to include a download link. See [[BriefcaseQuery.selectDownloadUrl]].
   * @param path Path where briefcase file should be downloaded, including filename.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.NotSupportedInBrowser]($bentley) if called in a browser.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.FileHandlerNotSet]($bentley) if [[FileHandler]] instance was not set for [[IModelClient]].
   * @throws [[ResponseError]] if the briefcase cannot be downloaded.
   */
  public async download(requestContext: AuthorizedClientRequestContext, briefcase: Briefcase, path: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Started downloading briefcase", () => ({ ...briefcase, path }));
    ArgumentCheck.defined("briefcase", briefcase);
    ArgumentCheck.defined("path", path);

    if (typeof window !== "undefined")
      return Promise.reject(IModelHubClientError.browser());

    if (!this._fileHandler)
      return Promise.reject(IModelHubClientError.fileHandler());

    if (!briefcase.downloadUrl)
      return Promise.reject(IModelHubClientError.missingDownloadUrl("briefcase"));

    await this._fileHandler.downloadFile(requestContext, briefcase.downloadUrl, path, parseInt(briefcase.fileSize!, 10), progressCallback);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Finished downloading briefcase", () => ({ ...briefcase, path }));
  }
}
