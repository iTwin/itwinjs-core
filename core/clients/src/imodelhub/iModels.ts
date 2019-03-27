/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { IModelHubClientError, IModelHubError, ArgumentCheck } from "./Errors";
import { InstanceIdQuery, addSelectFileAccessKey } from "./Query";
import { Logger, IModelHubStatus, GuidString } from "@bentley/bentleyjs-core";
import { FileHandler } from "../FileHandler";
import { ProgressInfo } from "../Request";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";
import { IModelBaseHandler } from "./BaseHandler";

const loggingCategory = "imodeljs-clients.imodelhub";
const iModelTemplateEmpty = "Empty";

/**
 * HubIModel represents an iModel on iModelHub. Getting a valid HubIModel instance from iModelHub is required for majority of iModelHub method calls, as wsgId of this object needs to be passed as imodelId argument to those methods.
 *
 * For iModel representation in iModel.js, see [IModel]($common). For the file that is used for that iModel, see [IModelDb]($backend).
 */
@ECJsonTypeMap.classToJson("wsg", "ProjectScope.iModel", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class HubIModel extends WsgInstance {
    /** Id of the iModel. */
    @ECJsonTypeMap.propertyToJson("wsg", "instanceId")
    public id?: GuidString;

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

    /** @hidden - internal property, set when creating iModel from empty seed file */
    @ECJsonTypeMap.propertyToJson("wsg", "properties.iModelTemplate")
    public iModelTemplate?: string;
}

/** Initialization state of seed file. Can be queried with [[IModelHandler.getInitializationState]]. See [iModel creation]($docs/learning/iModelHub/iModels/CreateiModel.md). */
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
     * @param imodelId Id of the iModel. See [[HubIModel]].
     * @param fileId Id of the Seed File.
     */
    private getRelativeUrl(imodelId: GuidString, fileId?: GuidString) {
        return `/Repositories/iModel--${imodelId}/iModelScope/SeedFile/${fileId || ""}`;
    }

    /**
     * Get the seed files given the id of the iModel.
     * @hidden
     * @param requestContext The client request context.
     * @param iModelId Id of the iModel. See [[HubIModel]].
     * @param query Optional query object to filter the queried SeedFiles or select different data from them.
     * @returns Resolves to the seed file.
     */
    public async get(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, query: SeedFileQuery = new SeedFileQuery()): Promise<SeedFile[]> {
        requestContext.enter();
        Logger.logInfo(loggingCategory, "Started querying seed files", () => ({ imodelId: iModelId }));

        const seedFiles = await this._handler.getInstances<SeedFile>(requestContext, SeedFile, this.getRelativeUrl(iModelId, query.getId()), query.getQueryOptions());
        requestContext.enter();

        Logger.logInfo(loggingCategory, "Finished querying seed files", () => ({ imodelId: iModelId, count: seedFiles.length }));

        return seedFiles;
    }

    /**
     * Upload the seed file. Use [[confirmUploadSeedFile]] to confirm the completion of the upload.
     * @hidden
     * @param requestContext The client request context.
     * @param iModelId Id of the iModel. See [[HubIModel]].
     * @param seedFile Information of the SeedFile to be uploaded.
     * @param seedPath Path of the SeedFile to be uploaded.
     * @param progressCallback Callback for tracking progress.
     */
    public async uploadSeedFile(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, seedPath: string, seedFileDescription?: string, progressCallback?: (progress: ProgressInfo) => void): Promise<SeedFile> {
        requestContext.enter();
        Logger.logInfo(loggingCategory, "Started uploading seed file", () => ({ iModelId, seedPath }));

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
        Logger.logTrace(loggingCategory, "Finished uploading seed file", () => confirmSeedFile);

        return confirmSeedFile;
    }
}

/**
 * Query object for getting [[HubIModel]] instances. You can use this to modify the [[IModelsHandler.get]] results.
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
 * Handler for managing [[HubIModel]] instances. Use [[IModelHubClient.IModels]] to get an instance of this handler.
 * @note Use [[IModelHubClient.IModel]] for the preferred single iModel per [[Project]] workflow.
 */
export class IModelsHandler {
    private _handler: IModelBaseHandler;
    private _fileHandler?: FileHandler;
    private _seedFileHandler: SeedFileHandler;

    /**
     * Constructor for IModelsHandler. Should use @see IModelClient instead of directly constructing this.
     * @param handler Handler for WSG requests.
     * @param fileHandler Handler for file system.
     * @note Use [[IModelHubClient.IModel]] for the preferred single iModel per [[Project]] workflow.
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
     * @param imodelId Id of the iModel. See [[HubIModel]].
     */
    private getRelativeUrl(contextId: string, imodelId?: GuidString) {
        return `/Repositories/Project--${this._handler.formatProjectIdForUrl(contextId)}/ProjectScope/iModel/${imodelId || ""}`;
    }

