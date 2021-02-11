/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64, Id64Arg } from "@bentley/bentleyjs-core";
import {
  ElementAgenda, HiliteSet, IModelConnection, MockRender, ModifyElementSource, SelectionSet, SelectionSetEventType, SnapshotConnection,
} from "@bentley/imodeljs-frontend";

describe("Tools", () => {
  let imodel: IModelConnection;

  before(async () => {
    await MockRender.App.startup();
    imodel = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
  });
  after(async () => {
    if (imodel) await imodel.close();
    await MockRender.App.shutdown();
  });

  it("ElementAgenda tests", () => {
    const ids = [Id64.fromString("0x1"), Id64.fromString("0x2"), Id64.fromString("0x3"), Id64.fromString("0x4")];
    const agenda = new ElementAgenda(imodel);
    assert.equal(agenda.iModel, imodel);
    assert.equal(agenda.count, 0);
    agenda.add(ids[0]);
    assert.equal(agenda.length, 1, "add with Id64");
    agenda.add([ids[0], ids[1]]);
    agenda.setSource(ModifyElementSource.Selected);
    assert.equal(agenda.length, 2, "add with array");
    assert.equal(agenda.getSource(), ModifyElementSource.Selected, "setSource selected");
    const idsSet = new Set([ids[0], ids[1], ids[2], ids[3]]);
    agenda.add(idsSet);
    agenda.setSource(ModifyElementSource.Selected);
    assert.equal(agenda.length, 4, "add with IdSet");
    ids.forEach((id) => assert.isTrue(agenda.has(id)));
    assert.isFalse(agenda.has("0x11"), "should not find");
    assert.equal(agenda.getSource(), ModifyElementSource.Selected, "setSource group");
    assert.equal(imodel.hilited.elements.size, 4, "hilite");
    agenda.remove(ids[0]);
    assert.equal(imodel.hilited.elements.size, 3, "remove unhilites");
    assert.equal(agenda.length, 3, "remove");
    agenda.popGroup();
    assert.equal(imodel.hilited.elements.size, 1, "popGroup unhilites");
    assert.equal(agenda.length, 1, "popGroup");
    assert.equal(agenda.getSource(), ModifyElementSource.Selected, "popGroup pops source");
    agenda.invert(idsSet);
    assert.equal(agenda.length, 3, "invert");
    assert.equal(imodel.hilited.elements.size, 3, "invert unhilites");
    assert.isTrue(agenda.find(ids[0]), "agenda find");
    agenda.clear();
    assert.isTrue(agenda.isEmpty, "clear works");
    assert.equal(imodel.hilited.elements.size, 0, "clear unhilites");
  });

  it("SelectionSet tests", () => {
    const ids = [Id64.fromString("0x1"), Id64.fromString("0x2"), Id64.fromString("0x3"), Id64.fromString("0x4")];
    const selSet = imodel.selectionSet;
    let numCalls = 0;
    let lastType = SelectionSetEventType.Clear;
    const originalNumListeners = selSet.onChanged.numberOfListeners;
    const removeMe = selSet.onChanged.addListener((ev) => {
      assert.equal(ev.set, selSet);
      lastType = ev.type;
      ++numCalls;
    });

    // add an id
    selSet.add(ids[0]);
    assert.equal(selSet.size, 1, "add with Id64");
    assert.isTrue(selSet.isSelected(ids[0]), "is selected");
    assert.isTrue(selSet.isActive, "is active");
    assert.isFalse(selSet.isSelected(ids[1]), "not selected");
    assert.equal(numCalls, 1, "listener called");
    assert.equal(lastType, SelectionSetEventType.Add, "add event type1");
    // ids in set: [0]

    // add a list of ids
    selSet.add([ids[0], ids[1]]);
    assert.equal(numCalls, 2, "listener called again");
    assert.equal(lastType, SelectionSetEventType.Add, "add event type again");
    assert.equal(selSet.size, 2, "add with array");
    // ids in set: [0, 1]

    // add the same ids - should do nothing
    selSet.add([ids[0], ids[1]]);
    assert.equal(selSet.size, 2, "size not changed");
    assert.equal(numCalls, 2, "added ones that are already present should not invoke callback");
    // ids in set: [0, 1]

    // add using a Set
    const idsSet = new Set([ids[0], ids[1], ids[2], ids[3]]);
    (selSet as any)._add(idsSet, false);
    assert.equal(numCalls, 2, "no callback (sendEvent = false)");
    assert.equal(selSet.size, 4, "add with IdSet");
    ids.forEach((id) => assert.isTrue(selSet.has(id)));
    // ids in set: [0, 1, 2, 3]

    // remove an id
    selSet.remove(ids[1]);
    assert.equal(lastType, SelectionSetEventType.Remove, "remove event type");
    assert.equal(numCalls, 3, "remove callback");
    assert.equal(selSet.size, 3, "removed one");
    assert.isFalse(selSet.isSelected(ids[1]), "removed from selected");
    // ids in set: [0, 2, 3]

    // invert
    selSet.invert(idsSet);
    assert.equal(numCalls, 4, "invert callback");
    assert.equal(selSet.size, 1, "inverted one");
    assert.isTrue(selSet.isSelected(ids[1]), "inverted selection");
    // ids in set: [1]

    // invert empty list - does nothing
    selSet.invert([]);
    assert.equal(numCalls, 4, "invert callback not called");
    assert.equal(selSet.size, 1, "selection size not changed");
    // ids in set: [1]

    // replace
    selSet.replace(idsSet);
    assert.equal(numCalls, 5, "replace callback");
    assert.equal(lastType, SelectionSetEventType.Replace, "replace event type");
    assert.equal(selSet.size, 4, "replaced with whole set");
    // ids in set: [0, 1, 2, 3]

    // replace with same set - does nothing
    selSet.replace(idsSet);
    assert.equal(numCalls, 5, "replace callback not called");
    assert.equal(selSet.size, 4, "selection size not changed");
    // ids in set: [0, 1, 2, 3]

    // empty all
    selSet.emptyAll();
    assert.equal(numCalls, 6, "emptyAll");
    assert.equal(lastType, SelectionSetEventType.Clear, "clear event type");
    assert.isFalse(selSet.isActive, "not active after emptyAll");
    // ids in set: []

    // empty all again - does nothing
    selSet.emptyAll();
    assert.equal(numCalls, 6, "already empty, should not invoke callback");
    // ids in set: []

    removeMe(); // remove listener
    assert.equal(selSet.onChanged.numberOfListeners, originalNumListeners, "listener removed");

    selSet.add(ids[0]);
    assert.equal(selSet.size, 1, "add with no listener");
    assert.equal(numCalls, 6, "listener was removed");
  });
});

