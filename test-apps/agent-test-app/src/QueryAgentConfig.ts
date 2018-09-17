import { DeploymentEnv } from "@bentley/imodeljs-clients/lib";
import * as path from "path";
import * as minimist from "minimist";

import { IHubProjectConfig } from "./changeSetUtility";

/** Credentials for test users */
export interface UserCredentials {
    email: string;
    password: string;
}
/* Command line argument object */
const argv = minimist(process.argv);
/* Configuration for Query Agent: uses provided command if necessary first, second it will attempt to look
   for the npm config generated environemnt variable, third it will use hard coded values. */
export class QueryAgentConfig implements IHubProjectConfig {
    public readonly port: number = argv.port || process.env.npm_package_config_port || 3000;
    public readonly listenTime: number = argv.listenFor || parseFloat(process.env.npm_package_config_listen_time!) || 60 * 1000;
    public readonly imsDeploymentEnv: DeploymentEnv = (argv.imsEnv || process.env.npm_package_config_ims_deployment_env) as DeploymentEnv || "QA";
    public readonly hubDeploymentEnv: DeploymentEnv = (argv.hubEnv || process.env.npm_package_config_hub_deployment_env) as DeploymentEnv || "QA";
    public static readonly loggingCategory = process.env.npm_package_config_logging_category || "imodel-query-agent";
    public static readonly outputDir = argv.outputDir || process.env.npm_package_config_output_dir || path.join(__dirname, "output");
    public static readonly changeSummaryDir = path.join(QueryAgentConfig.outputDir, "ChangeSummaries");
    public readonly projectName = argv.projectName || process.env.npm_package_config_project_name || "NodeJsTestProject";
    public readonly iModelName = argv.iModelName || process.env.npm_package_config_imodel_name || "ChangesetUtility";
    public readonly user: UserCredentials = this._getCredentials();
    private _getCredentials(): UserCredentials {
        // both must be provided via command line arguments in order to be used
        const user: UserCredentials = {
            email: process.env.npm_package_config_email! || process.env.email!,
            password: process.env.npm_package_config_password! || process.env.password!,
        };
        if (argv.email && argv.password) {
            user.email = argv.email;
            user.password = argv.password;
        }
        if (!(user.email && user.password))
            throw new Error("Must provide a email and password. Add them in package.json, using email and password environment variables, or by using '--email=your@email.com' and '--password=yourPass' with the cli");

        return user;
    }
}