    /**
     * Get iModels that belong to the specified [[Project]].
     * @param requestContext The client request context.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @param query Optional query object to filter the queried iModels or select different data from them.
     * @returns [[HubIModel]] instances that match the query.
     * @throws [[WsgError]] with [WSStatus.InstanceNotFound]($bentley) if [[InstanceIdQuery.byId]] is used and an HubIModel with the specified id could not be found.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async get(requestContext: AuthorizedClientRequestContext, contextId: string, query: IModelQuery = new IModelQuery()): Promise<HubIModel[]> {
        requestContext.enter();
        Logger.logInfo(loggingCategory, `Started querying iModels in project`, () => ({ contextId }));
        ArgumentCheck.defined("requestContext", requestContext);
        ArgumentCheck.defined("contextId", contextId); // contextId is a GUID for iModelHub and a JSON representation of an IModelBankAccessContext for iModelBank.

        const imodels = await this._handler.getInstances<HubIModel>(requestContext, HubIModel, this.getRelativeUrl(contextId, query.getId()), query.getQueryOptions());
        requestContext.enter();
        Logger.logInfo(loggingCategory, `Finished querying iModels in project`, () => ({ contextId, count: imodels.length }));

        return imodels;
    }

    /**
     * Delete an iModel with specified id from a [[Project]]. This method is not supported in iModelBank.
     * @param requestContext The client request context.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @param iModelId Id of the iModel to be deleted. See [[HubIModel]].
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel with specified id does not exist.
     * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have DeleteiModel permission.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async delete(requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: GuidString): Promise<void> {
        requestContext.enter();
        Logger.logInfo(loggingCategory, "Started deleting iModel", () => ({ iModelId, contextId }));
        ArgumentCheck.defined("requestContext", requestContext);
        ArgumentCheck.validGuid("contextId", contextId);
        ArgumentCheck.validGuid("imodelId", iModelId);

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
        Logger.logInfo(loggingCategory, "Finished deleting iModel", () => ({ iModelId, contextId }));
    }

    /**
     * Create an iModel instance
     * @hidden
     * @param requestContext The client request context.
     * @param projectId Id of the connect [[Project]].
     * @param iModelName Name of the iModel on the Hub.
     * @param description Description of the iModel on the Hub.
     * @param iModelTemplate iModel template.
     */
    private async createIModelInstance(requestContext: AuthorizedClientRequestContext, projectId: string, iModelName: string, description?: string, iModelTemplate?: string): Promise<HubIModel> {
        requestContext.enter();
        Logger.logInfo(loggingCategory, `Creating iModel with name ${iModelName} in project ${projectId}`);

        let imodel: HubIModel;
        const iModel = new HubIModel();
        iModel.name = iModelName;
        if (description)
            iModel.description = description;
        if (iModelTemplate)
            iModel.iModelTemplate = iModelTemplate;

        try {
            imodel = await this._handler.postInstance<HubIModel>(requestContext, HubIModel, this.getRelativeUrl(projectId), iModel);
            requestContext.enter();
            Logger.logTrace(loggingCategory, `Created iModel instance with name ${iModelName} in project ${projectId}`);
        } catch (err) {
            requestContext.enter();
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

            const imodels = await this.get(requestContext, projectId, new IModelQuery().byName(iModelName));
            requestContext.enter();
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
     * Get the [[InitializationState]] for the specified iModel. See [iModel creation]($docs/learning/iModelHub/iModels/CreateiModel.md).
     * @param requestContext The client request context.
     * @param imodelId Id of the iModel. See [[HubIModel]].
     * @returns State of the seed file initialization.
     * @throws [[IModelHubError]] with [IModelHubStatus.FileDoesNotExist]($bentley) if the seed file was not found.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async getInitializationState(requestContext: AuthorizedClientRequestContext, imodelId: GuidString): Promise<InitializationState> {
        const seedFiles: SeedFile[] = await this._seedFileHandler.get(requestContext, imodelId, new SeedFileQuery().latest());
        requestContext.enter();
        if (seedFiles.length < 1)
            return Promise.reject(new IModelHubError(IModelHubStatus.FileDoesNotExist));

        return seedFiles[0].initializationState!;
    }

    /**
     * Create an iModel from given seed file. In most cases [IModelDb.create]($backend) should be used instead. See [iModel creation]($docs/learning/iModelHub/iModels/CreateiModel.md).
     *
     * This method does not work on browsers. If iModel creation fails before finishing file upload, partially created iModel is deleted. This method is not supported in iModelBank.
     * @param requestContext The client request context.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @param name Name of the iModel on the Hub.
     * @param path iModel seed file path. If not defined, iModel will be created from an empty file.
     * @param description Description of the iModel on the Hub.
     * @param progressCallback Callback for tracking progress.
     * @param timeOutInMiliseconds Time to wait for iModel initialization.
     * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have CreateiModel permission.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async create(requestContext: AuthorizedClientRequestContext, contextId: string, name: string, path?: string,
        description?: string, progressCallback?: (progress: ProgressInfo) => void,
        timeOutInMilliseconds: number = 120000): Promise<HubIModel> {
        requestContext.enter();
        Logger.logInfo(loggingCategory, `Creating iModel in project ${contextId}`);
        ArgumentCheck.defined("requestContext", requestContext);
        ArgumentCheck.validGuid("contextId", contextId);
        ArgumentCheck.defined("name", name);

        const imodelFromTemplate = !path;

        if (typeof window !== "undefined")
            return Promise.reject(IModelHubClientError.browser());

        if (!this._fileHandler)
            return Promise.reject(IModelHubClientError.fileHandler());

        if (!!path && (!this._fileHandler.exists(path) || this._fileHandler.isDirectory(path)))
            return Promise.reject(IModelHubClientError.fileNotFound());

        const imodelTemplate = imodelFromTemplate ? iModelTemplateEmpty : undefined;
        const imodel = await this.createIModelInstance(requestContext, contextId, name, description, imodelTemplate);
        requestContext.enter();

        if (imodelFromTemplate) {
            return imodel;
        }

        try {
            await this._seedFileHandler.uploadSeedFile(requestContext, imodel.id!, path!, description, progressCallback);
        } catch (err) {
            await this.delete(requestContext, contextId, imodel.id!);
            return Promise.reject(err);
        }
        requestContext.enter();

        const errorMessage = "Cannot upload SeedFile " + path;
        const retryDelay = timeOutInMilliseconds / 10;
        for (let retries = 10; retries > 0; --retries) {
            try {
                const initState = await this.getInitializationState(requestContext, imodel.id!);
                requestContext.enter();
                if (initState === InitializationState.Successful) {
                    Logger.logTrace(loggingCategory, `Created iModel with id ${imodel.id} in project ${contextId}`);
                    imodel.initialized = true;
                    return imodel;
                }

                if (initState !== InitializationState.NotStarted && initState !== InitializationState.Scheduled) {
                    Logger.logWarning(loggingCategory, errorMessage);
                    return Promise.reject(new IModelHubError(IModelHubStatus.SeedFileInitializationFailed,
                        `Seed file initialization failed with status ${InitializationState[initState]}`));
                }

                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                requestContext.enter();
            } catch (err) {
                requestContext.enter();
                Logger.logWarning(loggingCategory, errorMessage);
                return Promise.reject(err);
            }
        }

        Logger.logWarning(loggingCategory, errorMessage);
        return Promise.reject(new Error("Timed out waiting for seed file initialization."));
    }

    /**
     * Update iModel's name and/or description
     * @param requestContext The client request context.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @param imodel iModel to update. See [[HubIModel]].
     * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have CreateiModel permission.
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelIsNotInitialized]$(bentley) if iModel is not initialized.
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelAlreadyExists]$(bentley) if iModel with specified name already exists.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async update(requestContext: AuthorizedClientRequestContext, contextId: string, imodel: HubIModel): Promise<HubIModel> {
        requestContext.enter();
        Logger.logInfo(loggingCategory, `Updating iModel in project ${contextId}`);
        ArgumentCheck.defined("requestContext", requestContext);
        ArgumentCheck.validGuid("contextId", contextId);

        const updatediModel = await this._handler.postInstance<HubIModel>(requestContext, HubIModel, this.getRelativeUrl(contextId, imodel.id), imodel);

        Logger.logTrace(loggingCategory, `Updated iModel with id ${imodel.wsgId}`);

        return updatediModel;
    }

    /**
     * Method to download the seed file for iModel. This will download the original seed file, that was uploaded when creating iModel. To download a file that was updated with ChangeSets on iModelHub, see [[BriefcaseHandler.download]].
     * @param requestContext The client request context.
     * @param iModelId Id of the iModel. See [[HubIModel]].
     * @param path Path to download the seed file to, including file name.
     * @param progressCallback Callback for tracking progress.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async download(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, path: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
        requestContext.enter();
        Logger.logInfo(loggingCategory, "Started downloading seed file", () => ({ imodelId: iModelId }));
        ArgumentCheck.defined("requestContext", requestContext);
        ArgumentCheck.validGuid("imodelId", iModelId);
        ArgumentCheck.defined("path", path);

        if (typeof window !== "undefined")
            return Promise.reject(IModelHubClientError.browser());

        if (!this._fileHandler)
            return Promise.reject(IModelHubClientError.fileHandler());

        const seedFiles: SeedFile[] = await this._seedFileHandler.get(requestContext, iModelId, new SeedFileQuery().selectDownloadUrl().latest());
        requestContext.enter();

        if (!seedFiles || !seedFiles[0] || !seedFiles[0].downloadUrl)
            return Promise.reject(IModelHubError.fromId(IModelHubStatus.FileDoesNotExist, "Failed to get seed file."));

        await this._fileHandler.downloadFile(requestContext, seedFiles[0].downloadUrl!, path, parseInt(seedFiles[0].fileSize!, 10), progressCallback);
        requestContext.enter();
        Logger.logInfo(loggingCategory, "Finished downloading seed file", () => ({ imodelId: iModelId }));
    }
}

/**
 * Handler for managing [[HubIModel]] instance. Use [[IModelHubClient.IModel]] to get an instance of this handler.
 * @note Use [[IModelHubClient.IModels]] if multiple iModels per [[Project]] are supported.
 */
export class IModelHandler {
    private _handler: IModelsHandler;

    /**
     * Constructor for IModelHandler. Should use @see IModelClient instead of directly constructing this.
     * @param handler Handler for managing [[HubIModel]] instances.
     * @note Use [[IModelHubClient.IModels]] if multiple iModels per [[Project]] are supported.
     * @hidden
     */
    constructor(handler: IModelsHandler) {
        this._handler = handler;
    }

    /**
     * Get iModel that belong to the specified [[Project]].
     * @param requestContext The client request context.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @returns [[HubIModel]] instances that match the query.
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async get(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<HubIModel> {
        requestContext.enter();

        Logger.logInfo(loggingCategory, `Querying iModel in project ${contextId}`);
        const query = new IModelQuery().orderBy("CreatedDate+asc").top(1);
        const imodels = await this._handler.get(requestContext, contextId, query);

        if (imodels.length < 1)
            return Promise.reject(new IModelHubError(IModelHubStatus.iModelDoesNotExist));

        return imodels[0];
    }

    /**
     * Delete an iModel from a [[Project]]. This method is not supported in iModelBank.
     * @param requestContext The client request context.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
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
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @returns State of the seed file initialization.
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
     * @throws [[IModelHubError]] with [IModelHubStatus.FileDoesNotExist]($bentley) if the seed file was not found.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async getInitializationState(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<InitializationState> {
        const imodel = await this.get(requestContext, contextId);
        return this._handler.getInitializationState(requestContext, imodel.id!);
    }

    /**
     * Create an iModel from given seed file. In most cases [IModelDb.create]($backend) should be used instead. See [iModel creation]($docs/learning/iModelHub/iModels/CreateiModel.md).
     *
     * This method does not work on browsers. If iModel creation fails before finishing file upload, partially created iModel is deleted. This method is not supported in iModelBank.
     * @param requestContext The client request context.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @param name Name of the iModel on the Hub.
     * @param path iModel seed file path. If not defined, iModel will be created from an empty file.
     * @param description Description of the iModel on the Hub.
     * @param progressCallback Callback for tracking progress.
     * @param timeOutInMiliseconds Time to wait for iModel initialization.
     * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have CreateiModel permission.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async create(requestContext: AuthorizedClientRequestContext, contextId: string, name: string, path?: string, description?: string, progressCallback?: (progress: ProgressInfo) => void, timeOutInMilliseconds: number = 120000): Promise<HubIModel> {
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
            return Promise.reject(new IModelHubError(IModelHubStatus.iModelAlreadyExists));

        return this._handler.create(requestContext, contextId, name, path, description, progressCallback, timeOutInMilliseconds);
    }

    /**
     * Update iModel's name and/or description
     * @param requestContext The client request context.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
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
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @param path Path where seed file should be downloaded, including filename.
     * @param progressCallback Callback for tracking progress.
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async download(requestContext: AuthorizedClientRequestContext, contextId: string, path: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
        const imodel = await this.get(requestContext, contextId);
        await this._handler.download(requestContext, imodel.id!, path, progressCallback);
    }
}
