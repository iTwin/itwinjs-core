import { OpenMode } from "@bentley/bentleyjs-core";
import { AccessToken, ConnectClient, DeploymentEnv } from "@bentley/imodeljs-clients";
import { IModelDb } from "@bentley/imodeljs-backend";
export interface IModelTestUtilsOpenOptions {
    copyFilename?: string;
    enableTransactions?: boolean;
    openMode?: OpenMode;
}
/** Credentials for test users */
export interface UserCredentials {
    email: string;
    password: string;
}
/** Test users with various permissions */
export declare class TestUsers {
    /** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
    static readonly regular: UserCredentials;
}
export declare class KnownTestLocations {
    /** The directory where test assets are stored. Keep in mind that the test is playing the role of the app. */
    static readonly assetsDir: string;
    /** The directory where tests can write. */
    static readonly outputDir: string;
}
export declare class IModelTestUtils {
    static iModelHubDeployConfig: DeploymentEnv;
    private static _connectClient;
    static readonly connectClient: ConnectClient;
    static getTestUserAccessToken(userCredentials?: any): Promise<AccessToken>;
    private static getStat(name);
    static openIModel(filename: string, opts?: IModelTestUtilsOpenOptions): IModelDb;
    static startupIModelHost(): void;
}
