/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientRequestContext, GuidString } from "@bentley/bentleyjs-core";
import { AuthorizationToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { ProjectShareClient, ProjectShareFolder, ProjectShareFile, ProjectShareQuery } from "../projectshare/ProjectShareClient";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";

chai.should();

/**
 * Defects for the Project Share Service team:
 * + File search by path does not work as expected (see skipped test below)
 * + Custom property update/delete based on "change sets" in the REST API documentation doesn't work as expected,
 *   or in the best case is not clear.
 *
 * Project Share Client API TODOs:
 * + Add an id field, and replace all wsgIds with ids - including parentFolderWsgId
 * + Move tests out of the node.js environment to a web environment using puppeteer
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

  it("should be able to retrieve folders in a specified path", async () => {
    const query = new ProjectShareQuery().inPath(projectId, "360-Images");
    const folders: ProjectShareFolder[] = await projectShareClient.getFolders(requestContext, projectId, query);
    chai.assert.strictEqual(2, folders.length);
  });

  it.skip("should be able to retrieve files in a specified path", async () => {
    // TBD: This does NOT work yet!!!
    const query = new ProjectShareQuery().inPath(projectId, "360-Images/2A");
    const files: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, query);
    chai.assert.isAbove(files.length, 20);
  });

  it("should be able to retrieve a list of folders and files", async () => {
    const folders: ProjectShareFolder[] = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareQuery().inRootFolder(projectId));
    chai.assert(folders);
    chai.assert.strictEqual(1, folders.length);
    chai.assert.strictEqual("360-Images", folders[0].name);

    const files: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareQuery().inRootFolder(projectId));
    chai.assert(files);
    chai.assert.strictEqual(0, files.length);

    const subFolders: ProjectShareFolder[] = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareQuery().inFolder(folders[0].wsgId));
    chai.assert(subFolders);
    chai.assert.strictEqual(2, subFolders.length);

    const subFolder2A = subFolders[1];
    chai.assert.strictEqual("2A", subFolder2A.name);

    const imageFiles: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareQuery().inFolder(subFolder2A.wsgId));
    chai.assert(imageFiles);
    chai.assert.isAtLeast(imageFiles.length, 18);
  });

  async function getFirstImageTestFile(): Promise<ProjectShareFile> {
    const subFolder2A: ProjectShareFolder = (await projectShareClient.getFolders(requestContext, projectId, new ProjectShareQuery().inPath(projectId, "360-Images")))[1];
    const imageFiles: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareQuery().inFolder(subFolder2A.wsgId));
    return imageFiles[0];
  }

  it("should be able to retrieve folder and file by id", async () => {
    const firstImageFile = await getFirstImageTestFile();

    const retFile = (await projectShareClient.getFiles(requestContext, projectId, new ProjectShareQuery().byWsgIds(firstImageFile.wsgId)))[0];
    chai.assert.strictEqual(retFile.wsgId, firstImageFile.wsgId);

    const retFolder = (await projectShareClient.getFolders(requestContext, projectId, new ProjectShareQuery().byWsgIds(firstImageFile.parentFolderWsgId!)))[0];
    chai.assert.strictEqual(retFolder.wsgId, firstImageFile.parentFolderWsgId);
  });

  it("should be able to retrieve multiple folders by id", async () => {
    // TODO: Does not work as expected - needs to be fixed!!!
    const subFolders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareQuery().inPath(projectId, "360-Images"));
    const retFolders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareQuery().byWsgIds(subFolders[0].wsgId, subFolders[1].wsgId));
    chai.assert.strictEqual(2, retFolders.length);
    chai.assert.strictEqual(subFolders[0].wsgId, retFolders[0].wsgId);
    chai.assert.strictEqual(subFolders[1].wsgId, retFolders[1].wsgId);
  });

  it("should be able to CRUD custom properties", async () => {
    const firstImageFile = await getFirstImageTestFile();

    // Create custom properties and validate returned file
    const createCustomProperties = [
      {
        Name: "testKey1",
        Value: "testValue1",
      },
      {
        Name: "TestKey2",
        Value: "TestValue2",
      },
    ];
    const retFile: ProjectShareFile = await projectShareClient.updateCustomProperties(requestContext, projectId, firstImageFile, createCustomProperties);
    chai.assert.isDefined(retFile.customProperties);
    chai.assert.strictEqual(2, retFile.customProperties.length);
    chai.assert.strictEqual("testKey1", retFile.customProperties[0].Name);
    chai.assert.strictEqual("testValue1", retFile.customProperties[0].Value);
    chai.assert.strictEqual("TestKey2", retFile.customProperties[1].Name);
    chai.assert.strictEqual("TestValue2", retFile.customProperties[1].Value);

    // Get the updated file again and validate it
    const retFile2: ProjectShareFile = (await projectShareClient.getFiles(requestContext, projectId, new ProjectShareQuery().byWsgIds(firstImageFile.wsgId)))[0];
    chai.assert.strictEqual(2, retFile2.customProperties.length);
    chai.assert.strictEqual("testKey1", retFile2.customProperties[0].Name);
    chai.assert.strictEqual("testValue1", retFile2.customProperties[0].Value);
    chai.assert.strictEqual("TestKey2", retFile2.customProperties[1].Name);
    chai.assert.strictEqual("TestValue2", retFile2.customProperties[1].Value);

    // Update a custom property and validate
    const updateCustomProperties = [
      {
        Name: "testKey1",
        Value: "testUpdatedValue1",
      },
    ];
    const retFile3: ProjectShareFile = await projectShareClient.updateCustomProperties(requestContext, projectId, firstImageFile, updateCustomProperties);
    chai.assert.strictEqual(1, retFile3.customProperties.length);
    chai.assert.strictEqual("testKey1", retFile3.customProperties[0].Name);
    chai.assert.strictEqual("testUpdatedValue1", retFile3.customProperties[0].Value);

    // Get the updated file again and validate it
    const retFile4: ProjectShareFile = (await projectShareClient.getFiles(requestContext, projectId, new ProjectShareQuery().byWsgIds(firstImageFile.wsgId)))[0];
    chai.assert.strictEqual(1, retFile4.customProperties.length);
    chai.assert.strictEqual("testKey1", retFile4.customProperties[0].Name);
    chai.assert.strictEqual("testUpdatedValue1", retFile4.customProperties[0].Value);
  });

});
