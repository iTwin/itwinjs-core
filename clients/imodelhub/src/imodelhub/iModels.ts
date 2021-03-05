/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import * as deepAssign from "deep-assign";
import { GuidString, IModelHubStatus, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, ECJsonTypeMap, FileHandler, ProgressCallback, WsgInstance } from "@bentley/itwin-client";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck, IModelHubClientError, IModelHubError } from "./Errors";
import { addSelectFileAccessKey, InstanceIdQuery } from "./HubQuery";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelHub;

/**
 * HubIModel represents an iModel on iModelHub. Getting a valid HubIModel instance from iModelHub is required for majority of iModelHub method calls, as wsgId of this object needs to be passed as iModelId argument to those methods.
 *
 * For iModel representation in iModel.js, see [IModel]($common). For the file that is used for that iModel, see [BriefcaseDb]($backend).
 * @public
 */
@ECJsonTypeMap.classToJson("wsg", "ContextScope.iModel", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class HubIModel extends WsgInstance {
  /** Id of the iModel. */
  @ECJsonTypeMap.propertyToJson("wsg", "instanceId")
  public id?: GuidString;

  /** Description of the iModel. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Description")
  public description?: string;

  /** Name of the iModel. iModels must have unique names per context ([[Project]] or [[Asset]]). */
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

  /** Set when creating iModel from empty seed file
   * @internal
   */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.iModelTemplate")
  public iModelTemplate?: string;

  /** Type of the iModel */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Type")
  public iModelType?: IModelType;

  /** Extent of iModel. Array of coordinates: [0] - south latitude, [1] - west longitude, [2] - north latitude, [3] - east longitude */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Extent")
  public extent?: number[];

  /** Set to true, when iModel has custom access control. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Secured")
  public secured?: boolean;

  /** Data center location id where iModel is stored. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataLocationId")
  public dataLocationId?: string;
}

/** Initialization state of seed file. Can be queried with [[IModelHandler.getInitializationState]]. See [iModel creation]($docs/learning/iModelHub/iModels/CreateiModel.md).
 * @public
 */
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
  /** Initialization failed due to file being a [[Briefcase]]. Only standalone and master files are supported for iModel creation, see [BriefcaseId]($backend). */
  SeedFileIsBriefcase = 6,
}

/** iModel type
 * @public
 */
export enum IModelType {
  /** iModel has no type. */
  Undefined = 0, // eslint-disable-line id-blacklist
  /** iModel contains metadata used for other iModel creation. */
  Library = 1,
}

/** SeedFile
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.SeedFile", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class SeedFile extends WsgInstance {
  /** Id of the iModel. */
  @ECJsonTypeMap.propertyToJson("wsg", "instanceId")
  public id?: GuidString;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileName")
  public fileName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileDescription")
  public fileDescription?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileSize")
  public fileSize?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FileId")
  public fileId?: GuidString;

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

/** Query object for getting SeedFiles. You can use this to modify the query. See [[SeedFileHandler.get]]. */
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

/** Handler for all methods related to @see SeedFile instances. */
class SeedFileHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;

  /** Constructor for SeedFileHandler. Should use @see IModelHandler instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
  }

  /** Get relative url for SeedFile requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param fileId Id of the Seed File.
   */
  private getRelativeUrl(iModelId: GuidString, fileId?: GuidString) {
    return `/Repositories/iModel--${iModelId}/iModelScope/SeedFile/${fileId || ""}`;
  }

  /** Get the seed files given the id of the iModel.
   * @param requestContext The client request context.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried SeedFiles or select different data from them.
   * @returns Resolves to the seed file.
   */
  public async get(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, query: SeedFileQuery = new SeedFileQuery()): Promise<SeedFile[]> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Started querying seed files", () => ({ iModelId }));

    const seedFiles = await this._handler.getInstances<SeedFile>(requestContext, SeedFile, this.getRelativeUrl(iModelId, query.getId()), query.getQueryOptions());
    requestContext.enter();

    Logger.logInfo(loggerCategory, "Finished querying seed files", () => ({ iModelId, count: seedFiles.length }));
    return seedFiles;
  }

  /** Upload the seed file. Use [[confirmUploadSeedFile]] to confirm the completion of the upload.
   * @param requestContext The client request context.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param seedFile Information of the SeedFile to be uploaded.
   * @param seedPath Path of the SeedFile to be uploaded.
   * @param progressCallback Callback for tracking progress.
   */
  public async uploadSeedFile(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, seedPath: string, seedFileDescription?: string, progressCallback?: ProgressCallback): Promise<SeedFile> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Started uploading seed file", () => ({ iModelId, seedPath }));

    const seedFile = new SeedFile();
    seedFile.fileName = this._fileHandler!.basename(seedPath);
    seedFile.fileSize = this._fileHandler!.getFileSize(seedPath).toString();
    if (seedFileDescription)
      seedFile.fileDescription = seedFileDescription;

    const createdSeedFile: SeedFile = await this._handler.postInstance<SeedFile>(requestContext, SeedFile, this.getRelativeUrl(iModelId), seedFile);
    requestContext.enter();
    await this._fileHandler!.uploadFile(requestContext, createdSeedFile.uploadUrl!, seedPath, progressCallback);
    requestContext.enter();
    createdSeedFile.uploadUrl = undefined;
    createdSeedFile.downloadUrl = undefined;
    createdSeedFile.isUploaded = true;

    const confirmSeedFile: SeedFile = await this._handler.postInstance<SeedFile>(requestContext, SeedFile, this.getRelativeUrl(iModelId, createdSeedFile.id), createdSeedFile);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Finished uploading seed file", () => confirmSeedFile);

    return confirmSeedFile;
  }
}

