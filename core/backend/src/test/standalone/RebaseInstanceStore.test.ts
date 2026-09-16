/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { Guid } from "@itwin/core-bentley";
import type { SchemaView } from "@itwin/ecschema-metadata";
import { RebaseInstanceStore } from "../../internal/RebaseInstanceStore";
import type { ChangeInstance, ChangeMeta } from "../../ChangesetReaderTypes";
import { StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";

/** Minimal, hand-built `ChangeMeta`/`ChangeInstance` - the fields `RebaseInstanceStore` actually
 * inspects (`id`, `classFullName`, `$meta.instanceKey`, `$meta.isIndirectChange`) are populated
 * meaningfully; the rest just need to satisfy the type.
 */
function makeInstance(id: string, classFullName: string, extra: Record<string, any> = {}, isIndirectChange = false): ChangeInstance {
  const meta: ChangeMeta = {
    tables: [],
    op: "Updated",
    stage: "New",
    changeIndexes: [],
    instanceKey: `${id}-0x1`,
    propFilter: 0,
    changeFetchedPropNames: [],
    isIndirectChange,
  };
  return { $meta: meta, id, classFullName, ...extra };
}

describe("RebaseInstanceStore", () => {
  let iModel: StandaloneDb;
  let schemaView: SchemaView;

  before(async () => {
    iModel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("RebaseInstanceStore", `${Guid.createValue()}.bim`), { rootSubject: { name: "RebaseInstanceStoreTest" } });
    schemaView = await iModel.getSchemaView();
  });

  after(() => {
    iModel.close();
  });

  function newStorePath(): string {
    return IModelTestUtils.prepareOutputFile("RebaseInstanceStore", `${Guid.createValue()}.sqlite`);
  }

  it("classifies operation/isElement/ownerId from an Update at capture time", () => {
    using store = RebaseInstanceStore.createNew(newStorePath(), iModel, schemaView);
    const parent = { id: "0x10", relClassName: "BisCore:ElementOwnsChildElements" };
    const oldInst = makeInstance("0x20", "BisCore:PhysicalElement", { parent, userLabel: "before" });
    const newInst = makeInstance("0x20", "BisCore:PhysicalElement", { parent, userLabel: "after" });
    store.set({ instanceKey: "0x20-0x1", old: oldInst, new: newInst, changedProperties: ["userLabel"] });

    const metas = [...store.allMetadata()];
    chai.expect(metas.length).to.equal(1);
    chai.expect(metas[0].instanceKey).to.equal("0x20-0x1");
    chai.expect(metas[0].id).to.equal("0x20");
    chai.expect(metas[0].classFullName).to.equal("BisCore:PhysicalElement");
    chai.expect(metas[0].operation).to.equal("Update");
    chai.expect(metas[0].isIndirect).to.be.false;
    chai.expect(metas[0].isElement).to.be.true;
    chai.expect(metas[0].ownerId).to.equal("0x10");
  });

  it("classifies Insert and Delete operations, and non-Element/no-owner classes", () => {
    using store = RebaseInstanceStore.createNew(newStorePath(), iModel, schemaView);
    store.set({ instanceKey: "0x21-0x1", new: makeInstance("0x21", "BisCore:PhysicalElement") });
    store.set({ instanceKey: "0x22-0x1", old: makeInstance("0x22", "BisCore:PhysicalElement") });
    store.set({ instanceKey: "0x23-0x1", old: makeInstance("0x23", "BisCore:ElementUniqueAspect"), new: makeInstance("0x23", "BisCore:ElementUniqueAspect") });

    const metas = new Map([...store.allMetadata()].map((m) => [m.instanceKey, m]));
    chai.expect(metas.get("0x21-0x1")?.operation).to.equal("Insert");
    chai.expect(metas.get("0x22-0x1")?.operation).to.equal("Delete");
    const aspectMeta = metas.get("0x23-0x1");
    chai.expect(aspectMeta?.isElement).to.be.false;
    chai.expect(aspectMeta?.ownerId).to.be.undefined;
  });

  it("marks isIndirect from $meta.isIndirectChange", () => {
    using store = RebaseInstanceStore.createNew(newStorePath(), iModel, schemaView);
    store.set({ instanceKey: "0x24-0x1", new: makeInstance("0x24", "BisCore:PhysicalElement", {}, true) });

    const meta = [...store.allMetadata()][0];
    chai.expect(meta.isIndirect).to.be.true;
  });

  it("get()/all() round-trip old/new/changedProperties", () => {
    using store = RebaseInstanceStore.createNew(newStorePath(), iModel, schemaView);
    const oldInst = makeInstance("0x25", "BisCore:PhysicalElement", { userLabel: "before" });
    const newInst = makeInstance("0x25", "BisCore:PhysicalElement", { userLabel: "after" });
    store.set({ instanceKey: "0x25-0x1", old: oldInst, new: newInst, changedProperties: ["userLabel"] });

    const fetched = store.get("0x25-0x1");
    chai.expect(fetched?.old?.userLabel).to.equal("before");
    chai.expect(fetched?.new?.userLabel).to.equal("after");
    chai.expect(fetched?.changedProperties).to.deep.equal(["userLabel"]);
    chai.expect(store.get("does-not-exist")).to.be.undefined;

    const all = [...store.all()];
    chai.expect(all.length).to.equal(1);
    chai.expect(all[0].instanceKey).to.equal("0x25-0x1");
  });

  it("setTheirs/getTheirs round-trip a value, an absence, and an overwrite", () => {
    using store = RebaseInstanceStore.createNew(newStorePath(), iModel, schemaView);

    chai.expect(store.getTheirs("0x30-0x1")).to.be.undefined;

    store.setTheirs("0x30-0x1", { id: "0x30", classFullName: "BisCore:PhysicalElement", userLabel: "theirs" });
    chai.expect(store.getTheirs("0x30-0x1")?.userLabel).to.equal("theirs");

    store.setTheirs("0x31-0x1", undefined);
    chai.expect(store.getTheirs("0x31-0x1")).to.be.undefined;

    store.setTheirs("0x30-0x1", { id: "0x30", classFullName: "BisCore:PhysicalElement", userLabel: "updated" });
    chai.expect(store.getTheirs("0x30-0x1")?.userLabel).to.equal("updated");
  });

  it("openExisting can read a store created via createNew; openForReplay can write to the same file", () => {
    const dbPath = newStorePath();
    using createStore = RebaseInstanceStore.createNew(dbPath, iModel, schemaView);
    createStore.set({ instanceKey: "0x40-0x1", new: makeInstance("0x40", "BisCore:PhysicalElement") });
    createStore[Symbol.dispose]();

    const readOnlyStore = RebaseInstanceStore.openExisting(dbPath);
    chai.expect([...readOnlyStore.allMetadata()].length).to.equal(1);
    readOnlyStore[Symbol.dispose]();

    using replayStore = RebaseInstanceStore.openForReplay(dbPath);
    replayStore.setTheirs("0x40-0x1", { id: "0x40", classFullName: "BisCore:PhysicalElement" });
    chai.expect(replayStore.getTheirs("0x40-0x1")?.id).to.equal("0x40");
  });
});
