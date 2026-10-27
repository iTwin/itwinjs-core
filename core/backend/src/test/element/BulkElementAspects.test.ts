/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Guid, Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Code, ElementAspectProps, IModel } from "@itwin/core-common";
import {
  BulkElementAspectsStatus, EditTxn, Element, ElementAspect, PhysicalModel, SpatialCategory, StandaloneDb, Subject,
} from "../../core-backend";
import { _verifyChannel } from "../../internal/Symbols";
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

  it("inserts unique and multi aspects on several owners, updating each owner once", () => {
    inAbandonedTxn((txn) => {
      const [e1, e2] = insertOwners(txn, 2);
      const onInsert = sinon.spy(ElementAspect as any, "onInsert");
      const onInserted = sinon.spy(ElementAspect as any, "onInserted");
      const ownerUpdates = spyOwnerUpdates();

      const result = txn.insertAspects([uniqueProps(e1, "u1"), multiProps(e1, "m1a"), multiProps(e1, "m1b"), multiProps(e2, "m2"), uniqueProps(e2, "u2")]);
      expect(result.status).to.equal(BulkElementAspectsStatus.Success);
      expect(result.failures).to.deep.equal([]);
      expect(result.ids.length).to.equal(5);
      result.ids.forEach((id) => expect(Id64.isValidId64(id)).to.be.true);

      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:m1a", "TestMultiAspect:m1b", "TestUniqueAspect:u1"]);
      expect(aspectsOf(e2)).to.deep.equal(["TestMultiAspect:m2", "TestUniqueAspect:u2"]);
      expect(iModel.elements.getAspect(result.ids[1]).asAny.strProp).to.equal("m1a");

      expect(onInsert.callCount).to.equal(5);
      expect(onInserted.callCount).to.equal(5);
      expect(ownerUpdates().sort()).to.deep.equal([e1, e2].sort());
    });
  });

  it("reports per-row failures and still writes the valid rows", () => {
    inAbandonedTxn((txn) => {
      const [e1] = insertOwners(txn, 1);
      const inserted = txn.insertAspects([
        multiProps(e1, "ok1"),
        multiProps("0xffffff", "noOwner"),
        { ...multiProps(e1, "badClass"), classFullName: "BulkAspectTest:DoesNotExist" },
        uniqueProps(e1, "ok2"),
      ]);
      expect(inserted.status).to.equal(BulkElementAspectsStatus.PartialSuccess);
      expect(inserted.failures.map((f) => f.index)).to.deep.equal([1, 2]);
      expect(inserted.ids[1]).to.equal(Id64.invalid);
      expect(inserted.ids[2]).to.equal(Id64.invalid);
      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:ok1", "TestUniqueAspect:ok2"]);

      const updated = txn.updateAspects([
        { ...multiProps(e1, "ok1-new"), id: inserted.ids[0] },
        { ...multiProps(e1, "missing"), id: "0xffffff" },
        uniqueProps(e1, "ok2-new"),
      ]);
      expect(updated.status).to.equal(BulkElementAspectsStatus.PartialSuccess);
      expect(updated.failures.map((f) => [f.index, f.status])).to.deep.equal([[1, IModelStatus.NotFound]]);
      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:ok1-new", "TestUniqueAspect:ok2-new"]);

      const deleted = txn.deleteAspects([inserted.ids[0], "0xffffff"]);
      expect(deleted.status).to.equal(BulkElementAspectsStatus.PartialSuccess);
      expect(deleted.failures.map((f) => [f.index, f.status])).to.deep.equal([[1, IModelStatus.NotFound]]);
      expect(aspectsOf(e1)).to.deep.equal(["TestUniqueAspect:ok2-new"]);
    });
  });

  it("reports distinct statuses for a missing class name, a class that is not in the iModel and a class that is not an aspect", () => {
    inAbandonedTxn((txn) => {
      const [e1] = insertOwners(txn, 1);
      const inserted = txn.insertAspects([
        { ...multiProps(e1, "noClass"), classFullName: undefined } as any,
        { ...multiProps(e1, "unknown"), classFullName: "NotImported:SomeAspect" },
        { ...multiProps(e1, "notAnAspect"), classFullName: "BisCore:Subject" },
        multiProps(e1, "ok"),
      ]);
      expect(inserted.failures.map((f) => [f.index, f.status])).to.deep.equal([
        [0, IModelStatus.BadArg],
        [1, IModelStatus.BadSchema],
        [2, IModelStatus.WrongClass],
      ]);
      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:ok"]);

      const updated = txn.updateAspects([{ ...uniqueProps(e1, "unknown"), classFullName: "NotImported:SomeAspect" }]);
      expect(updated.status).to.equal(BulkElementAspectsStatus.Failed);
      expect(updated.failures.map((f) => [f.index, f.status])).to.deep.equal([[0, IModelStatus.BadSchema]]);
    });
  });

  it("checks the lock of each distinct owner and the channel of each distinct model once per call, still calling the per-aspect handlers", () => {
    inAbandonedTxn((txn) => {
      const [e1, e2] = insertOwners(txn, 2);
      const checkLock = sinon.spy(iModel.locks, "checkExclusiveLock");
      const verifyChannel = sinon.spy(iModel.channels, _verifyChannel as any);
      const onInsert = sinon.spy(ElementAspect as any, "onInsert");
      const lockedIds = () => checkLock.getCalls().map((c) => c.args[0]).sort();

      const { ids } = txn.insertAspects([multiProps(e1, "m1a"), multiProps(e1, "m1b"), uniqueProps(e1, "u1"), multiProps(e2, "m2a"), uniqueProps(e2, "u2")]);
      expect(onInsert.callCount).to.equal(5);
      expect(lockedIds()).to.deep.equal([e1, e2].sort());
      expect(verifyChannel.callCount).to.equal(1);

      for (const op of [
        () => txn.updateAspects([{ ...multiProps(e1, "m1a-new"), id: ids[0] }, { ...multiProps(e1, "m1b-new"), id: ids[1] }, uniqueProps(e2, "u2-new")]),
        () => txn.deleteAspects(ids),
      ]) {
        checkLock.resetHistory();
        verifyChannel.resetHistory();
        expect(op().status).to.equal(BulkElementAspectsStatus.Success);
        expect(lockedIds()).to.deep.equal([e1, e2].sort());
        expect(verifyChannel.callCount).to.equal(1);
      }
    });
  });

  it("single-aspect operations still check every aspect and look up the owner of deleted aspects", () => {
    inAbandonedTxn((txn) => {
      const [e1] = insertOwners(txn, 1);
      txn.insertAspects([multiProps(e1, "bulk")]); // a previous bulk call must not affect later single-aspect calls
      const checkLock = sinon.spy(iModel.locks, "checkExclusiveLock");
      const verifyChannel = sinon.spy(iModel.channels, _verifyChannel as any);
      const getAspect = sinon.spy(iModel.elements, "getAspect");

      const id1 = txn.insertAspect(multiProps(e1, "m1"));
      const id2 = txn.insertAspect(multiProps(e1, "m2"));
      txn.updateAspect({ ...multiProps(e1, "m1-new"), id: id1 });
      txn.deleteAspect([id1, id2]);
      expect(checkLock.getCalls().map((c) => c.args[2])).to.deep.equal(["insert aspect", "insert aspect", "update aspect", "delete aspect", "delete aspect"]);
      expect(verifyChannel.callCount).to.equal(5);
      expect(getAspect.getCalls().map((c) => c.args[0])).to.deep.equal([id1, id2]);
    });
  });

  it("does not skip a lock check that failed", () => {
    inAbandonedTxn((txn) => {
      const [e1] = insertOwners(txn, 1);
      let calls = 0;
      sinon.stub(iModel.locks, "checkExclusiveLock").callsFake(() => {
        if (++calls === 1)
          throw new Error("exclusive lock not held");
      });
      expect(() => txn.insertAspects([multiProps(e1, "a"), multiProps(e1, "b")])).to.throw("exclusive lock not held");
      expect(calls).to.equal(1);
      expect(aspectsOf(e1)).to.deep.equal([]);
      expect(txn.insertAspects([multiProps(e1, "a"), multiProps(e1, "b")]).status).to.equal(BulkElementAspectsStatus.Success);
      expect(calls).to.equal(2);
    });
  });

  it("updates and deletes aspects on several owners, updating each owner once", () => {
    inAbandonedTxn((txn) => {
      const [e1, e2] = insertOwners(txn, 2);
      const { ids } = txn.insertAspects([uniqueProps(e1, "u1"), multiProps(e1, "m1"), multiProps(e2, "m2a"), multiProps(e2, "m2b")]);

      const onUpdate = sinon.spy(ElementAspect as any, "onUpdate");
      let ownerUpdates = spyOwnerUpdates();
      const updated = txn.updateAspects([uniqueProps(e1, "u1-new"), { ...multiProps(e1, "m1-new"), id: ids[1] }, { ...multiProps(e2, "m2b-new"), id: ids[3] }]);
      expect(updated.status).to.equal(BulkElementAspectsStatus.Success);
      expect(onUpdate.callCount).to.equal(3);
      expect(ownerUpdates().sort()).to.deep.equal([e1, e2].sort());
      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:m1-new", "TestUniqueAspect:u1-new"]);
      expect(aspectsOf(e2)).to.deep.equal(["TestMultiAspect:m2a", "TestMultiAspect:m2b-new"]);

      sinon.restore();
      const onDelete = sinon.spy(ElementAspect as any, "onDelete");
      const getAspect = sinon.spy(iModel.elements, "getAspect");
      ownerUpdates = spyOwnerUpdates();
      const deleted = txn.deleteAspects([...ids, ids[0]]);
      expect(deleted.status).to.equal(BulkElementAspectsStatus.Success);
      expect(onDelete.callCount).to.equal(4);
      expect(onDelete.getCalls().map((c) => c.args[0].element)).to.deep.equal([e1, e1, e2, e2]);
      expect(getAspect.called).to.be.false; // the owning element is supplied, so the aspects are not loaded
      expect(ownerUpdates().sort()).to.deep.equal([e1, e2].sort());
      expect(aspectsOf(e1)).to.deep.equal([]);
      expect(aspectsOf(e2)).to.deep.equal([]);
    });
  });

  it("deleteAspects throws for malformed ids without deleting anything", () => {
    inAbandonedTxn((txn) => {
      const [e1] = insertOwners(txn, 1);
      const { ids } = txn.insertAspects([multiProps(e1, "m1")]);
      expect(() => txn.deleteAspects([ids[0], "not-an-id"])).to.throw("Invalid aspect ids: not-an-id");
      expect(() => txn.deleteAspects([Id64.invalid])).to.throw("Invalid aspect ids: 0");
      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:m1"]);
    });
  });

  it("a lock violation on any owner aborts the whole call before anything is written", () => {
    inAbandonedTxn((txn) => {
      const [e1, e2] = insertOwners(txn, 2);
      const { ids } = txn.insertAspects([multiProps(e1, "m1"), multiProps(e2, "m2")]);

      sinon.stub(iModel.locks, "checkExclusiveLock").callsFake((id: Id64String) => {
        if (id === e2)
          throw new Error(`exclusive lock not held on ${id}`);
      });
      const ownerUpdates = spyOwnerUpdates();
      expect(() => txn.insertAspects([multiProps(e1, "new1"), multiProps(e2, "new2")])).to.throw("exclusive lock not held");
      expect(() => txn.updateAspects([{ ...multiProps(e1, "m1-new"), id: ids[0] }, { ...multiProps(e2, "m2-new"), id: ids[1] }])).to.throw("exclusive lock not held");
      expect(() => txn.deleteAspects(ids)).to.throw("exclusive lock not held");
      expect(ownerUpdates()).to.deep.equal([]);
      expect(aspectsOf(e1)).to.deep.equal(["TestMultiAspect:m1"]);
      expect(aspectsOf(e2)).to.deep.equal(["TestMultiAspect:m2"]);
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

      iModel.channels.removeAllowedChannel(channelKey);
      expect(() => txn.insertAspects([multiProps(owner, "denied")])).to.throw("not allowed");
      expect(aspectsOf(owner)).to.deep.equal([]);

      iModel.channels.addAllowedChannel(channelKey);
      expect(txn.insertAspects([multiProps(owner, "allowed")]).status).to.equal(BulkElementAspectsStatus.Success);
      expect(aspectsOf(owner)).to.deep.equal(["TestMultiAspect:allowed"]);
      iModel.channels.removeAllowedChannel(channelKey);
    });
  });

  it("calls the bulk handlers once per aspect class", () => {
    inAbandonedTxn((txn) => {
      const [e1, e2] = insertOwners(txn, 2);
      const onBulkInsert = sinon.spy(ElementAspect as any, "onBulkInsert");
      const onBulkInserted = sinon.spy(ElementAspect as any, "onBulkInserted");
      const onBulkDelete = sinon.spy(ElementAspect as any, "onBulkDelete");
      const { ids } = txn.insertAspects([multiProps(e1, "m1"), uniqueProps(e1, "u1"), multiProps(e2, "m2")]);

      expect(onBulkInsert.callCount).to.equal(2);
      expect(onBulkInsert.getCall(0).args[0].aspects.map((a: any) => a.props.strProp)).to.deep.equal(["m1", "m2"]);
      expect(onBulkInsert.getCall(1).args[0].aspects.map((a: any) => a.props.strProp)).to.deep.equal(["u1"]);
      expect(onBulkInsert.getCall(0).args[0].iModel).to.equal(iModel);
      expect(onBulkInserted.callCount).to.equal(2);

      txn.deleteAspects(ids);
      expect(onBulkDelete.getCalls().map((c) => c.args[0].aspects.length)).to.deep.equal([2, 1]);
    });
  });

  it("can be undone and redone", () => {
    const [e1, e2] = withEditTxn(iModel, (txn) => insertOwners(txn, 2));
    const all = () => [...aspectsOf(e1), ...aspectsOf(e2)];

    const { ids } = withEditTxn(iModel, (txn) => txn.insertAspects([uniqueProps(e1, "u1"), multiProps(e1, "m1"), multiProps(e2, "m2")]));
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
