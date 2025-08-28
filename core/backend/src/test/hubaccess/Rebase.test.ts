/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "..";
import { BriefcaseDb, ChannelControl, DrawingCategory, IModelHost, SqliteChangesetReader, TxnProps } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { Suite } from "mocha";
import { Code, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley/lib/cjs/Id";
import { assert } from "console";
chai.use(chaiAsPromised);

describe("change merge manager", function (this: Suite) {
  before(async () => {
    await IModelHost.startup();
  });

  it("SaveChangesArgs() and direct/indirect changes", async () => {
    HubMock.startup("PullMergeMethod", KnownTestLocations.outputDir);

    const iModelId = await HubMock.createNewIModel({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelName: "Test", description: "TestSubject" });

    const b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b1.saveChanges();

    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="a1">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="prop1" typeName="string" />
        </ECEntityClass>
    </ECSchema>`;

    await b1.importSchemaStrings([schema1]);
    chai.expect(b1.txns.hasPendingTxns).to.be.true

    await b1.pushChanges({ description: "schema1" });
    //-----------------------------------------------------
    // Create drawing model and category
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(b1, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(b1, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(b1, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());

    b1.saveChanges({
      description: "Initial Test Data Setup",
      source: "Test",
      appData: {
        test: "init"
      }
    });

    let lastTxn = b1.txns.changeMergeManager.getLastTxnSaved();

    chai.assert.isDefined(lastTxn);
    chai.assert.isFalse(lastTxn?.reversed);
    chai.assert.isFalse(lastTxn?.grouped);
    chai.assert.isTrue(lastTxn?.props.description === 'Initial Test Data Setup');
    chai.assert.isTrue(lastTxn?.props.source === 'Test');
    chai.assert.isTrue(lastTxn?.props?.appData?.test === 'init');
    chai.assert.isTrue(lastTxn?.type === 'Data');

    await b1.pushChanges({ description: "init" });

    const b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId });
    b2.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b2.saveChanges();

    const b3 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId });
    b3.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b3.saveChanges();
    //-----------------------------------------------------
    await b1.locks.acquireLocks({ shared: [IModel.repositoryModelId, drawingCategoryId, drawingModelId] });
    const baseProps = {
      classFullName: "TestDomain:a1",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
    };

    const expectedInsertedEl = new Map<Id64String, { id: Id64String, isIndirect: boolean }>();
    const insertDirectEl = (b: BriefcaseDb) => {
      const id = b.elements.insertElement({ ...baseProps, prop1: `${b.briefcaseId}` } as any);
      expectedInsertedEl.set(id, { id, isIndirect: false });
    }
    const insertIndirectEl = (b: BriefcaseDb) => {
      const id = b.elements.insertElement({ ...baseProps, prop1: `${b.briefcaseId}` } as any);
      expectedInsertedEl.set(id, { id, isIndirect: true });
    };

    insertDirectEl(b1);
    insertDirectEl(b1);
    b1.txns.withIndirectTxnMode(() => {
      insertIndirectEl(b1);
      insertIndirectEl(b1);
      insertIndirectEl(b1);
    });
    insertDirectEl(b1);
    insertDirectEl(b1);

    b1.saveChanges("insert some element 1 direct and 3 indirect");
    lastTxn = b1.txns.changeMergeManager.getLastTxnSaved();
    let checkCount = 0;
    chai.assert.isDefined(lastTxn);
    if (lastTxn) {
      const reader = SqliteChangesetReader.openTxn({ txnId: lastTxn?.id, db: b1 });
      while (reader.step()) {
        const id = reader.primaryKeyValues[0] as Id64String;
        if (!expectedInsertedEl.has(id)) {
          continue;
        }
        const isIndirect = reader.isIndirect;
        if (isIndirect) {
          chai.assert.isTrue(expectedInsertedEl.get(id)?.isIndirect);
        } else {
          chai.assert.isFalse(expectedInsertedEl.get(id)?.isIndirect);
        }
        checkCount++;
      }
    }
    assert(checkCount === expectedInsertedEl.size * 2);
    assert(checkCount === 14); // two table bis_Element and bis_GeometricElement3d so 7+7 =14

    chai.assert.isDefined(lastTxn);
    chai.assert.isTrue(lastTxn?.id === '0x100000000');
    chai.assert.isFalse(lastTxn?.reversed);
    chai.assert.isFalse(lastTxn?.grouped);
    chai.assert.isTrue(lastTxn?.props.description === 'insert some element 1 direct and 3 indirect');
    chai.assert.isTrue(lastTxn?.type === 'Data');

    await b1.pushChanges({ description: "insert element 4 direct and 3 indirect" });

    //-----------------------------------------------------

    await b2.pullChanges();
    await b3.pullChanges();


    const directEls = Array.from(expectedInsertedEl.values()).filter(v => !v.isIndirect).map(v => v.id);
    const indirectEls = Array.from(expectedInsertedEl.values()).filter(v => v.isIndirect).map(v => v.id);

    //-----------------------------------------------------
    await b1.locks.acquireLocks({ shared: [IModel.repositoryModelId, drawingCategoryId, drawingModelId] });
    insertDirectEl(b1)
    b1.txns.withIndirectTxnMode(()=>{
      b1.elements.deleteElement(indirectEls[0])
    });
    b1.saveChanges("inserted new element");
    await b1.pushChanges({ description: "insert element" });
    //-----------------------------------------------------

    await b2.locks.acquireLocks({ shared: [IModel.repositoryModelId, drawingCategoryId, drawingModelId] });

    const expectedUpdatedEl = new Map<Id64String, { id: Id64String, isIndirect: boolean }>();
    const updateDirectEl = async (b: BriefcaseDb, elId: Id64String) => {
      await b.locks.acquireLocks({ exclusive: [elId] });
      const elProps = b.elements.getElementProps(elId);
      b.elements.updateElement({ ...elProps, prop1: `${b.briefcaseId}` } as any);
      expectedUpdatedEl.set(elId, { id: elId, isIndirect: false });
    };

    const updateIndirectEl = (b: BriefcaseDb, elId: Id64String) => {
      const elProps = b.elements.getElementProps(elId);
      b.elements.updateElement({ ...elProps, prop1: `${b.briefcaseId}` } as any);
      expectedUpdatedEl.set(elId, { id: elId, isIndirect: true });
    };


    // txn 1 ----------------------------
    await updateDirectEl(b2, directEls[0]);

    // should not require any locks
    b2.txns.withIndirectTxnMode(()=>{
      b2.elements.deleteElement(indirectEls[0])
    });
    b2.saveChanges("update element 1");

    // txn 2 ----------------------------
    await updateDirectEl(b2, directEls[1]);

    // should not require any locks
    b2.txns.withIndirectTxnMode(() => {
      updateIndirectEl(b2, indirectEls[1]);
    });
    b2.saveChanges("update element 2");

    // txn 3 ----------------------------
    await updateDirectEl(b2, directEls[2]);

    // should not require any locks
    b2.txns.withIndirectTxnMode(() => {
      updateIndirectEl(b2, indirectEls[2]);
    });
    b2.saveChanges("update element 3");

    // rebase ---------------------------
    let isRecomputedInvoked = 0;
    let isShouldReinstateInvoked = 0;
    b2.txns.changeMergeManager.setRebaseHandler({
      shouldReinstate(_txn: TxnProps) {
        isShouldReinstateInvoked++;
        return true;
      },
      async recompute(_txn: TxnProps): Promise<void> {
        isRecomputedInvoked++;
      }
    });

    await b2.pullChanges();
    chai.assert.isTrue(isShouldReinstateInvoked === 3);
    chai.assert.isTrue(isRecomputedInvoked === 3);
    // txn 4 ----------------------------
    insertDirectEl(b2)
    b2.saveChanges("update element 3");


    b2.close();
    b3.close();
    HubMock.shutdown();
  });
});
