/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelHubClientError, ArgumentCheck } from "./Errors";

import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { Config } from "../Config";
import { InstanceIdQuery, addSelectFileAccessKey } from "./Query";
import { FileHandler } from "../FileHandler";
import { ProgressInfo } from "../Request";
import { IModelBaseHandler } from "./BaseHandler";

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
   * Query ChangeSet by its id.
   * @param id Id of a ChangeSet.
   * @returns This query.
   */
  public byId(id: string) {
    ArgumentCheck.validChangeSetId("id", id);
    this._byId = id;
    return this;
  }

  /**
   * Query all ChangeSets that are after given ChangeSet id (does not include the specified change set)
   * @param id Id of a ChangeSet.
   * @returns This query.
   */
  public fromId(id: string) {
    ArgumentCheck.validChangeSetId("id", id);
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

  /**
   * Query ChangeSets between changeSets.
   * @param firstChangeSetId Id of the first changeSet.
   * @param secondChangeSetId Id of the second changeSet.
   * @returns This query.
   */
  public betweenChangeSets(firstChangeSetId: string, secondChangeSetId?: string) {
    ArgumentCheck.validChangeSetId("firstChangeSetId", firstChangeSetId);
    if (secondChangeSetId)
      ArgumentCheck.validChangeSetId("secondChangeSetId", secondChangeSetId);
    let query: string;
    if (!secondChangeSetId) {
      query = `CumulativeChangeSet-backward-ChangeSet.Id+eq+'${firstChangeSetId}'`;
    } else {
      query = `(CumulativeChangeSet-backward-ChangeSet.Id+eq+'${firstChangeSetId}'`;
      query += `+and+FollowingChangeSet-backward-ChangeSet.Id+eq+'${secondChangeSetId}')`;
      query += `+or+(CumulativeChangeSet-backward-ChangeSet.Id+eq+'${secondChangeSetId}'`;
      query += `+and+FollowingChangeSet-backward-ChangeSet.Id+eq+'${firstChangeSetId}')`;
    }

    this.addFilter(query);
    return this;
  }

  /**
   * Query version changeSets.
   * @param versionId Id of the version.
   * @returns This query.
   */
  public getVersionChangeSets(versionId: string) {
    ArgumentCheck.validGuid("versionId", versionId);
    this.addFilter(`CumulativeChangeSet-backward-Version.Id+eq+'${versionId}'`);
    return this;
  }

  /**
   * Query changeSets after version.
   * @param versionId Id of the version.
   * @returns This query.
   */
  public afterVersion(versionId: string) {
    ArgumentCheck.validGuid("versionId", versionId);
    this.addFilter(`FollowingChangeSet-backward-Version.Id+eq+'${versionId}'`);
    return this;
  }

  /**
   * Query changeSets between two versions.
   * @param sourceVersionId Id of the source version.
   * @param destinationVersionId Id of the destination version.
   * @returns This query.
   */
  public betweenVersions(sourceVersionId: string, destinationVersionId: string) {
    ArgumentCheck.validGuid("sourceVersionId", sourceVersionId);
    ArgumentCheck.validGuid("destinationVersionId", destinationVersionId);
    let query: string;
    query = `(FollowingChangeSet-backward-Version.Id+eq+'${sourceVersionId}'`;
    query += `+and+CumulativeChangeSet-backward-Version.Id+eq+'${destinationVersionId}')`;
    query += `+or+(FollowingChangeSet-backward-Version.Id+eq+'${destinationVersionId}'`;
    query += `+and+CumulativeChangeSet-backward-Version.Id+eq+'${sourceVersionId}')`;

    this.addFilter(query);
    return this;
  }

  /**
   * Query changeSets between version and changeSet.
   * @param versionId Id of the version.
   * @param changeSetId Id of the changeSet.
   * @returns This query.
   */
  public betweenVersionAndChangeSet(versionId: string, changeSetId: string) {
    ArgumentCheck.validGuid("versionId", versionId);
    ArgumentCheck.validChangeSetId("changeSetId", changeSetId);
    let query: string;
    query = `(CumulativeChangeSet-backward-Version.Id+eq+'${versionId}'+and+FollowingChangeSet-backward-ChangeSet.Id+eq+'${changeSetId}')`;
    query += `+or+`;
    query += `(FollowingChangeSet-backward-Version.Id+eq+'${versionId}'+and+CumulativeChangeSet-backward-ChangeSet.Id+eq+'${changeSetId}')`;

    this.addFilter(query);
    return this;
  }

  /**
   * Query changeSets by seed file id.
   * @param seedFileId Id of the seed file.
   * @returns This query.
   */
  public bySeedFileId(seedFileId: string) {
    ArgumentCheck.validGuid("seedFileId", seedFileId);
    this.addFilter(`SeedFileId+eq+'${seedFileId}'`);
    return this;
  }
}

