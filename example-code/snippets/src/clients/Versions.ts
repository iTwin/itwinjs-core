/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { IModelHubClient, AccessToken, ChangeSet, Version, VersionQuery, SmallThumbnail } from "@bentley/imodeljs-clients";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";

class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public toTokenString() { return ""; }
}

const alctx: ActivityLoggingContext = new ActivityLoggingContext("b0f0808d-e76f-4615-acf4-95aa1b78eba5");

const imodelHubClient: IModelHubClient = new IModelHubClient();
const token: AccessToken = new MockAccessToken();
const imodelId: Guid = new Guid(true);

async () => {
  // __PUBLISH_EXTRACT_START__ VersionHandler.create.example-code
  // Query all ChangeSets
  const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(alctx, token, imodelId);
  // Select one of the resulting ChangeSets
  const changeSetId: string = changeSets[0].id!;
  // Create a Named Version for that ChangeSet
  const createdVersion: Version = await imodelHubClient.Versions().create(alctx, token, imodelId, changeSetId, "Version name", "Version description");
  // __PUBLISH_EXTRACT_END__
  if (!createdVersion)
    return;
};

async () => {
  // __PUBLISH_EXTRACT_START__ VersionHandler.get.example-code
  // Query all Named Versions
  const allVersions: Version[] = await imodelHubClient.Versions().get(alctx, token, imodelId);
  // Query a single Named Version by its name
  const queryByName: VersionQuery = new VersionQuery().byName("Version name");
  const versionByName: Version[] = await imodelHubClient.Versions().get(alctx, token, imodelId, queryByName);
  // __PUBLISH_EXTRACT_END__

  if (!allVersions || !versionByName)
    return;
};

async () => {
  // __PUBLISH_EXTRACT_START__ VersionHandler.thumbnail.example-code
  // Query Named Version with its Thumbnail Id
  const thumbnailIdQuery: VersionQuery = new VersionQuery().byName("Version name").selectThumbnailId("Small");
  const versionWithThumbnailId: Version[] = await imodelHubClient.Versions().get(alctx, token, imodelId, thumbnailIdQuery);
  // Download the Thumbnail
  const thumbnail: SmallThumbnail = new SmallThumbnail();
  thumbnail.id = versionWithThumbnailId[0].smallThumbnailId!;
  const thumbnailContents: string = await imodelHubClient.Thumbnails().download(alctx, token, imodelId, thumbnail);
  // __PUBLISH_EXTRACT_END__
  if (!thumbnailContents)
    return;
};
