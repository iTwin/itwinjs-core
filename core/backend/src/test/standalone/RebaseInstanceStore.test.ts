/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { Guid } from "@itwin/core-bentley";
import type { SchemaView } from "@itwin/ecschema-metadata";
import { RebaseInstanceStore } from "../../internal/RebaseInstanceStore";
import type { RebaseInstanceMetadata } from "../../internal/RebaseInstanceStore";
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

  it("extracts identity values (federationGuid/code) and navigationRefs (parent) at capture time for Insert/Update/Delete", () => {
    using store = RebaseInstanceStore.createNew(newStorePath(), iModel, schemaView);
    const parentA = { id: "0x10", relClassName: "BisCore:ElementOwnsChildElements" };
    const parentB = { id: "0x11", relClassName: "BisCore:ElementOwnsChildElements" };
    const guidOld = Guid.createValue();
    const guidNew = Guid.createValue();
    const codeOld = { spec: "0x1", scope: "0x1", value: "CodeOld" };
    const codeNew = { spec: "0x1", scope: "0x1", value: "CodeNew" };

    // Insert - only "new" identity/navigation values are populated.
    store.set({ instanceKey: "0x50-0x1", new: makeInstance("0x50", "BisCore:PhysicalElement", { federationGuid: guidNew, code: codeNew, parent: parentA }) });
    // Update - both "old" and "new" identity/navigation values are populated, and can differ.
    store.set({
      instanceKey: "0x51-0x1",
      old: makeInstance("0x51", "BisCore:PhysicalElement", { federationGuid: guidOld, code: codeOld, parent: parentA }),
      new: makeInstance("0x51", "BisCore:PhysicalElement", { federationGuid: guidNew, code: codeNew, parent: parentB }),
    });
    // Delete - only "old" identity/navigation values are populated.
    store.set({ instanceKey: "0x52-0x1", old: makeInstance("0x52", "BisCore:PhysicalElement", { federationGuid: guidOld, code: codeOld, parent: parentA }) });
    // A relationship (link-table) class must get no navigationRefs at all, regardless of its own nav properties.
    store.set({ instanceKey: "0x53-0x1", new: makeInstance("0x53", "BisCore:ElementOwnsChildElements", { sourceECInstanceId: "0x10", targetECInstanceId: "0x50" }) });

    const metas = new Map([...store.allMetadata()].map((m) => [m.instanceKey, m]));

    // `identityValues` now covers every schema-declared UNIQUE constraint discovered via ECSQL
    // (federationGuid and the Code triple both being BisCore:Element-declared ones), not just two
    // hardcoded properties - look each one up by its `key` (the sorted, comma-joined *raw EC* access
    // strings the constraint was declared with, e.g. `"FederationGuid"` or
    // `"CodeScope.Id,CodeSpec.Id,CodeValue"` - a `<NavProperty>.Id` suffix for a composite index entry
    // referencing a navigation property) rather than assuming a fixed shape.
    const findIdentity = (meta: RebaseInstanceMetadata, ecAccessStrings: string[]) => {
      const key = [...ecAccessStrings].sort().join(",");
      return meta.identityValues?.find((v) => v.key === key);
    };

    const insertMeta = metas.get("0x50-0x1")!;
    const insertGuid = findIdentity(insertMeta, ["FederationGuid"]);
    chai.expect(insertGuid?.old).to.be.undefined;
    chai.expect(insertGuid?.new).to.equal(guidNew);
    const insertCode = findIdentity(insertMeta, ["CodeSpec.Id", "CodeScope.Id", "CodeValue"]);
    chai.expect(insertCode?.old).to.be.undefined;
    chai.expect(insertCode?.new).to.equal(`${codeNew.spec}|${codeNew.scope}|${codeNew.value}`);
    const insertParentRef = insertMeta.navigationRefs?.find((ref) => ref.jsName === "parent");
    chai.expect(insertParentRef).to.not.be.undefined;
    chai.expect(insertParentRef?.oldId).to.be.undefined;
    chai.expect(insertParentRef?.newId).to.equal(parentA.id);

    const updateMeta = metas.get("0x51-0x1")!;
    const updateGuid = findIdentity(updateMeta, ["FederationGuid"]);
    chai.expect(updateGuid?.old).to.equal(guidOld);
    chai.expect(updateGuid?.new).to.equal(guidNew);
    const updateCode = findIdentity(updateMeta, ["CodeSpec.Id", "CodeScope.Id", "CodeValue"]);
    chai.expect(updateCode?.old).to.equal(`${codeOld.spec}|${codeOld.scope}|${codeOld.value}`);
    chai.expect(updateCode?.new).to.equal(`${codeNew.spec}|${codeNew.scope}|${codeNew.value}`);
    const updateParentRef = updateMeta.navigationRefs?.find((ref) => ref.jsName === "parent");
    chai.expect(updateParentRef?.oldId).to.equal(parentA.id);
    chai.expect(updateParentRef?.newId).to.equal(parentB.id);

    const deleteMeta = metas.get("0x52-0x1")!;
    const deleteGuid = findIdentity(deleteMeta, ["FederationGuid"]);
    chai.expect(deleteGuid?.old).to.equal(guidOld);
    chai.expect(deleteGuid?.new).to.be.undefined;
    const deleteCode = findIdentity(deleteMeta, ["CodeSpec.Id", "CodeScope.Id", "CodeValue"]);
    chai.expect(deleteCode?.old).to.equal(`${codeOld.spec}|${codeOld.scope}|${codeOld.value}`);
    chai.expect(deleteCode?.new).to.be.undefined;
    const deleteParentRef = deleteMeta.navigationRefs?.find((ref) => ref.jsName === "parent");
    chai.expect(deleteParentRef?.oldId).to.equal(parentA.id);
    chai.expect(deleteParentRef?.newId).to.be.undefined;

    const relationshipMeta = metas.get("0x53-0x1")!;
    chai.expect(relationshipMeta.navigationRefs).to.be.undefined;
  });
});