/**
 * Query object for getting [[HubIModel]] instances. You can use this to modify the [[IModelsHandler.get]] results.
 * @public
 */
export class IModelQuery extends InstanceIdQuery {
  /**
   * Query iModel by its name.
   * @param name Name of the iModel.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if name is undefined or empty.
   */
  public byName(name: string) {
    ArgumentCheck.defined("name", name);
    this.addFilter(`Name+eq+'${encodeURIComponent(name)}'`);
    return this;
  }

  /**
   * Query iModel by its type.
   * @param iModelType Type of the iModel.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if iModelType is undefined.
   */
  public byiModelType(iModelType: IModelType) {
    ArgumentCheck.defined("iModelType", iModelType);
    this.addFilter(`Type+eq+${iModelType}`);
    return this;
  }

  /**
   * Query iModel by its template.
   * @param type Type of the iModel.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if iModelTemplate is undefined or empty.
   * @internal
   */
  public byiModelTemplate(iModelTemplate: string) {
    ArgumentCheck.defined("iModelTemplate", iModelTemplate, true);
    this.addFilter(`iModelTemplate+eq+'${encodeURIComponent(iModelTemplate)}'`);
    return this;
  }
}

/**
 * Create an iModel by cloning another.
 * @internal
 */
export interface CloneIModelTemplate {
  /** Source iModel's Id. */
  imodelId: string;
  /** Id of the [[ChangeSet]] on source iModel that should be used as the baseline version. */
  changeSetId?: string;
}

/**
 * Create an iModel from an empty file.
 * @internal
 */
export type EmptyIModelTemplate = "Empty";
const iModelTemplateEmpty: EmptyIModelTemplate = "Empty";

/**
 * Options used when creating an [[HubIModel]] with [[IModelHandler.create]] or [[IModelsHandler.create]].
 * @public
 */
export interface IModelCreateOptions {
  /** iModel seed file path. If not defined, iModel will be created from template. */
  path?: string;
  /** Description of the iModel on the Hub. */
  description?: string;
  /** Callback for tracking progress. */
  progressCallback?: ProgressCallback;
  /**
   * Time to wait for iModel initialization. When it times out the initialization will continue, but the promise will be rejected.
   * Default is 2 minutes.
   */
  timeOutInMilliseconds?: number;
  /**
   * Template used to create the seed file. Works only when path is not provided. Creates iModel from empty file by default.
   * @internal
   */
  template?: CloneIModelTemplate | EmptyIModelTemplate;

