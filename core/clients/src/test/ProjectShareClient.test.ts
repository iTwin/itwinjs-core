/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientRequestContext, GuidString } from "@bentley/bentleyjs-core";
import { AuthorizationToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { ProjectShareClient, ProjectShareFolder, ProjectShareFile, ProjectShareFileQuery, ProjectShareFolderQuery } from "../projectshare/ProjectShareClient";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";

chai.should();

/**
 * Project Share Client API TODOs:
 * + Add an id field, and replace all wsgIds with ids - including parentFolderWsgId
 * + Setup OIDC authentication for tests instead of IMS
 */

describe("ProjectShareClient (#integration)", () => {
  const projectShareClient: ProjectShareClient = new ProjectShareClient();
  let projectId: GuidString;

  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    const authToken: AuthorizationToken = await TestConfig.login();
    const accessToken = await projectShareClient.getAccessToken(new ClientRequestContext(), authToken);
    requestContext = new AuthorizedClientRequestContext(accessToken);

    const project = await TestConfig.queryProject(requestContext, "iModelJsIntegrationTest");
    projectId = project.wsgId;
  });

  it("should be able to query folders with different options", async () => {
    // inRootFolder
    let folders: ProjectShareFolder[] = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().inRootFolder(projectId));
    chai.assert.strictEqual(1, folders.length);
    const folder360Images = folders[0];
    chai.assert.strictEqual(folder360Images.name, "360-Images");

    // inFolder
    folders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().inFolder(folder360Images.wsgId));
    chai.assert.strictEqual(2, folders.length);
    let folder2A = folders[0];
    let folder2B = folders[1];
    chai.assert.strictEqual(folder2B.name, "2B");
    chai.assert.strictEqual(folder2A.name, "2A");

    // byWsgIds
    folders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().byWsgIds(folder2B.wsgId, folder2A.wsgId));
    chai.assert.strictEqual(2, folders.length);
    chai.assert.strictEqual(folder2B.wsgId, folders[0].wsgId);
    chai.assert.strictEqual(folder2A.wsgId, folders[1].wsgId);

    // inPath
    folders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().inPath(projectId, "360-Images"));
    chai.assert.strictEqual(2, folders.length);
    folder2A = folders[0];
    folder2B = folders[1];
    chai.assert.strictEqual(folder2B.name, "2B");
    chai.assert.strictEqual(folder2A.name, "2A");

    // inFolderWithNameLike
    folders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().inFolderWithNameLike(folder360Images.wsgId, "2*"));
    chai.assert.strictEqual(2, folders.length);
    folder2A = folders[0];
    folder2B = folders[1];
    chai.assert.strictEqual(folder2B.name, "2B");
    chai.assert.strictEqual(folder2A.name, "2A");

    // startsWithPathAndNameLike
    folders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().startsWithPathAndNameLike(projectId, "360-Images", "2A"));
    chai.assert.strictEqual(1, folders.length);
    folder2A = folders[0];
    chai.assert.strictEqual(folder2A.name, "2A");
    folders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().startsWithPathAndNameLike(projectId, "360-Images", "*"));
    chai.assert.strictEqual(3, folders.length);
  });

  it("should be able to query files with different options", async () => {
    const folder360Images = (await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().inRootFolder(projectId)))[0];
    const subFolders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().inFolder(folder360Images.wsgId));
    const folder2A = subFolders[0];
    const folder2B = subFolders[1];

    // inRootFolder
    let files: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().inRootFolder(projectId));
    chai.assert(files);
    chai.assert.strictEqual(0, files.length);

    // inFolder
    files = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().inFolder(folder2A.wsgId));
    chai.assert(files);
    chai.assert.strictEqual(files.length, 18);
    files = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().inFolder(folder2B.wsgId));
    chai.assert(files);
    chai.assert.strictEqual(files.length, 0);

    // startsWithPath
    files = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().startsWithPath(projectId, "360-Images/2A"));
    chai.assert(files);
    chai.assert.isAtLeast(files.length, 28);

    // inFolderWithNameLike
    files = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().inFolderWithNameLike(folder2A.wsgId, "2A_v0410462"));
    chai.assert(files);
    chai.assert.strictEqual(files.length, 1);
    let firstImage = files[0];
    chai.assert.strictEqual(firstImage.name, "2A_v0410462.jpg");

    // startsWithPathAndNameLike
    files = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().startsWithPathAndNameLike(projectId, "360-Images/2A", "2A_v0410470"));
    chai.assert(files);
    chai.assert.strictEqual(files.length, 1);
    let secondImage = files[0];
    chai.assert.strictEqual(secondImage.name, "2A_v0410470.jpg");

    // byWsgIds
    files = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().byWsgIds(firstImage.wsgId, secondImage.wsgId));
    chai.assert.strictEqual(2, files.length);
    firstImage = files[0];
    chai.assert.strictEqual(firstImage.name, "2A_v0410462.jpg");
    secondImage = files[1];
    chai.assert.strictEqual(secondImage.name, "2A_v0410470.jpg");
  });

  it("should be able to CRUD custom properties", async () => {
    const firstImageFile = (await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().startsWithPathAndNameLike(projectId, "360-Images/2A", "2A_v0410470")))[0];

    // Delete any existing custom properties due to incomplete test runs
    if (firstImageFile.customProperties !== undefined && (firstImageFile.customProperties as any[]).length > 0) {
      const deleteProps = (firstImageFile.customProperties as any[]).map((entry: any) => entry.Name);
      await projectShareClient.updateCustomProperties(requestContext, projectId, firstImageFile, undefined, deleteProps);
    }

    // Create custom properties and validate returned file
    const createCustomProperties = [
      {
        Name: "TestKey1",
        Value: "TestValue1",
      },
      {
        Name: "TestKey2",
        Value: "TestValue2",
      },
    ];
    const retFile: ProjectShareFile = await projectShareClient.updateCustomProperties(requestContext, projectId, firstImageFile, createCustomProperties);
    chai.assert.isDefined(retFile.customProperties);
    chai.assert.strictEqual(2, retFile.customProperties.length);
    chai.assert.strictEqual("TestKey1", retFile.customProperties[0].Name);
    chai.assert.strictEqual("TestValue1", retFile.customProperties[0].Value);
    chai.assert.strictEqual("TestKey2", retFile.customProperties[1].Name);
    chai.assert.strictEqual("TestValue2", retFile.customProperties[1].Value);

    // Get the updated file again and validate it
    const retFile2: ProjectShareFile = (await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().byWsgIds(firstImageFile.wsgId)))[0];
    chai.assert.strictEqual(2, retFile2.customProperties.length);
    chai.assert.strictEqual("TestKey1", retFile2.customProperties[0].Name);
    chai.assert.strictEqual("TestValue1", retFile2.customProperties[0].Value);
    chai.assert.strictEqual("TestKey2", retFile2.customProperties[1].Name);
    chai.assert.strictEqual("TestValue2", retFile2.customProperties[1].Value);

    // Update a custom property and validate
    const updateCustomProperties = [
      {
        Name: "TestKey1",
        Value: "TestUpdatedValue1",
      },
    ];
    const retFile3: ProjectShareFile = await projectShareClient.updateCustomProperties(requestContext, projectId, firstImageFile, updateCustomProperties);
    chai.assert.strictEqual(2, retFile3.customProperties.length);
    chai.assert.strictEqual("TestKey1", retFile3.customProperties[0].Name);
    chai.assert.strictEqual("TestUpdatedValue1", retFile3.customProperties[0].Value);
    chai.assert.strictEqual("TestKey2", retFile3.customProperties[1].Name);
    chai.assert.strictEqual("TestValue2", retFile3.customProperties[1].Value);

    // Get the updated file again and validate it
    const retFile4: ProjectShareFile = (await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().byWsgIds(firstImageFile.wsgId)))[0];
    chai.assert.strictEqual(2, retFile4.customProperties.length);
    chai.assert.strictEqual("TestKey1", retFile4.customProperties[0].Name);
    chai.assert.strictEqual("TestUpdatedValue1", retFile4.customProperties[0].Value);
    chai.assert.strictEqual("TestKey2", retFile4.customProperties[1].Name);
    chai.assert.strictEqual("TestValue2", retFile4.customProperties[1].Value);

    // Delete a custom property and validate
    const deleteProperties = ["TestKey2", "TestKey1"];
    const retFile5: ProjectShareFile = await projectShareClient.updateCustomProperties(requestContext, projectId, firstImageFile, undefined, deleteProperties);
    chai.assert.strictEqual(0, retFile5.customProperties.length);

    // Get the updated file again and validate it
    const retFile6: ProjectShareFile = (await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().byWsgIds(firstImageFile.wsgId)))[0];
    chai.assert.strictEqual(0, retFile6.customProperties.length);
  });

});
