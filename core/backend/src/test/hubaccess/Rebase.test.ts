/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "..";
import { BriefcaseDb, BriefcaseManager, ChannelControl, DrawingCategory, IModelHost, SqliteChangesetReader, TxnProps } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { Suite } from "mocha";
import { Code, GeometricElement2dProps, IModel, QueryBinder, RelatedElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { Guid, Id64String } from "@itwin/core-bentley";
import { StashManager } from "../../StashManager";
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
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="a1">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="prop1" typeName="string" />
        </ECEntityClass>
        <ECRelationshipClass typeName="A1OwnsA1" modifier="None" strength="embedding">
            <BaseClass>bis:ElementOwnsChildElements</BaseClass>
            <Source multiplicity="(0..1)" roleLabel="owns" polymorphic="true">
                <Class class="a1"/>
            </Source>
            <Target multiplicity="(0..*)" roleLabel="is owned by" polymorphic="false">
                <Class class="a1"/>
            </Target>
        </ECRelationshipClass>
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
    await b1.pushChanges({ description: "drawing category" });
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
  public async insertElement2(b: BriefcaseDb, args?: { prop1?: string, markAsIndirect?: true, parent?: RelatedElementProps }) {
    await b.locks.acquireLocks({ shared: [this.drawingModelId] });

    const props: GeometricElement2dProps & { prop1: string } = {
      classFullName: "TestDomain:a1",
      model: this.drawingModelId,
      category: this.drawingCategoryId,
      code: Code.createEmpty(),
      parent: args?.parent,
      prop1: args?.prop1 ?? `${this._data++}`
    };

    let id: Id64String = "";
    if (args?.markAsIndirect) {
      b.txns.withIndirectTxnMode(() => {
        id = b.elements.insertElement(props as any);
      });
      return id;
    }
    return b.elements.insertElement(props as any);
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

describe("rebase changes & stashing api", function (this: Suite) {
  let testIModel: TestIModel;
  before(async () => {
    if (!IModelHost.isValid)
      await IModelHost.startup();
  });
  this.beforeEach(async () => {
    testIModel = new TestIModel();
    await testIModel.startup();
  });
  this.afterEach(async () => {
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

    let lastTxn = b1.txns.getLastSavedTxnProps();
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

    lastTxn = b1.txns.getLastSavedTxnProps();
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
    lastTxn = b1.txns.getLastSavedTxnProps();
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
    lastTxn = b1.txns.getLastSavedTxnProps();
    chai.assert.isUndefined(lastTxn);
  });

  it("direct / indirect", async () => {
    const b1 = await testIModel.openBriefcase();
    const directElId = await testIModel.insertElement(b1);
    const indirectElId = await testIModel.insertElement(b1, true);
    chai.expect(directElId).to.not.be.undefined;
    chai.expect(indirectElId).to.not.be.undefined;
    b1.saveChanges({ description: "insert element 1 direct and 1 indirect" });
    const txn = b1.txns.getLastSavedTxnProps();
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
    const lastTxn = b1.txns.getLastSavedTxnProps();
    chai.assert.isUndefined(lastTxn);
  });

  it("rebase handler", async () => {
    const b1 = await testIModel.openBriefcase();
    const b2 = await testIModel.openBriefcase();

    const e1 = await testIModel.insertElement(b1);
    const e2 = await testIModel.insertElement(b1, true);
    b1.saveChanges();
    await b1.pushChanges({ description: "insert element 1 direct and 1 indirect" });

    await b2.pullChanges();

    await testIModel.updateElement(b1, e1);
    await testIModel.updateElement(b1, e2, true);
    b1.saveChanges();
    await b1.pushChanges({ description: "update element 1 direct and 1 indirect" });


    await testIModel.insertElement(b2);
    await testIModel.insertElement(b2, true);
    b2.saveChanges("first change");

    await testIModel.insertElement(b2);
    await testIModel.insertElement(b2, true);
    b2.saveChanges("second change");

    await testIModel.insertElement(b2);
    await testIModel.insertElement(b2, true);
    b2.saveChanges("third change");

    b2.txns.rebaser.setCustomHandler({
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
  it("stash & drop", async () => {
    const b1 = await testIModel.openBriefcase();
    const e1 = await testIModel.insertElement(b1);
    b1.saveChanges();
    await b1.pushChanges({ description: "insert element 1 direct and 1 indirect" });

    const e2 = await testIModel.insertElement(b1);
    b1.saveChanges();
    await b1.pushChanges({ description: "insert element 1 direct and 1 indirect" });

    await testIModel.insertElement(b1);
    b1.saveChanges(`first`);
    await testIModel.updateElement(b1, e1);
    b1.saveChanges(`second`);
    await testIModel.deleteElement(b1, e2);
    b1.saveChanges(`third`);
    await testIModel.insertElement(b1);
    b1.saveChanges(`fourth`);

    const stash1 = await StashManager.stash({ db: b1, description: "stash test 1" });

    chai.expect(stash1).to.exist;
    chai.assert(Guid.isGuid(stash1.id));
    chai.expect(stash1.description).to.equals("stash test 1");
    chai.expect(stash1.briefcaseId).equals(b1.briefcaseId);
    chai.expect(stash1.iModelId).to.equals(b1.iModelId);
    chai.expect(stash1.timestamp).to.exist;
    chai.expect(stash1.description).to.exist;
    chai.expect(stash1.hash).length(64);
    chai.expect(stash1.parentChangeset).to.exist;
    chai.expect(stash1.idSequences.element).to.equals("0x30000000004");
    chai.expect(stash1.idSequences.instance).to.equals("0x30000000000");
    chai.expect(stash1.acquiredLocks).equals(4);
    chai.expect(stash1.txns).to.exist;

    chai.expect(stash1.txns).to.have.lengthOf(4);
    chai.expect(stash1.txns[0].props.description).to.equal("first");
    chai.expect(stash1.txns[1].props.description).to.equal("second");
    chai.expect(stash1.txns[2].props.description).to.equal("third");
    chai.expect(stash1.txns[3].props.description).to.equal("fourth");

    chai.expect(stash1.txns[0].id).to.equals("0x100000000");
    chai.expect(stash1.txns[1].id).to.equals("0x100000001");
    chai.expect(stash1.txns[2].id).to.equals("0x100000002");
    chai.expect(stash1.txns[3].id).to.equals("0x100000003");

    await testIModel.insertElement(b1);
    b1.saveChanges(`fifth`);
    await testIModel.updateElement(b1, e1);
    b1.saveChanges(`sixth`);
    await testIModel.insertElement(b1);
    b1.saveChanges(`seventh`);

    const stash2 = await StashManager.stash({ db: b1, description: "stash test 2" });
    chai.expect(stash2).to.exist;
    chai.expect(stash2.description).to.equals("stash test 2");
    chai.expect(stash2.hash).length(64);
    chai.expect(stash2.parentChangeset).to.exist;
    chai.expect(stash2.idSequences.element).to.equals("0x30000000006");
    chai.expect(stash2.idSequences.instance).to.equals("0x30000000000");
    chai.expect(stash2.acquiredLocks).equals(4);
    chai.expect(stash2.txns).to.exist;

    chai.expect(stash2.txns).to.have.lengthOf(7);
    chai.expect(stash2.txns[0].props.description).to.equal("first");
    chai.expect(stash2.txns[1].props.description).to.equal("second");
    chai.expect(stash2.txns[2].props.description).to.equal("third");
    chai.expect(stash2.txns[3].props.description).to.equal("fourth");
    chai.expect(stash2.txns[4].props.description).to.equal("fifth");
    chai.expect(stash2.txns[5].props.description).to.equal("sixth");
    chai.expect(stash2.txns[6].props.description).to.equal("seventh");

    chai.expect(stash2.txns[0].id).to.equals("0x100000000");
    chai.expect(stash2.txns[1].id).to.equals("0x100000001");
    chai.expect(stash2.txns[2].id).to.equals("0x100000002");
    chai.expect(stash2.txns[3].id).to.equals("0x100000003");
    chai.expect(stash2.txns[4].id).to.equals("0x100000004");
    chai.expect(stash2.txns[5].id).to.equals("0x100000005");
    chai.expect(stash2.txns[6].id).to.equals("0x100000006");

    const stashes = StashManager.getStashes(b1);
    chai.expect(stashes).to.have.lengthOf(2);
    chai.expect(stashes[0].description).to.equals("stash test 2");
    chai.expect(stashes[1].description).to.equals("stash test 1");
    chai.expect(stashes[0]).to.deep.equal(stash2);
    chai.expect(stashes[1]).to.deep.equal(stash1);

    StashManager.dropAllStashes(b1);
    chai.expect(StashManager.getStashes(b1)).to.have.lengthOf(0);
  });
  it("should restore mutually exclusive stashes", async () => {
    const b1 = await testIModel.openBriefcase();

    // stash 1
    const e1 = await testIModel.insertElement(b1);
    chai.expect(e1).to.exist;
    b1.saveChanges("first");
    const stash1 = await StashManager.stash({ db: b1, description: "stash test 1", discardLocalChanges: true, retainLocks: true });
    chai.expect(stash1).to.exist;
    chai.expect(b1.elements.tryGetElement(e1)).to.undefined;
    chai.expect(b1.txns.isUndoPossible).to.be.false;
    chai.expect(b1.txns.isRedoPossible).to.be.false;

    // stash 2
    const e2 = await testIModel.insertElement(b1);
    chai.expect(e2).to.exist;
    b1.saveChanges("second");
    const stash2 = await StashManager.stash({ db: b1, description: "stash test 2", discardLocalChanges: true, retainLocks: true });
    chai.expect(stash2).to.exist;
    chai.expect(b1.elements.tryGetElement(e1)).to.undefined;
    chai.expect(b1.elements.tryGetElement(e2)).to.undefined;
    chai.expect(b1.txns.isUndoPossible).to.be.false;
    chai.expect(b1.txns.isRedoPossible).to.be.false;

    // stash 3
    const e3 = await testIModel.insertElement(b1);
    chai.expect(e3).to.exist;
    b1.saveChanges("third");
    const stash3 = await StashManager.stash({ db: b1, description: "stash test 3", discardLocalChanges: true, retainLocks: true });
    chai.expect(stash3).to.exist;
    chai.expect(b1.elements.tryGetElement(e1)).to.undefined;
    chai.expect(b1.elements.tryGetElement(e2)).to.undefined;
    chai.expect(b1.elements.tryGetElement(e3)).to.undefined;
    chai.expect(b1.txns.isUndoPossible).to.be.false;
    chai.expect(b1.txns.isRedoPossible).to.be.false;

    chai.expect(e1).not.equals(e2);
    chai.expect(e1).not.equals(e3);
    chai.expect(e2).not.equals(e3);

    const stashes = StashManager.getStashes(b1);
    chai.expect(stashes).to.have.lengthOf(3);
    chai.expect(stashes[0].description).to.equals("stash test 3");
    chai.expect(stashes[1].description).to.equals("stash test 2");
    chai.expect(stashes[2].description).to.equals("stash test 1");

    // restore stash 1
    await StashManager.restore({ db: b1, stash: stash1 });
    chai.expect(b1.elements.tryGetElement(e1)).to.exist;
    chai.expect(b1.elements.tryGetElement(e2)).to.undefined;
    chai.expect(b1.elements.tryGetElement(e3)).to.undefined;

    // restore stash 2
    await StashManager.restore({ db: b1, stash: stash2 });
    chai.expect(b1.elements.tryGetElement(e1)).to.undefined;
    chai.expect(b1.elements.tryGetElement(e2)).to.exist;
    chai.expect(b1.elements.tryGetElement(e3)).to.undefined;

    // restore stash 3
    await StashManager.restore({ db: b1, stash: stash3 });
    chai.expect(b1.elements.tryGetElement(e1)).to.undefined;
    chai.expect(b1.elements.tryGetElement(e2)).to.undefined;
    chai.expect(b1.elements.tryGetElement(e3)).to.exist;
  });
  it("should restore stash in any order", async () => {
    const b1 = await testIModel.openBriefcase();

    // stash 1
    const e1 = await testIModel.insertElement(b1);
    chai.expect(e1).to.exist;
    b1.saveChanges("first");
    // do not discard local changes
    const stash1 = await StashManager.stash({ db: b1, description: "stash test 1" });
    chai.expect(stash1).to.exist;
    chai.expect(b1.elements.tryGetElement(e1)).to.exist;
    chai.expect(b1.txns.isUndoPossible).to.be.true;
    chai.expect(b1.txns.isRedoPossible).to.be.false;

    // stash 2
    const e2 = await testIModel.insertElement(b1);
    chai.expect(e2).to.exist;
    b1.saveChanges("second");
    // do not discard local changes
    const stash2 = await StashManager.stash({ db: b1, description: "stash test 2" });
    chai.expect(stash2).to.exist;
    chai.expect(b1.elements.tryGetElement(e1)).to.exist;
    chai.expect(b1.elements.tryGetElement(e2)).to.exist;
    chai.expect(b1.txns.isUndoPossible).to.be.true;
    chai.expect(b1.txns.isRedoPossible).to.be.false;

    // stash 3
    const e3 = await testIModel.insertElement(b1);
    chai.expect(e3).to.exist;
    b1.saveChanges("third");
    // do not discard local changes
    const stash3 = await StashManager.stash({ db: b1, description: "stash test 3" });
    chai.expect(stash3).to.exist;
    chai.expect(b1.elements.tryGetElement(e1)).to.exist;
    chai.expect(b1.elements.tryGetElement(e2)).to.exist;
    chai.expect(b1.elements.tryGetElement(e3)).to.exist;
    chai.expect(b1.txns.isUndoPossible).to.be.true;
    chai.expect(b1.txns.isRedoPossible).to.be.false;

    const stashes = StashManager.getStashes(b1);
    chai.expect(stashes).to.have.lengthOf(3);
    chai.expect(stashes[0].description).to.equals("stash test 3");
    chai.expect(stashes[1].description).to.equals("stash test 2");
    chai.expect(stashes[2].description).to.equals("stash test 1");

    await b1.discardChanges({ retainLocks: true });
    chai.expect(b1.elements.tryGetElement(e1)).to.undefined;
    chai.expect(b1.elements.tryGetElement(e2)).to.undefined;
    chai.expect(b1.elements.tryGetElement(e3)).to.undefined;
    chai.expect(b1.txns.isUndoPossible).to.be.false;
    chai.expect(b1.txns.isRedoPossible).to.be.false;

    // restore stash 1
    await StashManager.restore({ db: b1, stash: stash1 });
    chai.expect(b1.elements.tryGetElement(e1)).to.exist;
    chai.expect(b1.elements.tryGetElement(e2)).to.undefined;
    chai.expect(b1.elements.tryGetElement(e3)).to.undefined;


    // restore stash 2
    await StashManager.restore({ db: b1, stash: stash2 });
    chai.expect(b1.elements.tryGetElement(e1)).to.exist;
    chai.expect(b1.elements.tryGetElement(e2)).to.exist;
    chai.expect(b1.elements.tryGetElement(e3)).to.undefined;

    // restore stash 3
    await StashManager.restore({ db: b1, stash: stash3 });
    chai.expect(b1.elements.tryGetElement(e1)).to.exist;
    chai.expect(b1.elements.tryGetElement(e2)).to.exist;
    chai.expect(b1.elements.tryGetElement(e3)).to.exist;

  });
  it("should restore stash when briefcase has advanced to latest changeset", async () => {
    const b1 = await testIModel.openBriefcase();
    const b2 = await testIModel.openBriefcase();

    chai.expect(b1.changeset.index).to.equals(2);
    chai.expect(b2.changeset.index).to.equals(2);

    const e1 = await testIModel.insertElement(b1);
    chai.expect(e1).to.exist;
    b1.saveChanges();
    await b1.pushChanges({ description: `${e1} inserted` });

    chai.expect(b1.changeset.index).to.equals(3);

    const e2 = await testIModel.insertElement(b2);
    chai.expect(e2).to.exist;
    b2.saveChanges();

    chai.expect(b2.elements.tryGetElement(e1)).to.undefined;
    chai.expect(b2.elements.tryGetElement(e2)).to.exist;

    const b2Stash1 = await StashManager.stash({ db: b2, description: "stash test 1", discardLocalChanges: true });
    chai.expect(b2Stash1.parentChangeset.index).to.equals(2);

    chai.expect(b2.elements.tryGetElement(e1)).to.undefined;
    chai.expect(b2.elements.tryGetElement(e2)).to.undefined;

    await b2.pullChanges();
    chai.expect(b2.changeset.index).to.equals(3);

    chai.expect(b2.elements.tryGetElement(e1)).to.exist;
    chai.expect(b2.elements.tryGetElement(e2)).to.undefined;

    // stash restore should downgrade briefcase to older changeset as specified in stash
    await StashManager.restore({ db: b2, stash: b2Stash1 });
    chai.expect(b2.changeset.index).to.equals(2);

    chai.expect(b2.elements.tryGetElement(e1)).to.undefined;
    chai.expect(b2.elements.tryGetElement(e2)).to.exist;

    await b2.pullChanges();
    chai.expect(b2.changeset.index).to.equals(3);
    chai.expect(b2.elements.tryGetElement(e1)).to.exist;
    chai.expect(b2.elements.tryGetElement(e2)).to.exist;

    await b2.pushChanges({ description: "test" });
    chai.expect(b2.changeset.index).to.equals(4);
  });
  it("restore stash that has element changed by another briefcase", async () => {
    const b1 = await testIModel.openBriefcase();
    const b2 = await testIModel.openBriefcase();

    chai.expect(b1.changeset.index).to.equals(2);
    chai.expect(b2.changeset.index).to.equals(2);

    const e1 = await testIModel.insertElement(b1);
    chai.expect(e1).to.exist;
    b1.saveChanges();
    await b1.pushChanges({ description: `${e1} inserted` });

    chai.expect(b1.changeset.index).to.equals(3);

    await b2.pullChanges();
    chai.expect(b2.changeset.index).to.equals(3);
    await testIModel.updateElement(b2, e1);
    b2.saveChanges();

    chai.expect(b2.locks.holdsExclusiveLock(e1)).to.be.true;
    const b2Stash1 = await StashManager.stash({ db: b2, description: "stash test 1", discardLocalChanges: true });
    chai.expect(b2Stash1.parentChangeset.index).to.equals(3);
    chai.expect(b2.locks.holdsExclusiveLock(e1)).to.be.false;

    // stash release lock so b2 should have released lock and b1 should be able to update.
    await testIModel.updateElement(b1, e1);
    b1.saveChanges();

    // restore stash should fail because of lock not obtained on e1
    await chai.expect(StashManager.restore({ db: b2, stash: b2Stash1 })).to.be.rejectedWith("exclusive lock is already held");

    // push b1 changes to release lock
    await b1.pushChanges({ description: `${e1} inserted` });

    // restore stash should fail because pull is required to obtain lock
    await chai.expect(StashManager.restore({ db: b2, stash: b2Stash1 })).to.be.rejectedWith("pull is required to obtain lock");

    await b2.pullChanges();

    chai.expect(b2.changeset.index).to.equals(4);
    const elBefore = b2.elements.tryGetElementProps(e1);
    chai.expect((elBefore as any).prop1).to.equals("2");
    // restore stash should succeed as now it can obtain lock
    await StashManager.restore({ db: b2, stash: b2Stash1 });

    const elAfter = b2.elements.tryGetElementProps(e1);
    chai.expect((elAfter as any).prop1).to.equals("1");
    await b2.pushChanges({ description: `${e1} updated` });
  });
  it("schema change should not be stashed", async () => {
    const b1 = await testIModel.openBriefcase();
    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
        <ECSchema schemaName="TestDomain" alias="ts" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
            <ECEntityClass typeName="a1">
                <BaseClass>bis:GraphicalElement2d</BaseClass>
                <ECProperty propertyName="prop1" typeName="string" />
                <ECProperty propertyName="prop2" typeName="string" />
            </ECEntityClass>
            <ECRelationshipClass typeName="A1OwnsA1" modifier="None" strength="embedding">
                <BaseClass>bis:ElementOwnsChildElements</BaseClass>
                <Source multiplicity="(0..1)" roleLabel="owns" polymorphic="true">
                    <Class class="a1"/>
                </Source>
                <Target multiplicity="(0..*)" roleLabel="is owned by" polymorphic="false">
                    <Class class="a1"/>
                </Target>
            </ECRelationshipClass>
        </ECSchema>`;
    await b1.importSchemaStrings([schema1]);
    b1.saveChanges();

    await chai.expect(StashManager.stash({ db: b1, description: "stash test 1" })).to.not.rejectedWith("Bad Arg: Pending schema changeset stashing is not currently supported");
  });
  it("abort rebase", async () => {
    const b1 = await testIModel.openBriefcase();
    const b2 = await testIModel.openBriefcase();

    const e1 = await testIModel.insertElement(b1);
    b1.saveChanges();
    await b1.pushChanges({ description: `${e1} inserted` });

    const e2 = await testIModel.insertElement(b2);
    chai.expect(e2).to.exist;
    let e3 = "";
    b2.saveChanges();
    b2.txns.rebaser.setCustomHandler({
      shouldReinstate: (_txnProps: TxnProps) => {
        return true;
      },
      recompute: async (_txnProps: TxnProps) => {
        chai.expect(BriefcaseManager.containsRestorePoint(b2, BriefcaseManager.PULL_MERGE_RESTORE_POINT_NAME)).is.true;
        e3 = await testIModel.insertElement(b2);
        throw new Error("Rebase failed");
      },
    });

    chai.expect(b2.elements.tryGetElementProps(e1)).to.undefined;
    chai.expect(b2.elements.tryGetElementProps(e2)).to.exist;
    chai.expect(b2.elements.tryGetElementProps(e3)).to.undefined;
    chai.expect(b2.changeset.index).to.equals(2);
    await chai.expect(b2.pullChanges()).to.be.rejectedWith("Rebase failed");

    chai.expect(b2.changeset.index).to.equals(3);
    chai.expect(e3).to.exist;
    chai.expect(b2.elements.tryGetElementProps(e1)).to.exist;     // came from incoming changeset
    chai.expect(b2.elements.tryGetElementProps(e2)).to.undefined; // was local change and reversed during rebase.
    chai.expect(b2.elements.tryGetElementProps(e3)).to.undefined; // was insert by reCompute() but due to exception the rebase attempt was abandoned.

    chai.expect(BriefcaseManager.containsRestorePoint(b2, BriefcaseManager.PULL_MERGE_RESTORE_POINT_NAME)).is.true;

    chai.expect(b2.txns.rebaser.canAbort()).is.true;
    await b2.txns.rebaser.abort();

    chai.expect(b2.changeset.index).to.equals(2);
    chai.expect(b2.elements.tryGetElementProps(e1)).to.undefined; // reset briefcase should move tip back to where it was before pull
    chai.expect(b2.elements.tryGetElementProps(e2)).to.exist;  // abort should put back e2 which was only change at the time of pull
    chai.expect(b2.elements.tryGetElementProps(e3)).to.undefined; // add by rebase so should not exist either

    chai.expect(BriefcaseManager.containsRestorePoint(b2, BriefcaseManager.PULL_MERGE_RESTORE_POINT_NAME)).is.false;
  });
  it("getStash() should throw exception", async () => {
    const b1 = await testIModel.openBriefcase();
    chai.expect(() => StashManager.getStash({ db: b1, stash: "invalid_stash" })).to.throw("Invalid stash");
    chai.expect(StashManager.tryGetStash({ db: b1, stash: "invalid_stash" })).to.be.undefined;
  });
  it("edge case: a indirect update can cause FK violation", async () => {
    const b1 = await testIModel.openBriefcase();
    const b2 = await testIModel.openBriefcase();

    const parentId = await testIModel.insertElement(b1);
    const childId = await testIModel.insertElement2(b1, { parent: { id: parentId, relClassName: "TestDomain:A1OwnsA1" } });
    b1.saveChanges("insert parent and child");
    await b1.pushChanges({ description: `inserted parent ${parentId} and child ${childId}` });
    await b2.pullChanges();

    // b1 delete childId while b1 create a child of childId as indirect change
    await testIModel.deleteElement(b1, childId);
    b1.saveChanges("delete child");
    // no exclusive lock required on child1
    const grandChildId = await testIModel.insertElement2(b2, { parent: { id: childId, relClassName: "TestDomain:A1OwnsA1" }, markAsIndirect: true });
    b2.saveChanges("delete child and insert grandchild");

    await b1.pushChanges({ description: `deleted child ${childId}` });

    // should fail to pull and rebase changes.
    await chai.expect(b2.pushChanges({ description: `deleted child ${childId} and inserted grandchild ${grandChildId}` }))
      .to.be.rejectedWith("Foreign key conflicts in ChangeSet. Aborting rebase.");
  });

  it("ECSqlReader unable to read updates after saveChanges()", async () => {
    const b1 = await testIModel.openBriefcase();
    const findElement = async (id: Id64String) => {
      const reader = b1.createQueryReader(`SELECT ECInstanceId, ec_className(ECClassId), Prop1 FROM ts.A1 WHERE ECInstanceId = ${id}`, QueryBinder.from([id]));
      if(await reader.step())
        return { id: reader.current[0], className: reader.current[1], prop1: reader.current[2] };
      return undefined;
    }

    const runQuery  = async (query: string) => {
      const reader = b1.createQueryReader(query);
      let rows = 0;
      while (await reader.step()) {
        rows++;
      }
      return rows;
    }
    const runQueryParallel = async (query: string, times: number = 1) => {
      return Promise.all(new Array(times).fill(query).map(runQuery));
    }

    // Following query have open cached statement against BisCore.Element that will prevent
    // updates from being visible until the statement is finalized.
    await runQueryParallel(`SELECT $ FROM BisCore.Element`, 10);

    const e1 = await testIModel.insertElement(b1);
    chai.expect(await findElement(e1)).to.be.undefined;
    b1.saveChanges("insert element");

    const e1Props = await findElement(e1);
    chai.expect(e1Props).to.exist;
    await runQueryParallel(`SELECT $ FROM BisCore.Element`, 10);
    const e2 = await testIModel.insertElement(b1);
    chai.expect(await findElement(e2)).to.be.undefined;
    b1.saveChanges("insert second element");

    const e2Props = await findElement(e2);
    chai.expect(e2Props).to.exist;

    await runQueryParallel(`SELECT $ FROM BisCore.Element`, 10);
    const e3 = await testIModel.insertElement(b1);
    chai.expect(await findElement(e3)).to.be.undefined;
    b1.saveChanges("insert third element");

    const e3Props = await findElement(e3);
    chai.expect(e3Props).to.exist;
  });
});
