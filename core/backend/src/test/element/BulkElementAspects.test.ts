/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Guid, Id64, Id64String, IModelStatus, ITwinError } from "@itwin/core-bentley";
import { Code, ElementAspectProps, IModel, IModelError } from "@itwin/core-common";
import { EditTxn, Element, ElementAspect, PhysicalModel, SpatialCategory, StandaloneDb, Subject } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { withEditTxn } from "../TestEditTxn";

const testSchemaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="BulkAspectTest" alias="bat" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
  <ECEntityClass typeName="TestUniqueAspect">
    <BaseClass>bis:ElementUniqueAspect</BaseClass>
    <ECProperty propertyName="StrProp" typeName="string"/>
    <ECProperty propertyName="IntProp" typeName="int"/>
  </ECEntityClass>
  <ECEntityClass typeName="TestMultiAspect">
    <BaseClass>bis:ElementMultiAspect</BaseClass>
    <ECProperty propertyName="StrProp" typeName="string"/>
    <ECProperty propertyName="IntProp" typeName="int"/>
  </ECEntityClass>
</ECSchema>`;

const uniqueClass = "BulkAspectTest:TestUniqueAspect";
const multiClass = "BulkAspectTest:TestMultiAspect";

interface TestAspectProps extends ElementAspectProps {
  strProp?: string;
  intProp?: number;
}

describe("EditTxn bulk ElementAspect operations", () => {
  let iModel: StandaloneDb;
  let ownerCounter = 0;

  before(async () => {
    const fileName = IModelTestUtils.prepareOutputFile("BulkElementAspects", `BulkElementAspects_${Guid.createValue()}.bim`);
    iModel = StandaloneDb.createEmpty(fileName, { rootSubject: { name: "BulkElementAspects" }, allowEdit: JSON.stringify({ txns: true }) });
    await iModel.importSchemaStrings([testSchemaXml]);
  });

  after(() => {
    iModel.close();
  });

  afterEach(() => {
    sinon.restore();
  });

  const insertOwners = (txn: EditTxn, count: number) => Array.from({ length: count }, () => Subject.insert(txn, IModel.rootSubjectId, `Owner${++ownerCounter}`));
  const uniqueProps = (element: Id64String, strProp: string): TestAspectProps => ({ classFullName: uniqueClass, element: { id: element }, strProp });
  const multiProps = (element: Id64String, strProp: string): TestAspectProps => ({ classFullName: multiClass, element: { id: element }, strProp });
  const aspectsOf = (elementId: Id64String) => iModel.elements.getAspects(elementId)
    .filter((a) => a.classFullName === uniqueClass || a.classFullName === multiClass)
    .map((a) => `${a.classFullName.split(":")[1]}:${a.asAny.strProp}`).sort();

  /** Records the ids of the owning elements whose `onUpdated` handler was called. */
  const spyOwnerUpdates = () => {
    const spy = sinon.spy(Element as any, "onUpdated");
    return () => spy.getCalls().map((c) => c.args[0].id as Id64String);
  };

  /** Spies on the ElementAspect handlers and returns their call counts in the order insert, inserted, update, updated, delete, deleted. */
  const spyAspectHandlers = () => {
    const spies = ["onInsert", "onInserted", "onUpdate", "onUpdated", "onDelete", "onDeleted"].map((name) => sinon.spy(ElementAspect as any, name));
    return { callCounts: () => spies.map((s) => s.callCount), onDelete: spies[4] };
  };

  /** Runs `fn` in an EditTxn that is abandoned afterwards. */
  const inAbandonedTxn = (fn: (txn: EditTxn) => void) => {
    const txn = new EditTxn(iModel, "test");
    txn.start();
    try {
      fn(txn);
    } finally {
      txn.end("abandon");
    }
  };

  const thrownBy = (fn: () => void): any => {
    try {
      fn();
    } catch (err) {
      return err;
    }
    expect.fail("expected an exception");
  };

  it("inserts, updates and deletes aspects on several owners, updating each owner once and calling the per-aspect handlers", () => {
    inAbandonedTxn((txn) => {
      const [e1, e2] = insertOwners(txn, 2);
      let handlers = spyAspectHandlers();
      let ownerUpdates = spyOwnerUpdates();

      const ids = txn.insertAspects([uniqueProps(e1, "u1"), multiProps(e1, "m1a"), multiProps(e1, "m1b"), multiProps(e2, "m2"), uniqueProps(e2, "u2")]);
      expect(ids.length).to.equal(5);
      ids.forEach((id) => expect(Id64.isValidId64(id)).to.be.true);
      expect(iModel.elements.getAspect(ids[1]).asAny.strProp).to.equal("m1a");
      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:m1a", "TestMultiAspect:m1b", "TestUniqueAspect:u1"]);
      expect(aspectsOf(e2)).to.deep.equal(["TestMultiAspect:m2", "TestUniqueAspect:u2"]);
      expect(handlers.callCounts()).to.deep.equal([5, 5, 0, 0, 0, 0]);
      expect(ownerUpdates()).to.deep.equal([e1, e2]);

      sinon.restore();
      handlers = spyAspectHandlers();
      ownerUpdates = spyOwnerUpdates();
      txn.updateAspects([uniqueProps(e2, "u2-new"), { ...multiProps(e1, "m1a-new"), id: ids[1] }]);
      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:m1a-new", "TestMultiAspect:m1b", "TestUniqueAspect:u1"]);
      expect(aspectsOf(e2)).to.deep.equal(["TestMultiAspect:m2", "TestUniqueAspect:u2-new"]);
      expect(handlers.callCounts()).to.deep.equal([0, 0, 2, 2, 0, 0]);
      expect(ownerUpdates()).to.deep.equal([e2, e1]);

      sinon.restore();
      handlers = spyAspectHandlers();
      ownerUpdates = spyOwnerUpdates();
      const getAspect = sinon.spy(iModel.elements, "getAspect");
      txn.deleteAspects(ids);
      expect(aspectsOf(e1)).to.deep.equal([]);
      expect(aspectsOf(e2)).to.deep.equal([]);
      expect(handlers.callCounts()).to.deep.equal([0, 0, 0, 0, 5, 5]);
      expect(handlers.onDelete.getCalls().map((c) => c.args[0].element)).to.deep.equal([e1, e1, e1, e2, e2]);
      expect(getAspect.called).to.be.false; // the owning element is supplied, so the default onDelete does not load the aspect
      expect(ownerUpdates()).to.deep.equal([e1, e2]);
    });
  });

  it("throws an ITwinError on the first problem, leaving the aspects before it written", () => {
    inAbandonedTxn((txn) => {
      const [e1] = insertOwners(txn, 1);
      const [m1] = txn.insertAspects([multiProps(e1, "m1")]);
      const onInserted = sinon.spy(ElementAspect as any, "onInserted");

      let error = thrownBy(() => txn.insertAspects([multiProps(e1, "written"), multiProps("0xffffff", "noOwner"), multiProps(e1, "never")]));
      expect(ITwinError.isError(error, "dgn-db", "NotFound")).to.be.true;
      expect(error.message).to.contain("insertElementAspects: owning element 0xffffff of input 1 does not exist");
      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:m1", "TestMultiAspect:written"]); // the caller must abandon the txn
      expect(onInserted.called).to.be.false;

      error = thrownBy(() => txn.insertAspects([{ ...multiProps(e1, "x"), classFullName: "BisCore:Subject" }]));
      expect(ITwinError.isError(error, "dgn-db", "WrongClass")).to.be.true;

      error = thrownBy(() => txn.updateAspects([{ ...multiProps(e1, "x"), id: "0xffffff" }]));
      expect(ITwinError.isError(error, "dgn-db", "NotFound")).to.be.true;

      error = thrownBy(() => txn.deleteAspects([m1, "not-an-id"]));
      expect(ITwinError.isError(error, "dgn-db", "InvalidId")).to.be.true;
      expect(error.message).to.contain("deleteElementAspects: ids[1] is not a valid aspect id");

      error = thrownBy(() => txn.deleteAspects([m1]));
      expect(ITwinError.isError(error, "dgn-db", "NotFound")).to.be.true;
    });
  });

  it("single-aspect operations use the bulk operations and still throw an IModelError", () => {
    inAbandonedTxn((txn) => {
      const [e1] = insertOwners(txn, 1);
      const ownerUpdates = spyOwnerUpdates();
      const id1 = txn.insertAspect(multiProps(e1, "m1"));
      const id2 = txn.insertAspect(multiProps(e1, "m2"));
      txn.insertAspect(uniqueProps(e1, "u1"));
      txn.updateAspect({ ...multiProps(e1, "m1-new"), id: id1 });
      txn.updateAspect(uniqueProps(e1, "u1-new"));
      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:m1-new", "TestMultiAspect:m2", "TestUniqueAspect:u1-new"]);
      txn.deleteAspect([id1, id2]);
      expect(aspectsOf(e1)).to.deep.equal(["TestUniqueAspect:u1-new"]);
      expect(ownerUpdates().length).to.equal(6);

      expect(() => txn.insertAspect(multiProps("0xffffff", "x"))).to.throw(IModelError, "Error inserting ElementAspect");
      expect(() => txn.updateAspect({ ...multiProps(e1, "x"), id: id1 })).to.throw(IModelError, "Error updating ElementAspect");
      expect(() => txn.deleteAspect(id1)).to.throw(IModelError, "Error deleting ElementAspect");
    });
  });

  it("a lock violation stops the call", () => {
    inAbandonedTxn((txn) => {
      const [e1, e2] = insertOwners(txn, 2);
      sinon.stub(iModel.locks, "checkExclusiveLock").callsFake((id: Id64String) => {
        if (id === e2)
          throw new Error(`exclusive lock not held on ${id}`);
      });
      const ownerUpdates = spyOwnerUpdates();
      expect(() => txn.insertAspects([multiProps(e1, "new1"), multiProps(e2, "new2")])).to.throw("exclusive lock not held");
      expect(ownerUpdates()).to.deep.equal([]);
      expect(aspectsOf(e2)).to.deep.equal([]);
    });
  });

  it("enforces channels", () => {
    inAbandonedTxn((txn) => {
      const channelKey = `bulk-aspects-${Guid.createValue()}`;
      iModel.channels.addAllowedChannel(channelKey);
      const channelSubject = iModel.channels.insertChannelSubject({ subjectName: channelKey, channelKey, txn });
      const modelId = PhysicalModel.insert(txn, channelSubject, "ChannelModel");
      const categoryId = SpatialCategory.insert(txn, IModel.dictionaryId, `Category-${channelKey}`, {});
      const owner = txn.insertElement({ classFullName: "Generic:PhysicalObject", model: modelId, category: categoryId, code: Code.createEmpty() } as any);

      try {
        iModel.channels.removeAllowedChannel(channelKey);
        expect(() => txn.insertAspects([multiProps(owner, "denied")])).to.throw("not allowed");
        expect(aspectsOf(owner)).to.deep.equal([]);

        iModel.channels.addAllowedChannel(channelKey);
        txn.insertAspects([multiProps(owner, "allowed")]);
        expect(aspectsOf(owner)).to.deep.equal(["TestMultiAspect:allowed"]);
      } finally {
        iModel.channels.removeAllowedChannel(channelKey);
      }
    });
  });

  it("can be undone and redone", () => {
    const [e1, e2] = withEditTxn(iModel, (txn) => insertOwners(txn, 2));
    const all = () => [...aspectsOf(e1), ...aspectsOf(e2)];

    const ids = withEditTxn(iModel, (txn) => txn.insertAspects([uniqueProps(e1, "u1"), multiProps(e1, "m1"), multiProps(e2, "m2")]));
    const afterInsert = all();
    expect(afterInsert.length).to.equal(3);

    withEditTxn(iModel, (txn) => txn.updateAspects([uniqueProps(e1, "u1-new"), { ...multiProps(e2, "m2-new"), id: ids[2] }]));
    const afterUpdate = all();
    withEditTxn(iModel, (txn) => txn.deleteAspects(ids));
    expect(all()).to.deep.equal([]);

    expect(iModel.txns.reverseSingleTxn()).to.equal(IModelStatus.Success);
    expect(all()).to.deep.equal(afterUpdate);
    expect(iModel.txns.reverseSingleTxn()).to.equal(IModelStatus.Success);
    expect(all()).to.deep.equal(afterInsert);
    expect(iModel.txns.reverseSingleTxn()).to.equal(IModelStatus.Success);
    expect(all()).to.deep.equal([]);

    expect(iModel.txns.reinstateTxn()).to.equal(IModelStatus.Success);
    expect(all()).to.deep.equal(afterInsert);
    expect(iModel.txns.reinstateTxn()).to.equal(IModelStatus.Success);
    expect(all()).to.deep.equal(afterUpdate);
    expect(iModel.txns.reinstateTxn()).to.equal(IModelStatus.Success);
    expect(all()).to.deep.equal([]);
  });
});
