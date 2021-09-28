/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, GuidString } from "@itwin/core-bentley";
import { ColorDef, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { SpatialCategory } from "../../Category";
import { BriefcaseDb, IModelHost } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

/** Test utility to push an iModel and ChangeSets */
export class TestChangeSetUtility {
  private readonly _iModelName: string;

  public projectId!: GuidString;
  public iModelId!: GuidString;
  private _iModel!: BriefcaseDb;
  private _requestContext: AccessToken;

  private _modelId!: string;
  private _categoryId!: string;

  constructor(requestContext: AccessToken, iModelName: string) {
    this._requestContext = requestContext;
    this._iModelName = HubUtility.generateUniqueName(iModelName); // Generate a unique name for the iModel (so that this test can be run simultaneously by multiple users+hosts simultaneously)
  }

  private async addTestModel(): Promise<void> {
    this._iModel = await IModelTestUtils.downloadAndOpenBriefcase({ user: this._requestContext, iTwinId: this.projectId, iModelId: this.iModelId });
    [, this._modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(this._iModel, IModelTestUtils.getUniqueModelCode(this._iModel, "TestPhysicalModel"), true);
    this._iModel.saveChanges("Added test model");
  }

  private async addTestCategory(): Promise<void> {
    this._categoryId = SpatialCategory.insert(this._iModel, IModel.dictionaryId, "TestSpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
    this._iModel.saveChanges("Added test category");
  }

  private async addTestElements(): Promise<void> {
    this._iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(this._iModel, this._modelId, this._categoryId));
    this._iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(this._iModel, this._modelId, this._categoryId));
    this._iModel.saveChanges("Added test elements");
  }

  public async createTestIModel(): Promise<BriefcaseDb> {
    this.projectId = await HubUtility.getTestITwinId(this._requestContext);

    // Re-create iModel on iModelHub
    this.iModelId = await HubUtility.recreateIModel({ user: this._requestContext, iTwinId: this.projectId, iModelName: this._iModelName, noLocks: true });

    // Populate sample data
    await this.addTestModel();
    await this.addTestCategory();
    await this.addTestElements();

    // Push changes to the hub
    await this._iModel.pushChanges({ user: this._requestContext, description: "Setup test model" });
    return this._iModel;
  }

  public async pushTestChangeSet() {
    if (!this._iModel)
      throw new Error("Must first call createTestIModel");
    await this.addTestElements();
    await this._iModel.pushChanges({ user: this._requestContext, description: "Added test elements" });
  }

  public async deleteTestIModel(): Promise<void> {
    if (!this._iModel)
      throw new Error("Must first call createTestIModel");
    await IModelTestUtils.closeAndDeleteBriefcaseDb(this._requestContext, this._iModel);
    await IModelHost.hubAccess.deleteIModel({ user: this._requestContext, iTwinId: this.projectId, iModelId: this.iModelId });
  }
}