/**
 * Handler for all methods related to ChangeSets.
 */
export class ChangeSetHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;

  /**
   * Constructor for ChangeSetHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
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

  /**
   * Gets ChangeSets.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param query Object to modify this methods results.
   * @returns Resolves to an array of change sets.
   * @throws [[WsgError]] with [WSStatus.InstanceNotFound]($bentley) if [[InstanceIdQuery.byId]] is used and a [[ChangeSet]] with the specified id could not be found.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(token: AccessToken, imodelId: string, query: ChangeSetQuery = new ChangeSetQuery()): Promise<ChangeSet[]> {
    Logger.logInfo(loggingCategory, `Querying changesets for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const id = query.getId();
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
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if one of the required arguments is undefined or empty.
   * @param progressCallback Callback for tracking progress.
   * @throws [[ResponseError]] if the download fails.
   */
  public async download(changeSets: ChangeSet[], downloadToPath: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    Logger.logInfo(loggingCategory, `Downloading ${changeSets.length} changesets`);
    ArgumentCheck.nonEmptyArray("changeSets", changeSets);
    ArgumentCheck.defined("downloadToPath", downloadToPath);

    if (Config.isBrowser)
      return Promise.reject(IModelHubClientError.browser());

    if (!this._fileHandler)
      return Promise.reject(IModelHubClientError.fileHandler());

    changeSets.forEach((changeSet) => {
      if (!changeSet.downloadUrl)
        throw IModelHubClientError.missingDownloadUrl("changeSets");
    });

    const promises = new Array<Promise<void>>();
    let totalSize = 0;
    let downloadedSize = 0;
    changeSets.forEach((value) => totalSize += parseInt(value.fileSize!, 10));
    for (const changeSet of changeSets) {
      const downloadUrl: string = changeSet.downloadUrl!;
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
   * @throws [IModelHubStatus.BriefcaseDoesNotBelongToUser]($bentley) if [[Briefcase]] specified by changeSet.briefcaseId belongs to another user.
   * @throws [IModelHubStatus.AnotherUserPushing]($bentley) if another user is currently uploading a [[ChangeSet]].
   * @throws [IModelHubStatus.PullIsRequired]($bentley) if there are newer [[ChangeSet]]s on iModel Hub, that need to be downloaded and merged, before upload is possible.
   * @throws [IModelHubStatus.ChangeSetAlreadyExists]($bentley) if a [[ChangeSet]] with this id already exists. This usually happens if previous upload attempt has succeeded.
   * @throws [IModelHubStatus.ChangeSetPointsToBadSeed]($bentley) if changeSet.seedFileId isn't set to the correct file id. That file id should match to the value written to the [[Briefcase]] file.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(token: AccessToken, imodelId: string, changeSet: ChangeSet, changeSetPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<ChangeSet> {
    Logger.logInfo(loggingCategory, `Uploading changeset ${changeSet.id} to iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.defined("changeSet", changeSet);
    ArgumentCheck.defined("changeSetPathname", changeSetPathname);

    if (Config.isBrowser)
      return Promise.reject(IModelHubClientError.browser());

    if (!this._fileHandler)
      return Promise.reject(IModelHubClientError.fileHandler());

    if (!this._fileHandler.exists(changeSetPathname) || this._fileHandler.isDirectory(changeSetPathname))
      return Promise.reject(IModelHubClientError.fileNotFound());

    const postChangeSet = await this._handler.postInstance<ChangeSet>(ChangeSet, token, this.getRelativeUrl(imodelId), changeSet);

    await this._fileHandler.uploadFile(postChangeSet.uploadUrl!, changeSetPathname, progressCallback);

    postChangeSet.uploadUrl = undefined;
    postChangeSet.downloadUrl = undefined;
    postChangeSet.isUploaded = true;

    const confirmChangeSet = await this._handler.postInstance<ChangeSet>(ChangeSet, token, this.getRelativeUrl(imodelId, postChangeSet.wsgId), postChangeSet);

    changeSet.isUploaded = true;

    Logger.logTrace(loggingCategory, `Uploaded changeset ${changeSet.id} to iModel ${imodelId}`);

    return confirmChangeSet;
  }
}
