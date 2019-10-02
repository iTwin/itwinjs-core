/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientRequestContext, GuidString, StopWatch } from "@bentley/bentleyjs-core";
import { Range3d, Point3d } from "@bentley/geometry-core";
import { AuthorizationToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { ProjectShareClient, ProjectShareFolder, ProjectShareFile, ProjectShareQuery } from "../projectshare/ProjectShareClient";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";
import { KnownTestLocations } from "./KnownTestLocations";

import * as fs from "fs";
import * as path from "path";
import { ExifExtractor, ImageTags } from "./ExifExtractor";

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
    chai.assert.isAbove(imageFiles.length, 20);
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

  it("should be able to download a file", async () => {
    const firstImageFile = await getFirstImageTestFile();
    chai.assert.isDefined(firstImageFile.accessUrl);
    chai.assert.isAbove(firstImageFile.accessUrl!.length, 10);

    const imagePath = path.join(KnownTestLocations.outputDir, firstImageFile.name!);
    if (!fs.existsSync(KnownTestLocations.outputDir))
      fs.mkdirSync(KnownTestLocations.outputDir);
    else if (fs.existsSync(imagePath))
      fs.unlinkSync(imagePath);

    const byteArray: Uint8Array = await projectShareClient.downloadFile(requestContext, firstImageFile);
    const count = byteArray.length;
    chai.assert.isAbove(count, 100);

    const ws = fs.createWriteStream(imagePath);
    ws.write(byteArray);
    ws.end();
    ws.close();
    chai.assert.isTrue(fs.existsSync(imagePath));
  });

  it("should open multiple images to get the consolidated range", async () => {
    const subFolder2A: ProjectShareFolder = (await projectShareClient.getFolders(requestContext, projectId, new ProjectShareQuery().inPath(projectId, "360-Images")))[1];
    const imageFiles: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareQuery().inFolder(subFolder2A.wsgId));

    const watch: StopWatch = new StopWatch(`Time taken to process ${imageFiles.length} images`, true);
    const range: Range3d = new Range3d();
    range.setNull();
    for (const imageFile of imageFiles) {
      const byteArray: Uint8Array = await projectShareClient.downloadFile(requestContext, imageFile);
      const tags: ImageTags = ExifExtractor.extractFromJpeg(byteArray.buffer);

      const latArr = tags.get("GPSLatitude") as number[];
      const latRef = tags.get("GPSLatitudeRef") as string;
      const lonArr = tags.get("GPSLongitude") as number[];
      const lonRef = tags.get("GPSLongitudeRef") as string;

      const lat = (latRef === "N" ? 1.0 : -1.0) * (latArr[0] + latArr[1] / 60 + latArr[2] / 3600);
      const lon = (lonRef === "E" ? 1.0 : -1.0) * (lonArr[0] + lonArr[1] / 60 + lonArr[2] / 3600);
      const alt = tags.get("GPSAltitude") as number;

      const latPnt = Point3d.create(lat, lon, alt);
      range.extend(latPnt);
    }
    watch.stop();

    // console.log(`Range is ${JSON.stringify(range.toJSON())}`); // tslint:disable-line:no-console
    // console.log(`Time taken to process ${imageFiles.length} images: ${watch.elapsedSeconds} seconds`); // tslint:disable-line:no-console
  });

  it("should be able to extract image tags", async () => {
    const firstImageFile = await getFirstImageTestFile();

    const byteArray: Uint8Array = await projectShareClient.downloadFile(requestContext, firstImageFile);
    const count = byteArray.length;
    chai.assert.isAbove(count, 100);

    const tags: ImageTags = ExifExtractor.extractFromJpeg(byteArray.buffer);

    // Convert map to object
    const tagsObj = Object.create(null);
    for (const [k, v] of tags)
      tagsObj[k] = v;

    chai.assert.strictEqual("N", tagsObj.GPSLatitudeRef);
    chai.assert.strictEqual(3, tagsObj.GPSLatitude.length);
    chai.assert.strictEqual(51, tagsObj.GPSLatitude[0]);
    chai.assert.strictEqual(55, tagsObj.GPSLatitude[1]);
    chai.assert.strictEqual(29.07, tagsObj.GPSLatitude[2]);

    chai.assert.strictEqual("W", tagsObj.GPSLongitudeRef);
    chai.assert.strictEqual(3, tagsObj.GPSLongitude.length);
    chai.assert.strictEqual(1, tagsObj.GPSLongitude[0]);
    chai.assert.strictEqual(0, tagsObj.GPSLongitude[1]);
    chai.assert.strictEqual(36.51, tagsObj.GPSLongitude[2]);

    chai.assert.strictEqual(0, tagsObj.GPSAltitudeRef);
    chai.assert.strictEqual(85.2, tagsObj.GPSAltitude);

    chai.assert.strictEqual("WGS-84", tagsObj.GPSMapDatum);
    chai.assert.strictEqual("Normal process", tagsObj.CustomRendered); // Should say "Panaroma", but perhaps that works only on iOS cameras??

    // console.log(JSON.stringify(tagsObj, null, "  ")); // tslint:disable-line:no-console
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
