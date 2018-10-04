/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap, WsgInstance, GuidSerializer } from "./../ECJsonTypeMap";
import { IModelHubClientError, ArgumentCheck } from "./Errors";

import { AccessToken } from "../Token";
import { Logger, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { Config } from "../Config";
import { addSelectFileAccessKey, StringIdQuery } from "./Query";
import { FileHandler } from "../FileHandler";
import { ProgressInfo } from "../Request";
import { IModelBaseHandler } from "./BaseHandler";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Specifies types of changes in a [[ChangeSet]]. */
export const enum ChangesType {
  /** [[ChangeSet]] contains regular file changes (e.g. changes to elements or models). */
  Regular,
  /** [[ChangeSet]] only contains schema changes. */
  Schema,
}

/**
 * [ChangeSet]($docs/learning/Glossary.md#changeset) represents a file containing changes to the iModel. A single ChangeSet contains changes made on a single [[Briefcase]] file and pushed as a single file. ChangeSets form a linear change history of the iModel. If a user wants to push their changes to iModelHub, they first have to merge all ChangeSet they do not have yet. Only a single briefcase is allowed to push their changes at a time.
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.ChangeSet", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class ChangeSet extends WsgInstance {
  /** Id of this ChangeSet. It has to be set during the push. It's a hash value based on the contents of ChangeSet file and its parentId. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Id")
  public id?: string;

  /** Filename of the ChangeSet. It has to be set during the push. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileName")
  public fileName?: string;

  /** Description of this ChangeSet. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Description")
  public description?: string;

  /** Size of this ChangeSet file. It has to be set during the push. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileSize")
  public fileSize?: string;

  /** Index of this ChangeSet (increasing, but not necessarily sequential). */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Index")
  public index?: string;

  /** Id of this ChangeSet's parent ChangeSet. It has to be set during the push. See [BriefcaseEntry.reversedChangeSetId]($backend). */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ParentId")
  public parentId?: string;

  /** Id of the file that this ChangeSet belongs to. It has to be set during the push. See [IModelDb.getGuid]($backend). */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.SeedFileId", new GuidSerializer())
  public seedFileId?: Guid;

  /** Id of the [[Briefcase]] that pushed this ChangeSet. It has to be set during the push. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.BriefcaseId")
  public briefcaseId?: number;

  /** Id of the user that pushed this ChangeSet. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.UserCreated")
  public userCreated?: string;

  /** Date when this ChangeSet was pushed to iModelHub. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.PushDate")
  public pushDate?: string;

  /** Shows what kind of changes are contained in this ChangeSet. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ContainingChanges")
  public changesType?: ChangesType;

  /** Flag that needs to be marked true, when confirming successful ChangeSet upload. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsUploaded")
  public isUploaded?: boolean;

  /** URL from where the ChangeSet file can be downloaded. See [[ChangeSetQuery.selectDownloadUrl]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.DownloadUrl")
  public downloadUrl?: string;

  /** URL where the ChangeSet file has to be uploaded. */
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.UploadUrl")
  public uploadUrl?: string;

  /** Path to the download ChangeSet file on disk. */
  public pathname?: string;
}

/**
 * Query object for getting [[ChangeSet]]s. You can use this to modify the query. See [[ChangeSetHandler.get]].
 */
export class ChangeSetQuery extends StringIdQuery {

  /**
   * Query will additionally select [[ChangeSet]] file download URL. This is needed to use the ChangeSet object with [[ChangeSetHandler.download]].
   * @returns This query.
   */
  public selectDownloadUrl() {
    addSelectFileAccessKey(this._query);
    return this;
  }

  /** @hidden */
  protected checkValue(id: string) {
    ArgumentCheck.validChangeSetId("id", id);
  }

  /**
   * Query [[ChangeSet]]s that are after the specified ChangeSet. This overrides any previously applied ChangeSetQuery filters. Query will return all of the ChangeSets that are newer than the one specified by id. ChangeSet specified by the id will not be included in the results. Returned ChangeSets will be in an ascending order.
   * @param id Id of a ChangeSet.
   * @returns This query.
   */
  public fromId(id: string) {
    ArgumentCheck.validChangeSetId("id", id);
    this._query.$filter = `FollowingChangeSet-backward-ChangeSet.Id+eq+'${id}'`;
    return this;
  }

  /**
   * Change the order of results to be from newest [[ChangeSet]]s to the oldest ones.
   * @returns This query.
   */
  public latest() {
    this._query.$orderby = "Index+desc";
    return this;
  }

