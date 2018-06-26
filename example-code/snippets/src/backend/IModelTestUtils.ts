/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { RpcManager, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { OpenMode } from "@bentley/bentleyjs-core";
import { AccessToken, AuthorizationToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, ConnectClient, DeploymentEnv } from "@bentley/imodeljs-clients";
import { IModelDb, IModelHost, IModelHostConfiguration, KnownLocations } from "@bentley/imodeljs-backend";
import { IModelJsFs, IModelJsFsStats } from "@bentley/imodeljs-backend/lib/IModelJsFs";
import * as path from "path";

RpcManager.initializeInterface(IModelReadRpcInterface);

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
export class TestUsers {
  /** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
  public static readonly regular: UserCredentials = {
    email: "Regular.IModelJsTestUser@mailinator.com",
    password: "Regular@iMJs",
  };
}

export class KnownTestLocations {

  /** The directory where test assets are stored. Keep in mind that the test is playing the role of the app. */
  public static get assetsDir(): string {
    // Assume that we are running in nodejs
    return path.join(__dirname, "assets");
  }

  /** The directory where tests can write. */
  public static get outputDir(): string {
    // Assume that we are running in nodejs
    return path.join(__dirname, "output");
  }

}

export class IModelTestUtils {
  public static hubDeploymentEnv: DeploymentEnv = "QA";

  private static _connectClient: ConnectClient | undefined;
  public static get connectClient(): ConnectClient {
    if (!IModelTestUtils._connectClient)
      IModelTestUtils._connectClient = new ConnectClient(IModelTestUtils.hubDeploymentEnv);
    return IModelTestUtils._connectClient!;
  }

  public static async getTestUserAccessToken(userCredentials?: any): Promise<AccessToken> {
    if (userCredentials === undefined)
      userCredentials = TestUsers.regular;
    const env = IModelTestUtils.hubDeploymentEnv;
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient(env)).getToken(userCredentials.email, userCredentials.password);
    assert(authToken);

    const accessToken = await (new ImsDelegationSecureTokenClient(env)).getToken(authToken!);
    assert(accessToken);

    return accessToken;
  }

  private static getStat(name: string) {
    let stat: IModelJsFsStats | undefined;
    try {
      stat = IModelJsFs.lstatSync(name);
    } catch (err) {
      stat = undefined;
    }
    return stat;
  }

  public static openIModel(filename: string, opts?: IModelTestUtilsOpenOptions): IModelDb {
    const destPath = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(destPath))
      IModelJsFs.mkdirSync(destPath);

    if (opts === undefined)
      opts = {};

    const srcName = path.join(KnownTestLocations.assetsDir, filename);
    const dbName = path.join(destPath, (opts.copyFilename ? opts.copyFilename! : filename));
    const srcStat = IModelTestUtils.getStat(srcName);
    const destStat = IModelTestUtils.getStat(dbName);
    if (!srcStat || !destStat || srcStat.mtimeMs !== destStat.mtimeMs) {
      IModelJsFs.copySync(srcName, dbName, { preserveTimestamps: true });
    }

    const iModel: IModelDb = IModelDb.openStandalone(dbName, opts.openMode, opts.enableTransactions); // could throw Error
    assert.exists(iModel);
    return iModel!;
  }

  // __PUBLISH_EXTRACT_START__ IModelHost.startup
  public static startupIModelHost() {
    // The host configuration.
    // The defaults will work for most backends.
    // Here is an example of how the briefcasesCacheDir property of the host configuration
    // could be set from an environment variable, which could be set by a cloud deployment mechanism.
    let briefcaseCacheDir = process.env.MY_SERVICE_BRIEFCASES_DIR;
    if (briefcaseCacheDir === undefined) {
      const tempDir = process.env.MY_SERVICE_TMP_DIR || KnownLocations.tmpdir;
      briefcaseCacheDir = path.join(tempDir, "iModelJs_cache");
    }

    const imHostConfig = new IModelHostConfiguration();
    imHostConfig.briefcaseCacheDir = briefcaseCacheDir;

    // Start up IModelHost, supplying the configuration.
    IModelHost.startup(imHostConfig);
  }
  // __PUBLISH_EXTRACT_END__

}

// Start the backend
IModelTestUtils.startupIModelHost();
