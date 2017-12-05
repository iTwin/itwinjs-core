import { AccessToken } from "@bentley/imodeljs-clients";
import { ConnectClient, IModelHubClient } from "@bentley/imodeljs-clients";
export declare class TestData {
    static user: {
        email: string;
        password: string;
    };
    static connectClient: ConnectClient;
    static hubClient: IModelHubClient;
    static getTestUserAccessToken(): Promise<AccessToken>;
    static getTestProjectId(accessToken: AccessToken, projectName: string): Promise<string>;
    static getTestIModelId(accessToken: AccessToken, projectId: string, iModelName: string): Promise<string>;
}
