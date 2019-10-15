/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientRequestContext, GuidString, StopWatch } from "@bentley/bentleyjs-core";
import { Range3d, Point3d } from "@bentley/geometry-core";
import {
  AuthorizationToken, AuthorizedClientRequestContext,
  ProjectShareClient, ProjectShareFolder, ProjectShareFile, ProjectShareQuery,
} from "@bentley/imodeljs-clients";
import { JpegTagReader, ImageTags } from "../JpegTagReader";
import { TestConfig } from "./TestConfig";

chai.should();

describe("JpegTagReader (#integration)", () => {
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

  async function getFirstImageTestFile(): Promise<ProjectShareFile> {
    const subFolder2A: ProjectShareFolder = (await projectShareClient.getFolders(requestContext, projectId, new ProjectShareQuery().inPath(projectId, "360-Images")))[1];
    const imageFiles: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareQuery().inFolder(subFolder2A.wsgId));
    return imageFiles[0];
  }

  it("should be able to read tags from a jpeg image", async () => {
    const firstImageFile = await getFirstImageTestFile();

    const byteArray: Uint8Array = await projectShareClient.readFile(requestContext, firstImageFile);
    const count = byteArray.length;
    chai.assert.isAbove(count, 100);

    const tags: ImageTags = JpegTagReader.readTags(byteArray.buffer);

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

  it("should open multiple images to get the consolidated range", async () => {
    const subFolder2A: ProjectShareFolder = (await projectShareClient.getFolders(requestContext, projectId, new ProjectShareQuery().inPath(projectId, "360-Images")))[1];
    const imageFiles: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareQuery().inFolder(subFolder2A.wsgId));

    const watch: StopWatch = new StopWatch(`Time taken to process ${imageFiles.length} images`, true);

    const range: Range3d = new Range3d();
    range.setNull();
    const processLocations = new Array<Promise<void>>();
    for (const imageFile of imageFiles) {
      const processLocation: Promise<void> = projectShareClient.readFile(requestContext, imageFile, 10000)
        .then((byteArray: Uint8Array) => {
          const tags: ImageTags = JpegTagReader.readTags(byteArray.buffer);
          const latArr = tags.get("GPSLatitude") as number[];
          const latRef = tags.get("GPSLatitudeRef") as string;
          const lonArr = tags.get("GPSLongitude") as number[];
          const lonRef = tags.get("GPSLongitudeRef") as string;

          const lat = (latRef === "N" ? 1.0 : -1.0) * (latArr[0] + latArr[1] / 60 + latArr[2] / 3600);
          const lon = (lonRef === "E" ? 1.0 : -1.0) * (lonArr[0] + lonArr[1] / 60 + lonArr[2] / 3600);
          const alt = tags.get("GPSAltitude") as number;

          const latPnt = Point3d.create(lat, lon, alt);
          range.extend(latPnt); // Inside synchronous call that will only get processed for one point at a time
        });
      processLocations.push(processLocation);
    }
    await Promise.all(processLocations);
    watch.stop();

    console.log(`Range is ${JSON.stringify(range.toJSON())}`); // tslint:disable-line:no-console
    console.log(`Time taken to process ${imageFiles.length} images: ${watch.elapsedSeconds} seconds`); // tslint:disable-line:no-console
  });

});
