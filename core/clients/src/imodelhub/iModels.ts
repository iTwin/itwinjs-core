/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap, WsgInstance, GuidSerializer } from "./../ECJsonTypeMap";
import { IModelHubClientError, IModelHubError, ArgumentCheck } from "./Errors";
import { InstanceIdQuery, addSelectFileAccessKey } from "./Query";
import { AccessToken } from "../Token";
import { Logger, IModelHubStatus, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { FileHandler } from "../FileHandler";
import { ProgressInfo } from "../Request";
import { IModelBaseHandler } from "./BaseHandler";

const loggingCategory = "imodeljs-clients.imodelhub";

/**
 * HubIModel represents an iModel on iModelHub. Getting a valid HubIModel instance from iModelHub is required for majority of iModelHub method calls, as wsgId of this object needs to be passed as imodelId argument to those methods.
 *
 * For iModel representation in iModel.js, see [IModel]($common). For the file that is used for that iModel, see [IModelDb]($backend).
 */
@ECJsonTypeMap.classToJson("wsg", "ProjectScope.iModel", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class HubIModel extends WsgInstance {
    /** Id of the iModel. */
    @ECJsonTypeMap.propertyToJson("wsg", "instanceId", new GuidSerializer())
    public id?: Guid;

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
    @ECJsonTypeMap.propertyToJson("wsg", "instanceId", new GuidSerializer())
    public id?: Guid;

    @ECJsonTypeMap.propertyToJson("wsg", "properties.FileName")
    public fileName?: string;

    @ECJsonTypeMap.propertyToJson("wsg", "properties.FileDescription")
    public fileDescription?: string;

    @ECJsonTypeMap.propertyToJson("wsg", "properties.FileSize")
    public fileSize?: string;

    @ECJsonTypeMap.propertyToJson("wsg", "properties.FileId", new GuidSerializer())
    public fileId?: Guid;

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
    private getRelativeUrl(imodelId: Guid, fileId?: Guid) {
        return `/Repositories/iModel--${imodelId}/iModelScope/SeedFile/${fileId || ""}`;
    }

    /**
     * Get the seed files given the id of the iModel.
     * @hidden
     * @param token Delegation token of the authorized user.
     * @param imodelId Id of the iModel. See [[HubIModel]].
     * @param query Optional query object to filter the queried SeedFiles or select different data from them.
     * @returns Resolves to the seed file.
     */
    public async get(alctx: ActivityLoggingContext, token: AccessToken, imodelId: Guid, query: SeedFileQuery = new SeedFileQuery()): Promise<SeedFile[]> {
        alctx.enter();
        Logger.logInfo(loggingCategory, `Querying seed files for iModel ${imodelId}`);

        const seedFiles = await this._handler.getInstances<SeedFile>(alctx, SeedFile, token, this.getRelativeUrl(imodelId, query.getId()), query.getQueryOptions());
        alctx.enter();
        Logger.logTrace(loggingCategory, `Queried ${seedFiles.length} seed files for iModel ${imodelId}`);

        return seedFiles;
    }

    /**
     * Upload the seed file. Use [[confirmUploadSeedFile]] to confirm the completion of the upload.
     * @hidden
     * @param token Delegation token of the authorized user.
     * @param imodelId Id of the iModel. See [[HubIModel]].
     * @param seedFile Information of the SeedFile to be uploaded.
     * @param seedPathname Pathname of the SeedFile to be uploaded.
     * @param progressCallback Callback for tracking progress.
     */
    public async uploadSeedFile(alctx: ActivityLoggingContext, token: AccessToken, imodelId: Guid, seedPathname: string, seedFileDescription?: string, progressCallback?: (progress: ProgressInfo) => void): Promise<SeedFile> {
        alctx.enter();
        Logger.logInfo(loggingCategory, `Uploading seed file to iModel ${imodelId}`);

        const seedFile = new SeedFile();
        seedFile.fileName = this._fileHandler!.basename(seedPathname);
        seedFile.fileSize = this._fileHandler!.getFileSize(seedPathname).toString();
        if (seedFileDescription)
            seedFile.fileDescription = seedFileDescription;

        const createdSeedFile: SeedFile = await this._handler.postInstance<SeedFile>(alctx, SeedFile, token, this.getRelativeUrl(imodelId), seedFile);
        alctx.enter();
        await this._fileHandler!.uploadFile(alctx, createdSeedFile.uploadUrl!, seedPathname, progressCallback);
        alctx.enter();
        createdSeedFile.uploadUrl = undefined;
        createdSeedFile.downloadUrl = undefined;
        createdSeedFile.isUploaded = true;

        const confirmSeedFile = await this._handler.postInstance<SeedFile>(alctx, SeedFile, token, this.getRelativeUrl(imodelId, createdSeedFile.id), createdSeedFile);
        alctx.enter();
        Logger.logTrace(loggingCategory, `Uploaded seed file ${seedFile.wsgId} to iModel ${imodelId}`);

        return confirmSeedFile;
    }
}

/**
 * Query object for getting [[HubIModel]] instances. You can use this to modify the [[IModelHandler.get]] results.
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

    /**
     * Query [[Project]] primary iModel.
     * @returns This query.
     */
    public primary() {
        this.resetQueryOptions();

        this.orderBy("CreatedDate+asc").top(1);
        return this;
    }
}

/**
 * Handler for managing [[HubIModel]] instances. Use [[IModelHubClient.IModels]] to get an instance of this handler.
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
     * @param imodelId Id of the iModel. See [[HubIModel]].
     */
    private getRelativeUrl(contextId: string, imodelId?: Guid) {
        return `/Repositories/Project--${this._handler.formatProjectIdForUrl(contextId)}/ProjectScope/iModel/${imodelId || ""}`;
    }

    /**
     * Get iModels that belong to the specified [[Project]].
     * @param token Delegation token of the authorized user.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @param query Optional query object to filter the queried iModels or select different data from them.
     * @returns [[HubIModel]] instances that match the query.
     * @throws [[WsgError]] with [WSStatus.InstanceNotFound]($bentley) if [[InstanceIdQuery.byId]] is used and an HubIModel with the specified id could not be found.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async get(alctx: ActivityLoggingContext, token: AccessToken, contextId: string, query: IModelQuery = new IModelQuery()): Promise<HubIModel[]> {
        alctx.enter();
        Logger.logInfo(loggingCategory, `Querying iModels in project ${contextId}`);
        ArgumentCheck.defined("token", token);
        ArgumentCheck.defined("contextId", contextId); // contextId is a GUID for iModelHub and a JSON representation of an IModelBankAccessContext for iModelBank.

        const imodels = await this._handler.getInstances<HubIModel>(alctx, HubIModel, token, this.getRelativeUrl(contextId, query.getId()), query.getQueryOptions());
        alctx.enter();
        Logger.logTrace(loggingCategory, `Queried ${imodels.length} iModels in project ${contextId}`);

        return imodels;
    }

    /**
     * Delete an iModel with specified id from a [[Project]]. This method is not supported in iModelBank.
     * @param token Delegation token of the authorized user.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @param imodelId Id of the iModel to be deleted. See [[HubIModel]].
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel with specified id does not exist.
     * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have DeleteiModel permission.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async delete(alctx: ActivityLoggingContext, token: AccessToken, contextId: string, imodelId: Guid): Promise<void> {
        alctx.enter();
        Logger.logInfo(loggingCategory, `Deleting iModel with id ${imodelId} from project ${contextId}`);
        ArgumentCheck.defined("token", token);
        ArgumentCheck.validGuid("contextId", contextId);
        ArgumentCheck.validGuid("imodelId", imodelId);

        if (this._handler.getCustomRequestOptions().isSet) {
            // to add custom request options, request with body is needed.
            const imodel = new HubIModel();
            imodel.id = imodelId;
            imodel.changeState = "deleted";
            await this._handler.deleteInstance(alctx, token, this.getRelativeUrl(contextId, imodelId), imodel);
        } else {
            await this._handler.delete(alctx, token, this.getRelativeUrl(contextId, imodelId));
        }
        alctx.enter();
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
    private async createIModelInstance(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, iModelName: string, description?: string): Promise<HubIModel> {
        alctx.enter();
        Logger.logInfo(loggingCategory, `Creating iModel with name ${iModelName} in project ${projectId}`);

        let imodel: HubIModel;
        const iModel = new HubIModel();
        iModel.name = iModelName;
        if (description)
            iModel.description = description;

        try {
            imodel = await this._handler.postInstance<HubIModel>(alctx, HubIModel, token, this.getRelativeUrl(projectId), iModel);
            alctx.enter();
            Logger.logTrace(loggingCategory, `Created iModel instance with name ${iModelName} in project ${projectId}`);
        } catch (err) {
            alctx.enter();
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

            const imodels = await this.get(alctx, token, projectId, new IModelQuery().byName(iModelName));
            alctx.enter();
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
     * @param token Delegation token of the authorized user.
     * @param imodelId Id of the iModel. See [[HubIModel]].
     * @returns State of the seed file initialization.
     * @throws [[IModelHubError]] with [IModelHubStatus.FileDoesNotExist]($bentley) if the seed file was not found.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async getInitializationState(alctx: ActivityLoggingContext, token: AccessToken, imodelId: Guid): Promise<InitializationState> {
        const seedFiles: SeedFile[] = await this._seedFileHandler.get(alctx, token, imodelId, new SeedFileQuery().latest());
        alctx.enter();
        if (seedFiles.length < 1)
            return Promise.reject(new IModelHubError(IModelHubStatus.FileDoesNotExist));

        return seedFiles[0].initializationState!;
    }

    /**
     * Create an iModel from given seed file. In most cases [IModelDb.create]($backend) should be used instead. See [iModel creation]($docs/learning/iModelHub/iModels/CreateiModel.md).
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
    public async create(alctx: ActivityLoggingContext, token: AccessToken, contextId: string, name: string, pathName: string,
        description?: string, progressCallback?: (progress: ProgressInfo) => void,
        timeOutInMilliseconds: number = 120000): Promise<HubIModel> {
        alctx.enter();
        Logger.logInfo(loggingCategory, `Creating iModel in project ${contextId}`);
        ArgumentCheck.defined("token", token);
        ArgumentCheck.validGuid("contextId", contextId);
        ArgumentCheck.defined("name", name);
        ArgumentCheck.defined("pathName", pathName);

        if (typeof window !== "undefined")
            return Promise.reject(IModelHubClientError.browser());

        if (!this._fileHandler)
            return Promise.reject(IModelHubClientError.fileHandler());

        if (!this._fileHandler.exists(pathName) || this._fileHandler.isDirectory(pathName))
            return Promise.reject(IModelHubClientError.fileNotFound());

        const imodel = await this.createIModelInstance(alctx, token, contextId, name, description);
        alctx.enter();

        try {
            await this._seedFileHandler.uploadSeedFile(alctx, token, imodel.id!, pathName, description, progressCallback);
        } catch (err) {
            await this.delete(alctx, token, contextId, imodel.id!);
            return Promise.reject(err);
        }
        alctx.enter();

        const errorMessage = "Cannot upload SeedFile " + pathName;
        const retryDelay = timeOutInMilliseconds / 10;
        for (let retries = 10; retries > 0; --retries) {
            try {
                const initState = await this.getInitializationState(alctx, token, imodel.id!);
                alctx.enter();
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
                alctx.enter();
            } catch (err) {
                alctx.enter();
                Logger.logWarning(loggingCategory, errorMessage);
                return Promise.reject(err);
            }
        }

        Logger.logWarning(loggingCategory, errorMessage);
        return Promise.reject(new Error("Timed out waiting for seed file initialization."));
    }

    /**
     * Update iModel's name and/or description
     * @param token Delegation token of the authorized user.
     * @param contextId Id for the iModel's context. For iModelHub it should be the id of the connect [[Project]].
     * @param imodel iModel to update. See [[HubIModel]].
     * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if the user does not have CreateiModel permission.
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelDoesNotExist]$(bentley) if iModel does not exist.
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelIsNotInitialized]$(bentley) if iModel is not initialized.
     * @throws [[IModelHubError]] with [IModelHubStatus.iModelAlreadyExists]$(bentley) if iModel with specified name already exists.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async update(alctx: ActivityLoggingContext, token: AccessToken, contextId: string, imodel: HubIModel): Promise<HubIModel> {
        alctx.enter();
        Logger.logInfo(loggingCategory, `Updating iModel in project ${contextId}`);
        ArgumentCheck.defined("token", token);
        ArgumentCheck.validGuid("contextId", contextId);

        const updatediModel = await this._handler.postInstance<HubIModel>(alctx, HubIModel, token, this.getRelativeUrl(contextId, imodel.id), imodel);

        Logger.logTrace(loggingCategory, `Updated iModel with id ${imodel.wsgId}`);

        return updatediModel;
    }

    /**
     * Method to download the seed file for iModel. This will download the original seed file, that was uploaded when creating iModel. To download a file that was updated with ChangeSets on iModelHub, see [[BriefcaseHandler.download]].
     * @param token Delegation token of the authorized user.
     * @param imodelId Id of the iModel. See [[HubIModel]].
     * @param downloadToPathname Directory where the seed file should be downloaded.
     * @param progressCallback Callback for tracking progress.
     * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
     */
    public async download(alctx: ActivityLoggingContext, token: AccessToken, imodelId: Guid, downloadToPathname: string, progressCallback?: (progress: ProgressInfo) => void): Promise<void> {
        alctx.enter();
        Logger.logInfo(loggingCategory, `Downloading seed file for iModel ${imodelId}`);
        ArgumentCheck.defined("token", token);
        ArgumentCheck.validGuid("imodelId", imodelId);
        ArgumentCheck.defined("downloadToPathname", downloadToPathname);

        if (typeof window !== "undefined")
            return Promise.reject(IModelHubClientError.browser());

        if (!this._fileHandler)
            return Promise.reject(IModelHubClientError.fileHandler());

        const seedFiles: SeedFile[] = await this._seedFileHandler.get(alctx, token, imodelId, new SeedFileQuery().selectDownloadUrl().latest());
        alctx.enter();

        if (!seedFiles || !seedFiles[0] || !seedFiles[0].downloadUrl)
            return Promise.reject(IModelHubError.fromId(IModelHubStatus.FileDoesNotExist, "Failed to get seed file."));

        await this._fileHandler.downloadFile(alctx, seedFiles[0].downloadUrl!, downloadToPathname, parseInt(seedFiles[0].fileSize!, 10), progressCallback);
        alctx.enter();
        Logger.logTrace(loggingCategory, `Downloading seed file for iModel ${imodelId}`);
    }
}
