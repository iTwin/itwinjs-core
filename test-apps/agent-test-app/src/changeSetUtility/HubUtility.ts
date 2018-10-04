/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IHubProjectConfig, ChangesetGenerationConfig } from "./Config";
import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, ConnectClient, IModelHubClient } from "@bentley/imodeljs-clients/lib";
import { AzureFileHandler } from "@bentley/imodeljs-clients/lib/imodelhub/AzureFileHandler";
import { Project, IModelQuery } from "@bentley/imodeljs-clients/lib";
import { HubIModel as HubIModel } from "@bentley/imodeljs-clients/lib/imodelhub/iModels";
import { Logger, assert, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core/lib/bentleyjs-core";
import { IModelVersion } from "@bentley/imodeljs-common/lib/common";
import { Version } from "@bentley/imodeljs-clients/lib/imodelhub";
import * as path from "path";

const actx = new ActivityLoggingContext("");

/** Class Containing utility functions for interactions with the iModelHub */
export class HubUtility {
    public connectClient: ConnectClient;
    private _hubClient: IModelHubClient;
    private _projectConfig: IHubProjectConfig;
    public constructor(projectConfig: IHubProjectConfig) {
        this.connectClient = new ConnectClient(projectConfig.hubDeploymentEnv);
        this._hubClient = new IModelHubClient(projectConfig.hubDeploymentEnv, new AzureFileHandler());
        this._projectConfig = projectConfig;
    }
    public getHubClient(): IModelHubClient {
        return this._hubClient;
    }
    public async login(): Promise<AccessToken> {
        // TODO: eventually use OIDC
        const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient(this._projectConfig.imsDeploymentEnv)).getToken(actx, this._projectConfig.user.email,
            this._projectConfig.user.password);
        assert(!!authToken);

        const accessToken: AccessToken = await (new ImsDelegationSecureTokenClient(this._projectConfig.imsDeploymentEnv)).getToken(actx, authToken!);
        assert(!!accessToken);

        Logger.logTrace(ChangesetGenerationConfig.loggingCategory, `Logged in test user ${this._projectConfig.user.email}`);
        return accessToken;
    }
    public async createNamedVersion(accessToken: AccessToken, iModelId: string, name: string, description: string): Promise<Version> {
        const changeSetId: string = await IModelVersion.latest().evaluateChangeSet(actx, accessToken, iModelId, this._hubClient);
        Logger.logTrace(ChangesetGenerationConfig.loggingCategory, `Creating named version "${name}" on the Hub`);
        return await this._hubClient.Versions().create(actx, accessToken, new Guid(iModelId), changeSetId, name, description);
    }
    /** Push an iModel to the Hub */
    public async pushIModel(accessToken: AccessToken, projectId: string, pathname: string): Promise<string> {
        // Delete any existing iModels with the same name as the required iModel
        const iModelName = path.basename(pathname, ".bim");
        let iModel: HubIModel | undefined = await this._queryIModelByName(accessToken, projectId, iModelName);
        if (iModel && !!iModel.id)
            await this._hubClient.IModels().delete(actx, accessToken, projectId, iModel.id!);

        // Upload a new iModel
        Logger.logTrace(ChangesetGenerationConfig.loggingCategory, `Started pushing test iModel "${iModelName}" to the Hub`);
        iModel = await this._hubClient.IModels().create(actx, accessToken, projectId, iModelName, pathname, "", undefined, 2 * 60 * 1000);
        Logger.logTrace(ChangesetGenerationConfig.loggingCategory, `Finished pushing test iModel "${iModelName} (id:${iModel.wsgId})" to the Hub`);
        return iModel.wsgId;
    }
    /**
     * Queries the project id by its name
     * @param accessToken AccessToken
     * @param projectName Name of project
     * @throws If the project is not found, or there is more than one project with the supplied name
     */
    public async queryProjectIdByName(accessToken: AccessToken, projectName: string): Promise<string> {
        const project: Project | undefined = await this._queryProjectByName(accessToken, projectName);
        if (!project)
            return Promise.reject(`Project ${projectName} not found`);
        return project.wsgId;
    }

    /**
     * Queries the iModel id by its name
     * @param accessToken AccessToken
     * @param projectId Id of the project
     * @param iModelName Name of the iModel
     * @throws If the iModel is not found, or if there is more than one iModel with the supplied name
     */
    public async queryIModelIdByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<string> {
        const iModel: HubIModel | undefined = await this._queryIModelByName(accessToken, projectId, iModelName);
        if (!iModel)
            return Promise.reject(`IModel ${iModelName} not found`);
        return iModel.wsgId;
    }
    private async _queryProjectByName(accessToken: AccessToken, projectName: string): Promise<Project | undefined> {
        const project: Project = await this.connectClient.getProject(actx, accessToken, {
            $select: "*",
            $filter: "Name+eq+'" + projectName + "'",
        });
        return project;
    }

    private async _queryIModelByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<HubIModel | undefined> {
        const iModels = await this._hubClient.IModels().get(actx, accessToken, projectId, new IModelQuery().byName(iModelName));
        if (iModels.length === 0)
            return undefined;
        if (iModels.length > 1)
            return Promise.reject(`Too many iModels with name ${iModelName} found`);
        return iModels[0];
    }

}
