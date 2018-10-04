/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Logger, LogLevel, DbResult, assert, Id64, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core/lib/bentleyjs-core";
import { AccessToken, ChangeSetPostPushEvent, NamedVersionCreatedEvent } from "@bentley/imodeljs-clients/lib";
import { IModelVersion, ChangedValueState, ChangeOpCode } from "@bentley/imodeljs-common/lib/common";
import { IModelHost, IModelHostConfiguration, IModelDb, OpenParams, ChangeSummaryManager, ECSqlStatement, ChangeSummary, AccessMode } from "@bentley/imodeljs-backend/lib/backend";
import { HubUtility } from "./changeSetUtility";
import { QueryAgentConfig } from "./QueryAgentConfig";
import { OpenIdConnectTokenStore } from "./OpenIdConnectTokenStore";
import * as fs from "fs";
import * as path from "path";

const actx = new ActivityLoggingContext("");

/** Sleep for ms */
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Agent for querying changesets. Contains backend iModel.js engine. */
export class QueryAgent {
    private _tokenStore?: OpenIdConnectTokenStore;
    private _projectId?: string;
    private _iModelId?: string;
    private _iModelDb?: IModelDb;
    private _hubUtility: HubUtility;
    private _config: QueryAgentConfig;
    private _isInitialized: boolean = false;
    public constructor(config: QueryAgentConfig, hubUtility = new HubUtility(config)) {
        this._config = config;
        this._hubUtility = hubUtility;
        Logger.initializeToConsole();
        Logger.setLevelDefault(LogLevel.Error);
        Logger.setLevel(QueryAgentConfig.loggingCategory, LogLevel.Trace);

        if (config.hubDeploymentEnv === "DEV") {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            Logger.logTrace(QueryAgentConfig.loggingCategory, "Setting NODE_TLS_REJECT_UNAUTHORIZED = 0");
        }
        // Startup IModel Host if we need to
        const configuration = new IModelHostConfiguration();
        configuration.hubDeploymentEnv = config.hubDeploymentEnv;
        if (!IModelHost.configuration)
            IModelHost.startup(configuration);
    }

    /** Create listeners and respond to changesets */
    public async listenForAndHandleChangesets(tokenStore: OpenIdConnectTokenStore, listenFor: number = 60 * 1000 /*ms*/) {
        await this._initialize(tokenStore);

        const accessToken: AccessToken = await this._tokenStore!.getAccessToken();

        // Subscribe to change set and named version events
        const imodelId = new Guid(this._iModelId!);
        Logger.logTrace(QueryAgentConfig.loggingCategory, "Setting up changeset and named version listeners...");
        const changeSetSubscription = await this._hubUtility!.getHubClient().Events().Subscriptions().create(actx, accessToken, imodelId, ["ChangeSetPostPushEvent"]);
        const deleteChangeSetListener = this._hubUtility!.getHubClient().Events().createListener(actx, async () => accessToken, changeSetSubscription!.wsgId, imodelId,
            async (receivedEvent: ChangeSetPostPushEvent) => {
                Logger.logTrace(QueryAgentConfig.loggingCategory, `Received notification that change set "${receivedEvent.changeSetId}" was just posted on the Hub`);
                try {
                    await this._extractChangeSummary(receivedEvent.changeSetId!);
                } catch (error) {
                    Logger.logError(QueryAgentConfig.loggingCategory, `Error while extracting changeset summary: ${error}`);
                }
            });
        const namedVersionSubscription = await this._hubUtility!.getHubClient().Events().Subscriptions().create(actx, accessToken, imodelId, ["VersionEvent"]);
        const deleteNamedVersionListener = this._hubUtility!.getHubClient().Events().createListener(actx, async () => accessToken, namedVersionSubscription!.wsgId, imodelId,
            async (receivedEvent: NamedVersionCreatedEvent) => {
                Logger.logTrace(QueryAgentConfig.loggingCategory, `Received notification that named version "${receivedEvent.versionName}" was just created on the Hub`);
            });

        Logger.logTrace(QueryAgentConfig.loggingCategory, `Listening to changesets for ${listenFor} ms.`);
        // Wait for callbacks from events in the iModelHub
        await pause(listenFor);

        if (this._iModelDb)
            await this._iModelDb.close(actx, accessToken);
        // Unsubscribe from events (if necessary)
        if (deleteChangeSetListener)
            deleteChangeSetListener();
        if (deleteNamedVersionListener)
            deleteNamedVersionListener();
        Logger.logTrace(QueryAgentConfig.loggingCategory, `Finished listening for changesets for ${listenFor} ms.`);
    }