  /** Type of iModel. */
  iModelType?: IModelType;

  /** Extent of iModel. Array of coordinates: [0] - south latitude, [1] - west longitude, [2] - north latitude, [3] - east longitude */
  extent?: number[];
}

/**
 * Provider for default IModelCreateOptions, used by IModelHandler and IModelsHandler to set defaults.
 * @internal
 */
export class DefaultIModelCreateOptionsProvider {
  protected _defaultOptions: IModelCreateOptions;
  /**  Creates an instance of DefaultRequestOptionsProvider and sets up the default options. */
  constructor() {
    this._defaultOptions = {
      timeOutInMilliseconds: 120000,
    };
  }

  /**
   * Augments options with the provider's default values. The options passed in override any defaults where necessary.
   * @param options Options that should be augmented.
   */
  public async assignOptions(options: IModelCreateOptions): Promise<void> {
    const clonedOptions: IModelCreateOptions = { ...options };
    deepAssign(options, this._defaultOptions);
    deepAssign(options, clonedOptions); // ensure the supplied options override the defaults
    if (!options.template) // this assignment works incorrectly through deepAssign
      options.template = iModelTemplateEmpty;
  }

  /**
   * Formats iModel template value as a string.
   * @param options Options that have the template value.
   */
  public templateToString(options: IModelCreateOptions): string | undefined {
    if (!options.template || options.template === iModelTemplateEmpty)
      return options.template;
    return `${options.template.imodelId}:${options.template.changeSetId || ""}`;
  }
}

/**
 * Handler for managing [[HubIModel]] instances. Use [[IModelHubClient.IModels]] to get an instance of this handler.
 * @note Use [[IModelHubClient.IModel]] for the preferred single iModel per context workflow.
 * @public
 */
export class IModelsHandler {
  private _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;
  private _seedFileHandler: SeedFileHandler;
  private static _defaultCreateOptionsProvider: DefaultIModelCreateOptionsProvider;
  private static readonly _imodelExtentLength: number = 4;
  private static readonly _imodelExtentLatitudeLimit: number = 90;
  private static readonly _imodelExtentLongitudeLimit: number = 180;

  /** Constructor for IModelsHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @param fileHandler Handler for file system.
   * @note Use [[IModelHubClient.IModel]] for the preferred single iModel per context workflow.
   * @internal
   */
  constructor(handler: IModelBaseHandler, fileHandler?: FileHandler) {
    this._handler = handler;
    this._fileHandler = fileHandler;
    this._seedFileHandler = new SeedFileHandler(this._handler, this._fileHandler);
  }

  /** Get relative url for iModel requests.
   * @param contextId Id of the context.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   */
  private getRelativeUrl(contextId: string, iModelId?: GuidString) {
    return `/Repositories/Context--${this._handler.formatContextIdForUrl(contextId)}/ContextScope/iModel/${iModelId || ""}`;
  }

