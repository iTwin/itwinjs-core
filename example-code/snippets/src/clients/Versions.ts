/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, Guid, GuidString } from "@itwin/core-bentley";
import { ChangeSet, IModelHubClient, Version, VersionQuery } from "@bentley/imodelhub-client";

const imodelHubClient: IModelHubClient = new IModelHubClient();
const accessToken: AccessToken = "";
const imodelId: GuidString = Guid.createValue();

// enclosing function avoids compile errors and code analysis report.
export async function test1() {
  // __PUBLISH_EXTRACT_START__ VersionHandler.create.example-code
  // Query all ChangeSets
  const changeSets: ChangeSet[] = await imodelHubClient.changeSets.get(accessToken, imodelId);
  // Select one of the resulting ChangeSets
  const changeSetId: string = changeSets[0].id!;
  // Create a Named Version for that ChangeSet
  const createdVersion: Version = await imodelHubClient.versions.create(accessToken, imodelId, changeSetId, "Version name", "Version description");
  // __PUBLISH_EXTRACT_END__
  if (!createdVersion)
    return;
}

// enclosing function avoids compile errors and code analysis report.
export async function test2() {
  // __PUBLISH_EXTRACT_START__ VersionHandler.get.example-code
  // Query all Named Versions
  const allVersions: Version[] = await imodelHubClient.versions.get(accessToken, imodelId);
  // Query a single Named Version by its name
  const queryByName: VersionQuery = new VersionQuery().byName("Version name");
  const versionByName: Version[] = await imodelHubClient.versions.get(accessToken, imodelId, queryByName);
  // __PUBLISH_EXTRACT_END__

  if (!allVersions || !versionByName)
    return;
}