    /** Asyncronous initialization */
    private async _initialize(tokenStore: OpenIdConnectTokenStore): Promise<void> {
        if (!this._isInitialized) {
            try {
                // Initialize (cleanup) output directory
                this._initializeOutputDirectory();
                this._tokenStore = tokenStore;

                const accessToken: AccessToken = await this._tokenStore.getAccessToken();
                this._projectId = await this._hubUtility.queryProjectIdByName(accessToken, this._config.projectName);
                this._iModelId = await this._hubUtility.queryIModelIdByName(accessToken, this._projectId, this._config.iModelName);
                Logger.logTrace(QueryAgentConfig.loggingCategory, `Query Agent Intialized with event subscriptions for ${this._config.iModelName}`);
                this._isInitialized = true;
            } catch (error) {
                const errorStr = `Unable to verify IModel:'${this._config.iModelName}', for project '${this._config.projectName}' exists in the iModel Hub: ${error}`;
                Logger.logError(QueryAgentConfig.loggingCategory, errorStr);
                throw errorStr;
            }

        }
    }

    /** Extract a summary of information in the change set - who changed it, when it was changed, what was changed, how it was changed, and write it to a JSON file */
    private async _extractChangeSummary(changeSetId: string) {
        const accessToken: AccessToken = await this._tokenStore!.getAccessToken();
        if (!this._iModelDb) {
            // Open a new local briefcase of the iModel at the specified version
            this._iModelDb = await IModelDb.open(actx, accessToken, this._projectId!, this._iModelId!, OpenParams.pullOnly(AccessMode.Exclusive), IModelVersion.asOfChangeSet(changeSetId));
        } else {
            // Update the existing local briefcase of the iModel to the specified version
            await this._iModelDb.pullAndMergeChanges(actx, accessToken, IModelVersion.asOfChangeSet(changeSetId));
        }

        // Extract summary information about the current version of the briefcase/iModel into the change cache
        const changeSummaryIds: Id64[] = await ChangeSummaryManager.extractChangeSummaries(actx, accessToken, this._iModelDb!, { currentVersionOnly: true });
        Logger.logTrace(QueryAgentConfig.loggingCategory, `Extracted summary information from change set "${changeSetId}"`);

        // Attach a change cache file to the iModel to enable querying the change summary
        ChangeSummaryManager.attachChangeCache(this._iModelDb);

        // Find the change summary that was just created
        assert(changeSummaryIds.length === 1);
        const changeSummary: ChangeSummary = ChangeSummaryManager.queryChangeSummary(this._iModelDb!, changeSummaryIds[0]);

        /*
        * Query the change summary to gather up all the content
        */
        const changeContent = { id: changeSummary.id, changeSet: changeSummary.changeSet, instanceChanges: {} };

        Logger.logTrace(QueryAgentConfig.loggingCategory, `   Description: ${changeSummary.changeSet.description}`);
        Logger.logTrace(QueryAgentConfig.loggingCategory, `   Push Date: ${new Date(changeSummary.changeSet.pushDate).toLocaleString()}`);
        Logger.logTrace(QueryAgentConfig.loggingCategory, `   Author: ${changeSummary.changeSet.author}`);

        changeContent.instanceChanges = this._iModelDb!.withPreparedStatement<any[]>("SELECT ECInstanceId FROM ecchange.change.InstanceChange WHERE Summary.Id=? ORDER BY ECInstanceId", (stmt: ECSqlStatement): any[] => {
            stmt.bindId(1, changeSummary.id);
            const instanceChanges = new Array<any>();
            while (stmt.step() === DbResult.BE_SQLITE_ROW) {
                const row = stmt.getRow();

                const instanceChange: any = ChangeSummaryManager.queryInstanceChange(this._iModelDb!, new Id64(row.id));
                switch (instanceChange.opCode) {
                    case ChangeOpCode.Insert: {
                        // Get the instance after the insert
                        const rows: any[] = this._iModelDb!.executeQuery(ChangeSummaryManager.buildPropertyValueChangesECSql(this._iModelDb!, instanceChange, ChangedValueState.AfterInsert));
                        assert(rows.length === 1);
                        instanceChange.after = rows[0];
                        break;
                    }
                    case ChangeOpCode.Update: {
                        // Get the instance before the update
                        let rows: any[] = this._iModelDb!.executeQuery(ChangeSummaryManager.buildPropertyValueChangesECSql(this._iModelDb!, instanceChange, ChangedValueState.BeforeUpdate));
                        assert(rows.length === 1);
                        instanceChange.before = rows[0];
                        // Get the instance after the update
                        rows = this._iModelDb!.executeQuery(ChangeSummaryManager.buildPropertyValueChangesECSql(this._iModelDb!, instanceChange, ChangedValueState.AfterUpdate));
                        assert(rows.length === 1);
                        instanceChange.after = rows[0];
                        break;
                    }
                    case ChangeOpCode.Delete: {
                        // Get the instance before the delete
                        const rows: any[] = this._iModelDb!.executeQuery(ChangeSummaryManager.buildPropertyValueChangesECSql(this._iModelDb!, instanceChange, ChangedValueState.BeforeDelete));
                        assert(rows.length === 1);
                        instanceChange.before = rows[0];
                        break;
                    }
                    default:
                        throw new Error("Unexpected ChangedOpCode " + instanceChange.opCode);
                }
                instanceChanges.push(instanceChange);
            }
            return instanceChanges;
        });

        // Write the change summary contents as JSON
        this._writeChangeSummaryToDisk(changeContent);

        // Detach change cache file for further extraction
        ChangeSummaryManager.detachChangeCache(this._iModelDb);

        return changeContent;
    }

