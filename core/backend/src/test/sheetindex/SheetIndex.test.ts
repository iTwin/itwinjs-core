// /*---------------------------------------------------------------------------------------------
//  * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
//  * See LICENSE.md in the project root for license terms and full copyright notice.
//  *--------------------------------------------------------------------------------------------*/

// import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
// import { CodeScopeSpec, CodeSpec, GeometricModel2dProps, RelatedElement, SheetProps } from "@itwin/core-common";

// import { IModelDb, SnapshotDb } from "../../IModelDb";
// import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
// import { Sheet, SheetIndex, SheetIndexFolder, SheetReference } from "../../Element";
// import { expect } from "chai";
// import { DictionaryModel, DocumentListModel, SheetModel } from "../../Model";
// import { ECSqlStatement } from "../../ECSqlStatement";

// enum DPChannels {
//   channelKey = "DrawingProduction",
//   channel = "DPChannel",
//   subject = "DrawingProductionSubject",
//   documentPartition = "DrawingProductionDocumentPartition",
// }

// const getOrCreateSubjectId = async (iModel: IModelDb) => {
//   try {
//     let subjectId: string | undefined;

//     // check if channel subject already exists, if yes then get id
//     iModel.withPreparedStatement(
//       "SELECT ECInstanceId FROM BisCore:Subject WHERE CodeValue = ?",
//       (stmt: ECSqlStatement) => {
//         stmt.bindString(1, DPChannels.subject);
//         while (stmt.step() === DbResult.BE_SQLITE_ROW) {
//           const row: any = stmt.getRow();
//           subjectId = row.id;
//         }
//       }
//     );

//     if (subjectId === undefined) {
//       await iModel.locks.acquireLocks({
//         shared: iModel.elements.getRootSubject().id,
//       });

//       subjectId = iModel.channels.insertChannelSubject({
//         subjectName: DPChannels.subject,
//         channelKey: DPChannels.channelKey,
//       });
//     }

//     return subjectId;
//   } catch (error) {
//     throw new Error(`Error creating channel subject: ${error}`);
//   }
// };

// const getOrCreateDocumentList = async (iModel: IModelDb): Promise<Id64String> => {
//   const documentListName = "DrawingProduction.SheetsList";
//   try {
//     const channelSubjectId = await getOrCreateSubjectId(iModel);
//     // Attempt to find an existing document partition and document list model
//     let documentListModelId: string | undefined;
//     iModel.withPreparedStatement(
//       "SELECT ECInstanceId FROM bis:DocumentPartition WHERE CodeValue = ?",
//       (stmt: ECSqlStatement) => {
//         stmt.bindString(1, documentListName);
//         while (stmt.step() === DbResult.BE_SQLITE_ROW) {
//           const row: any = stmt.getRow();
//           documentListModelId = row.id;
//         }
//       }
//     );

//     // If they do not exist, create the document partition and document list model
//     if (documentListModelId === undefined) {
//       await iModel.locks.acquireLocks({
//         shared: channelSubjectId,
//       });
//       documentListModelId = DocumentListModel.insert(iModel, channelSubjectId, documentListName);
//     }

//     return documentListModelId;
//   } catch (error) {
//     throw new Error(`Error getting document list: ${error}`);
//   }
// };

// const insertSheet = async (iModel: IModelDb): Promise<Id64String> => {
//   const sheetName = "TestSheet";
//   const createSheetProps = {
//     height: 42,
//     width: 42,
//     scale: 69,
//   };
//   try {
//     // Get or make documentListModelId
//     const documentListModelId = await getOrCreateDocumentList(iModel);

//     // Acquire locks and create sheet
//     await iModel.locks.acquireLocks({ shared: documentListModelId });
//     const sheetElementProps: SheetProps = {
//       ...createSheetProps,
//       classFullName: Sheet.classFullName,
//       code: Sheet.createCode(iModel, documentListModelId, sheetName),
//       model: documentListModelId,
//     };
//     const sheetElementId = iModel.elements.insertElement(sheetElementProps);

//     const sheetModelProps: GeometricModel2dProps = {
//       classFullName: SheetModel.classFullName,
//       modeledElement: { id: sheetElementId, relClassName: "BisCore:ModelModelsElement" } as RelatedElement,
//     };
//     const sheetModelId = iModel.models.insertModel(sheetModelProps);

//     return sheetModelId;
//   } catch (error) {
//     throw new Error(`Inserting sheet failed: ${error}`);
//   }
// };

// describe("SheetIndex", () => {
//   let iModel: SnapshotDb;

