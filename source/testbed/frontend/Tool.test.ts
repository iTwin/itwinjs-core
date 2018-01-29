/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelApp } from "../../frontend/IModelApp";
import { IModelConnection } from "../../frontend/IModelConnection";
import { ElementAgenda } from "../../frontend/tools/ElementSetTool";
import * as path from "path";
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

const iModelLocation = path.join(__dirname, "../../../../test/lib/test/assets/test.bim");

class TestIModelApp extends IModelApp {
  protected supplyI18NOptions() { return { urlTemplate: "http://localhost:3000/locales/{{lng}}/{{ns}}.json" }; }
}

// tslint:disable:only-arrow-functions
// tslint:disable-next-line:space-before-function-paren
describe("Tools", function () {
  let imodel: IModelConnection;
  const mocha = this;

  before(async () => {
    mocha.timeout(99999);
    TestIModelApp.startup();
    imodel = await IModelConnection.openStandalone(iModelLocation);
  });
  after(async () => {
    await imodel.closeStandalone();
    TestIModelApp.shutdown();
  });

  it("ElementAgenda tests", () => {
    const ids = [new Id64("0x1"), new Id64("0x2"), new Id64("0x3"), new Id64("0x4")];
    const agenda = new ElementAgenda(imodel);
    assert.equal(agenda.iModel, imodel);
    assert.equal(agenda.getCount(), 0);
    agenda.add(ids[0]);
    assert.equal(agenda.length, 1, "add with Id64");
    agenda.add([ids[0].value, ids[1].value]);
    assert.equal(agenda.length, 2, "add with array");
    const idsSet = new Set([ids[0].value, ids[1].value, ids[2].value, ids[3].value]);
    agenda.add(idsSet);
    assert.equal(agenda.length, 4, "add with IdSet");
    ids.forEach((id) => assert.isTrue(agenda.has(id.value)));
    assert.isFalse(agenda.has("0x11"), "should not find");
    agenda.hilite();
    assert.equal(imodel.hilited.size, 4, "hilite");
    agenda.remove(ids[0]);
    assert.equal(imodel.hilited.size, 3, "remove unhilites");
    assert.equal(agenda.length, 3, "remove");
    agenda.popGroup();
    assert.equal(imodel.hilited.size, 1, "popGroup unhilites");
    assert.equal(agenda.length, 1, "popGroup");
    agenda.invert(idsSet);
    assert.equal(agenda.length, 3, "invert");
    assert.equal(imodel.hilited.size, 3, "invert unhilites");
    assert.isTrue(agenda.find(ids[0]), "agenda find");
    agenda.clear();
    assert.isTrue(agenda.isEmpty(), "clear works");
    assert.equal(imodel.hilited.size, 0, "clear unhilites");
  });

});