  /**
   * Query [[ChangeSet]]s between two specified ChangeSets. This overrides any previously applied ChangeSetQuery filters. This query will work when either of the ChangeSet ids points to an earlier ChangeSet. Latest ChangeSet specified by this range will be included in the results, but the earliest will be excluded. If the second ChangeSet id is not specified, it's assumed that it's the same as an empty id, and query will return all ChangeSets from the start up to the ChangeSet with the first id. Returned ChangeSets will be in an ascending order.
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

    this._query.$filter = query;
    return this;
  }

  /**
   * Query [[ChangeSet]]s included in the specified [[Version]]. This overrides any previously applied ChangeSetQuery filters. Query will return all of the ChangeSets from the start up to the one specified by versionId. ChangeSet specified by versionId will be included in the results. Returned ChangeSets will be in an ascending order.
   * @param versionId Id of the version.
   * @returns This query.
   */
  public getVersionChangeSets(versionId: Guid) {
    ArgumentCheck.validGuid("versionId", versionId);
    this._query.$filter = `CumulativeChangeSet-backward-Version.Id+eq+'${versionId}'`;
    return this;
  }

  /**
   * Query [[ChangeSet]]s after the specified [[Version]]. This overrides any previously applied ChangeSetQuery filters. Query will return all of the ChangeSets that are newer than the one specified by versionId. ChangeSet specified by versionId will not be included in the results. Returned ChangeSets will be in an ascending order.
   * @param versionId Id of the version.
   * @returns This query.
   */
  public afterVersion(versionId: Guid) {
    ArgumentCheck.validGuid("versionId", versionId);
    this._query.$filter = `FollowingChangeSet-backward-Version.Id+eq+'${versionId}'`;
    return this;
  }

  /**
   * Query [[ChangeSet]]s between two specified [[Version]]s. This overrides any previously applied ChangeSetQuery filters. This query will work when either of the Version ids points to an earlier ChangeSet. Latest ChangeSet specified by this range will be included in the results, but the earliest will be excluded. Returned ChangeSets will be in an ascending order.
   * @param sourceVersionId Id of the source version.
   * @param destinationVersionId Id of the destination version.
   * @returns This query.
   */
  public betweenVersions(sourceVersionId: Guid, destinationVersionId: Guid) {
    ArgumentCheck.validGuid("sourceVersionId", sourceVersionId);
    ArgumentCheck.validGuid("destinationVersionId", destinationVersionId);
    let query: string;
    query = `(FollowingChangeSet-backward-Version.Id+eq+'${sourceVersionId}'`;
    query += `+and+CumulativeChangeSet-backward-Version.Id+eq+'${destinationVersionId}')`;
    query += `+or+(FollowingChangeSet-backward-Version.Id+eq+'${destinationVersionId}'`;
    query += `+and+CumulativeChangeSet-backward-Version.Id+eq+'${sourceVersionId}')`;

    this._query.$filter = query;
    return this;
  }

  /**
   * Query [[ChangeSet]]s between the specified [[Version]] and another [[ChangeSet]]. This overrides any previously applied ChangeSetQuery filters. This query will work when either versionId or changeSetId points to an earlier ChangeSet. Latest ChangeSet specified by this range will be included in the results, but the earliest will be excluded. Returned ChangeSets will be in an ascending order.
   * @param versionId Id of the version.
   * @param changeSetId Id of the changeSet.
   * @returns This query.
   */
  public betweenVersionAndChangeSet(versionId: Guid, changeSetId: string) {
    ArgumentCheck.validGuid("versionId", versionId);
    ArgumentCheck.validChangeSetId("changeSetId", changeSetId);
    let query: string;
    query = `(CumulativeChangeSet-backward-Version.Id+eq+'${versionId}'+and+FollowingChangeSet-backward-ChangeSet.Id+eq+'${changeSetId}')`;
    query += `+or+`;
    query += `(FollowingChangeSet-backward-Version.Id+eq+'${versionId}'+and+CumulativeChangeSet-backward-ChangeSet.Id+eq+'${changeSetId}')`;

    this._query.$filter = query;
    return this;
  }

  /**
   * Query changeSets by the seed file id. Should be obsolete, because seed file replacement is deprecated.
   * @hidden
   * @param seedFileId Id of the seed file.
   * @returns This query.
   */
  public bySeedFileId(seedFileId: Guid) {
    ArgumentCheck.validGuid("seedFileId", seedFileId);
    this.addFilter(`SeedFileId+eq+'${seedFileId}'`);
    return this;
  }
}

/**
 * Handler for managing [[ChangeSet]]s. Use [[IModelClient.ChangeSets]] to get an instance of this class. In most cases, you should use [IModelDb]($backend) or [BriefcaseManager]($backend) methods instead.
 */
