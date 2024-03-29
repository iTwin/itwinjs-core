/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { join } from "path";
import { tmpdir } from "os";
import { ProcessDetector } from "@itwin/core-bentley";

export class KnownTestLocations {

  /** The directory where test assets are stored. Keep in mind that the test is playing the role of the app. */
  public static get assetsDir(): string {
    if (ProcessDetector.isMobileAppBackend) {
      // Note: this relies on the native test runner copying its assets out of its app wrapper into
      // its tmpdir before running the tests.
      return join(tmpdir(), "assets");
    }

    return join(__dirname, "assets");
  }

  /** The directory where tests can write. */
  public static get outputDir(): string {
    if (ProcessDetector.isMobileAppBackend) {
      return join(tmpdir(), "output");
    }

    // Assume that we are running in nodejs
    return join(__dirname, "output");
  }
}
