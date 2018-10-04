/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
// import * as minimist from "minimist";
import { Config } from "@bentley/imodeljs-clients";

// const argv = minimist(process.argv);

export class ChangeSetUtilityConfig {
    private static _appIModelName = "agent_app_imodel_name";
    private static _appProjectName = "agent_app_project_name";
    private static _appUserEmail = "agent_app_user_name";
    private static _appUserPassword = "agent_app_user_password";
    private static _appLoggingCategory = "agent_app_logging_category";
    private static _appOutputDir = "agent_app_output_dir";
    private static _appNumChangesets = "agent_app_num_changesets";
    private static _appNumCreatedPerChangeset = "agent_app_num_created_per_changeset";
    private static _appChangesetPushDelay = "agent_app_changeset_push_delay";

    public static get numChangesets(): number {
        return Config.App.getNumber(ChangeSetUtilityConfig._appNumChangesets, 10);
    }
    public static get numCreatedPerChangeset(): number {
        return Config.App.getNumber(ChangeSetUtilityConfig._appNumCreatedPerChangeset, 50);
    }
    public static get changesetPushDelay(): number {
        return Config.App.getNumber(ChangeSetUtilityConfig._appChangesetPushDelay, 1000);
    }
    public static get iModelName(): string {
        return Config.App.getString(ChangeSetUtilityConfig._appIModelName, "QueryAgentTestIModel");
    }
    public static get projectName(): string {
        return Config.App.getString(ChangeSetUtilityConfig._appProjectName, "ChangesetUtility");
    }
    public static get userName(): string {
        return Config.App.getString(ChangeSetUtilityConfig._appUserEmail);
    }
    public static get userPassword(): string {
        return Config.App.getString(ChangeSetUtilityConfig._appUserPassword);
    }
    public static get loggingCategory(): string {
        return Config.App.getString(ChangeSetUtilityConfig._appLoggingCategory, "imodel-changeset-test-utility");
    }
    public static get outputDir(): string {
        return Config.App.getString(ChangeSetUtilityConfig._appOutputDir, path.join(__dirname, "output"));
    }

}
