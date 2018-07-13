/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelHubRequestError } from "./Errors";

import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { Config } from "../Config";
import { Query, addSelectFileAccessKey } from "./Query";
import { FileHandler } from "../FileHandler";
import { ProgressInfo } from "../Request";
import { IModelBaseHandler } from "./BaseHandler";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Controls whether the user has exclusive or shared access to a local briefcase */
export enum BriefcaseAccessMode {
  Shared = 0,
  Exclusive = 1,
}

/** Briefcase */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Briefcase", { schemaPropertyName: "schemaName", classPropertyName: "className" })
@ECJsonTypeMap.classToJson("ecdb", "ServiceStore.Briefcase", { classKeyPropertyName: "className" })
export class Briefcase extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileName")
  public fileName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileDescription")
  public fileDescription?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileSize")
  public fileSize?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileId")
  public fileId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.BriefcaseId")
  @ECJsonTypeMap.propertyToJson("ecdb", "briefcaseId")
  public briefcaseId?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.UserOwned")
  @ECJsonTypeMap.propertyToJson("ecdb", "userId")
  public userId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.MergedChangeSetId")
  public mergedChangeSetId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.AcquiredDate")
  public acquiredDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsReadOnly")
  @ECJsonTypeMap.propertyToJson("ecdb", "isReadOnly")
  public isReadOnly?: boolean;

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
 * Query object for getting Briefcases. You can use this to modify the query.
 * @see BriefcaseHandler.get()
 */
export class BriefcaseQuery extends Query {
  private _byId?: number;
  /**
   * Query single briefcase by its id.
   * If briefcase is not found, request will be rejected with a [[WsgError]].
   * @param id Id of the briefcase.
   * @returns This query.
   */
  public byId(id: number): this {
    this._byId = id;
    return this;
  }

  /**
   * Used by handler to get the id that is queried.
   * @returns Value that was set with byId method.
   */
  public getId(): number | undefined {
    return this._byId;
  }

  /**
   * Query will additionally select Briefcase file download URL.
   * @returns This query.
   */
  public selectDownloadUrl(): this {
    addSelectFileAccessKey(this._query);
    return this;
  }
}

/** Check if Briefcase Id is valid. */
export function isBriefcaseIdValid(briefcaseId: number): boolean {
  return briefcaseId > 1 && briefcaseId < 16 * 1024 * 1024;
}

/**
 * Handler for all methods related to @see Briefcase instances.
 */
export class BriefcaseHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;

  /**
   * Constructor for BriefcaseHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
  }

  /**
   * Gets relative url for Briefcase requests.
   * @param imodelId Id of the iModel.
   * @param briefcaseId Id of the briefcase.
   */
  private getRelativeUrl(imodelId: string, briefcaseId?: number) {
    return `/Repositories/iModel--${imodelId}/iModelScope/Briefcase/${briefcaseId || ""}`;
  }

  /**
   * Acquires a briefcase for the specified iModel
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @returns Resolves to the acquired Briefcase instance.
   */
  public async create(token: AccessToken, imodelId: string): Promise<Briefcase> {
    Logger.logInfo(loggingCategory, `Acquiring briefcase for iModel ${imodelId}`);

    let briefcase: Briefcase = new Briefcase();

    briefcase = await this._handler.postInstance<Briefcase>(Briefcase, token, this.getRelativeUrl(imodelId), briefcase);

    Logger.logTrace(loggingCategory, `Acquired briefcase ${briefcase.briefcaseId!} for iModel ${imodelId}`);

    return briefcase;
  }

  /**
   * Delete a Briefcase
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel.
   * @param briefcaseId Id of the briefcase to be deleted.
   * @returns Resolves if the Briefcase has been successfully deleted.
   */
  public async delete(token: AccessToken, imodelId: string, briefcaseId: number): Promise<void> {
    Logger.logInfo(loggingCategory, `Deleting briefcase ${briefcaseId} from iModel ${imodelId}`);

    if (!isBriefcaseIdValid(briefcaseId))
      return Promise.reject(IModelHubRequestError.invalidArgument("briefcaseId"));

    await this._handler.delete(token, this.getRelativeUrl(imodelId, briefcaseId));

    Logger.logTrace(loggingCategory, `Deleted briefcase ${briefcaseId} from iModel ${imodelId}`);
  }

  /**
   * Gets the briefcases that have been acquired by the user.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param query Optional query object to filter the queried briefcases and select different data from them.
   * @returns Resolves to the briefcase.
   * @throws [[ResponseError]] if briefcases couldn't be queried.
   */
  public async get(token: AccessToken, imodelId: string, query: BriefcaseQuery = new BriefcaseQuery()): Promise<Briefcase[]> {
    Logger.logInfo(loggingCategory, `Querying briefcases for iModel ${imodelId}`);

    const id = query.getId();

    if (id && !isBriefcaseIdValid(id))
      return Promise.reject(IModelHubRequestError.invalidArgument("briefcaseId"));

    const briefcases = await this._handler.getInstances<Briefcase>(Briefcase, token, this.getRelativeUrl(imodelId, id), query.getQueryOptions());

    for (const briefcase of briefcases) {
      briefcase.iModelId = imodelId;
    }

    Logger.logTrace(loggingCategory, `Queried ${briefcases.length} briefcases for iModel ${imodelId}`);

    return briefcases;
  }

  /**
   * Downloads the briefcase.
   * Creates the directory containing the briefcase if necessary.
   * If there is a error in the operation any incomplete briefcase is deleted from disk.
   * @param briefcase Briefcase to download. This needs to include a download link. @see BriefcaseQuery.selectDownloadUrl().
   * @param downloadToPathname Directory where the briefcase should be downloaded.
   * @param progressCallback Callback for tracking progress.
   * @throws [[ResponseError]] if the briefcase cannot be downloaded.
   * @throws [[IModelHubRequestError]] if this method is used incorrectly.
   */
  public async download(briefcase: Briefcase, downloadToPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    Logger.logInfo(loggingCategory, `Downloading briefcase ${briefcase.wsgId} for iModel ${briefcase.iModelId}`);

    if (Config.isBrowser())
      return Promise.reject(IModelHubRequestError.browser());

    if (!this._fileHandler)
      return Promise.reject(IModelHubRequestError.fileHandler());

    if (!briefcase.downloadUrl)
      return Promise.reject(IModelHubRequestError.missingDownloadUrl("briefcase"));

    await this._fileHandler.downloadFile(briefcase.downloadUrl, downloadToPathname, parseInt(briefcase.fileSize!, 10), progressCallback);

    Logger.logTrace(loggingCategory, `Downloading briefcase ${briefcase.wsgId} for iModel ${briefcase.iModelId}`);
  }
}
