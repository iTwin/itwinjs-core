/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { Platform } from "@bentley/imodeljs-backend";

export class KnownTestLocations {

  /** The directory where test assets are stored. Keep in mind that the test is playing the role of the app. */
  public static get assetsDir(): string {
    const imodeljsMobile = Platform.imodeljsMobile;
    if (imodeljsMobile !== undefined) {
      return imodeljsMobile.knownLocations.assetsDir;
    }

    // Assume that we are running in nodejs
    return path.join(__dirname, "assets");
  }

  /** The directory where tests can write. */
  public static get outputDir(): string {
    const imodeljsMobile = Platform.imodeljsMobile;
    if (imodeljsMobile !== undefined) {
      return imodeljsMobile.knownLocations.tempDir;
    }

    // Assume that we are running in nodejs
    return path.join(__dirname, "output");
  }

}
