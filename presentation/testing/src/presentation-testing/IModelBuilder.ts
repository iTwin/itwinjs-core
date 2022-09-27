/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModel
 */

import { Drawing, DrawingModel, Element, IModelDb, IModelJsFs, InformationPartitionElement, PhysicalModel, PhysicalPartition, SubjectOwnsPartitionElements } from "@itwin/core-backend";
import { Guid, Id64, Id64String, ProcessDetector } from "@itwin/core-bentley";
import { Code, CodeProps, ElementProps, GeometricElement2dProps, IModel, LocalFileName, PhysicalElementProps, RelatedElement } from "@itwin/core-common";
import { assert } from "chai";
import { tmpdir } from "os";
import path, { join } from "path";

export class IModelBuilder {
  /**
   * Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
   * @return [modeledElementId, modelId]
   */
  public static createAndInsertPhysicalPartitionAndModel(testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false, parent?: Id64String): Id64String[] {
    const eid = IModelBuilder.createAndInsertPhysicalPartition(testImodel, newModelCode, parent);
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = IModelBuilder.createAndInsertPhysicalModel(testImodel, modeledElementRef, privateModel);
    return [eid, mid];
  }

  /** Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel. */
  public static createAndInsertPhysicalPartition(testDb: IModelDb, newModelCode: CodeProps, parentId?: Id64String): Id64String {
    const model = parentId ? testDb.elements.getElement(parentId).model : IModel.repositoryModelId;
    const parent = new SubjectOwnsPartitionElements(parentId || IModel.rootSubjectId);

    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      parent,
      model,
      code: newModelCode,
    };
    const modeledElement: Element = testDb.elements.createElement(modeledElementProps);
    return testDb.elements.insertElement(modeledElement.toJSON());
  }

  /** Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel. */
  public static createAndInsertPhysicalModel(testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Id64String {
    const newModel = testDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
    const newModelId = newModel.id = testDb.models.insertModel(newModel.toJSON());
    assert.isTrue(Id64.isValidId64(newModelId));
    assert.isTrue(Id64.isValidId64(newModel.id));
    assert.deepEqual(newModelId, newModel.id);
    return newModelId;
  }

  /**
   * Create and insert a DrawingPartition element (in the repositoryModel) and an associated DrawingModel.
   * @return [modeledElementId, modelId]
   */
  public static createAndInsertDrawingPartitionAndModel(testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false, parent?: Id64String): Id64String[] {
    const eid = IModelBuilder.createAndInsertDrawingPartition(testImodel, newModelCode, parent);
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = IModelBuilder.createAndInsertDrawingModel(testImodel, modeledElementRef, privateModel);
    return [eid, mid];
  }

  /** Create and insert a DrawingPartition element (in the repositoryModel) and an associated DrawingModel. */
  public static createAndInsertDrawingPartition(testDb: IModelDb, newModelCode: CodeProps, parentId?: Id64String): Id64String {
    const model = parentId ? testDb.elements.getElement(parentId).model : IModel.repositoryModelId;
    const parent = new SubjectOwnsPartitionElements(parentId || IModel.rootSubjectId);

    const modeledElementProps: ElementProps = {
      classFullName: Drawing.classFullName,
      parent,
      model,
      code: newModelCode,
    };
    const modeledElement: Element = testDb.elements.createElement(modeledElementProps);
    return testDb.elements.insertElement(modeledElement.toJSON());
  }

  /** Create and insert a DrawingPartition element (in the repositoryModel) and an associated DrawingModel. */
  public static createAndInsertDrawingModel(testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Id64String {
    const newModel = testDb.models.createModel({ modeledElement: modeledElementRef, classFullName: DrawingModel.classFullName, isPrivate: privateModel });
    const newModelId = newModel.id = testDb.models.insertModel(newModel.toJSON());
    assert.isTrue(Id64.isValidId64(newModelId));
    assert.isTrue(Id64.isValidId64(newModel.id));
    assert.deepEqual(newModelId, newModel.id);
    return newModelId;
  }

  // Create a DrawingObject. (Does not insert it.)
  public static createDrawingGraphic(testImodel: IModelDb, modelId: Id64String, categoryId: Id64String, elemCode?: Code): Element {
    const elementProps: GeometricElement2dProps = {
      classFullName: "BisCore:DrawingGraphic",
      model: modelId,
      category: categoryId,
      code: elemCode ? elemCode : Code.createEmpty(),
    };
    return testImodel.elements.createElement(elementProps);
  }

  // Create a PhysicalObject. (Does not insert it.)
  public static createPhysicalObject(testImodel: IModelDb, modelId: Id64String, categoryId: Id64String, elemCode?: Code): Element {
    const elementProps: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      category: categoryId,
      code: elemCode ? elemCode : Code.createEmpty(),
    };
    return testImodel.elements.createElement(elementProps);
  }

  public static getUniqueModelCode(testDb: IModelDb, newModelCodeBase: string): Code {
    let newModelCode: string = newModelCodeBase;
    let iter: number = 0;
    while (true) {
      const modelCode = InformationPartitionElement.createCode(testDb, IModel.rootSubjectId, newModelCode);
      if (testDb.elements.queryElementIdByCode(modelCode) === undefined)
        return modelCode;

      newModelCode = newModelCodeBase + iter;
      ++iter;
    }
  }

  /** Generate a name for an iModel that's unique using the baseName provided and appending a new GUID.  */
  public static generateUniqueName(baseName: string) {
    return `${baseName} - ${Guid.createValue()}`;
  }

  /** Prepare for an output file by:
   * - Resolving the output file name under the known test output directory
   * - Making directories as necessary
   * - Removing a previous copy of the output file
   * @param subDirName Sub-directory under known test output directory. Should match the name of the test file minus the .test.ts file extension.
   * @param fileName Name of output fille
   */
  public static prepareOutputFile(subDirName: string, fileName: string): LocalFileName {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);

    const outputDir = path.join(KnownTestLocations.outputDir, subDirName);
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);

    const outputFile = path.join(outputDir, fileName);
    if (IModelJsFs.existsSync(outputFile))
      IModelJsFs.unlinkSync(outputFile);

    return outputFile;
  }
}

export class KnownTestLocations {

  /** The directory where test assets are stored. Keep in mind that the test is playing the role of the app. */
  public static get assetsDir(): string {
    return join(__dirname, "assets");
  }

  /** The directory where tests can write. */
  public static get outputDir(): string {
    if (ProcessDetector.isMobileAppBackend) {
      return join(tmpdir(), "output");
    }

    // Assume that we are running in nodejs
    return join(__dirname, "output");
  }
}
