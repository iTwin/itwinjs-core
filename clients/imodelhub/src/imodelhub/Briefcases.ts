/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import { GuidString, IModelHubStatus, Logger } from "@bentley/bentleyjs-core";
import {
  AuthorizedClientRequestContext, CancelRequest, ECJsonTypeMap, FileHandler, ProgressCallback, WsgInstance, WsgQuery,
} from "@bentley/itwin-client";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck, IModelHubClientError, IModelHubError } from "./Errors";
import { addSelectApplicationData, addSelectFileAccessKey } from "./HubQuery";
import { IModelClient } from "../IModelClient";
import { LockQuery } from "./Locks";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelHub;

/** Controls whether the user has exclusive or shared access to a local briefcase
 * @internal
 */
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
 * @internal
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

  /** FileId of the master file. */
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

  /** Date until this briefcase is valid. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ExpirationDate")
  public expirationDate?: string;

  /** Name of the device on which this briefcase is downloaded. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.DeviceName")
  public deviceName?: string;

  /** Id of the latest [[ChangeSet]] on device. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ChangeSetIdOnDevice")
  public changeSetIdOnDevice?: string;

  /** Shows whether the user who acquired this briefcase can perform write operations. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsReadOnly")
  @ECJsonTypeMap.propertyToJson("ecdb", "isReadOnly")
  public isReadOnly?: boolean;

  /** URL that can be used to download the latest copy of master file from iModelHub. See [[BriefcaseQuery.selectDownloadUrl]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.DownloadUrl")
  public downloadUrl?: string;

  /** Id of the application that created this Briefcase. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[CreatedByApplication].relatedInstance[Application].properties.Id")
  public applicationId?: string;

  /** Name of the application that created this Briefcase. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[CreatedByApplication].relatedInstance[Application].properties.Name")
  public applicationName?: string;

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
 * @internal
 */
export class BriefcaseQuery extends WsgQuery {
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
   * @internal
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

  /**
   * Query will additionally select data about application that created this [[Briefcase]].
   * @returns This query.
   */
  public selectApplicationData() {
    addSelectApplicationData(this._query);
    return this;
  }

  /**
   * Query will select [[Briefcase]]s owned by this user.
   * @returns This query.
   */
  public ownedByMe(): this {
    this.addFilter("UserOwned+eq+'@me'");
    return this;
  }
}

/**
 * Handler for managing [[Briefcase]]s. Use [[IModelClient.Briefcases]] to get an instance of this class.
 * In most cases, you should use [BriefcaseDb]($backend) methods instead.
 * @internal
 */
export class BriefcaseHandler {
  private _handler: IModelBaseHandler;
  private _imodelClient: IModelClient;
  private _fileHandler?: FileHandler;

  /** Constructor for BriefcaseHandler. Use [[IModelClient]] instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   * @internal
   */
  constructor(handler: IModelBaseHandler, imodelClient: IModelClient, fileHandler?: FileHandler) {
    this._handler = handler;
    this._imodelClient = imodelClient;
    this._fileHandler = fileHandler;
  }

  /** Get relative url for Briefcase requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param briefcaseId Id of the briefcase.
   */
  private getRelativeUrl(iModelId: GuidString, briefcaseId?: number) {
    return `/Repositories/iModel--${iModelId}/iModelScope/Briefcase/${briefcaseId || ""}`;
  }

  /** Acquire a [[Briefcase]] for the specified iModel. This assigns you a new briefcaseId and returns you a download link.
   * A briefcase is automatically acquired when calling [BriefcaseManager.download]($backend) or [BriefcaseDb.create]($backend). You should use this method only when you want to acquire the briefcaseId without downloading the file. If you need just the download link, you can call [[BriefcaseHandler.get]] with [[BriefcaseQuery.selectDownloadUrl]].
   * @param requestContext The client request context
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param briefcase Information of the Briefcase to acquire.
   * @returns The acquired Briefcase instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.MaximumNumberOfBriefcasesPerUser]($bentley) or [IModelHubStatus.MaximumNumberOfBriefcasesPerUserPerMinute]($bentley) if a limit of Briefcases for that user was reached. Users should use the Briefcases they have previously acquired. If that is no longer possible, they should delete them, to be able to acquire new ones.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, briefcase: Briefcase = new Briefcase()): Promise<Briefcase> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Acquiring briefcase for iModel", () => ({ iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);

    briefcase = await this._handler.postInstance<Briefcase>(requestContext, Briefcase, this.getRelativeUrl(iModelId), briefcase);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Acquired briefcase for iModel", () => briefcase);
    return briefcase;
  }

  /** Update the [[Briefcase]] of an iModel. Only [[Briefcase.deviceName]] and [[Briefcase.changeSetIdOnDevice]] can be changed when updating the briefcase.
   * Briefcase expiration date is also extended with each update request for a configured period of time (default is 30 days).
   * @param requestContext The client request context.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param briefcase Briefcase to update.
   * @returns Updated Briefcase instance from iModelHub.
   * @throws [[IModelHubError]] with [IModelHubStatus.FailedToGetProductSettings]($bentley) if request to get settings to Product Settings service fails.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, briefcase: Briefcase): Promise<Briefcase> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Updating briefcase for iModel", () => ({ iModelId, briefcase }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);
    const briefcaseId = parseInt(briefcase.wsgId, 10);
    ArgumentCheck.validBriefcaseId("briefcase.wsgId", briefcaseId);

    const updatedBriefcase = await this._handler.postInstance<Briefcase>(requestContext, Briefcase, this.getRelativeUrl(iModelId, briefcaseId), briefcase);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Updated briefcase for iModel", () => ({ iModelId, briefcase }));
    return updatedBriefcase;
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

    const existingLocksOwnedByBriefcase = await this._imodelClient.locks.get(requestContext, iModelId, new LockQuery().byBriefcaseId(briefcaseId).top(1));
    requestContext.enter();
    if (existingLocksOwnedByBriefcase.length > 0) {
      try {
        await this._imodelClient.locks.deleteAll(requestContext, iModelId, briefcaseId);
        requestContext.enter();
      } catch (error) {
        requestContext.enter();
        if (!(error instanceof IModelHubError) || error.errorNumber !== IModelHubStatus.UserDoesNotHavePermission) {
          throw error;
        }
      }
    }

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
   * @param cancelRequest Request used to cancel download
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.NotSupportedInBrowser]($bentley) if called in a browser.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.FileHandlerNotSet]($bentley) if [[FileHandler]] instance was not set for [[IModelClient]].
   * @throws [[ResponseError]] if the briefcase cannot be downloaded.
   */
  public async download(requestContext: AuthorizedClientRequestContext, briefcase: Briefcase, path: string, progressCallback?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Started downloading briefcase", () => ({ ...briefcase, path }));
    ArgumentCheck.defined("briefcase", briefcase);
    ArgumentCheck.defined("path", path);

    if (typeof window !== "undefined")
      throw IModelHubClientError.browser();

    if (!this._fileHandler)
      throw IModelHubClientError.fileHandler();

    if (!briefcase.downloadUrl)
      throw IModelHubClientError.missingDownloadUrl("briefcase");

    await this._fileHandler.downloadFile(requestContext, briefcase.downloadUrl, path, parseInt(briefcase.fileSize!, 10), progressCallback, cancelRequest);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Finished downloading briefcase", () => ({ ...briefcase, path }));
  }
}
