/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { GuidString, Id64, Id64String } from "@bentley/bentleyjs-core";
import {
  BriefcaseDb, BriefcaseManager, Element, IModelDb, IModelJsFs, InformationPartitionElement, PhysicalModel, PhysicalPartition,
  SubjectOwnsPartitionElements,
} from "@bentley/imodeljs-backend";
import { Code, CodeProps, ElementProps, IModel, IModelVersion, PhysicalElementProps, RelatedElement } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

export class IModelTestUtils {
  // Helper to open a briefcase db
  public static async downloadAndOpenBriefcaseDb(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString, briefcaseId?: number, version: IModelVersion = IModelVersion.latest()): Promise<BriefcaseDb> {
    requestContext.enter();
    const props = await BriefcaseManager.downloadBriefcase(requestContext, { contextId, iModelId, briefcaseId, asOf: version.toJSON() });
    requestContext.enter();
    return BriefcaseDb.open(requestContext, { fileName: props.fileName });
  }

  public static async closeAndDeleteBriefcaseDb(requestContext: AuthorizedClientRequestContext, briefcaseDb: BriefcaseDb) {
    const fileName = briefcaseDb.pathName; // save this before we close - afterwards it is invalid
    const iModelId = briefcaseDb.iModelId;
    briefcaseDb.close();
    await BriefcaseManager.deleteBriefcaseFiles(fileName, requestContext);
    // try to clean up empty briefcase directories, and empty iModel directories.
    if (0 === BriefcaseManager.getCachedBriefcases(iModelId).length) {
      IModelJsFs.removeSync(BriefcaseManager.getBriefcaseBasePath(iModelId));
      const imodelPath = BriefcaseManager.getIModelPath(iModelId);
      if (0 === IModelJsFs.readdirSync(imodelPath).length) {
        IModelJsFs.removeSync(imodelPath);
      }
    }
  }

  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  public static createAndInsertPhysicalPartition(testDb: IModelDb, newModelCode: CodeProps): Id64String {
    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      model: IModel.repositoryModelId,
      code: newModelCode,
    };
    const modeledElement: Element = testDb.elements.createElement(modeledElementProps);
    return testDb.elements.insertElement(modeledElement);
  }

  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  public static createAndInsertPhysicalModel(testDb: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Id64String {
    const newModel = testDb.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
    const newModelId = testDb.models.insertModel(newModel);
    assert.isTrue(Id64.isValidId64(newModelId));
    assert.isTrue(Id64.isValidId64(newModel.id));
    assert.deepEqual(newModelId, newModel.id);
    return newModelId;
  }

  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  // @return [modeledElementId, modelId]
  public static createAndInsertPhysicalPartitionAndModel(testImodel: IModelDb, newModelCode: CodeProps, privateModel: boolean = false): Id64String[] {
    const eid = IModelTestUtils.createAndInsertPhysicalPartition(testImodel, newModelCode);
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = IModelTestUtils.createAndInsertPhysicalModel(testImodel, modeledElementRef, privateModel);
    return [eid, mid];
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

}
