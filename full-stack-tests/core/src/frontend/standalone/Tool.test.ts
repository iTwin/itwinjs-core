/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { ElementAgenda, IModelConnection, ModifyElementSource } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("Tools", () => {
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
  });
  after(async () => {
    await imodel?.close();
    await TestUtility.shutdownFrontend();
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
});
