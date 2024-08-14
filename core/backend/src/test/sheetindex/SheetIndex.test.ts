/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@itwin/core-bentley";
import { BisCodeSpec, CodeScopeSpec, CodeSpec, GeometricModel2dProps, RelatedElement, SheetProps } from "@itwin/core-common";

import { IModelDb, SnapshotDb } from "../../IModelDb";
import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
import { Sheet, SheetIndex, SheetIndexFolder, SheetIndexReference, SheetReference } from "../../Element";
import { expect } from "chai";
import { DocumentListModel, SheetIndexModel, SheetModel } from "../../Model";
import { ElementOwnsChildElements, SheetIndexFolderOwnsEntries, SheetIndexOwnsEntries, SheetIndexReferenceRefersToSheetIndex, SheetReferenceRefersToSheet } from "../../NavigationRelationship";

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
  const indexSpec = CodeSpec.create(iModel, BisCodeSpec.sheetIndex, CodeScopeSpec.Type.Model);
  iModel.codeSpecs.insert(indexSpec);

  const entrySpec = CodeSpec.create(iModel, BisCodeSpec.sheetIndexEntry, CodeScopeSpec.Type.ParentElement);
  iModel.codeSpecs.insert(entrySpec);
};

describe.only("SheetIndex", () => {
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

  it("SheetIndexModel Should insert", async () => {
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

  it("SheetIndex Should insert", async () => {
    const subjectId = iModel.elements.getRootSubject().id;

    const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
    expect(Id64.isValidId64(modelId)).to.be.true;

    const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
    expect(Id64.isValidId64(sheetIndex)).to.be.true;

    const folderId = SheetIndexFolder.insert(iModel, modelId, sheetIndex, "TestFolder", 1);
    expect(Id64.isValidId64(folderId)).to.be.true;
  });

  describe("SheetIndexFolder", () => {
    it("Should insert", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndexId = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndexId)).to.be.true;

      const folderId = SheetIndexFolder.insert(iModel, modelId, sheetIndexId, "TestFolder-1", 1);
      expect(Id64.isValidId64(folderId)).to.be.true;

      const folder = iModel.elements.tryGetElement<SheetIndexFolder>(folderId);
      expect(folder).to.not.be.undefined;
      // Need to register class scheme?
      // const relationship = iModel.relationships.tryGetInstance(SheetIndexOwnsEntries.classFullName, { sourceId: sheetIndexId, targetId: folderId });
      const relationship = iModel.relationships.tryGetInstanceProps(ElementOwnsChildElements.classFullName, { sourceId: sheetIndexId, targetId: folderId });
      expect(relationship).to.not.be.undefined;
      expect(relationship?.classFullName).equals(SheetIndexOwnsEntries.classFullName);

      expect(folder?.parent?.id).equals(sheetIndexId);
    });

    it("Should have children", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndexId = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndexId)).to.be.true;

      const folder1Id = SheetIndexFolder.insert(iModel, modelId, sheetIndexId, "TestFolder-1", 1);
      expect(Id64.isValidId64(folder1Id)).to.be.true;

      const folder2Id = SheetIndexFolder.insert(iModel, modelId, folder1Id, "TestFolder-2", 1);
      expect(Id64.isValidId64(folder2Id)).to.be.true;
      const folder2 = iModel.elements.tryGetElement<SheetIndexFolder>(folder2Id);
      expect(folder2).to.not.be.undefined;
      // Need to register class scheme?
      // const relationship = iModel.relationships.tryGetInstance(SheetIndexFolderOwnsEntries.classFullName, { sourceId: folder1Id, targetId: folder2Id });
      const relationship = iModel.relationships.tryGetInstanceProps(ElementOwnsChildElements.classFullName, { sourceId: folder1Id, targetId: folder2Id });
      expect(relationship).to.not.be.undefined;
      expect(relationship?.classFullName).equals(SheetIndexFolderOwnsEntries.classFullName);

      expect(folder2?.parent?.id).equals(folder1Id);
    });
  });

  describe("SheetReferences", () => {
    it("Should insert SheetReferences without a Sheet", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex)).to.be.true;

      const sheetRef = SheetReference.insert(iModel, modelId, sheetIndex, "TestSheetRef", 1);
      expect(Id64.isValidId64(sheetRef)).to.be.true;
    });

    it("Should insert and with a Sheet", async () => {
      const subjectId = iModel.elements.getRootSubject().id;
      const sheetId = await insertSheet(iModel, "sheet-1");

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex)).to.be.true;

      const sheetRefId = SheetReference.insert(iModel, modelId, sheetIndex, "TestSheetRef", 1, sheetId);
      expect(Id64.isValidId64(sheetRefId)).to.be.true;

      const ref = iModel.elements.tryGetElement<SheetReference>(sheetRefId);
      expect(ref).to.not.be.undefined;
      // Need to register class scheme?
      // const relationship = iModel.relationships.tryGetInstance(SheetReferenceRefersToSheet.classFullName, { sourceId: sheetRefId, targetId: sheetId });
      const relationship = iModel.relationships.tryGetInstanceProps(SheetReferenceRefersToSheet.classFullName, { sourceId: sheetRefId, targetId: sheetId });
      expect(relationship).to.not.be.undefined;
      expect(relationship?.classFullName).equals(SheetReferenceRefersToSheet.classFullName);

      expect(ref?.sheet?.id).equals(sheetId);
    });
  });

  describe("SheetIndexReferences", () => {
    it("Should insert SheetReferences without a Sheet", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex1Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex1Id)).to.be.true;

      const sheetRef = SheetIndexReference.insert(iModel, modelId, sheetIndex1Id, "TestSheetIndexRef", 1);
      expect(Id64.isValidId64(sheetRef)).to.be.true;
    });

    it("Should insert and with a Sheet", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex1Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex-1");
      expect(Id64.isValidId64(sheetIndex1Id)).to.be.true;
      const sheetIndex2Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex-2");
      expect(Id64.isValidId64(sheetIndex1Id)).to.be.true;

      const sheetIndexRefId = SheetIndexReference.insert(iModel, modelId, sheetIndex1Id, "TestSheetRef", 1, sheetIndex2Id);
      expect(Id64.isValidId64(sheetIndexRefId)).to.be.true;

      const ref = iModel.elements.tryGetElement<SheetIndexReference>(sheetIndexRefId);
      expect(ref).to.not.be.undefined;
      // Need to register class scheme?
      // const relationship = iModel.relationships.tryGetInstance(SheetReferenceRefersToSheet.classFullName, { sourceId: sheetRefId, targetId: sheetId });
      const relationship = iModel.relationships.tryGetInstanceProps(SheetIndexReferenceRefersToSheetIndex.classFullName, { sourceId: sheetIndexRefId, targetId: sheetIndex2Id });
      expect(relationship).to.not.be.undefined;
      expect(relationship?.classFullName).equals(SheetIndexReferenceRefersToSheetIndex.classFullName);

      expect(ref?.sheetIndex?.id).equals(sheetIndex2Id);
    });
  });
});