//   before(async () => {
//     // iModel = IModelTestUtils.createSnapshotFromSeed(
//     //   IModelTestUtils.prepareOutputFile("IModel", "test.bim"),
//     //   IModelTestUtils.resolveAssetFile("test.bim"),
//     // );
//     const iModelFile: string = IModelTestUtils.prepareOutputFile("SheetIndex", "SheetIndex.bim");
//     const iModelDb = SnapshotDb.createEmpty(iModelFile, { rootSubject: { name: "SheetIndex" } });
//     await ExtensiveTestScenario.prepareDb(iModelDb);
//     ExtensiveTestScenario.populateDb(iModelDb);
//   });

//   after(() => {
//     iModel.abandonChanges();
//     iModel.close();
//   });

//   // Currently busted
//   // test.skip("SheetIndexModel Should insert", async () => {
//   //   const subjectId = await getOrCreateSubjectId(iModel);

//   //   const modelId = SheetIndexModel.insert(iModel, subjectId, "testSheetIndex");
//   //   expect(Id64.isValidId64(modelId)).to.be.true;
//   // });

//   it("SheetIndex Should insert", async () => {
//     const subjectId = await getOrCreateSubjectId(iModel);

//     await iModel.locks.acquireLocks({
//       shared: subjectId,
//     });
//     const spec = CodeSpec.create(iModel, SheetIndex.getCodeSpecName(), CodeScopeSpec.Type.Model);
//     iModel.codeSpecs.insert(spec);

//     // const modelId = SheetIndexModel.insert(iModel, subjectId, "testSheetIndex");
//     const modelId = DictionaryModel.insert(iModel, subjectId, "TestSheetIndexModel");
//     expect(Id64.isValidId64(modelId)).to.be.true;

//     const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
//     expect(Id64.isValidId64(sheetIndex)).to.be.true;
//   });

//   it("SheetIndexFolders Should insert", async () => {
//     const subjectId = await getOrCreateSubjectId(iModel);

//     const spec = CodeSpec.create(iModel, SheetIndex.getCodeSpecName(), CodeScopeSpec.Type.Model);
//     iModel.codeSpecs.insert(spec);

//     // const modelId = SheetIndexModel.insert(iModel, subjectId, "testSheetIndex");
//     const modelId = DictionaryModel.insert(iModel, subjectId, "TestSheetIndexModel");
//     expect(Id64.isValidId64(modelId)).to.be.true;
//     const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
//     expect(Id64.isValidId64(sheetIndex)).to.be.true;

//     const folder1 = SheetIndexFolder.insert(iModel, modelId, sheetIndex, "TestFolder-1", 1);
//     expect(Id64.isValidId64(folder1)).to.be.true;

//     const folder2 = SheetIndexFolder.insert(iModel, modelId, sheetIndex, "TestFolder-2", 2);
//     expect(Id64.isValidId64(folder2)).to.be.true;
//   });

//   describe("SheetReferences", () => {
//     it("Should insert SheetReferences without a Sheet", async () => {
//       const subjectId = await getOrCreateSubjectId(iModel);

//       const spec = CodeSpec.create(iModel, SheetIndex.getCodeSpecName(), CodeScopeSpec.Type.Model);
//       iModel.codeSpecs.insert(spec);

//       // const modelId = SheetIndexModel.insert(iModel, subjectId, "testSheetIndex");
//       const modelId = DictionaryModel.insert(iModel, subjectId, "TestSheetIndexModel");
//       expect(Id64.isValidId64(modelId)).to.be.true;
//       const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
//       expect(Id64.isValidId64(sheetIndex)).to.be.true;

//       const folder1 = SheetIndexFolder.insert(iModel, modelId, sheetIndex, "TestFolder", 1);
//       expect(Id64.isValidId64(folder1)).to.be.true;

//       const sheetRef = SheetReference.insert(iModel, modelId, sheetIndex, "TestSheetRef", 1);
//       expect(Id64.isValidId64(sheetRef)).to.be.true;
//     });

//     it("Should insert with Sheet", async () => {
//       const subjectId = await getOrCreateSubjectId(iModel);
//       const sheetId = await insertSheet(iModel);

//       const spec = CodeSpec.create(iModel, SheetIndex.getCodeSpecName(), CodeScopeSpec.Type.Model);
//       iModel.codeSpecs.insert(spec);

//       // const modelId = SheetIndexModel.insert(iModel, subjectId, "testSheetIndex");
//       const modelId = DictionaryModel.insert(iModel, subjectId, "TestSheetIndexModel");
//       expect(Id64.isValidId64(modelId)).to.be.true;
//       const sheetIndex = SheetIndex.insert(iModel, modelId, "TestSheetIndex");
//       expect(Id64.isValidId64(sheetIndex)).to.be.true;

//       const folder1 = SheetIndexFolder.insert(iModel, modelId, sheetIndex, "TestFolder", 1);
//       expect(Id64.isValidId64(folder1)).to.be.true;

//       const sheetRef = SheetReference.insert(iModel, modelId, sheetIndex, "TestSheetRef", 1, sheetId);
//       expect(Id64.isValidId64(sheetRef)).to.be.true;
//     });
//   });
// });
