/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelHubClientError, IModelHubError, ArgumentCheck } from "./Errors";
import { Config } from "../Config";
import { InstanceIdQuery, addSelectFileAccessKey } from "./Query";
import { AccessToken } from "../Token";
import { Logger, IModelHubStatus } from "@bentley/bentleyjs-core";
import { FileHandler } from "../FileHandler";
import { ProgressInfo } from "../Request";
import { IModelBaseHandler } from "./BaseHandler";

const loggingCategory = "imodeljs-clients.imodelhub";

/**
 * IModelRepository represents an iModel on iModelHub. Getting a valid IModelRepository instance from iModelHub is required for majority of iModelHub method calls, as wsgId of this object needs to be passed as imodelId argument to those methods.
 *
 * For iModel representation in iModelJs, see [IModel]($common). For the file that is used for that iModel, see [IModelDb]($backend).
 */
@ECJsonTypeMap.classToJson("wsg", "ProjectScope.iModel", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class IModelRepository extends WsgInstance {
  /** Description of the iModel. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Description")
  public description?: string;

  /** Name of the iModel. iModels must have unique names per [[Project]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  /** Id of the user that created the iModel. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.UserCreated")
  public userCreated?: string;

  /** Date when iModel was created. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedDate")
  public createdDate?: string;

  /** Set to true, when iModel is ready to be used. See [[IModelHandler.create]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Initialized")
  public initialized?: boolean;
}

/** Initialization state of seed file. Can be queried with [[IModelHandler.getInitializationState]]. If [[IModelHandler.create]] has timed out, querying InitializationState can show if the seed file initialization has completed. */
export enum InitializationState {
  /** Initialization was successful. */
  Successful = 0,
  /** Initialization has not started, seed file has not yet been uploaded. */
  NotStarted = 1,
  /** Initialization has been scheduled and has not completed yet. */
  Scheduled = 2,
  /** Initialization failed with a generic error. */
  Failed = 3,
  /** Initialization failed due to file having outdated schemas. */
  OutdatedFile = 4,
  /** Initialization failed due to file having [[Code]] values that are too long. */
  CodeTooLong = 5,
  /**
   * Initialization failed due to file being a [[Briefcase]]. Only standalone and master files are supported for iModel creation, see [BriefcaseId]($backend).
   */
  SeedFileIsBriefcase = 6,
}

/**
 * SeedFile
 * @hidden
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.SeedFile", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class SeedFile extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileName")
  public fileName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileDescription")
  public fileDescription?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileSize")
  public fileSize?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileId")
  public fileId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Index")
  public index?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.IModelName")
  public iModelName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.MergedChangeSetId")
  public mergedChangeSetId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.UserUploaded")
  public userUploaded?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.UploadedDate")
  public uploadedDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsUploaded")
  public isUploaded?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.InitializationState")
  public initializationState?: InitializationState;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.DownloadUrl")
  public downloadUrl?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.UploadUrl")
  public uploadUrl?: string;
}

/**
 * Query object for getting SeedFiles. You can use this to modify the query. See [[SeedFileHandler.get]].
 * @hidden
 */
class SeedFileQuery extends InstanceIdQuery {
  /**
   * Query will additionally select SeedFile file download URL.
   * @returns This query.
   */
  public selectDownloadUrl() {
    addSelectFileAccessKey(this._query);
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
 * Handler for all methods related to @see SeedFile instances.
 * @hidden
 */
class SeedFileHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;

  /**
   * Constructor for SeedFileHandler. Should use @see IModelHandler instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
  }

  /**
   * Get relative url for SeedFile requests.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param fileId Id of the Seed File.
   */
  private getRelativeUrl(imodelId: string, fileId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/SeedFile/${fileId || ""}`;
  }

  /**
   * Get the seed files given the id of the iModel.
   * @hidden
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param query Optional query object to filter the queried SeedFiles or select different data from them.
   * @returns Resolves to the seed file.
   */
  public async get(token: AccessToken, imodelId: string, query: SeedFileQuery = new SeedFileQuery()): Promise<SeedFile[]> {
    Logger.logInfo(loggingCategory, `Querying seed files for iModel ${imodelId}`);

    const seedFiles = await this._handler.getInstances<SeedFile>(SeedFile, token, this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());

    Logger.logTrace(loggingCategory, `Queried ${seedFiles.length} seed files for iModel ${imodelId}`);

    return seedFiles;
  }

  /**
   * Upload the seed file. Use [[confirmUploadSeedFile]] to confirm the completion of the upload.
   * @hidden
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param seedFile Information of the SeedFile to be uploaded.
   * @param seedPathname Pathname of the SeedFile to be uploaded.
   * @param progressCallback Callback for tracking progress.
   */
  public async uploadSeedFile(token: AccessToken, imodelId: string, seedPathname: string, seedFileDescription?: string, progressCallback?: (progress: ProgressInfo) => void): Promise<SeedFile> {
    Logger.logInfo(loggingCategory, `Uploading seed file to iModel ${imodelId}`);

    const seedFile = new SeedFile();
    seedFile.fileName = this._fileHandler!.basename(seedPathname);
    seedFile.fileSize = this._fileHandler!.getFileSize(seedPathname).toString();
    if (seedFileDescription)
      seedFile.fileDescription = seedFileDescription;

    const createdSeedFile: SeedFile = await this._handler.postInstance<SeedFile>(SeedFile, token, this.getRelativeUrl(imodelId), seedFile);

    await this._fileHandler!.uploadFile(createdSeedFile.uploadUrl!, seedPathname, progressCallback);

    createdSeedFile.uploadUrl = undefined;
    createdSeedFile.downloadUrl = undefined;
    createdSeedFile.isUploaded = true;

    const confirmSeedFile = await this._handler.postInstance<SeedFile>(SeedFile, token, this.getRelativeUrl(imodelId, createdSeedFile.wsgId), createdSeedFile);

    Logger.logTrace(loggingCategory, `Uploaded seed file ${seedFile.wsgId} to iModel ${imodelId}`);

    return confirmSeedFile;
  }
}

/**
 * Query object for getting [[IModelRepository]] instances. You can use this to modify the [[IModelHandler.get]] results.
 */
export class IModelQuery extends InstanceIdQuery {
  /**
   * Query iModel by its name.
   * @param name Name of the iModel.
   * @returns This query.
   * @throws [IModelHubClientError]($clients) with [IModelHubStatus.UndefinedArgumentError]($bentley) if name is undefined or empty.
   */
  public byName(name: string) {
    ArgumentCheck.defined("name", name);
    this.addFilter(`Name+eq+'${name}'`);
    return this;
  }
}

/**
 * Handler for managing [[IModelRepository]] instances. Use [[IModelHubClient.IModels]] to get an instance of this handler.
 */
export class IModelHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;
  private _seedFileHandler: SeedFileHandler;

  /**
   * Constructor for IModelHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   * @hidden
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
    this._seedFileHandler = new SeedFileHandler(this._handler, this._fileHandler);
  }

  /**
   * Get relative url for iModel requests.
   * @param projectId Id of the project.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   */
  private getRelativeUrl(contextId: string, imodelId?: string) {
    return `/Repositories/Project--${this._handler.formatProjectIdForUrl(contextId)}/ProjectScope/iModel/${imodelId || ""}`;
  }

  /**
   * Get iModels that belong to the specified [[Project]].
   * @param token Delegation token of the authorized user.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
   * @param query Optional query object to filter the queried iModels or select different data from them.
   * @returns [[IModelRepository]] instances that match the query.
   * @throws [[WsgError]] with [WSStatus.InstanceNotFound]($bentley) if [[InstanceIdQuery.byId]] is used and an IModelRepository with the specified id could not be found.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(token: AccessToken, contextId: string, query: IModelQuery = new IModelQuery()): Promise<IModelRepository[]> {
    Logger.logInfo(loggingCategory, `Querying iModels in project ${contextId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("projectId", contextId);

    const imodels = await this._handler.getInstances<IModelRepository>(IModelRepository, token, this.getRelativeUrl(contextId, query.getId()), query.getQueryOptions());

    Logger.logTrace(loggingCategory, `Queried ${imodels.length} iModels in project ${contextId}`);

    return imodels;
  }

  /**
   * Delete an iModel with specified id from a [[Project]]. This method is not supported in iModelBank.
   * @param token Delegation token of the authorized user.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
   * @param imodelId Id of the iModel to be deleted. See [[IModelRepository]].
   * @throws [[IModelHubError]] with [IModelHubStatus.IModelDoesNotExists]$(bentley) if iModel with specified id does not exist.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have DeleteiModel permission.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async delete(token: AccessToken, contextId: string, imodelId: string): Promise<void> {
    Logger.logInfo(loggingCategory, `Deleting iModel with id ${imodelId} from project ${contextId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("contextId", contextId);
    ArgumentCheck.validGuid("imodelId", imodelId);

    if (this._handler.getCustomRequestOptions().isSet) {
      // In order to add custom request options, request with body is needed.
      const iModelRepository = new IModelRepository();
      iModelRepository.wsgId = imodelId;
      iModelRepository.changeState = "deleted";
      await this._handler.deleteInstance(token, this.getRelativeUrl(contextId, imodelId), iModelRepository);
    } else {
      await this._handler.delete(token, this.getRelativeUrl(contextId, imodelId));
    }

    Logger.logTrace(loggingCategory, `Deleted iModel with id ${imodelId} from project ${contextId}`);
  }

  /**
   * Create an iModel instance
   * @hidden
   * @param token Delegation token of the authorized user.
   * @param projectId Id of the connect [[Project]].
   * @param iModelName Name of the iModel on the Hub.
   * @param description Description of the iModel on the Hub.
   */
  private async createIModelInstance(token: AccessToken, projectId: string, iModelName: string, description?: string): Promise<IModelRepository> {
    Logger.logInfo(loggingCategory, `Creating iModel with name ${iModelName} in project ${projectId}`);

    let imodel: IModelRepository;
    const iModel = new IModelRepository();
    iModel.name = iModelName;
    if (description)
      iModel.description = description;

    try {
      imodel = await this._handler.postInstance<IModelRepository>(IModelRepository, token, this.getRelativeUrl(projectId), iModel);
      Logger.logTrace(loggingCategory, `Created iModel instance with name ${iModelName} in project ${projectId}`);
    } catch (err) {
      if (!(err instanceof IModelHubError) || IModelHubStatus.iModelAlreadyExists !== err.errorNumber) {
        Logger.logWarning(loggingCategory, `Can not create iModel: ${err.message}`);

        return Promise.reject(err);
      }

      const initialized: boolean = err.data.iModelInitialized;
      if (initialized) {
        Logger.logWarning(loggingCategory, `Error creating iModel: iModel with name ${iModelName} already exists and is initialized`);

        return Promise.reject(err);
      }

      Logger.logInfo(loggingCategory, `Querying iModel by name ${iModelName} in project ${projectId}`);

      const imodels = await this.get(token, projectId, new IModelQuery().byName(iModelName));

      Logger.logTrace(loggingCategory, `Queried iModel by name ${iModelName} in project ${projectId}`);

      if (imodels.length > 0) {
        imodel = imodels[0];
      } else {
        Logger.logTrace(loggingCategory, `iModel by name: iModel ${iModelName} not found`);

        return Promise.reject(new Error(`iModel by name: iModel ${iModelName} not found`));
      }
    }

    return imodel;
  }

  /**
   * Get the [[InitializationState]] for the specified iModel. See [[IModelHandler.create]].
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @returns State of the seed file initialization.
   * @throws [[IModelHubError]] with [IModelHubStatus.FileDoesNotExist]($bentley) if the seed file was not found.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async getInitializationState(token: AccessToken, imodelId: string): Promise<InitializationState> {
    const seedFiles: SeedFile[] = await this._seedFileHandler.get(token, imodelId, new SeedFileQuery().latest());
    if (seedFiles.length < 1)
      return Promise.reject(new IModelHubError(IModelHubStatus.FileDoesNotExist));

    return seedFiles[0].initializationState!;
  }

  /**
   * Create an iModel from given seed file. In most cases [IModelDb.create]($backend) should be used instead.
   *
   * This method creates an iModel and uploads a seed file to it. That seed file will need to be initialized by the iModelHub. Until the file is initialized, iModel will be unavailable for other requests.
   *
   * If file is not initialized by the timeOutInMilliseconds, this task will be rejected, but it could still get initialized in the future. You can use [[IModelHandler.getInitializationState]] to check whether the file initialization hasn't completed ([[InitializationState.Scheduled]]), or the initialization has completed. If initialization has failed with [[InitializationState.Failed]], it's possible, that deleting and creating new iModel with the same seed file could succeed.
   *
   * This method does not work on browsers. If iModel creation fails before finishing file upload, partially created iModel is deleted. This method is not supported in iModelBank.
   * @param token Delegation token of the authorized user.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
   * @param name Name of the iModel on the Hub.
   * @param description Description of the iModel on the Hub.
   * @param progressCallback Callback for tracking progress.
   * @param timeOutInMiliseconds Time to wait for iModel initialization.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have CreateiModel permission.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(token: AccessToken, contextId: string, name: string, pathName: string,
    description?: string, progressCallback?: (progress: ProgressInfo) => void,
    timeOutInMilliseconds: number = 2 * 60 * 1000): Promise<IModelRepository> {
    Logger.logInfo(loggingCategory, `Creating iModel in project ${contextId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("contextId", contextId);
    ArgumentCheck.defined("name", name);
    ArgumentCheck.defined("pathName", pathName);

    if (Config.isBrowser)
      return Promise.reject(IModelHubClientError.browser());

    if (!this._fileHandler)
      return Promise.reject(IModelHubClientError.fileHandler());

    if (!this._fileHandler.exists(pathName) || this._fileHandler.isDirectory(pathName))
      return Promise.reject(IModelHubClientError.fileNotFound());

    const iModel = await this.createIModelInstance(token, contextId, name, description);

    try {
      await this._seedFileHandler.uploadSeedFile(token, iModel.wsgId, pathName, description, progressCallback);
    } catch (err) {
      await this.delete(token, contextId, iModel.wsgId);
      return Promise.reject(err);
    }

    const errorMessage = "Cannot upload SeedFile " + pathName;
    const retryDelay = timeOutInMilliseconds / 10;
    for (let retries = 10; retries > 0; --retries) {
      try {
        const initState = await this.getInitializationState(token, iModel.wsgId);

        if (initState === InitializationState.Successful) {
          Logger.logTrace(loggingCategory, `Created iModel with id ${iModel.wsgId} in project ${contextId}`);
          iModel.initialized = true;
          return iModel;
        }

        if (initState !== InitializationState.NotStarted && initState !== InitializationState.Scheduled) {
          Logger.logWarning(loggingCategory, errorMessage);
          return Promise.reject(new IModelHubError(IModelHubStatus.SeedFileInitializationFailed,
            `Seed file initialization failed with status ${InitializationState[initState]}`));
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } catch (err) {
        Logger.logWarning(loggingCategory, errorMessage);
        return Promise.reject(err);
      }
    }

    Logger.logWarning(loggingCategory, errorMessage);
    return Promise.reject(new Error("Timed out waiting for seed file initialization."));
  }

  /**
   * Method to download the seed file for iModel. This will download the original seed file, that was uploaded when creating iModel. To download a file that was updated with ChangeSets on iModelHub, see [[BriefcaseHandler.download]].
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[IModelRepository]].
   * @param downloadToPathname Directory where the seed file should be downloaded.
   * @param progressCallback Callback for tracking progress.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async download(token: AccessToken, imodelId: string, downloadToPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
    Logger.logInfo(loggingCategory, `Downloading seed file for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.defined("downloadToPathname", downloadToPathname);

    if (Config.isBrowser)
      return Promise.reject(IModelHubClientError.browser());

    if (!this._fileHandler)
      return Promise.reject(IModelHubClientError.fileHandler());

    const seedFiles: SeedFile[] = await this._seedFileHandler.get(token, imodelId, new SeedFileQuery().selectDownloadUrl().latest());

    if (!seedFiles || !seedFiles[0] || !seedFiles[0].downloadUrl)
      return Promise.reject(IModelHubError.fromId(IModelHubStatus.FileDoesNotExist, "Failed to get seed file."));

    await this._fileHandler.downloadFile(seedFiles[0].downloadUrl!, downloadToPathname, parseInt(seedFiles[0].fileSize!, 10), progressCallback);

    Logger.logTrace(loggingCategory, `Downloading seed file for iModel ${imodelId}`);
  }
}