  /** Get iModels that belong to the specified context.
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @param query Optional query object to filter the queried iModels or select different data from them.
   * @returns [[HubIModel]] instances that match the query.
   * @throws [WsgError]($itwin-client) with [WSStatus.InstanceNotFound]($bentley) if [[InstanceIdQuery.byId]] is used and an HubIModel with the specified id could not be found.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(requestContext: AuthorizedClientRequestContext, contextId: string, query: IModelQuery = new IModelQuery()): Promise<HubIModel[]> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, `Started querying iModels in context`, () => ({ contextId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.defined("contextId", contextId); // contextId is a GUID for iModelHub and a JSON representation of an IModelBankAccessContext for iModelBank.

    const imodels = await this._handler.getInstances<HubIModel>(requestContext, HubIModel, this.getRelativeUrl(contextId, query.getId()), query.getQueryOptions());
    requestContext.enter();
    Logger.logInfo(loggerCategory, `Finished querying iModels in context`, () => ({ contextId, count: imodels.length }));

    return imodels;
  }

  /** Delete an iModel with specified id from a context. This method is not supported in iModelBank.
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @param iModelId Id of the iModel to be deleted. See [[HubIModel]].
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel with specified id does not exist.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have DeleteiModel permission.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async delete(requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: GuidString): Promise<void> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Started deleting iModel", () => ({ iModelId, contextId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("contextId", contextId);
    ArgumentCheck.validGuid("iModelId", iModelId);

    if (this._handler.getCustomRequestOptions().isSet) {
      // to add custom request options, request with body is needed.
      const imodel = new HubIModel();
      imodel.id = iModelId;
      imodel.changeState = "deleted";
      await this._handler.deleteInstance(requestContext, this.getRelativeUrl(contextId, iModelId), imodel);
    } else {
      await this._handler.delete(requestContext, this.getRelativeUrl(contextId, iModelId));
    }
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Finished deleting iModel", () => ({ iModelId, contextId }));
  }

  /** Create an iModel instance
   * @param requestContext The client request context.
   * @param contextId Id of the iTwin context.
   * @param iModelName Name of the iModel on the Hub.
   * @param description Description of the iModel on the Hub.
   * @param iModelTemplate iModel template.
   * @param iModelType iModel type.
   */
  private async createIModelInstance(requestContext: AuthorizedClientRequestContext, contextId: string, iModelName: string, description?: string, iModelTemplate?: string, iModelType?: IModelType, extent?: number[]): Promise<HubIModel> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, `Creating iModel with name ${iModelName}`, () => ({ contextId }));

    let imodel: HubIModel;
    const iModel = new HubIModel();
    iModel.name = iModelName;
    if (description)
      iModel.description = description;
    if (iModelTemplate)
      iModel.iModelTemplate = iModelTemplate;
    if (extent)
      iModel.extent = extent;
    if (iModelType)
      iModel.iModelType = iModelType;

    try {
      imodel = await this._handler.postInstance<HubIModel>(requestContext, HubIModel, this.getRelativeUrl(contextId), iModel);
      requestContext.enter();
      Logger.logTrace(loggerCategory, `Created iModel instance with name ${iModelName}`, () => ({ contextId }));
    } catch (err) {
      requestContext.enter();
      if (!(err instanceof IModelHubError) || IModelHubStatus.iModelAlreadyExists !== err.errorNumber) {
        Logger.logWarning(loggerCategory, `Can not create iModel: ${err.message}`, () => ({ contextId }));

        throw err;
      }

      const initialized: boolean = err.data.iModelInitialized;
      if (initialized) {
        Logger.logWarning(loggerCategory, `Error creating iModel: iModel with name ${iModelName} already exists and is initialized`, () => ({ contextId }));

        throw err;
      }

      Logger.logInfo(loggerCategory, `Querying iModel by name ${iModelName}`, () => ({ contextId }));

      const imodels = await this.get(requestContext, contextId, new IModelQuery().byName(iModelName));
      requestContext.enter();
      Logger.logTrace(loggerCategory, `Queried iModel by name ${iModelName}`, () => ({ contextId }));

      if (imodels.length > 0) {
        imodel = imodels[0];
      } else {
        Logger.logTrace(loggerCategory, `iModel by name: iModel ${iModelName} not found`, () => ({ contextId }));

        throw new Error(`iModel by name: iModel ${iModelName} not found`);
      }
    }

    return imodel;
  }

  /** Get the [[InitializationState]] for the specified iModel. See [iModel creation]($docs/learning/iModelHub/iModels/CreateiModel.md).
   * @param requestContext The client request context.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @returns State of the seed file initialization.
   * @throws [[IModelHubError]] with [IModelHubStatus.FileDoesNotExist]($bentley) if the seed file was not found.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   * @internal
   */
  public async getInitializationState(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<InitializationState> {
    const seedFiles: SeedFile[] = await this._seedFileHandler.get(requestContext, iModelId, new SeedFileQuery().latest());
    requestContext.enter();
    if (seedFiles.length < 1)
      throw new IModelHubError(IModelHubStatus.FileDoesNotExist);

    return seedFiles[0].initializationState!;
  }

  /**
   * Augment update options with defaults returned by the DefaultIModelCreateOptionsProvider. The options passed in by clients override any defaults where necessary.
   * @param options Options the caller wants to augment with the defaults.
   * @returns Promise resolves after the defaults are setup.
   */
  private async setupOptionDefaults(options: IModelCreateOptions): Promise<void> {
    if (!IModelsHandler._defaultCreateOptionsProvider)
      IModelsHandler._defaultCreateOptionsProvider = new DefaultIModelCreateOptionsProvider();
    return IModelsHandler._defaultCreateOptionsProvider.assignOptions(options);
  }

  /** Wait until the iModel is initialized.
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @param imodel iModel instance that will be returned if initialization is successful.
   * @param timeOutInMilliseconds Maximum time to wait for the initialization.
   */
  private async waitForInitialization(requestContext: AuthorizedClientRequestContext, contextId: string, imodel: HubIModel, timeOutInMilliseconds: number): Promise<HubIModel> {
    requestContext.enter();
    const errorMessage = "iModel initialization failed";
    const retryDelay = timeOutInMilliseconds / 10;
    for (let retries = 10; retries > 0; --retries) {
      try {
        const initState = await this.getInitializationState(requestContext, imodel.id!);
        requestContext.enter();
        if (initState === InitializationState.Successful) {
          Logger.logTrace(loggerCategory, "Created iModel", () => ({ contextId, iModelId: imodel.id }));
          imodel.initialized = true;
          return imodel;
        }

        if (initState !== InitializationState.NotStarted && initState !== InitializationState.Scheduled) {
          Logger.logWarning(loggerCategory, errorMessage);
          throw new IModelHubError(IModelHubStatus.SeedFileInitializationFailed,
            `Seed file initialization failed with status ${InitializationState[initState]}`);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        requestContext.enter();
      } catch (err) {
        requestContext.enter();
        Logger.logWarning(loggerCategory, errorMessage);
        throw err;
      }
    }

    Logger.logWarning(loggerCategory, errorMessage);
    throw IModelHubClientError.initializationTimeout();
  }

  /**
   * Verifies iModel extent
   * @param extent iModel extent
   * @throws [[IModelHubError]] with [IModelHubStatus.UndefinedArgumentError] if extent is invalid.
   */
  private validateExtent(extent: number[]): void {
    if (extent.length === 0)
      return;

    if (extent.length !== IModelsHandler._imodelExtentLength)
      throw IModelHubClientError.invalidArgument("extent");

    this.validateExtentCoordinate(extent[0], IModelsHandler._imodelExtentLatitudeLimit);
    this.validateExtentCoordinate(extent[1], IModelsHandler._imodelExtentLongitudeLimit);
    this.validateExtentCoordinate(extent[2], IModelsHandler._imodelExtentLatitudeLimit);
    this.validateExtentCoordinate(extent[3], IModelsHandler._imodelExtentLongitudeLimit);
  }

  /**
   * Validates iModel extent coordinate
   * @param coordinate iModel extent coordinate
   * @param limit Coordinate limit value (latitude/longitude max value)
   * @throws [[IModelHubError]] with [IModelHubStatus.UndefinedArgumentError] if coordinate is invalid.
   */
  private validateExtentCoordinate(coordinate: number, limit: number): void {
    if (coordinate < -limit || coordinate > limit)
      throw IModelHubClientError.invalidArgument("extent");
  }

  /** Create an iModel from given seed file. See [iModel creation]($docs/learning/iModelHub/iModels/CreateiModel.md).
   * This method does not work on browsers. If iModel creation fails before finishing file upload, partially created iModel is deleted. This method is not supported in iModelBank.
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @param name Name of the iModel on the Hub.
   * @param createOptions Optional arguments for iModel creation.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have CreateiModel permission.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   * @internal
   */
  public async create(requestContext: AuthorizedClientRequestContext, contextId: string, name: string, createOptions?: IModelCreateOptions): Promise<HubIModel> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Creating iModel", () => ({ contextId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("contextId", contextId);
    ArgumentCheck.defined("name", name);

    createOptions = createOptions || {};
    await this.setupOptionDefaults(createOptions);

    if (createOptions.extent)
      this.validateExtent(createOptions.extent);

    if (createOptions.path) {
      createOptions.template = undefined;

      if (typeof window !== "undefined")
        throw IModelHubClientError.browser();

      if (!this._fileHandler)
        throw IModelHubClientError.fileHandler();

      if (!this._fileHandler.exists(createOptions.path) || this._fileHandler.isDirectory(createOptions.path))
        throw IModelHubClientError.fileNotFound();
    }

    const template = IModelsHandler._defaultCreateOptionsProvider.templateToString(createOptions);
    const imodel = await this.createIModelInstance(requestContext, contextId, name, createOptions.description, template, createOptions.iModelType, createOptions.extent);
    requestContext.enter();

    if (createOptions.template === iModelTemplateEmpty) {
      return imodel;
    }

    if (!createOptions.template) {
      try {
        await this._seedFileHandler.uploadSeedFile(requestContext, imodel.id!, createOptions.path!, createOptions.description, createOptions.progressCallback);
      } catch (err) {
        await this.delete(requestContext, contextId, imodel.id!);
        throw err;
      }
      requestContext.enter();
    }

    return this.waitForInitialization(requestContext, contextId, imodel, createOptions.timeOutInMilliseconds!);
  }

  /** Update iModel's name and/or description
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @param imodel iModel to update. See [[HubIModel]].
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have CreateiModel permission.
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelIsNotInitialized]$(bentley) if iModel is not initialized.
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelAlreadyExists]$(bentley) if iModel with specified name already exists.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(requestContext: AuthorizedClientRequestContext, contextId: string, imodel: HubIModel): Promise<HubIModel> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Updating iModel", () => ({ contextId, iModelId: imodel.id }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("contextId", contextId);

    const updatedIModel = await this._handler.postInstance<HubIModel>(requestContext, HubIModel, this.getRelativeUrl(contextId, imodel.id), imodel);

    Logger.logTrace(loggerCategory, "Updated iModel", () => ({ contextId, iModelId: imodel.id }));
    return updatedIModel;
  }

  /** Method to download the seed file for iModel. This will download the original seed file, that was uploaded when creating iModel. To download a file that was updated with ChangeSets on iModelHub, see [[BriefcaseHandler.download]].
   * @param requestContext The client request context.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param path Path to download the seed file to, including file name.
   * @param progressCallback Callback for tracking progress.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   * @internal
   */
  public async download(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, path: string, progressCallback?: ProgressCallback): Promise<void> {
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Started downloading seed file", () => ({ iModelId }));
    ArgumentCheck.defined("requestContext", requestContext);
    ArgumentCheck.validGuid("iModelId", iModelId);
    ArgumentCheck.defined("path", path);

    if (typeof window !== "undefined")
      throw IModelHubClientError.browser();

    if (!this._fileHandler)
      throw IModelHubClientError.fileHandler();

    const seedFiles: SeedFile[] = await this._seedFileHandler.get(requestContext, iModelId, new SeedFileQuery().selectDownloadUrl().latest());
    requestContext.enter();

    if (!seedFiles || !seedFiles[0] || !seedFiles[0].downloadUrl)
      throw IModelHubError.fromId(IModelHubStatus.FileDoesNotExist, "Failed to get seed file.");

    await this._fileHandler.downloadFile(requestContext, seedFiles[0].downloadUrl, path, parseInt(seedFiles[0].fileSize!, 10), progressCallback);
    requestContext.enter();
    Logger.logInfo(loggerCategory, "Finished downloading seed file", () => ({ iModelId }));
  }
}

