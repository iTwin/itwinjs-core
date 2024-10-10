/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, GeometricElementProps } from "@itwin/core-common";
import { expect } from "chai";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { DefinitionModel, PhysicalModel } from "../../Model";
import { ChannelControl, GeometricElement, IModelJsFs, PhysicalObject } from "../../core-backend";
import * as path from "node:path";

describe.only("ChangeModel Tests", () => {
  let iModel: IModelDb;
  let modelId1: Id64String;
  let modelId2: Id64String;
  let elementId: Id64String;

  const iModelPath = path.resolve("temp.bim");

  before(async () => {
    iModel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "TestSubject" } });
    iModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);
  });

  after(() => {
    iModel?.close();
    IModelJsFs.removeSync(iModelPath);
  });

  it("should move element from first model to second model", () => {
    modelId1 = PhysicalModel.insert(iModel, IModelDb.rootSubjectId, "PhysicalModel1");
    modelId2 = PhysicalModel.insert(iModel, IModelDb.rootSubjectId, "PhysicalModel2");

    const definitionModelId = DefinitionModel.insert(iModel, IModelDb.rootSubjectId, "Definition");
    const spatialCategoryId1 = IModelTestUtils.insertSpatialCategory(iModel, definitionModelId, "SpatialCategory1", ColorDef.blue);
    const spatialCategoryId2 = IModelTestUtils.insertSpatialCategory(iModel, definitionModelId, "SpatialCategory2", ColorDef.green);

    const elementProps: GeometricElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: modelId1,
      category: spatialCategoryId1,
      code: Code.createEmpty(),
    };
    elementId = iModel.elements.insertElement(elementProps);

    const element = iModel.elements.getElement<GeometricElement>(elementId);
    expect(element.model).to.equal(modelId1);
    expect(element.category).to.equal(spatialCategoryId1);

    iModel.elements.updateElement<GeometricElementProps>({ id: elementId, model: modelId2, category: spatialCategoryId2 });

    const updatedElement = iModel.elements.getElement<GeometricElement>(elementId);
    expect(updatedElement.category).to.equal(spatialCategoryId2);
    expect(updatedElement.model).to.equal(modelId2); // Fails
  });
});
