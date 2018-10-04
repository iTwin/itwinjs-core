/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
// import * as minimist from "minimist";
import { Config } from "@bentley/imodeljs-clients";

// const argv = minimist(process.argv);

export class QueryAgentConfig {
    private static _appPort = "agent_app_port";
    private static _appListenTime = "agent_app_listen_time";
    private static _appIModelName = "agent_app_imodel_name";
    private static _appProjectName = "agent_app_project_name";
    private static _appLoggingCategory = "agent_app_logging_category";
    private static _appOutputDir = "agent_app_output_dir";

    public static get port(): number {
        return Config.App.getNumber(QueryAgentConfig._appPort, 3000);
    }
    public static get listenTime(): number {
        return Config.App.getNumber(QueryAgentConfig._appListenTime, 40000);
    }
    public static get iModelName(): string {
        return Config.App.getString(QueryAgentConfig._appIModelName, "QueryAgentTestIModel"); // NodeJsTestProject
    }
    public static get projectName(): string {
        return Config.App.getString(QueryAgentConfig._appProjectName, "ChangesetUtility");
    }
    public static get loggingCategory(): string {
        return Config.App.getString(QueryAgentConfig._appLoggingCategory, "imodel-query-agent");
    }
    public static get outputDir(): string {
        return Config.App.getString(QueryAgentConfig._appOutputDir, path.join(__dirname, "output"));
    }
    public static get changeSummaryDir(): string {
        return path.join(QueryAgentConfig.outputDir, "changeSummaries");
    }
}