export class ChangeSetHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;

  /**
   * Constructor for ChangeSetHandler. Should use [[IModelClient]] instead of directly constructing this.
   * @hidden
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
  }

  /**
   * Get relative url for ChangeSet requests.
   * @hidden
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param changeSetId Id of the ChangeSet.
   */
  private getRelativeUrl(imodelId: Guid, changeSetId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/ChangeSet/${changeSetId || ""}`;
  }

  /**
   * Get the [[ChangeSet]]s for the iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried ChangeSets or select different data from them.
   * @returns ChangeSets that match the query.
   * @throws [[WsgError]] with [WSStatus.InstanceNotFound]($bentley) if [[InstanceIdQuery.byId]] is used and a [[ChangeSet]] with the specified id could not be found.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(alctx: ActivityLoggingContext, token: AccessToken, imodelId: Guid, query: ChangeSetQuery = new ChangeSetQuery()): Promise<ChangeSet[]> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Querying changesets for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const id = query.getId();
    const changeSets = await this._handler.getInstances<ChangeSet>(alctx, ChangeSet, token, this.getRelativeUrl(imodelId, id), query.getQueryOptions());
    alctx.enter();
    Logger.logTrace(loggingCategory, `Queried ${changeSets.length} changesets for iModel ${imodelId}`);

    return changeSets;
  }

  /**
   * Download the specified [[ChangeSet]]s. If you want to [pull]($docs/learning/Glossary.md#pull) and [merge]($docs/learning/Glossary.md#merge) ChangeSets from iModelHub to your [[Briefcase]], you should use [IModelDb.pullAndMergeChanges]($backend) instead.
   *
   * This method creates the directory containing the ChangeSets if necessary. If there is an error in downloading some of the ChangeSets, all partially downloaded ChangeSets are deleted from disk.
   * @param alctx The activity logging context
   * @param changeSets ChangeSets to download. These need to include a download link. See [[ChangeSetQuery.selectDownloadUrl]].
   * @param downloadToPath Directory where the ChangeSets should be downloaded.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley), if one of the required arguments is undefined or empty.
   * @param progressCallback Callback for tracking progress.
   * @throws [[ResponseError]] if the download fails.
   */
  public async download(alctx: ActivityLoggingContext, changeSets: ChangeSet[], downloadToPath: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    alctx.enter();
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
      promises.push(this._fileHandler.downloadFile(alctx, downloadUrl, downloadToPathname, parseInt(changeSet.fileSize!, 10), progressCallback ? callback : undefined));
    }

    await Promise.all(promises);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Downloaded ${changeSets.length} changesets`);
  }

  /**
   * Upload a [[ChangeSet]] file. If you want to [push]($docs/learning/Glossary.md#push) your changes to iModelHub, use [IModelDb.pushChanges]($backend) instead. This method is only a part of that workflow.
   *
   * ChangeSets have to be uploaded in a linear order. If another user is uploading, or changeSet.parentId does not point to the latest ChangeSet on iModelHub, this method will fail. User will have to download all of the newer ChangeSets, merge them into their [[Briefcase]] and calculate a new ChangeSet id.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param changeSet Information of the ChangeSet to be uploaded.
   * @param changeSetPathname Pathname of the ChangeSet file to be uploaded.
   * @param progressCallback Callback for tracking upload progress.
   * @throws [IModelHubStatus.BriefcaseDoesNotBelongToUser]($bentley) if Briefcase specified by changeSet.briefcaseId belongs to another user.
   * @throws [IModelHubStatus.AnotherUserPushing]($bentley) if another user is currently uploading a ChangeSet.
   * @throws [IModelHubStatus.PullIsRequired]($bentley) if there are newer ChangeSets on iModelHub, that need to be downloaded and merged, before upload is possible.
   * @throws [IModelHubStatus.ChangeSetAlreadyExists]($bentley) if a ChangeSet with this id already exists. This usually happens if previous upload attempt has succeeded.
   * @throws [IModelHubStatus.ChangeSetPointsToBadSeed]($bentley) if changeSet.seedFileId is not set to the correct file id. That file id should match to the value written to the Briefcase file. See [IModelDb.setGuid]($backend).
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(alctx: ActivityLoggingContext, token: AccessToken, imodelId: Guid, changeSet: ChangeSet, changeSetPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<ChangeSet> {
    alctx.enter();
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

    const postChangeSet = await this._handler.postInstance<ChangeSet>(alctx, ChangeSet, token, this.getRelativeUrl(imodelId), changeSet);

    await this._fileHandler.uploadFile(alctx, postChangeSet.uploadUrl!, changeSetPathname, progressCallback);
    alctx.enter();

    postChangeSet.uploadUrl = undefined;
    postChangeSet.downloadUrl = undefined;
    postChangeSet.isUploaded = true;

    const confirmChangeSet = await this._handler.postInstance<ChangeSet>(alctx, ChangeSet, token, this.getRelativeUrl(imodelId, postChangeSet.id!), postChangeSet);
    alctx.enter();

    changeSet.isUploaded = true;

    Logger.logTrace(loggingCategory, `Uploaded changeset ${changeSet.id} to iModel ${imodelId}`);

    return confirmChangeSet;
  }
}
