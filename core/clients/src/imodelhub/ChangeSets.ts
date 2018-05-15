/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelHubBaseHandler } from "./BaseHandler";
import { IModelHubRequestError } from "./Errors";

import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { Config } from "../Config";
import { InstanceIdQuery, addSelectFileAccessKey } from "./Query";
import { FileHandler } from "./index";
import { ProgressInfo } from "../Request";

const loggingCategory = "imodeljs-clients.imodelhub";

export const enum ContainsSchemaChanges {
  No = 0,
  Yes = 1,
}

/** ChangeSet */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.ChangeSet", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class ChangeSet extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Id")
  public id?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileName")
  public fileName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Description")
  public description?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileSize")
  public fileSize?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Index")
  public index?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ParentId")
  public parentId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.SeedFileId")
  public seedFileId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.BriefcaseId")
  public briefcaseId?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.UserCreated")
  public userCreated?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.PushDate")
  public pushDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ContainingChanges")
  public containsSchemaChanges?: ContainsSchemaChanges;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsUploaded")
  public isUploaded?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.DownloadUrl")
  public downloadUrl?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.UploadUrl")
  public uploadUrl?: string;

  /** Pathname of the download change set on disk */
  public pathname?: string;
}

/**
 * Query object for getting ChangeSets You can use this to modify the query.
 * @see ChangeSetHandler.get()
 */
export class ChangeSetQuery extends InstanceIdQuery {
  /**
   * Query will additionally select Briefcase file download URL.
   * @returns This query.
   */
  public selectDownloadUrl() {
    addSelectFileAccessKey(this._query);
    return this;
  }

  /**
   * Query all ChangeSets that are after given ChangeSet id (does not include the specified change set)
   * @param id Id of a ChangeSet.
   * @returns This query.
   */
  public fromId(id: string) {
    this._query.$filter = `FollowingChangeSet-backward-ChangeSet.Id+eq+'${id}'`;
    return this;
  }

  /**
   * Change the order to latest changesets first in the query.
   * @returns This query.
   */
  public latest() {
    this._query.$orderby = "Index+desc";
    return this;
  }
}

/**
 * Handler for all methods related to ChangeSets.
 */
export class ChangeSetHandler {
  private _handler: IModelHubBaseHandler;
  private _fileHandler?: FileHandler;

  /**
   * Constructor for ChangeSetHandler. Should use @see IModelHubClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   */
  constructor(handler: IModelHubBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
  }

  /**
   * Gets relative url for ChangeSet requests.
   * @param imodelId Id of the iModel.
   * @param changeSetId Id of the ChangeSet.
   */
  private getRelativeUrl(imodelId: string, changeSetId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/ChangeSet/${changeSetId || ""}`;
  }

  /** Check if ChangeSet Id is valid. */
  private isValid(changesetId: string) {
    return changesetId.length === 40;
  }

  /**
   * Gets ChangeSets.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param query Object to modify this methods results.
   * @returns Resolves to an array of change sets.
   */
  public async get(token: AccessToken, imodelId: string, query: ChangeSetQuery = new ChangeSetQuery()): Promise<ChangeSet[]> {
    Logger.logInfo(loggingCategory, `Querying changesets for iModel ${imodelId}`);

    const id = query.getId();

    if (id && !this.isValid(id))
      return Promise.reject(IModelHubRequestError.invalidArgument("changeSetId"));

    const changeSets = await this._handler.getInstances<ChangeSet>(ChangeSet, token, this.getRelativeUrl(imodelId, id), query.getQueryOptions());

    Logger.logTrace(loggingCategory, `Queried ${changeSets.length} changesets for iModel ${imodelId}`);

    return changeSets;
  }

  /**
   * Downloads the specified ChangeSets.
   * Creates the directory containing the ChangeSets if necessary.
   * If there is an error in downloading some ChangeSet, throws an error and any incomplete ChangeSet is deleted from disk.
   * @param changeSets Change sets to download. These need to include a download link. @see ChangeSetQuery.selectDownloadUrl().
   * @param downloadToPath Directory where the ChangeSets should be downloaded.
   * @param progressCallback Callback for tracking progress.
   */
  public async download(changeSets: ChangeSet[], downloadToPath: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    Logger.logInfo(loggingCategory, `Downloading ${changeSets.length} changesets`);

    if (Config.isBrowser())
      return Promise.reject(IModelHubRequestError.browser());

    if (!this._fileHandler)
      return Promise.reject(IModelHubRequestError.fileHandler());

    const promises = new Array<Promise<void>>();
    let totalSize = 0;
    let downloadedSize = 0;
    changeSets.forEach((value) => totalSize += parseInt(value.fileSize!, 10));
    for (const changeSet of changeSets) {
      if (!changeSet.downloadUrl)
        return Promise.reject(IModelHubRequestError.missingDownloadUrl("changeSets"));

      const downloadUrl: string = changeSet.downloadUrl;
      const downloadToPathname: string = this._fileHandler.join(downloadToPath, changeSet.fileName!);

      let previouslyDownloaded = 0;
      const callback = (progress: ProgressInfo) => {
        downloadedSize += (progress.loaded - previouslyDownloaded);
        previouslyDownloaded = progress.loaded;
        progressCallback!({ loaded: downloadedSize, total: totalSize, percent: downloadedSize / totalSize });
      };
      promises.push(this._fileHandler.downloadFile(downloadUrl, downloadToPathname, parseInt(changeSet.fileSize!, 10), progressCallback ? callback : undefined));
    }

    await Promise.all(promises);

    Logger.logTrace(loggingCategory, `Downloaded ${changeSets.length} changesets`);
  }

  /**
   * Uploads a ChangeSet
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param changeSet Information of the ChangeSet to be uploaded.
   * @param changeSetPathname Pathname of the ChangeSet to be uploaded.
   * @param progressCallback Callback for tracking progress.
   * @throws [[ResponseError]] if the upload fails.
   */
  public async create(token: AccessToken, imodelId: string, changeSet: ChangeSet, changeSetPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<ChangeSet> {
    Logger.logInfo(loggingCategory, `Uploading changeset ${changeSet.id} to iModel ${imodelId}`);

    if (Config.isBrowser())
      return Promise.reject(IModelHubRequestError.browser());

    if (!this._fileHandler)
      return Promise.reject(IModelHubRequestError.fileHandler());

    const postChangeSet = await this._handler.postInstance<ChangeSet>(ChangeSet, token, this.getRelativeUrl(imodelId), changeSet);

    await this._fileHandler.uploadFile(postChangeSet.uploadUrl!, changeSetPathname, progressCallback);

    postChangeSet.uploadUrl = undefined;
    postChangeSet.downloadUrl = undefined;
    postChangeSet.isUploaded = true;

    const confirmChangeSet = await this._handler.postInstance<ChangeSet>(ChangeSet, token, this.getRelativeUrl(imodelId, postChangeSet.wsgId), postChangeSet);

    if (!confirmChangeSet.isUploaded)
      return Promise.reject(new Error("Error uploading change set"));

    changeSet.isUploaded = true;

    Logger.logTrace(loggingCategory, `Uploaded changeset ${changeSet.id} to iModel ${imodelId}`);

    return confirmChangeSet;
  }
}