describe("HiliteSet", () => {
  let imodel: IModelConnection;
  let selected: SelectionSet;
  let hilited: HiliteSet;

  before(async () => {
    await MockRender.App.startup();
    imodel = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    selected = imodel.selectionSet;
    hilited = imodel.hilited;
  });

  after(async () => {
    if (imodel) await imodel.close();
    await MockRender.App.shutdown();
  });

  function expectHilitedElements(ids: Id64Arg) {
    Id64.forEach(ids, (id) => expect(hilited.elements.hasId(id)).to.be.true);
  }

  it("synchronizes with selection set", () => {
    // Things explicitly added to HiliteSet are unaffected when selection set changes, unless they are also added and later removed from selection set.
    hilited.clear();
    expect(hilited.wantSyncWithSelectionSet).to.be.true;
    expect(hilited.isEmpty).to.be.true;

    hilited.models.addId("0x123");
    hilited.subcategories.addId("0xabc");

    selected.add(["0x1", "0x2", "0x3"]);
    expectHilitedElements(["0x1", "0x2", "0x3"]);

    selected.remove("0x2");
    expect(hilited.elements.size).to.equal(2);
    expectHilitedElements(["0x1", "0x3"]);

    selected.emptyAll();
    expect(hilited.elements.size).to.equal(0);

    hilited.elements.addIds(["0xa", "0xb"]);
    selected.replace(["0x1", "0x2"]);
    expect(hilited.elements.size).to.equal(4);
    expectHilitedElements(["0x1", "0x2", "0xa", "0xb"]);

    selected.emptyAll();
    expect(hilited.elements.size).to.equal(2);
    expectHilitedElements(["0xa", "0xb"]);

    hilited.elements.clear();
    expect(hilited.elements.size).to.equal(0);

    expect(hilited.models.size).to.equal(1);
    expect(hilited.subcategories.size).to.equal(1);

    hilited.clear();
    expect(hilited.models.size).to.equal(0);
    expect(hilited.subcategories.size).to.equal(0);

    hilited.elements.addIds(["0x1", "0x2"]);
    selected.replace(["0x2", "0x3"]);
    expect(hilited.elements.size).to.equal(3);
    expectHilitedElements(["0x1", "0x2", "0x3"]);

    selected.remove(["0x2"]);
    selected.add(["0x1", "0x4"]);
    expect(hilited.elements.size).to.equal(3);
    expectHilitedElements(["0x1", "0x3", "0x4"]);
  });

  it("can be decoupled from selection set", () => {
    // Disabling sync means changes to selection set have no effect on hilite set.
    hilited.clear();
    hilited.wantSyncWithSelectionSet = false;
    selected.emptyAll();
    hilited.elements.addId("0xa");
    selected.add(["0x1", "0x2", "0x3"]);
    expect(hilited.elements.size).to.equal(1);
    expectHilitedElements("0xa");

    // Re-enabling sync repopulates HiliteSet from SelectionSet. It does not remove current contents of hilite set.
    hilited.wantSyncWithSelectionSet = true;
    expect(hilited.elements.size).to.equal(4);
    expectHilitedElements(["0x1", "0x2", "0x3", "0xa"]);

    // Disabling sync has no effect on HiliteSet.
    hilited.wantSyncWithSelectionSet = false;
    expect(hilited.elements.size).to.equal(4);
    expectHilitedElements(["0x1", "0x2", "0x3", "0xa"]);
  });
});
