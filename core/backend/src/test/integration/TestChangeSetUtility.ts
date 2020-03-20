
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { ColorDef, IModel, IModelVersion, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { SpatialCategory } from "../../Category";
import { ConcurrencyControl } from "../../ConcurrencyControl";
import { BriefcaseIModelDb, BriefcaseManager, KeepBriefcase, OpenParams } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

/** Test utility to push an iModel and ChangeSets */
export class TestChangeSetUtility {
  private readonly _projectName: string = "iModelJsIntegrationTest";
  private readonly _iModelName: string;

  public projectId!: GuidString;
  public iModelId!: GuidString;
  private _iModel!: BriefcaseIModelDb;
  private _requestContext: AuthorizedClientRequestContext;

  private _modelId!: string;
  private _categoryId!: string;

  constructor(requestContext: AuthorizedClientRequestContext, iModelName: string) {
    this._requestContext = requestContext;
    this._iModelName = HubUtility.generateUniqueName(iModelName); // Generate a unique name for the iModel (so that this test can be run simultaneously by multiple users+hosts simultaneously)
  }

  private async initialize(): Promise<void> {
    if (this.projectId)
      return;
    this.projectId = await HubUtility.queryProjectIdByName(this._requestContext, this._projectName);
  }

  private async addTestModel(): Promise<void> {
    this._iModel = await BriefcaseIModelDb.open(this._requestContext, this.projectId, this.iModelId, OpenParams.pullAndPush(), IModelVersion.latest());
    this._iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    [, this._modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(this._iModel, IModelTestUtils.getUniqueModelCode(this._iModel, "TestPhysicalModel"), true);
    await this._iModel.concurrencyControl.request(this._requestContext);
    this._iModel.saveChanges("Added test model");
  }

  private async addTestCategory(): Promise<void> {
    this._categoryId = SpatialCategory.insert(this._iModel, IModel.dictionaryId, "TestSpatialCategory", new SubCategoryAppearance({ color: new ColorDef("rgb(255,0,0)") }));
    await this._iModel.concurrencyControl.request(this._requestContext);
    this._iModel.saveChanges("Added test category");
  }

  private async addTestElements(): Promise<void> {
    this._iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(this._iModel, this._modelId, this._categoryId));
    this._iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(this._iModel, this._modelId, this._categoryId));
    await this._iModel.concurrencyControl.request(this._requestContext);
    this._iModel.saveChanges("Added test elements");
  }

  public async createTestIModel(): Promise<BriefcaseIModelDb> {
    await this.initialize();

    // Re-create iModel on iModelHub
    this.iModelId = await HubUtility.recreateIModel(this._requestContext, this.projectId, this._iModelName);

    // Populate sample data
    await this.addTestModel();
    await this.addTestCategory();
    await this.addTestElements();

    // Push changes to the hub
    await this._iModel.pushChanges(this._requestContext, "Setup test model");

    return this._iModel;
  }

  public async pushTestChangeSet() {
    if (!this._iModel)
      throw new Error("Must first call createTestIModel");
    await this.addTestElements();
    await this._iModel.pushChanges(this._requestContext, "Added test elements");
  }

  public async deleteTestIModel(): Promise<void> {
    if (!this._iModel)
      throw new Error("Must first call createTestIModel");
    await this._iModel.close(this._requestContext, KeepBriefcase.No);
    await BriefcaseManager.imodelClient.iModels.delete(this._requestContext, this.projectId, this.iModelId);
  }
}
