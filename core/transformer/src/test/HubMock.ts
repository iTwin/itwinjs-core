/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { HubMock as BackendHubMock } from "@itwin/core-backend/lib/cjs/test/HubMock";
import { KnownTestLocations } from "./KnownTestLocations";

export class HubMock extends BackendHubMock {
  protected static override get knownTestLocations(): { outputDir: string, assetsDir: string } { return KnownTestLocations; }
}
