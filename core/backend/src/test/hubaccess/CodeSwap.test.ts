/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { Suite } from "mocha";
import { Id64String } from "@itwin/core-bentley";
import { Code, CodeScopeSpec, GeometricElement2dProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "..";
import { BriefcaseDb, ChannelControl, DrawingCategory } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { withEditTxn } from "../../EditTxn";
import { TestUtils } from "../TestUtils";

chai.use(chaiAsPromised);

describe("Code value management: null, swap, undo/redo, and cross-briefcase pull", function (this: Suite) {
  this.timeout(60000);

  before(async () => {
    await TestUtils.startBackend();
  });

  after(async () => {
    await TestUtils.shutdownBackend();
  });
  it("swap codeValues between two elements sharing the same codeSpec and codeScope, verify undo/redo in a single transaction", async () => {
    HubMock.startup("CodeSwapTest", KnownTestLocations.outputDir);
    let b1: BriefcaseDb | undefined;

    try {
      // --- Setup iModel ---
      const iModelId = await HubMock.createNewIModel({
        accessToken: "user1",
        iTwinId: HubMock.iTwinId,
        iModelName: "CodeSwapTest",
        description: "CodeSwapTest",
      });

      b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
      b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      // --- Create a drawing model + category and a CodeSpec ---
      let drawingModelId: Id64String;
      let drawingCategoryId: Id64String;
      let codeSpecId: Id64String;
      let codeScopeId: Id64String; // will be the drawing model

      await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
      withEditTxn(b1, "setup model, category, codeSpec", (txn) => {
        const modelCode = IModelTestUtils.getUniqueModelCode(b1!, "DrawingModel");
        const [, modelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, modelCode);
        drawingModelId = modelId;

        let catId = DrawingCategory.queryCategoryIdByName(b1!, IModel.dictionaryId, "MyDrawingCategory");
        if (undefined === catId)
          catId = DrawingCategory.insert(txn, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());
        drawingCategoryId = catId;

        codeSpecId = b1!.codeSpecs.insert(txn, "MyCodeSpec", CodeScopeSpec.Type.Model);
        codeScopeId = drawingModelId;
      });

      await b1.pushChanges({ description: "setup" });

      // --- Insert two elements with same codeSpecId/codeScopeId but different codeValues ---
      let elem1Id: Id64String;
      let elem2Id: Id64String;

      await b1.locks.acquireLocks({ shared: drawingModelId! });
      withEditTxn(b1, "insert two coded elements", (txn) => {
        const elem1Props: GeometricElement2dProps = {
          classFullName: "BisCore:DrawingGraphic",
          model: drawingModelId!,
          category: drawingCategoryId!,
          code: new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_A" }),
        };
        const elem2Props: GeometricElement2dProps = {
          classFullName: "BisCore:DrawingGraphic",
          model: drawingModelId!,
          category: drawingCategoryId!,
          code: new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_B" }),
        };
        elem1Id = txn.insertElement(elem1Props);
        elem2Id = txn.insertElement(elem2Props);
      });

      await b1.pushChanges({ description: "insert two elements with CODE_A and CODE_B" });

      // Verify initial state
      let e1 = b1.elements.getElementProps(elem1Id!);
      let e2 = b1.elements.getElementProps(elem2Id!);
      chai.expect(e1.code.spec).to.equal(codeSpecId!);
      chai.expect(e1.code.scope).to.equal(codeScopeId!);
      chai.expect(e1.code.value).to.equal("CODE_A");
      chai.expect(e2.code.spec).to.equal(codeSpecId!);
      chai.expect(e2.code.scope).to.equal(codeScopeId!);
      chai.expect(e2.code.value).to.equal("CODE_B");

      await b1.locks.acquireLocks({ exclusive: [elem2Id!, elem1Id!] });
      withEditTxn(b1, "swap code values", (txn) => {
        const props = b1!.elements.getElementProps(elem1Id!);
        props.code = new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "" });
        txn.updateElement(props);

        const props1 = b1!.elements.getElementProps(elem1Id!);
        const props2 = b1!.elements.getElementProps(elem2Id!);

        props2.code = new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_A" });
        props1.code = new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_B" });

        txn.updateElement(props2);
        txn.updateElement(props1);
      });
      b1.clearCaches();
      // Verify after swap2
      e1 = b1.elements.getElementProps(elem1Id!);
      e2 = b1.elements.getElementProps(elem2Id!);
      chai.expect(e1.code.value).to.equal("CODE_B");
      chai.expect(e2.code.value).to.equal("CODE_A");

      // --- Undo (reverse txn2: the swap) ---
      chai.expect(b1.txns.isUndoPossible).to.be.true;
      b1.txns.reverseTxns(1);

      e1 = b1.elements.getElementProps(elem1Id!);
      e2 = b1.elements.getElementProps(elem2Id!);
      chai.expect(e1.code.value).to.equal("CODE_A");
      chai.expect(e2.code.value).to.equal("CODE_B");

      // --- Redo (reinstate txn2: the swap) ---
      chai.expect(b1.txns.isRedoPossible).to.be.true;
      b1.txns.reinstateTxn();

      e1 = b1.elements.getElementProps(elem1Id!);
      e2 = b1.elements.getElementProps(elem2Id!);
      chai.expect(e1.code.value).to.equal("CODE_B");
      chai.expect(e2.code.value).to.equal("CODE_A");

    } finally {
      b1?.close();
      HubMock.shutdown();
    }
  });
  it("insert two elements with same codeSpecId and codeScopeId, null first code, swap codes, undo/redo, push", async () => {
    HubMock.startup("CodeSwapTest", KnownTestLocations.outputDir);
    let b1: BriefcaseDb | undefined;
    let b2: BriefcaseDb | undefined;

    try {
      // --- Setup iModel ---
      const iModelId = await HubMock.createNewIModel({
        accessToken: "user1",
        iTwinId: HubMock.iTwinId,
        iModelName: "CodeSwapTest",
        description: "CodeSwapTest",
      });

      b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
      b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId });
      b2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      // --- Create a drawing model + category and a CodeSpec ---
      let drawingModelId: Id64String;
      let drawingCategoryId: Id64String;
      let codeSpecId: Id64String;
      let codeScopeId: Id64String; // will be the drawing model

      await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
      withEditTxn(b1, "setup model, category, codeSpec", (txn) => {
        const modelCode = IModelTestUtils.getUniqueModelCode(b1!, "DrawingModel");
        const [, modelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, modelCode);
        drawingModelId = modelId;

        let catId = DrawingCategory.queryCategoryIdByName(b1!, IModel.dictionaryId, "MyDrawingCategory");
        if (undefined === catId)
          catId = DrawingCategory.insert(txn, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());
        drawingCategoryId = catId;

        codeSpecId = b1!.codeSpecs.insert(txn, "MyCodeSpec", CodeScopeSpec.Type.Model);
        codeScopeId = drawingModelId;
      });

      await b1.pushChanges({ description: "setup" });
      await b2.pullChanges();

      // --- Insert two elements with same codeSpecId/codeScopeId but different codeValues ---
      let elem1Id: Id64String;
      let elem2Id: Id64String;

      await b1.locks.acquireLocks({ shared: drawingModelId! });
      withEditTxn(b1, "insert two coded elements", (txn) => {
        const elem1Props: GeometricElement2dProps = {
          classFullName: "BisCore:DrawingGraphic",
          model: drawingModelId!,
          category: drawingCategoryId!,
          code: new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_A" }),
        };
        const elem2Props: GeometricElement2dProps = {
          classFullName: "BisCore:DrawingGraphic",
          model: drawingModelId!,
          category: drawingCategoryId!,
          code: new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_B" }),
        };
        elem1Id = txn.insertElement(elem1Props);
        elem2Id = txn.insertElement(elem2Props);
      });

      await b1.pushChanges({ description: "insert two elements with CODE_A and CODE_B" });
      await b2.pullChanges();

      // Verify initial state
      let e1 = b1.elements.getElementProps(elem1Id!);
      let e2 = b1.elements.getElementProps(elem2Id!);
      chai.expect(e1.code.spec).to.equal(codeSpecId!);
      chai.expect(e1.code.scope).to.equal(codeScopeId!);
      chai.expect(e1.code.value).to.equal("CODE_A");
      chai.expect(e2.code.spec).to.equal(codeSpecId!);
      chai.expect(e2.code.scope).to.equal(codeScopeId!);
      chai.expect(e2.code.value).to.equal("CODE_B");

      // --- Step 1 (txn1): Set codeValue of elem1 to empty (null-equivalent) ---
      await b1.locks.acquireLocks({ exclusive: [elem1Id!] });
      withEditTxn(b1, "set elem1 code to null", (txn) => {
        const props = b1!.elements.getElementProps(elem1Id!);
        props.code = new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "" });
        txn.updateElement(props);
      });

      e1 = b1.elements.getElementProps(elem1Id!);
      chai.expect(e1.code.value).to.satisfy((v: string | undefined) => v === undefined || v === "");

      // --- Step 2 (txn2): Swap codeValues — elem1 gets CODE_B, elem2 gets CODE_A ---
      // elem1's intermediate empty code value avoids a uniqueness conflict while assigning CODE_A to elem2.
      await b1.locks.acquireLocks({ exclusive: [elem2Id!] });
      withEditTxn(b1, "swap code values", (txn) => {
        const props1 = b1!.elements.getElementProps(elem1Id!);
        const props2 = b1!.elements.getElementProps(elem2Id!);

        props2.code = new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_A" });
        props1.code = new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_B" });

        txn.updateElement(props2);
        txn.updateElement(props1);
      });
      b1.clearCaches();
      // Verify after swap
      e1 = b1.elements.getElementProps(elem1Id!);
      e2 = b1.elements.getElementProps(elem2Id!);
      chai.expect(e1.code.value).to.equal("CODE_B");
      chai.expect(e2.code.value).to.equal("CODE_A");

      // --- Undo (reverse txn2: the swap) ---
      chai.expect(b1.txns.isUndoPossible).to.be.true;
      b1.txns.reverseTxns(1);

      e1 = b1.elements.getElementProps(elem1Id!);
      e2 = b1.elements.getElementProps(elem2Id!);
      chai.expect(e1.code.value).to.satisfy((v: string | undefined) => v === undefined || v === "");
      chai.expect(e2.code.value).to.equal("CODE_B");

      // --- Redo (reinstate txn2: the swap) ---
      chai.expect(b1.txns.isRedoPossible).to.be.true;
      b1.txns.reinstateTxn();

      e1 = b1.elements.getElementProps(elem1Id!);
      e2 = b1.elements.getElementProps(elem2Id!);
      chai.expect(e1.code.value).to.equal("CODE_B");
      chai.expect(e2.code.value).to.equal("CODE_A");
      // --- Push changes ---
      await b1.pushChanges({ description: "null elem1 code and swap code values" });
      await b2.pullChanges();

      // No local txns remain after push
      chai.expect(b1.txns.isUndoPossible).to.be.false;
      chai.expect(b1.txns.isRedoPossible).to.be.false;

      // Verify b2 sees the final swapped code values after pulling
      const b2e1 = b2.elements.getElementProps(elem1Id!);
      const b2e2 = b2.elements.getElementProps(elem2Id!);
      chai.expect(b2e1.code.value).to.equal("CODE_B");
      chai.expect(b2e2.code.value).to.equal("CODE_A");

    } finally {
      b1?.close();
      b2?.close();
      HubMock.shutdown();
    }
  });
  it("delete element with existing code and insert new element with same code, verify undo/redo, push, and b2 sees final state after pull", async () => {
    HubMock.startup("CodeDeleteInsertTest", KnownTestLocations.outputDir);
    let b1: BriefcaseDb | undefined;
    let b2: BriefcaseDb | undefined;

    try {
      // --- Setup iModel ---
      const iModelId = await HubMock.createNewIModel({
        accessToken: "user1",
        iTwinId: HubMock.iTwinId,
        iModelName: "CodeDeleteInsertTest",
        description: "CodeDeleteInsertTest",
      });

      b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
      b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId });
      b2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      // --- Create a drawing model + category and a CodeSpec ---
      let drawingModelId: Id64String;
      let drawingCategoryId: Id64String;
      let codeSpecId: Id64String;
      let codeScopeId: Id64String;

      await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
      withEditTxn(b1, "setup model, category, codeSpec", (txn) => {
        const modelCode = IModelTestUtils.getUniqueModelCode(b1!, "DrawingModel");
        const [, modelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, modelCode);
        drawingModelId = modelId;

        let catId = DrawingCategory.queryCategoryIdByName(b1!, IModel.dictionaryId, "MyDrawingCategory");
        if (undefined === catId)
          catId = DrawingCategory.insert(txn, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());
        drawingCategoryId = catId;

        codeSpecId = b1!.codeSpecs.insert(txn, "MyCodeSpec", CodeScopeSpec.Type.Model);
        codeScopeId = drawingModelId;
      });

      await b1.pushChanges({ description: "setup" });
      await b2.pullChanges();

      // --- Insert an element with a code ---
      let elem1Id: Id64String;

      await b1.locks.acquireLocks({ shared: drawingModelId! });
      withEditTxn(b1, "insert element with CODE_A", (txn) => {
        const elem1Props: GeometricElement2dProps = {
          classFullName: "BisCore:DrawingGraphic",
          model: drawingModelId!,
          category: drawingCategoryId!,
          code: new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_A" }),
        };
        elem1Id = txn.insertElement(elem1Props);
      });

      await b1.pushChanges({ description: "insert element with CODE_A" });
      await b2.pullChanges();

      // Verify initial state
      let e1 = b1.elements.getElementProps(elem1Id!);
      chai.expect(e1.code.spec).to.equal(codeSpecId!);
      chai.expect(e1.code.scope).to.equal(codeScopeId!);
      chai.expect(e1.code.value).to.equal("CODE_A");

      // --- Delete elem1 and insert a new element with the same code ---
      let newElemId: Id64String;

      await b1.locks.acquireLocks({ exclusive: [elem1Id!] });
      withEditTxn(b1, "delete elem1 and insert new element with same code", (txn) => {
        txn.deleteElement(elem1Id!);

        const newElemProps: GeometricElement2dProps = {
          classFullName: "BisCore:DrawingGraphic",
          model: drawingModelId!,
          category: drawingCategoryId!,
          code: new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_A" }),
        };
        newElemId = txn.insertElement(newElemProps);
      });

      b1.clearCaches();

      // Verify after delete + insert
      chai.expect(() => b1!.elements.getElementProps(elem1Id!)).to.throw();
      const newElem = b1.elements.getElementProps(newElemId!);
      chai.expect(newElem.code.value).to.equal("CODE_A");

      // --- Undo (reverse the delete + insert) ---
      chai.expect(b1.txns.isUndoPossible).to.be.true;
      b1.txns.reverseTxns(1);

      e1 = b1.elements.getElementProps(elem1Id!);
      chai.expect(e1.code.value).to.equal("CODE_A");
      chai.expect(() => b1!.elements.getElementProps(newElemId!)).to.throw();

      // --- Redo (reinstate the delete + insert) ---
      chai.expect(b1.txns.isRedoPossible).to.be.true;
      b1.txns.reinstateTxn();

      chai.expect(() => b1!.elements.getElementProps(elem1Id!)).to.throw();
      const redoneElem = b1.elements.getElementProps(newElemId!);
      chai.expect(redoneElem.code.value).to.equal("CODE_A");

      // --- Push changes ---
      await b1.pushChanges({ description: "delete elem1 and insert new element with same code" });
      await b2.pullChanges();

      // No local txns remain after push
      chai.expect(b1.txns.isUndoPossible).to.be.false;
      chai.expect(b1.txns.isRedoPossible).to.be.false;

      // Verify b2 sees the final state after pulling
      chai.expect(() => b2!.elements.getElementProps(elem1Id!)).to.throw();
      const b2NewElem = b2.elements.getElementProps(newElemId!);
      chai.expect(b2NewElem.code.value).to.equal("CODE_A");

    } finally {
      b1?.close();
      b2?.close();
      HubMock.shutdown();
    }
  });

  it("single-transaction code swap reverts to old behaviour (swap not applied) when noUpdateLoop is true", async () => {
    HubMock.startup("CodeSwapNoUpdateLoopTest", KnownTestLocations.outputDir);
    let b1: BriefcaseDb | undefined;
    let b2: BriefcaseDb | undefined;

    try {
      // --- Setup iModel ---
      const iModelId = await HubMock.createNewIModel({
        accessToken: "user1",
        iTwinId: HubMock.iTwinId,
        iModelName: "CodeSwapNoUpdateLoopTest",
        description: "CodeSwapNoUpdateLoopTest",
      });

      b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
      b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId });
      b2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      let drawingModelId: Id64String;
      let drawingCategoryId: Id64String;
      let codeSpecId: Id64String;
      let codeScopeId: Id64String;

      await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
      withEditTxn(b1, "setup model, category, codeSpec", (txn) => {
        const modelCode = IModelTestUtils.getUniqueModelCode(b1!, "DrawingModel");
        const [, modelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, modelCode);
        drawingModelId = modelId;

        let catId = DrawingCategory.queryCategoryIdByName(b1!, IModel.dictionaryId, "MyDrawingCategory");
        if (undefined === catId)
          catId = DrawingCategory.insert(txn, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());
        drawingCategoryId = catId;

        codeSpecId = b1!.codeSpecs.insert(txn, "MyCodeSpec", CodeScopeSpec.Type.Model);
        codeScopeId = drawingModelId;
      });

      await b1.pushChanges({ description: "setup" });
      await b2.pullChanges();

      let elem1Id: Id64String;
      let elem2Id: Id64String;

      await b1.locks.acquireLocks({ shared: drawingModelId! });
      withEditTxn(b1, "insert two coded elements", (txn) => {
        const elem1Props: GeometricElement2dProps = {
          classFullName: "BisCore:DrawingGraphic",
          model: drawingModelId!,
          category: drawingCategoryId!,
          code: new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_A" }),
        };
        const elem2Props: GeometricElement2dProps = {
          classFullName: "BisCore:DrawingGraphic",
          model: drawingModelId!,
          category: drawingCategoryId!,
          code: new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_B" }),
        };
        elem1Id = txn.insertElement(elem1Props);
        elem2Id = txn.insertElement(elem2Props);
      });

      await b1.pushChanges({ description: "insert two elements with CODE_A and CODE_B" });
      await b2.pullChanges();

      // --- Single-transaction swap: null elem1, then swap codes ---
      await b1.locks.acquireLocks({ exclusive: [elem2Id!, elem1Id!] });
      withEditTxn(b1, "single-txn swap", (txn) => {
        // Step 1: null out elem1's code to free the uniqueness slot
        const props = b1!.elements.getElementProps(elem1Id!);
        props.code = new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "" });
        txn.updateElement(props);

        // Step 2: assign CODE_A to elem2, CODE_B to elem1
        const props1 = b1!.elements.getElementProps(elem1Id!);
        const props2 = b1!.elements.getElementProps(elem2Id!);
        props2.code = new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_A" });
        props1.code = new Code({ spec: codeSpecId!, scope: codeScopeId!, value: "CODE_B" });
        txn.updateElement(props2);
        txn.updateElement(props1);
      });

      // Verify b1 has the swapped state
      b1.clearCaches();
      const b1e1 = b1.elements.getElementProps(elem1Id!);
      const b1e2 = b1.elements.getElementProps(elem2Id!);
      chai.expect(b1e1.code.value).to.equal("CODE_B");
      chai.expect(b1e2.code.value).to.equal("CODE_A");

      await b1.pushChanges({ description: "single-txn code swap" });

      // Pull with noUpdateLoop: true — this uses the old (pre-fix) apply path.
      // The unique-index conflict handler skips the intermediate null step,
      // so the swap is silently dropped and b2 retains the original codes.
      // noUpdateLoop is intentionally not in the public PullChangesArgs type.
      type InternalPullArgs = Parameters<BriefcaseDb["pullChanges"]>[0] & { noUpdateLoop?: boolean };
      await b2.pullChanges({ noUpdateLoop: true } as InternalPullArgs);

      b2.clearCaches();
      const b2e1 = b2.elements.getElementProps(elem1Id!);
      const b2e2 = b2.elements.getElementProps(elem2Id!);
      // Old behaviour: swap did NOT land — b2 still sees the original codes
      chai.expect(b2e1.code.value).to.equal("CODE_A");
      chai.expect(b2e2.code.value).to.equal("CODE_B");

    } finally {
      b1?.close();
      b2?.close();
      HubMock.shutdown();
    }
  });
});
