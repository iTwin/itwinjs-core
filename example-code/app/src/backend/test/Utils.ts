/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelJsFs } from "@bentley/imodeljs-backend/lib/IModelJsFs";
import * as path from "path";
import { AuthorizationToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AccessToken, Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

/** Credentials for test users */
export interface UserCredentials {
  email: string;
  password: string;
}

/** Test users with various permissions */
export class TestUsers {
  /** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
  public static get regular(): UserCredentials {
    return {
      email: Config.App.getString("imjs_test_regular_user_name"),
      password: Config.App.getString("imjs_test_regular_user_password"),
    };
  }
  public static get superManager(): UserCredentials {
    return {
      email: Config.App.getString("imjs_test_super_manager_user_name"),
      password: Config.App.getString("imjs_test_super_manager_user_password"),
    };
  }
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
  // __PUBLISH_EXTRACT_START__ Bridge.getAccessToken.example-code
  public static async getAccessToken(activityContext: ActivityLoggingContext, userCredentials: any): Promise<AccessToken> {
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(activityContext, userCredentials.email, userCredentials.password);
    assert(authToken);
    const accessToken = await (new ImsDelegationSecureTokenClient()).getToken(activityContext, authToken!);
    assert(accessToken);
    return accessToken;
  }
  // __PUBLISH_EXTRACT_END__

  /** Prepare for an output file by:
   * - Resolving the output file name under the known test output directory
   * - Making directories as necessary
   * - Removing a previous copy of the output file
   * @param fileName Name of output fille
   * @returns The full path to the output file
   */
  public static prepareOutputFile(fileName: string): string {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);

    const outputFile = path.join(KnownTestLocations.outputDir, fileName);
    if (IModelJsFs.existsSync(outputFile))
      IModelJsFs.unlinkSync(outputFile);

    return outputFile;
  }

  /** Resolve an asset file path from the asset name by looking in the known assets directory */
  public static resolveAssetFile(assetName: string): string {
    const assetFile = path.join(KnownTestLocations.assetsDir, assetName);
    assert.isTrue(IModelJsFs.existsSync(assetFile));
    return assetFile;
  }
}
