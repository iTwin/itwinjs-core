/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { GuidString, StopWatch } from "@bentley/bentleyjs-core";
import { Range3d, Point3d } from "@bentley/geometry-core";
import {
  AuthorizedClientRequestContext,
  ProjectShareClient, ProjectShareFolder, ProjectShareFile, ProjectShareFolderQuery, ProjectShareFileQuery,
} from "@bentley/imodeljs-clients";
import { JpegTagReader, ImageTags } from "../../JpegTagReader";
import { TestConfig } from "../TestConfig";

chai.should();

describe("JpegTagReader (#integration)", () => {
  const projectShareClient: ProjectShareClient = new ProjectShareClient();
  let projectId: GuidString;
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    requestContext = await TestConfig.getAuthorizedClientRequestContext();
    const project = await TestConfig.queryProject(requestContext, "iModelJsGeoPhotoTestProject");
    projectId = project.wsgId;
  });

  it("should be able to read tags from a jpeg image", async () => {
    const testImageFile = (await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().startsWithPathAndNameLike(projectId, "360-Images/2A", "2A_v0410470")))[0];

    const byteArray: Uint8Array = await projectShareClient.readFile(requestContext, testImageFile);
    const count = byteArray.length;
    chai.assert.isAbove(count, 100);

    const tags: ImageTags = JpegTagReader.readTags(byteArray.buffer);

    // Convert map to object
    const tagsObj = Object.create(null);
    for (const [k, v] of tags)
      tagsObj[k] = v;
    // console.log(JSON.stringify(tagsObj, null, "  ")); // tslint:disable-line:no-console

    chai.assert.strictEqual("N", tagsObj.GPSLatitudeRef);
    chai.assert.strictEqual(3, tagsObj.GPSLatitude.length);
    chai.assert.strictEqual(51, tagsObj.GPSLatitude[0]);
    chai.assert.strictEqual(55, tagsObj.GPSLatitude[1]);
    chai.assert.strictEqual(32.2, tagsObj.GPSLatitude[2]);

    chai.assert.strictEqual("W", tagsObj.GPSLongitudeRef);
    chai.assert.strictEqual(3, tagsObj.GPSLongitude.length);
    chai.assert.strictEqual(1, tagsObj.GPSLongitude[0]);
    chai.assert.strictEqual(0, tagsObj.GPSLongitude[1]);
    chai.assert.strictEqual(16.26, tagsObj.GPSLongitude[2]);

    chai.assert.strictEqual(0, tagsObj.GPSAltitudeRef);
    chai.assert.strictEqual(86.24, tagsObj.GPSAltitude);

    chai.assert.strictEqual("WGS-84", tagsObj.GPSMapDatum);
    chai.assert.strictEqual("Normal process", tagsObj.CustomRendered); // Panorama
  });

  it("should open multiple images to get the consolidated range", async () => {
    const subFolder2A: ProjectShareFolder = (await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().startsWithPathAndNameLike(projectId, "360-Images", "2A")))[0];
    const imageFiles: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().inFolder(subFolder2A.wsgId));

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

    // console.log(`Range is ${JSON.stringify(range.toJSON())}`); // tslint:disable-line:no-console
    // console.log(`Time taken to process ${imageFiles.length} images: ${watch.elapsedSeconds} seconds`); // tslint:disable-line:no-console
  });

  it("should be able to read tags from a jpeg image with large offsets in headers", async () => {
    const testImageFile = (await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().startsWithPathAndNameLike(projectId, "360-Images/2A", "V0130591")))[0];
    chai.assert.isDefined(testImageFile);

    const byteCount = 12000; // 12KB should be sufficient to read the GPS headers and Thumbnails
    const byteArray: Uint8Array = await projectShareClient.readFile(requestContext, testImageFile!, byteCount);
    const tags: ImageTags = JpegTagReader.readTags(byteArray.buffer);

    // Convert map to object
    const tagsObj = Object.create(null);
    for (const [k, v] of tags)
      tagsObj[k] = v;

    // console.log(JSON.stringify(tagsObj, null, "  ")); // tslint:disable-line:no-console
    chai.assert.strictEqual("N", tagsObj.GPSLatitudeRef);
    chai.assert.strictEqual(3, tagsObj.GPSLatitude.length);
    chai.assert.strictEqual(51, tagsObj.GPSLatitude[0]);
    chai.assert.strictEqual(54, tagsObj.GPSLatitude[1]);
    chai.assert.strictEqual(58.577682, tagsObj.GPSLatitude[2]);

    chai.assert.strictEqual("W", tagsObj.GPSLongitudeRef);
    chai.assert.strictEqual(3, tagsObj.GPSLongitude.length);
    chai.assert.strictEqual(1, tagsObj.GPSLongitude[0]);
    chai.assert.strictEqual(3, tagsObj.GPSLongitude[1]);
    chai.assert.strictEqual(19.386452, tagsObj.GPSLongitude[2]);

    chai.assert.strictEqual(0, tagsObj.GPSAltitudeRef);
    chai.assert.strictEqual(88.940155, tagsObj.GPSAltitude);
  });

});