    /** Clean up the test output directory to prepare for fresh output */
    private _initializeOutputDirectory() {
        const outputDir = QueryAgentConfig.outputDir;
        if (!fs.existsSync(outputDir))
            fs.mkdirSync(outputDir);
        const changeSummaryDir = QueryAgentConfig.changeSummaryDir;
        if (fs.existsSync(changeSummaryDir))
            this._deleteDirectory(changeSummaryDir);
        fs.mkdirSync(changeSummaryDir);
    }

    /** Write the change summary contents as JSON to disk */
    private _writeChangeSummaryToDisk(content: any) {
        const filePath = path.join(QueryAgentConfig.changeSummaryDir, `${content.id.value}.json`);

        // Dump the change summary
        fs.writeFileSync(filePath, JSON.stringify(content, (name, value) => {
            if (name === "opCode")
                return ChangeOpCode[value];

            if (name === "pushDate")
                return new Date(value).toLocaleString();

            return value;
        }, 2));

        Logger.logTrace(QueryAgentConfig.loggingCategory, `Wrote contents of change summary to ${filePath}`);
    }
    /** Utility to delete a directory that contains files */
    private _deleteDirectory(folderPath: string) {
        if (!fs.existsSync(folderPath))
            return;

        try {
            const files = fs.readdirSync(folderPath);
            for (const file of files) {
                const curPath = path.join(folderPath, file);
                try {
                    fs.unlinkSync(curPath);
                } catch (error) {
                    Logger.logError(QueryAgentConfig.loggingCategory, `Cannot delete file ${curPath}`);
                    throw error;
                }
            }
            try {
                fs.rmdirSync(folderPath);
            } catch (error) {
                Logger.logError(QueryAgentConfig.loggingCategory, `Cannot delete folder: ${folderPath}`);
                throw error;
            }
        } catch (error) {
        }
    }
}