/**
 * Handler for managing [[HubIModel]] instance. Use [[IModelHubClient.IModel]] to get an instance of this handler.
 * @note Use [[IModelHubClient.IModels]] if multiple iModels per context are supported.
 * @beta
 */
export class IModelHandler {
  private _handler: IModelsHandler;

  /**
   * Constructor for IModelHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for managing [[HubIModel]] instances.
   * @note Use [[IModelHubClient.IModels]] if multiple iModels per context are supported.
   * @internal
   */
  constructor(handler: IModelsHandler) {
    this._handler = handler;
  }

  /**
   * Get iModel that belong to the specified context.
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @returns [[HubIModel]] instances that match the query.
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<HubIModel> {
    requestContext.enter();

    Logger.logInfo(loggerCategory, "Querying iModel", () => ({ contextId }));
    const query = new IModelQuery().orderBy("CreatedDate+asc").top(1);
    const imodels = await this._handler.get(requestContext, contextId, query);

    if (imodels.length < 1)
      throw new IModelHubError(IModelHubStatus.iModelDoesNotExist);

    return imodels[0];
  }

  /**
   * Delete an iModel from a context. This method is not supported in iModelBank.
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have DeleteiModel permission.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async delete(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<void> {
    const imodel = await this.get(requestContext, contextId);
    await this._handler.delete(requestContext, contextId, imodel.id!);
  }

  /**
   * Get the [[InitializationState]] for the specified iModel. See [iModel creation]($docs/learning/iModelHub/iModels/CreateiModel.md).
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @returns State of the seed file initialization.
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
   * @throws [[IModelHubError]] with [IModelHubStatus.FileDoesNotExist]($bentley) if the seed file was not found.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   * @internal
   */
  public async getInitializationState(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<InitializationState> {
    const imodel = await this.get(requestContext, contextId);
    return this._handler.getInitializationState(requestContext, imodel.id!);
  }

  /**
   * Create an iModel from given seed file. In most cases [BriefcaseManager.create]($backend) should be used instead. See [iModel creation]($docs/learning/iModelHub/iModels/CreateiModel.md).
   *
   * This method does not work on browsers. If iModel creation fails before finishing file upload, partially created iModel is deleted. This method is not supported in iModelBank.
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @param name Name of the iModel on the Hub.
   * @param createOptions Optional arguments for iModel creation.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have CreateiModel permission.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   * @internal
   */
  public async create(requestContext: AuthorizedClientRequestContext, contextId: string, name: string, createOptions?: IModelCreateOptions): Promise<HubIModel> {
    requestContext.enter();

    let imodelExists = true;
    try {
      await this.get(requestContext, contextId);
      requestContext.enter();
    } catch (err) {
      if (err instanceof IModelHubError && err.errorNumber === IModelHubStatus.iModelDoesNotExist)
        imodelExists = false;
      else
        throw err;
    }

    if (imodelExists)
      throw new IModelHubError(IModelHubStatus.iModelAlreadyExists);

    return this._handler.create(requestContext, contextId, name, createOptions);
  }

  /**
   * Update iModel's name and/or description
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @param imodel iModel to update. See [[HubIModel]].
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have CreateiModel permission.
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelIsNotInitialized]$(bentley) if iModel is not initialized.
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelAlreadyExists]$(bentley) if iModel with specified name already exists.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(requestContext: AuthorizedClientRequestContext, contextId: string, imodel: HubIModel): Promise<HubIModel> {
    return this._handler.update(requestContext, contextId, imodel);
  }

  /**
   * Method to download the seed file for iModel. This will download the original seed file, that was uploaded when creating iModel. To download a file that was updated with ChangeSets on iModelHub, see [[BriefcaseHandler.download]].
   * @param requestContext The client request context.
   * @param contextId Id for the iModel's context. For iModelHub it should be the id of the iTwin context ([[Project]] or [[Asset]]).
   * @param path Path where seed file should be downloaded, including filename.
   * @param progressCallback Callback for tracking progress.
   * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   * @internal
   */
  public async download(requestContext: AuthorizedClientRequestContext, contextId: string, path: string, progressCallback?: ProgressCallback): Promise<void> {
    const imodel = await this.get(requestContext, contextId);
    await this._handler.download(requestContext, imodel.id!, path, progressCallback);
  }
}
