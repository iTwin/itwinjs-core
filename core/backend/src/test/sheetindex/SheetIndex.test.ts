/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@itwin/core-bentley";
import { GeometricModel2dProps, RelatedElement, SheetProps } from "@itwin/core-common";

import { IModelDb, SnapshotDb } from "../../IModelDb";
import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
import { DocumentPartition, Sheet } from "../../Element";
import { expect } from "chai";
import { DocumentListModel, SheetIndexModel, SheetModel } from "../../Model";
import { ElementOwnsChildElements, SheetIndexFolderOwnsEntries, SheetIndexOwnsEntries, SheetIndexReferenceRefersToSheetIndex, SheetReferenceRefersToSheet } from "../../NavigationRelationship";
import { SheetIndex, SheetIndexFolder, SheetIndexReference, SheetReference } from "../../SheetIndex";

export const getOrCreateDocumentList = async (iModel: IModelDb): Promise<Id64String> => {
  const documentListName = "SheetList";
  let documentListModelId: string | undefined;

  // Attempt to find an existing document partition and document list model
  const ids = iModel.queryEntityIds({ from: DocumentPartition.classFullName, where: `CodeValue = '${documentListName}'`});
  if (ids.size === 1) {
    documentListModelId = ids.values().next().value;
  }

  // If they do not exist, create the document partition and document list model
  if (documentListModelId === undefined) {
    const subjectId = iModel.elements.getRootSubject().id;
    await iModel.locks.acquireLocks({
      shared: subjectId,
    });
    documentListModelId = DocumentListModel.insert(iModel, subjectId, documentListName);
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
  await iModel.locks.acquireLocks({ shared: modelId });
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

  describe("Update", () => {
    it("Priority", () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;

      const sheetIndex1Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex1Id)).to.be.true;

      const folderId = SheetIndexFolder.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex1Id, name: "TestFolder", priority: 1 });
      expect(Id64.isValidId64(folderId)).to.be.true;

      const folder = iModel.elements.tryGetElement<SheetIndexFolder>(folderId);
      expect(folder).to.not.be.undefined;
      expect(folder?.entryPriority).equals(1);

      folder!.entryPriority = 0;
      folder!.update();

      const folderPostUpdate = iModel.elements.tryGetElement<SheetIndexFolder>(folderId);
      expect(folderPostUpdate?.entryPriority).equals(0);
    });

    it("Parent", () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;

      const sheetIndex1Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex-1");
      expect(Id64.isValidId64(sheetIndex1Id)).to.be.true;

      const sheetIndex2Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex-2");
      expect(Id64.isValidId64(sheetIndex2Id)).to.be.true;

      const folderId = SheetIndexFolder.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex1Id, name: "TestFolder", priority: 1 });
      expect(Id64.isValidId64(folderId)).to.be.true;

      const folder = iModel.elements.tryGetElement<SheetIndexFolder>(folderId);
      expect(folder).to.not.be.undefined;

      const parentRel11 = iModel.relationships.tryGetInstanceProps(ElementOwnsChildElements.classFullName, { sourceId: sheetIndex1Id, targetId: folderId });
      expect(parentRel11).to.not.be.undefined;

      folder!.parent = new SheetIndexOwnsEntries(sheetIndex2Id);
      folder!.update();

      const parentRel12 = iModel.relationships.tryGetInstanceProps(ElementOwnsChildElements.classFullName, { sourceId: sheetIndex1Id, targetId: folderId });
      expect(parentRel12).to.be.undefined;

      const parentRel22 = iModel.relationships.tryGetInstanceProps(ElementOwnsChildElements.classFullName, { sourceId: sheetIndex2Id, targetId: folderId });
      expect(parentRel22).to.not.be.undefined;
    });

    it("Sheet Reference", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;

      const sheetIndexId = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndexId)).to.be.true;

      const sheet1Id = await insertSheet(iModel, "sheet-1");
      const sheet2Id = await insertSheet(iModel, "sheet-2");

      const sheetRefId = SheetReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndexId, name: "TestSheetReference", priority: 1 });
      expect(Id64.isValidId64(sheetRefId)).to.be.true;

      const sheetRef = iModel.elements.tryGetElement<SheetReference>(sheetRefId);
      expect(sheetRef).to.not.be.undefined;
      expect(sheetRef!.sheet).to.be.undefined;

      sheetRef!.sheet = new SheetReferenceRefersToSheet(sheet1Id);
      sheetRef!.update();

      const refersRel11 = iModel.relationships.tryGetInstanceProps(SheetReferenceRefersToSheet.classFullName, { sourceId: sheetRefId, targetId: sheet1Id });
      expect(refersRel11).to.not.be.undefined;

      const parentRel12 = iModel.relationships.tryGetInstanceProps(SheetReferenceRefersToSheet.classFullName, { sourceId: sheetRefId, targetId: sheet2Id });
      expect(parentRel12).to.be.undefined;

      sheetRef!.sheet = new SheetReferenceRefersToSheet(sheet2Id);
      sheetRef!.update();

      const refersRel21 = iModel.relationships.tryGetInstanceProps(SheetReferenceRefersToSheet.classFullName, { sourceId: sheetRefId, targetId: sheet1Id });
      expect(refersRel21).to.be.undefined;

      const parentRel22 = iModel.relationships.tryGetInstanceProps(SheetReferenceRefersToSheet.classFullName, { sourceId: sheetRefId, targetId: sheet2Id });
      expect(parentRel22).to.not.be.undefined;
    });

    it("Sheet Index Reference", () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;

      const sheetIndex1Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex-1");
      expect(Id64.isValidId64(sheetIndex1Id)).to.be.true;

      const sheetIndex2Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex-2");
      expect(Id64.isValidId64(sheetIndex2Id)).to.be.true;
      const sheetIndex3Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex-3");
      expect(Id64.isValidId64(sheetIndex3Id)).to.be.true;

      const sheetIndexRefId = SheetIndexReference.insert({iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex1Id, name: "TestSheetReference", priority: 1});
      expect(Id64.isValidId64(sheetIndexRefId)).to.be.true;

      const sheetIndexRef = iModel.elements.tryGetElement<SheetIndexReference>(sheetIndexRefId);
      expect(sheetIndexRef).to.not.be.undefined;
      expect(sheetIndexRef!.sheetIndex).to.be.undefined;

      sheetIndexRef!.sheetIndex = new SheetIndexReferenceRefersToSheetIndex(sheetIndex2Id);
      sheetIndexRef!.update();

      const parentRel11 = iModel.relationships.tryGetInstanceProps(SheetIndexReferenceRefersToSheetIndex.classFullName, { sourceId: sheetIndexRefId, targetId: sheetIndex2Id });
      expect(parentRel11).to.not.be.undefined;

      sheetIndexRef!.sheetIndex = new SheetIndexReferenceRefersToSheetIndex(sheetIndex3Id);
      sheetIndexRef!.update();

      const refersRel21 = iModel.relationships.tryGetInstanceProps(SheetIndexReferenceRefersToSheetIndex.classFullName, { sourceId: sheetIndexRefId, targetId: sheetIndex2Id });
      expect(refersRel21).to.be.undefined;

      const parentRel22 = iModel.relationships.tryGetInstanceProps(SheetIndexReferenceRefersToSheetIndex.classFullName, { sourceId: sheetIndexRefId, targetId: sheetIndex3Id });
      expect(parentRel22).to.not.be.undefined;
    });
  });

  describe("SheetIndexFolder", () => {
    it("Should insert", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndexId = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndexId)).to.be.true;

      const folderId = SheetIndexFolder.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndexId, name: "TestFolder-1", priority: 1});
      expect(Id64.isValidId64(folderId)).to.be.true;

      const folder = iModel.elements.tryGetElement<SheetIndexFolder>(folderId);
      expect(folder).to.not.be.undefined;

      const relationship = iModel.relationships.tryGetInstanceProps(ElementOwnsChildElements.classFullName, { sourceId: sheetIndexId, targetId: folderId });
      expect(relationship).to.not.be.undefined;
      expect(relationship?.classFullName).equals(SheetIndexOwnsEntries.classFullName);

      expect(folder?.parent?.id).equals(sheetIndexId);
    });

    it("Should not insert SheetIndexFolder with the same name", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex)).to.be.true;

      const folder = SheetIndexFolder.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex, name: "TestFolder", priority: 1 });
      expect(Id64.isValidId64(folder)).to.be.true;

      const failInsert = () => SheetIndexFolder.insert({iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex, name: "TestFolder", priority: 0 });

      expect(failInsert).throws();
    });

    it("Should have children", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndexId = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndexId)).to.be.true;

      const folder1Id = SheetIndexFolder.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndexId, name: "TestFolder-1", priority: 1 });
      expect(Id64.isValidId64(folder1Id)).to.be.true;

      const folder2Id = SheetIndexFolder.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: folder1Id, name: "TestFolder-2", priority: 1 });
      expect(Id64.isValidId64(folder2Id)).to.be.true;
      const folder2 = iModel.elements.tryGetElement<SheetIndexFolder>(folder2Id);
      expect(folder2).to.not.be.undefined;

      const relationship = iModel.relationships.tryGetInstanceProps(ElementOwnsChildElements.classFullName, { sourceId: folder1Id, targetId: folder2Id });
      expect(relationship).to.not.be.undefined;
      expect(relationship?.classFullName).equals(SheetIndexFolderOwnsEntries.classFullName);

      expect(folder2?.parent?.id).equals(folder1Id);
    });
  });

  describe("SheetReferences", () => {
    it("Should not insert SheetReferences with the same name", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex)).to.be.true;

      const sheetRef1 = SheetReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex, name: "TestSheetRef", priority: 1 });
      expect(Id64.isValidId64(sheetRef1)).to.be.true;

      const failInsert = () => SheetReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex, name: "TestSheetRef", priority: 0 });

      expect(failInsert).throws();
    });

    it("Should insert SheetReferences without a Sheet", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex)).to.be.true;

      const sheetRef = SheetReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex, name: "TestSheetRef", priority: 1 });
      expect(Id64.isValidId64(sheetRef)).to.be.true;
    });

    it("Should insert and with a Sheet", async () => {
      const subjectId = iModel.elements.getRootSubject().id;
      const sheetId = await insertSheet(iModel, "sheet-1");

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex)).to.be.true;

      const sheetRefId = SheetReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex, name: "TestSheetRef", priority: 1, sheetId });
      expect(Id64.isValidId64(sheetRefId)).to.be.true;

      const ref = iModel.elements.tryGetElement<SheetReference>(sheetRefId);
      expect(ref).to.not.be.undefined;

      const relationship = iModel.relationships.tryGetInstanceProps(SheetReferenceRefersToSheet.classFullName, { sourceId: sheetRefId, targetId: sheetId });
      expect(relationship).to.not.be.undefined;
      expect(relationship?.classFullName).equals(SheetReferenceRefersToSheet.classFullName);

      expect(ref?.sheet?.id).equals(sheetId);
    });

    it.skip("Should not insert with the same Sheet twice", async () => {
      const subjectId = iModel.elements.getRootSubject().id;
      const sheetId = await insertSheet(iModel, "sheet-1");

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");

      SheetReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex, name: "TestSheetRef-1", priority: 1, sheetId });

      const sameIndex = () => SheetReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex, name: "TestSheetRef-2", priority: 2, sheetId });

      expect(sameIndex).throws();
    });
  });

  describe("SheetIndexReferences", () => {
    it("Should not insert SheetIndexReferences with the same name", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex)).to.be.true;

      const sheetIndexRef = SheetIndexReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex, name: "TestSheetIndexRef", priority: 1 });
      expect(Id64.isValidId64(sheetIndexRef)).to.be.true;

      const failInsert = () => SheetIndexReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex, name: "TestSheetIndexRef", priority: 0 });

      expect(failInsert).throws();
    });

    it("Should insert SheetIndexReferences without a SheetIndexRef", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex1Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
      expect(Id64.isValidId64(sheetIndex1Id)).to.be.true;

      const sheetRef = SheetIndexReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex1Id, name: "TestSheetIndexRef", priority: 1 });
      expect(Id64.isValidId64(sheetRef)).to.be.true;
    });

    it("Should insert and with a SheetIndexRef", async () => {
      const subjectId = iModel.elements.getRootSubject().id;

      const modelId = SheetIndexModel.insert(iModel, subjectId, "TestSheetIndexModel");
      expect(Id64.isValidId64(modelId)).to.be.true;
      const sheetIndex1Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex-1");
      expect(Id64.isValidId64(sheetIndex1Id)).to.be.true;
      const sheetIndex2Id = SheetIndex.insert(iModel, modelId, "TestSheetIndex-2");
      expect(Id64.isValidId64(sheetIndex1Id)).to.be.true;

      const sheetIndexRefId = SheetIndexReference.insert({ iModelDb: iModel, sheetIndexModelId: modelId, parentId: sheetIndex1Id, name: "TestSheetRef", priority: 1, sheetIndexId: sheetIndex2Id });
      expect(Id64.isValidId64(sheetIndexRefId)).to.be.true;

      const ref = iModel.elements.tryGetElement<SheetIndexReference>(sheetIndexRefId);
      expect(ref).to.not.be.undefined;

      const relationship = iModel.relationships.tryGetInstanceProps(SheetIndexReferenceRefersToSheetIndex.classFullName, { sourceId: sheetIndexRefId, targetId: sheetIndex2Id });
      expect(relationship).to.not.be.undefined;
      expect(relationship?.classFullName).equals(SheetIndexReferenceRefersToSheetIndex.classFullName);

      expect(ref?.sheetIndex?.id).equals(sheetIndex2Id);
    });
  });
});
