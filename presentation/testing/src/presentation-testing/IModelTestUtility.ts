/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module TestUtilities
 */
import { DrawingCategory, IModelDb, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { GuidString } from "@itwin/core-bentley";
import { Code, ElementProps } from "@itwin/core-common";
import { IModelBuilder } from "./IModelBuilder";

/**
 * Test utility to push an iModel.
 *
 * @internal
 */
export class IModelTestUtility {
  public iTwinId!: GuidString;
  public iModelId!: string;
  public outputFile!: string;
  private _iModel!: IModelDb;
  private _modelId!: string;

  public createIModel(): void {
    this.outputFile = IModelBuilder.prepareOutputFile("IModelTest", IModelBuilder.generateUniqueName("IModelTest.bim"));
    this._iModel = SnapshotDb.createEmpty(this.outputFile, { rootSubject: { name: "IModelTest" } });
    this.iModelId = this._iModel.iModelId;
  }

  public addPhysicalModel(): string {
    [, this._modelId] = IModelBuilder.createAndInsertPhysicalPartitionAndModel(this._iModel, IModelBuilder.getUniqueModelCode(this._iModel, "TestPhysicalModel"), false);
    this._iModel.saveChanges("Added test model");
    return this._modelId;
  }

  public addDrawingModel(): string {
    [, this._modelId] = IModelBuilder.createAndInsertDrawingPartitionAndModel(this._iModel, IModelBuilder.getUniqueModelCode(this._iModel, "TestDrawingModel"), false);
    this._iModel.saveChanges("Added test model");
    return this._modelId;
  }

  public addSpatialCategory(elementProps: ElementProps): string {
    const categoryId = this._iModel.elements.insertElement(new SpatialCategory(elementProps, this._iModel).toJSON());
    this._iModel.saveChanges("Added spatial category");
    return categoryId;
  }

  public addDrawingCategory(elementProps: ElementProps): string {
    const categoryId = this._iModel.elements.insertElement(new DrawingCategory(elementProps, this._iModel).toJSON());
    this._iModel.saveChanges("Added drawing category");
    return categoryId;
  }

  public addPhysicalObject(categoryId: string): void {
    this._iModel.elements.insertElement(IModelBuilder.createPhysicalObject(this._iModel, this._modelId, categoryId).toJSON());
    this._iModel.saveChanges("Added physical object");
  }

  public addDrawingGraphic(categoryId: string): void {
    this._iModel.elements.insertElement(IModelBuilder.createDrawingGraphic(this._iModel, this._modelId, categoryId).toJSON());
    this._iModel.saveChanges("Added drawing graphic");
  }

  public getSpatialCategoryCode(codeValue: string): Code {
    return SpatialCategory.createCode(this._iModel, this._modelId, codeValue);
  }

  public getDrawingCategoryCode(codeValue: string): Code {
    return DrawingCategory.createCode(this._iModel, this._modelId, codeValue);
  }

  public closeIModel(): void {
    this._iModel.close();
  }
}
