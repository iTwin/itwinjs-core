
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString } from "@bentley/bentleyjs-core";
import { BriefcaseDb, ConcurrencyControl, IModelHost, SpatialCategory } from "@bentley/imodeljs-backend";
import { ColorDef, IModel, IModelVersion, SubCategoryAppearance, SyncMode } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { HubUtility } from "./HubUtility";
import { IModelTestUtils } from "./IModelTestUtils";

/** Test utility to push an iModel and ChangeSets */
export class TestChangeSetUtility {
  private readonly _projectName: string;
  private readonly _iModelName: string;

  public projectId!: GuidString;
  public iModelId!: GuidString;
  private _iModel!: BriefcaseDb;
  public requestContext: AuthorizedClientRequestContext;

  private _modelId!: string;
  private _categoryId!: string;

  constructor(requestContext: AuthorizedClientRequestContext, projectName: string, iModelBaseName: string) {
    this.requestContext = requestContext;
    this._projectName = projectName;
    this._iModelName = HubUtility.generateUniqueName(iModelBaseName); // Generate a unique name for the iModel (so that this test can be run simultaneously by multiple users+hosts simultaneously)
  }

  private async initialize(): Promise<void> {
    if (this.projectId)
      return;
    this.projectId = await HubUtility.queryProjectIdByName(this.requestContext, this._projectName);
  }

  private async addTestModel(): Promise<void> {
    this._iModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(this.requestContext, this.projectId, this.iModelId, SyncMode.PullAndPush, IModelVersion.latest());
    this._iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    [, this._modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(this._iModel, IModelTestUtils.getUniqueModelCode(this._iModel, "TestPhysicalModel"), true);
    await this._iModel.concurrencyControl.request(this.requestContext);
    this._iModel.saveChanges("Added test model");
  }

  private async addTestCategory(): Promise<void> {
    this._categoryId = SpatialCategory.insert(this._iModel, IModel.dictionaryId, "TestSpatialCategory", new SubCategoryAppearance({ color: ColorDef.computeTbgrFromString("rgb(255,0,0)") }));
    await this._iModel.concurrencyControl.request(this.requestContext);
    this._iModel.saveChanges("Added test category");
  }

  private async addTestElements(): Promise<void> {
    this._iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(this._iModel, this._modelId, this._categoryId));
    this._iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(this._iModel, this._modelId, this._categoryId));
    await this._iModel.concurrencyControl.request(this.requestContext);
    this._iModel.saveChanges("Added test elements");
  }

  public async createTestIModel(): Promise<BriefcaseDb> {
    await this.initialize();

    // Re-create iModel on iModelHub
    this.iModelId = await HubUtility.recreateIModel(this.requestContext, this.projectId, this._iModelName);

    // Populate sample data
    await this.addTestModel();
    await this.addTestCategory();
    await this.addTestElements();

    // Push changes to the hub
    await this._iModel.pushChanges(this.requestContext, "Setup test model");

    return this._iModel;
  }

  public async pushTestChangeSet() {
    if (!this._iModel)
      throw new Error("Must first call createTestIModel");
    await this.addTestElements();
    await this._iModel.pushChanges(this.requestContext, "Added test elements");
  }

  public async deleteTestIModel(): Promise<void> {
    if (!this._iModel)
      throw new Error("Must first call createTestIModel");
    await IModelTestUtils.closeAndDeleteBriefcaseDb(this.requestContext, this._iModel);
    await IModelHost.iModelClient.iModels.delete(this.requestContext, this.projectId, this.iModelId);
  }
}
