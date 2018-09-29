/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DeploymentEnv } from "@bentley/imodeljs-clients/lib";
import * as path from "path";
import * as minimist from "minimist";
/** Credentials for test users */
export interface UserCredentials {
    email: string;
    password: string;
}
/** Configuration for IModel Hub Project */
export interface IHubProjectConfig {
    readonly imsDeploymentEnv: DeploymentEnv;
    readonly hubDeploymentEnv: DeploymentEnv;
    readonly projectName: string;
    readonly iModelName: string;
    readonly user: UserCredentials;
}

const argv = minimist(process.argv);
const environments: string[] = [ "DEV", "QA", "PROD", "PERF" ];
export class ChangesetGenerationConfig implements IHubProjectConfig {
    public readonly imsDeploymentEnv: DeploymentEnv = argv.imsEnv in environments ? argv.imsEnv :
        process.env.npm_package_config_ims_deployment_env as DeploymentEnv || "QA";
    public readonly hubDeploymentEnv: DeploymentEnv = argv.hubEnv in environments ? argv.hubEnv :
        process.env.npm_package_config_hub_deployment_env as DeploymentEnv || "QA";
    public readonly projectName = argv.projectName || process.env.npm_package_config_project_name || "NodeJsTestProject";
    public readonly iModelName = argv.iModelName || process.env.npm_package_config_imodel_name || "ChangesetUtility";
    public static readonly loggingCategory = process.env.npm_package_config_logging_category || "imodel-changeset-test-utility";
    public readonly outputDir = argv.outputDir || process.env.npm_package_config_out_dir || path.join(__dirname, "output");
    public readonly user: UserCredentials = this._getCredentials();
    public readonly numChangesets: number =
        parseInt(argv.numChangesets || process.env.npm_package_config_num_changesets!, 10) || 10;
    public readonly numCreatedPerChangeset: number =
        parseInt(argv.numCreatedPerChangeset || process.env.npm_package_config_num_created_per_changeset!, 10) || 50;
    public readonly changesetPushDelay: number =
        parseInt(argv.changesetPushDelay || process.env.npm_package_config_changeset_push_delay, 10) || 1000;
    private _getCredentials(): UserCredentials {
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
