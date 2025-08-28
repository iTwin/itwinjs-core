/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "..";
import { BriefcaseDb, ChannelControl, DrawingCategory, IModelHost, SqliteChangesetReader, TxnProps } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { after, Suite } from "mocha";
import { Code, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley/lib/cjs/Id";
chai.use(chaiAsPromised);

class TestIModel {
  public iModelId: Id64String = "";
  public drawingModelId: Id64String = "";
  public drawingCategoryId: Id64String = "";
  public briefcases: BriefcaseDb[] = [];
  private _data = 0;
  public constructor() { }
  public async startup() {
    HubMock.startup("TestIModel", KnownTestLocations.outputDir);
    this.iModelId = await HubMock.createNewIModel({ iTwinId: HubMock.iTwinId, iModelName: "Test", description: "TestSubject" });
    const b1 = await HubWrappers.downloadAndOpenBriefcase({ iTwinId: HubMock.iTwinId, iModelId: this.iModelId });
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
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
    this.drawingModelId = IModelTestUtils.createAndInsertDrawingPartitionAndModel(b1, codeProps, true)[1];
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(b1, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(b1, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());
    this.drawingCategoryId = drawingCategoryId;
    b1.saveChanges();
    await b1.pushChanges({description: "drawing category"});
    b1.close();
  }
  public async openBriefcase(): Promise<BriefcaseDb> {
    const b = await HubWrappers.downloadAndOpenBriefcase({ iTwinId: HubMock.iTwinId, iModelId: this.iModelId });
    b.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b.saveChanges();
    this.briefcases.push(b);
    return b;
  }
  public async insertElement(b: BriefcaseDb, markAsIndirect?: true) {
    await b.locks.acquireLocks({ shared: [this.drawingModelId] });
    const baseProps = {
      classFullName: "TestDomain:a1",
      model: this.drawingModelId,
      category: this.drawingCategoryId,
      code: Code.createEmpty(),
    };
    let id: Id64String = "";
    if (markAsIndirect) {
      b.txns.withIndirectTxnMode(() => {
        id = b.elements.insertElement({ ...baseProps, prop1: `${this._data++}` } as any);
      });
      return id;
    }
    return b.elements.insertElement({ ...baseProps, prop1: `${this._data++}` } as any);
  }
  public async updateElement(b: BriefcaseDb, id: Id64String, markAsIndirect?: true) {
    await b.locks.acquireLocks({ shared: [this.drawingModelId], exclusive: [id] });
    const elProps = b.elements.getElementProps(id);

    if (markAsIndirect) {
      b.txns.withIndirectTxnMode(() => {
        b.elements.updateElement({ ...elProps, prop1: `${this._data++}` } as any);
      });
    } else {
      b.elements.updateElement({ ...elProps, prop1: `${this._data++}` } as any);
    }
  }
  public async deleteElement(b: BriefcaseDb, id: Id64String, markAsIndirect?: true) {
    await b.locks.acquireLocks({ shared: [this.drawingModelId], exclusive: [id] });
    if (markAsIndirect) {
      b.txns.withIndirectTxnMode(() => {
        b.elements.deleteElement(id);
      });
    } else {
      b.elements.deleteElement(id);
    }
  }
  public async shutdown(): Promise<void> {
    this.briefcases.forEach(b => b.close());
    HubMock.shutdown();
  }
}

describe.only("change merge manager", function (this: Suite) {
  let testIModel: TestIModel;
  before(async () => {
    if (!IModelHost.isValid)
      await IModelHost.startup();
    testIModel = new TestIModel();
    await testIModel.startup();
  });
  after(async () => {
    await testIModel.shutdown();
  });

  it("save changes args", async () => {
    const b1 = await testIModel.openBriefcase();
    await testIModel.insertElement(b1)
    b1.saveChanges({
      source: "test",
      description: "test description",
      appData: {
        test: "test",
        foo: [1, 2, 3],
        bar: { baz: "qux" }
      }
    });

    let lastTxn = b1.txns.changeMergeManager.getLastTxnSaved();
    chai.assert.isDefined(lastTxn);
    if (lastTxn) {
      chai.expect(lastTxn.props.source).to.be.equals("test");
      chai.expect(lastTxn.props.description).to.be.equals("test description");
      chai.expect(lastTxn.props.appData).to.not.be.undefined;
      chai.expect(lastTxn.props.appData?.test).to.be.eq("test");
      chai.expect(lastTxn.props.appData?.foo).to.be.deep.eq([1, 2, 3]);
      chai.expect(lastTxn.props.appData?.bar).to.be.deep.eq({ baz: "qux" });
      chai.expect(lastTxn.nextId).to.be.undefined;
      chai.expect(lastTxn.prevId).to.be.undefined;
      chai.expect(lastTxn.type).to.be.eq("Data");
      chai.expect(lastTxn.id).to.be.eq('0x100000000');
      chai.expect(lastTxn.reversed).to.be.false;
      chai.expect(lastTxn.grouped).to.be.false;
    }

    await testIModel.insertElement(b1)
    b1.saveChanges({
      source: "test2",
      description: "test description 2",
      appData: {
        test: "test 2",
        foo: [11, 12, 13],
        bar: { baz: "qux2" }
      }
    });

    lastTxn = b1.txns.changeMergeManager.getLastTxnSaved();
    chai.assert.isDefined(lastTxn);
    if (lastTxn) {
      chai.expect(lastTxn.props.source).to.be.equals("test2");
      chai.expect(lastTxn.props.description).to.be.equals("test description 2");
      chai.expect(lastTxn.props.appData).to.not.be.undefined;
      chai.expect(lastTxn.props.appData?.test).to.be.eq("test 2");
      chai.expect(lastTxn.props.appData?.foo).to.be.deep.eq([11, 12, 13]);
      chai.expect(lastTxn.props.appData?.bar).to.be.deep.eq({ baz: "qux2" });
      chai.expect(lastTxn.nextId).to.be.undefined;
      chai.expect(lastTxn.prevId).to.be.equal('0x100000000');
      chai.expect(lastTxn.type).to.be.eq("Data");
      chai.expect(lastTxn.id).to.be.eq('0x100000001');
      chai.expect(lastTxn.reversed).to.be.false;
      chai.expect(lastTxn.grouped).to.be.false;
    }

    await testIModel.insertElement(b1)
    b1.saveChanges("new element");
    lastTxn = b1.txns.changeMergeManager.getLastTxnSaved();
    chai.assert.isDefined(lastTxn);
    if (lastTxn) {
      chai.expect(lastTxn.props.source).is.undefined;
      chai.expect(lastTxn.props.description).to.be.equals("new element");
      chai.expect(lastTxn.props.appData).to.be.undefined;
      chai.expect(lastTxn.nextId).to.be.undefined;
      chai.expect(lastTxn.prevId).to.be.equal('0x100000001');
      chai.expect(lastTxn.type).to.be.eq("Data");
      chai.expect(lastTxn.id).to.be.eq('0x100000002');
      chai.expect(lastTxn.reversed).to.be.false;
      chai.expect(lastTxn.grouped).to.be.false;
    }

    await b1.pushChanges({ description: "new element" });
    chai.expect(b1.txns.isUndoPossible).is.false;
    chai.expect(b1.txns.isRedoPossible).is.false;
    lastTxn = b1.txns.changeMergeManager.getLastTxnSaved();
    chai.assert.isUndefined(lastTxn);
  });

  it("direct / indirect", async () => {
    const b1 = await testIModel.openBriefcase();
    const directElId = await testIModel.insertElement(b1);
    const indirectElId = await testIModel.insertElement(b1, true);
    chai.expect(directElId).to.not.be.undefined;
    chai.expect(indirectElId).to.not.be.undefined;
    b1.saveChanges({ description: "insert element 1 direct and 1 indirect" });
    const txn = b1.txns.changeMergeManager.getLastTxnSaved();
    chai.assert.isDefined(txn);
    if (txn) {
      let checkCount = 0;
      const reader = SqliteChangesetReader.openTxn({ txnId: txn?.id, db: b1 });
      while (reader.step()) {
        if (reader.primaryKeyValues.length === 0) continue;
        if (reader.tableName !== "bis_Element") continue;
        const iid = reader.primaryKeyValues[0] as Id64String;
        if (iid === directElId) {
          chai.expect(reader.isIndirect).to.be.false;
        }
        if (iid === indirectElId) {
          chai.expect(reader.isIndirect).to.be.true;
        }
        checkCount++;
      }
      chai.expect(checkCount).to.be.equals(2);
    }

    await b1.pushChanges({ description: "insert element 1 direct and 1 indirect" });
    chai.expect(b1.txns.isUndoPossible).is.false;
    chai.expect(b1.txns.isRedoPossible).is.false;
    const lastTxn = b1.txns.changeMergeManager.getLastTxnSaved();
    chai.assert.isUndefined(lastTxn);
  });

  it("rebase handler", async () => {
    const b1 = await testIModel.openBriefcase();
    const b2 = await testIModel.openBriefcase();

    const e1 = await testIModel.insertElement(b1);
    const e2 = await testIModel.insertElement(b1, true);
    b1.saveChanges();
    await b1.pushChanges({description: "insert element 1 direct and 1 indirect"});

    await b2.pullChanges();

    await testIModel.updateElement(b1, e1);
    await testIModel.updateElement(b1, e2,  true);
    b1.saveChanges();
    await b1.pushChanges({description: "update element 1 direct and 1 indirect"});


    await testIModel.insertElement(b2);
    await testIModel.insertElement(b2, true);
    b2.saveChanges("first change");

    await testIModel.insertElement(b2);
    await testIModel.insertElement(b2, true);
    b2.saveChanges("second change");

    await testIModel.insertElement(b2);
    await testIModel.insertElement(b2, true);
    b2.saveChanges("third change");

    b2.txns.changeMergeManager.setRebaseHandler({
      shouldReinstate: (_txn: TxnProps) => {
        return true;
      },
      recompute: async (_txn: TxnProps): Promise<void> => {
        await testIModel.insertElement(b2);
        await testIModel.insertElement(b2, true);
      },
    });

    await b1.pullChanges();
  });
  // it("SaveChangesArgs() and direct/indirect changes", async () => {
  //   const b1 = await testIModel.openBriefcase();
  //   const b2 = await testIModel.openBriefcase();
  //   //-----------------------------------------------------
  //   await b1.locks.acquireLocks({ shared: [IModel.repositoryModelId, testIModel.drawingCategoryId, testIModel.drawingModelId] });
  //   const baseProps = {
  //     classFullName: "TestDomain:a1",
  //     model: drawingModelId,
  //     category: drawingCategoryId,
  //     code: Code.createEmpty(),
  //   };

  //   const expectedInsertedEl = new Map<Id64String, { id: Id64String, isIndirect: boolean }>();
  //   const insertDirectEl = (b: BriefcaseDb) => {
  //     const id = b.elements.insertElement({ ...baseProps, prop1: `${b.briefcaseId}` } as any);
  //     expectedInsertedEl.set(id, { id, isIndirect: false });
  //   }
  //   const insertIndirectEl = (b: BriefcaseDb) => {
  //     const id = b.elements.insertElement({ ...baseProps, prop1: `${b.briefcaseId}` } as any);
  //     expectedInsertedEl.set(id, { id, isIndirect: true });
  //   };

  //   insertDirectEl(b1);
  //   insertDirectEl(b1);
  //   b1.txns.withIndirectTxnMode(() => {
  //     insertIndirectEl(b1);
  //     insertIndirectEl(b1);
  //     insertIndirectEl(b1);
  //   });
  //   insertDirectEl(b1);
  //   insertDirectEl(b1);

  //   b1.saveChanges("insert some element 1 direct and 3 indirect");
  //   lastTxn = b1.txns.changeMergeManager.getLastTxnSaved();
  //   let checkCount = 0;
  //   chai.assert.isDefined(lastTxn);
  //   if (lastTxn) {
  //     const reader = SqliteChangesetReader.openTxn({ txnId: lastTxn?.id, db: b1 });
  //     while (reader.step()) {
  //       const id = reader.primaryKeyValues[0] as Id64String;
  //       if (!expectedInsertedEl.has(id)) {
  //         continue;
  //       }
  //       const isIndirect = reader.isIndirect;
  //       if (isIndirect) {
  //         chai.assert.isTrue(expectedInsertedEl.get(id)?.isIndirect);
  //       } else {
  //         chai.assert.isFalse(expectedInsertedEl.get(id)?.isIndirect);
  //       }
  //       checkCount++;
  //     }
  //   }
  //   assert(checkCount === expectedInsertedEl.size * 2);
  //   assert(checkCount === 14); // two table bis_Element and bis_GeometricElement3d so 7+7 =14

  //   chai.assert.isDefined(lastTxn);
  //   chai.assert.isTrue(lastTxn?.id === '0x100000000');
  //   chai.assert.isFalse(lastTxn?.reversed);
  //   chai.assert.isFalse(lastTxn?.grouped);
  //   chai.assert.isTrue(lastTxn?.props.description === 'insert some element 1 direct and 3 indirect');
  //   chai.assert.isTrue(lastTxn?.type === 'Data');

  //   await b1.pushChanges({ description: "insert element 4 direct and 3 indirect" });

  //   //-----------------------------------------------------

  //   await b2.pullChanges();
  //   await b3.pullChanges();


  //   const directEls = Array.from(expectedInsertedEl.values()).filter(v => !v.isIndirect).map(v => v.id);
  //   const indirectEls = Array.from(expectedInsertedEl.values()).filter(v => v.isIndirect).map(v => v.id);

  //   //-----------------------------------------------------
  //   await b1.locks.acquireLocks({ shared: [IModel.repositoryModelId, drawingCategoryId, drawingModelId] });
  //   insertDirectEl(b1)
  //   b1.txns.withIndirectTxnMode(() => {
  //     b1.elements.deleteElement(indirectEls[0])
  //   });
  //   b1.saveChanges("inserted new element");
  //   await b1.pushChanges({ description: "insert element" });
  //   //-----------------------------------------------------

  //   await b2.locks.acquireLocks({ shared: [IModel.repositoryModelId, drawingCategoryId, drawingModelId] });

  //   const expectedUpdatedEl = new Map<Id64String, { id: Id64String, isIndirect: boolean }>();
  //   const updateDirectEl = async (b: BriefcaseDb, elId: Id64String) => {
  //     await b.locks.acquireLocks({ exclusive: [elId] });
  //     const elProps = b.elements.getElementProps(elId);
  //     b.elements.updateElement({ ...elProps, prop1: `${b.briefcaseId}` } as any);
  //     expectedUpdatedEl.set(elId, { id: elId, isIndirect: false });
  //   };

  //   const updateIndirectEl = (b: BriefcaseDb, elId: Id64String) => {
  //     const elProps = b.elements.getElementProps(elId);
  //     b.elements.updateElement({ ...elProps, prop1: `${b.briefcaseId}` } as any);
  //     expectedUpdatedEl.set(elId, { id: elId, isIndirect: true });
  //   };


  //   // txn 1 ----------------------------
  //   await updateDirectEl(b2, directEls[0]);

  //   // should not require any locks
  //   b2.txns.withIndirectTxnMode(() => {
  //     b2.elements.deleteElement(indirectEls[0])
  //   });
  //   b2.saveChanges("update element 1");

  //   // txn 2 ----------------------------
  //   await updateDirectEl(b2, directEls[1]);

  //   // should not require any locks
  //   b2.txns.withIndirectTxnMode(() => {
  //     updateIndirectEl(b2, indirectEls[1]);
  //   });
  //   b2.saveChanges("update element 2");

  //   // txn 3 ----------------------------
  //   await updateDirectEl(b2, directEls[2]);

  //   // should not require any locks
  //   b2.txns.withIndirectTxnMode(() => {
  //     updateIndirectEl(b2, indirectEls[2]);
  //   });
  //   b2.saveChanges("update element 3");

  //   // rebase ---------------------------
  //   let isRecomputedInvoked = 0;
  //   let isShouldReinstateInvoked = 0;
  //   b2.txns.changeMergeManager.setRebaseHandler({
  //     shouldReinstate(_txn: TxnProps) {
  //       isShouldReinstateInvoked++;
  //       return true;
  //     },
  //     async recompute(_txn: TxnProps): Promise<void> {
  //       isRecomputedInvoked++;
  //     }
  //   });

  //   await b2.pullChanges();
  //   chai.assert.isTrue(isShouldReinstateInvoked === 3);
  //   chai.assert.isTrue(isRecomputedInvoked === 3);
  //   // txn 4 ----------------------------
  //   insertDirectEl(b2)
  //   b2.saveChanges("update element 3");


  //   b2.close();
  //   b3.close();
  //   HubMock.shutdown();
  // });
});
