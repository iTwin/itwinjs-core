/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@itwin/core-bentley";
import { CodeScopeSpec, CodeSpec, GeometricModel2dProps, RelatedElement, SheetProps } from "@itwin/core-common";

import { IModelDb, SnapshotDb } from "../../IModelDb";
import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
import { Sheet, SheetIndex, SheetIndexEntry, SheetIndexFolder, SheetReference } from "../../Element";
import { expect } from "chai";
import { DocumentListModel, SheetIndexModel, SheetModel } from "../../Model";

let documentListModelId: string | undefined;
const getOrCreateDocumentList = async (iModel: IModelDb): Promise<Id64String> => {
  // If they do not exist, create the document partition and document list model
  if (documentListModelId === undefined) {
    const channelSubjectId = iModel.elements.getRootSubject().id;
    await iModel.locks.acquireLocks({
      shared: channelSubjectId,
    });
    documentListModelId = DocumentListModel.insert(iModel, channelSubjectId, "SheetsList");
  }

  return documentListModelId;
};

const insertSheet = async (iModel: IModelDb, sheetName: string): Promise<Id64String> => {
  const createSheetProps = {
    height: 42,
    width: 42,
    scale: 42,
  };
  // Get or make documentListModelId
  const modelId = await getOrCreateDocumentList(iModel);

  // Acquire locks and create sheet
  await iModel.locks.acquireLocks({ shared: documentListModelId });
  const sheetElementProps: SheetProps = {
    ...createSheetProps,
    classFullName: Sheet.classFullName,
    code: Sheet.createCode(iModel, modelId, sheetName),
    model: modelId,
  };
  const sheetElementId = iModel.elements.insertElement(sheetElementProps);

  const sheetModelProps: GeometricModel2dProps = {
    classFullName: SheetModel.classFullName,
    modeledElement: { id: sheetElementId, relClassName: "BisCore:ModelModelsElement" } as RelatedElement,
  };
  const sheetModelId = iModel.models.insertModel(sheetModelProps);

  return sheetModelId;
};

const insertCodeSpec = async (iModel: IModelDb) => {
  const indexSpec = CodeSpec.create(iModel, SheetIndex.getCodeSpecName(), CodeScopeSpec.Type.Model);
  iModel.codeSpecs.insert(indexSpec);

  const entrySpec = CodeSpec.create(iModel, SheetIndexEntry.getCodeSpecName(), CodeScopeSpec.Type.ParentElement);
  iModel.codeSpecs.insert(entrySpec);
};

describe("SheetIndex", () => {
  let iModel: SnapshotDb;

  beforeEach(async () => {
    const iModelFile: string = IModelTestUtils.prepareOutputFile("IModel", "TestSheetIndex.bim");

    const iModelDb = SnapshotDb.createEmpty(iModelFile, { rootSubject: { name: "SheetIndex" } });
    await ExtensiveTestScenario.prepareDb(iModelDb);
    ExtensiveTestScenario.populateDb(iModelDb);
    iModel = iModelDb;

    await insertCodeSpec(iModel);
  });

  afterEach(() => {
    iModel.abandonChanges();
    iModel.close();
  });

  // Currently busted
  it.only("SheetIndexModel Should insert", async () => {
    const subjectId = iModel.elements.getRootSubject().id;

    const modelId = SheetIndexModel.insert(iModel, subjectId, "testSheetIndex");
    expect(Id64.isValidId64(modelId)).to.be.true;
  });

  it("SheetIndex Should insert", async () => {
    const subjectId = iModel.elements.getRootSubject().id;

    const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
    expect(Id64.isValidId64(modelId)).to.be.true;

    const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
    expect(Id64.isValidId64(sheetIndex)).to.be.true;
  });

  it("SheetIndexFolders Should insert", async () => {
    const subjectId = iModel.elements.getRootSubject().id;

    const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
    expect(Id64.isValidId64(modelId)).to.be.true;
    const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
    expect(Id64.isValidId64(sheetIndex)).to.be.true;

    const folder1 = SheetIndexFolder.insert(iModel, modelId, sheetIndex, "TestFolder-1", 1);
    expect(Id64.isValidId64(folder1)).to.be.true;

    const folder2 = SheetIndexFolder.insert(iModel, modelId, sheetIndex, "TestFolder-2", 2);
    expect(Id64.isValidId64(folder2)).to.be.true;
  });

  describe("SheetReferences", () => {
    it("Should insert SheetReferences without a Sheet", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex)).to.be.true;

      const folder1 = SheetIndexFolder.insert(iModel, modelId, sheetIndex, "TestFolder", 1);
      expect(Id64.isValidId64(folder1)).to.be.true;

      const sheetRef = SheetReference.insert(iModel, modelId, sheetIndex, "TestSheetRef", 1);
      expect(Id64.isValidId64(sheetRef)).to.be.true;
    });

    it("Should insert and with a  Sheet", async () => {
      const subjectId = iModel.elements.getRootSubject().id;
      const sheetId = await insertSheet(iModel, "sheet-1");

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex)).to.be.true;

      const folder1 = SheetIndexFolder.insert(iModel, modelId, sheetIndex, "TestFolder", 1);
      expect(Id64.isValidId64(folder1)).to.be.true;

      const sheetRef = SheetReference.insert(iModel, modelId, sheetIndex, "TestSheetRef", 1, sheetId);
      expect(Id64.isValidId64(sheetRef)).to.be.true;
    });
  });
});
