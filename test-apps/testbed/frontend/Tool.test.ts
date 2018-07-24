/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "chai";
import { IModelConnection, ElementAgenda, ModifyElementSource, SelectEventType } from "@bentley/imodeljs-frontend";
import { Id64 } from "@bentley/bentleyjs-core";
import { CONSTANTS } from "../common/Testbed";
import { MaybeRenderApp } from "./WebGLTestContext";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

describe("Tools", () => {
  let imodel: IModelConnection;

  before(async () => {
    MaybeRenderApp.startup();
    imodel = await IModelConnection.openStandalone(iModelLocation);
  });
  after(async () => {
    if (imodel) await imodel.closeStandalone();
    MaybeRenderApp.shutdown();
  });

  it("ElementAgenda tests", () => {
    const ids = [new Id64("0x1"), new Id64("0x2"), new Id64("0x3"), new Id64("0x4")];
    const agenda = new ElementAgenda(imodel);
    assert.equal(agenda.iModel, imodel);
    assert.equal(agenda.getCount(), 0);
    agenda.add(ids[0]);
    assert.equal(agenda.length, 1, "add with Id64");
    agenda.add([ids[0].value, ids[1].value]);
    agenda.setSource(ModifyElementSource.Selected);
    assert.equal(agenda.length, 2, "add with array");
    assert.equal(agenda.getSource(), ModifyElementSource.Selected, "setSource selected");
    const idsSet = new Set([ids[0].value, ids[1].value, ids[2].value, ids[3].value]);
    agenda.add(idsSet);
    agenda.setSource(ModifyElementSource.Group);
    assert.equal(agenda.length, 4, "add with IdSet");
    ids.forEach((id) => assert.isTrue(agenda.has(id.value)));
    assert.isFalse(agenda.has("0x11"), "should not find");
    assert.equal(agenda.getSource(), ModifyElementSource.Group, "setSource group");
    agenda.hilite();
    assert.equal(imodel.hilited.size, 4, "hilite");
    agenda.remove(ids[0]);
    assert.equal(imodel.hilited.size, 3, "remove unhilites");
    assert.equal(agenda.length, 3, "remove");
    agenda.popGroup();
    assert.equal(imodel.hilited.size, 1, "popGroup unhilites");
    assert.equal(agenda.length, 1, "popGroup");
    assert.equal(agenda.getSource(), ModifyElementSource.Selected, "popGroup pops source");
    agenda.invert(idsSet);
    assert.equal(agenda.length, 3, "invert");
    assert.equal(imodel.hilited.size, 3, "invert unhilites");
    assert.isTrue(agenda.find(ids[0]), "agenda find");
    agenda.clear();
    assert.isTrue(agenda.isEmpty(), "clear works");
    assert.equal(imodel.hilited.size, 0, "clear unhilites");
  });

  it("SelectionSet tests", () => {
    const ids = [new Id64("0x1"), new Id64("0x2"), new Id64("0x3"), new Id64("0x4")];
    const selSet = imodel.selectionSet;
    let numCalls = 0;
    let lastType = SelectEventType.Clear;
    const originalNumListeners = selSet.onChanged.numberOfListeners;
    const removeMe = selSet.onChanged.addListener((_imodel: IModelConnection, _evType: SelectEventType, _ids?: Set<string>) => {
      assert.equal(_imodel, imodel);
      lastType = _evType;
      ++numCalls;
    });
    selSet.add(ids[0]);
    assert.equal(selSet.size, 1, "add with Id64");
    assert.isTrue(selSet.isSelected(ids[0]), "is selected");
    assert.isTrue(selSet.isActive(), "is active");
    assert.isFalse(selSet.isSelected(ids[1]), "not selected");
    assert.equal(numCalls, 1, "listener called");
    assert.equal(lastType, SelectEventType.Add, "add event type1");
    selSet.add([ids[0].value, ids[1].value]);
    assert.equal(numCalls, 2, "listener called again");
    assert.equal(lastType, SelectEventType.Add, "add event type again");
    assert.equal(selSet.size, 2, "add with array");
    selSet.add([ids[0].value, ids[1].value]);
    assert.equal(numCalls, 2, "added ones that are already present should not invoke callback");
    const idsSet = new Set([ids[0].value, ids[1].value, ids[2].value, ids[3].value]);
    selSet.add(idsSet, false);
    assert.equal(numCalls, 2, "no callback");
    assert.equal(selSet.size, 4, "add with IdSet");
    ids.forEach((id) => assert.isTrue(selSet.has(id.value)));
    selSet.remove(ids[1]);
    assert.equal(lastType, SelectEventType.Remove, "remove event type");
    assert.equal(numCalls, 3, "remove callback");
    assert.equal(selSet.size, 3, "removed one");
    assert.isFalse(selSet.isSelected(ids[1]), "removed from selected");
    selSet.invert(idsSet);
    assert.equal(numCalls, 5, "invert callback");
    assert.equal(selSet.size, 1, "inverted one");
    assert.isTrue(selSet.isSelected(ids[1]), "inverted selection");
    selSet.replace(idsSet);
    assert.equal(numCalls, 6, "replace");
    assert.equal(lastType, SelectEventType.Replace, "replace event type");
    assert.equal(selSet.size, 4, "replaced with whole set");
    selSet.emptyAll();
    assert.equal(numCalls, 7, "emptyAll");
    assert.equal(lastType, SelectEventType.Clear, "clear event type");
    assert.isFalse(selSet.isActive(), "not active after emptyAll");
    selSet.emptyAll();
    assert.equal(numCalls, 7, "already empty, should not invoke callback");
    removeMe(); // remove listener
    assert.equal(selSet.onChanged.numberOfListeners, originalNumListeners, "listener removed");
    selSet.add(ids[0]);
    assert.equal(selSet.size, 1, "add with no listener");
    assert.equal(numCalls, 7, "listener was removed");
  });
});
