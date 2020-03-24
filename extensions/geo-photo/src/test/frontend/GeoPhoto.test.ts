/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString, OpenMode, StopWatch } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, HubIModel, ProjectShareClient } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import { BriefcaseConnection, IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { TestAuthorizationClient } from "@bentley/oidc-signin-tool/lib/TestUsers";
import * as chai from "chai";
import { PhotoFile, PhotoFolder, PhotoTree } from "../../PhotoTree";
import { ProjectShareHandler, PSPhotoFile } from "../../ProjectSharePhotoTree";
import { TestConfig } from "../TestConfig";

chai.should();

/** Test utility that exercises various geo photo tag operations */
export class GeoPhotoTest {
  private _currentCount = 0;
  private _totalCount = 0;
  private _projectShareClient = new ProjectShareClient();

  public constructor(private _requestContext: AuthorizedClientRequestContext, private _iModel: IModelConnection, private _treeHandler: ProjectShareHandler) {
  }

  private async deleteFileTag(file: PhotoFile, _folder: PhotoFolder): Promise<void> {
    // console.log(`Deleting tag for file ${this._currentCount}: ${file.name}`); // tslint:disable-line:no-console
    this._currentCount++;

    const psFile = file as PSPhotoFile;
    await this._treeHandler.deleteCustomInfo(this._requestContext, this._iModel.iModelToken.contextId!, psFile);
  }

  public async deleteTags(folder: PhotoFolder, subFolders: boolean): Promise<void> {
    this._currentCount = 0;
    await folder.traversePhotos(this.deleteFileTag.bind(this), undefined, subFolders, false);
  }

  private async validateFileTag(file: PhotoFile, folder: PhotoFolder): Promise<void> {
    // console.log(`Validating tag for file ${this._currentCount}: ${file.name}`); // tslint:disable-line:no-console
    this._currentCount++;

    const psFile = file as PSPhotoFile;

    const tags = this._treeHandler.readCustomInfo(psFile);
    chai.assert.isDefined(tags, `Tags were not defined for file ${file.name} in folder ${folder.name}`);
    chai.assert.isDefined(tags!.geoLoc);
    chai.assert.isDefined(tags!.track);
    chai.assert.isDefined(tags!.time);
    chai.assert.isDefined(tags!.isPano);

    const isValid = this._treeHandler.validateCustomInfo(psFile, tags!);
    chai.assert.isTrue(isValid, `Tags were not valid for file ${file.name} in folder ${folder.name}`);
  }

  public async validateTags(folder: PhotoFolder, subFolders: boolean): Promise<void> {
    this._currentCount = 0;
    await folder.traversePhotos(this.validateFileTag.bind(this), undefined, subFolders, false);
  }

  private async validateDeletedFileTag(file: PhotoFile, folder: PhotoFolder): Promise<void> {
    // console.log(`Validating deleted tag for file ${this._currentCount}: ${file.name}`); // tslint:disable-line:no-console
    this._currentCount++;

    const psFile = file as PSPhotoFile;
    const tags = this._treeHandler.readCustomInfo(psFile);
    chai.assert.isUndefined(tags, `Tags were not deleted for file ${file.name} in folder ${folder.name}`);
  }

  public async validateDeletedTags(folder: PhotoFolder, subFolders: boolean): Promise<void> {
    this._currentCount = 0;
    await folder.traversePhotos(this.validateDeletedFileTag.bind(this), undefined, subFolders, false);
  }

  private async updateFileTag(file: PhotoFile, _folder: PhotoFolder): Promise<void> {
    console.log(`Updating tag for file ${this._currentCount}: ${file.name}`); // tslint:disable-line:no-console
    this._currentCount++;

    const psFile = file as PSPhotoFile;
    await this._treeHandler.updateCustomInfo(this._requestContext, this._iModel.iModelToken.contextId!, psFile);
  }

  public async updateTags(folder: PhotoFolder, subFolders: boolean): Promise<void> {
    this._currentCount = 0;
    await folder.traversePhotos(this.updateFileTag.bind(this), undefined, subFolders, false);
  }

  private async countPhoto(_file: PhotoFile, _folder: PhotoFolder): Promise<void> {
    this._totalCount++;
  }

  public async getPhotoCount(folder: PhotoFolder, subFolders: boolean): Promise<number> {
    this._totalCount = 0;
    await folder.traversePhotos(this.countPhoto.bind(this), undefined, subFolders, false);
    return this._totalCount;
  }

  private async deleteFileCustomProperties(file: PhotoFile, _folder: PhotoFolder): Promise<void> {
    // console.log(`Deleting custom properties for file ${this._currentCount}: ${file.name}`); // tslint:disable-line:no-console
    this._currentCount++;
    const psFile = file as PSPhotoFile;
    if (psFile.psFile.customProperties === undefined)
      return;
    const deleteProps = (psFile.psFile.customProperties as any[]).map((entry: any) => entry.Name);
    if (deleteProps.length === 0)
      return;
    await this._projectShareClient.updateCustomProperties(this._requestContext, this._iModel.iModelToken.contextId!, psFile.psFile, undefined, deleteProps);
  }

  public async deleteCustomProperties(folder: PhotoFolder, subFolders: boolean): Promise<void> {
    this._currentCount = 0;
    await folder.traversePhotos(this.deleteFileCustomProperties.bind(this), undefined, subFolders, false);
  }
}

describe("GeoPhoto (#integration)", () => {
  let projectId: GuidString;
  let iModel: IModelConnection;
  let requestContext: AuthorizedClientRequestContext;
  let geoPhotoTest: GeoPhotoTest;
  let rootFolder: PhotoTree;
  const subFolders = true;

  before(async () => {
    IModelApp.startup();

    requestContext = await TestConfig.getAuthorizedClientRequestContext();
    IModelApp.authorizationClient = new TestAuthorizationClient(requestContext.accessToken);

    const project = await TestConfig.queryProject(requestContext, "iModelJsGeoPhotoTestProject");
    projectId = project.wsgId;

    const hubIModel: HubIModel = await TestConfig.queryIModel(requestContext, projectId, "PhotoTest");
    iModel = await BriefcaseConnection.open(projectId, hubIModel.wsgId, OpenMode.Readonly, IModelVersion.latest());

    const treeHandler = new ProjectShareHandler(requestContext, undefined as any, iModel, undefined);
    geoPhotoTest = new GeoPhotoTest(requestContext, iModel, treeHandler);
    rootFolder = await treeHandler.createPhotoTree();
  });

  it("should be able to count all images", async () => {
    const count = await geoPhotoTest.getPhotoCount(rootFolder, subFolders);
    console.log(`Total number of photos to process ${count}`); // tslint:disable-line:no-console
    chai.assert.isAtLeast(count, 800);
  });

  it.skip("should be able to delete tags for all images", async () => {
    // TODO: For local testing only - reduce the size of the folder before opening this up.
    const stopWatch = new StopWatch();
    stopWatch.start();
    await geoPhotoTest.deleteTags(rootFolder, subFolders);
    stopWatch.stop();
    console.log(`Time taken to delete tags ${stopWatch.elapsedSeconds} seconds`); // tslint:disable-line:no-console

    await geoPhotoTest.validateDeletedTags(rootFolder, subFolders);
  }).timeout(5 * 60 * 1000);

  it.skip("should be able to create tags for all images", async () => {
    // TODO: For local testing only - reduce the size of the folder before opening this up.
    const stopWatch = new StopWatch();
    stopWatch.start();
    await geoPhotoTest.updateTags(rootFolder, subFolders);
    stopWatch.stop();
    console.log(`Time taken to create tags ${stopWatch.elapsedSeconds} seconds`); // tslint:disable-line:no-console

    await geoPhotoTest.validateTags(rootFolder, subFolders);
  }).timeout(10 * 60 * 1000);

});
