/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect, spy, use } from "chai";
import * as spies from "chai-spies";
import * as moq from "typemoq";
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet } from "@bentley/ecpresentation-common";
import { SelectionManager } from "./SelectionManager";
import { SelectionHandler } from "./SelectionHandler";
import { SelectionChangeEvent } from "./SelectionChangeEvent";

describe("SelectionHandler", () => {

  const mockSelectionManager = moq.Mock.ofType<SelectionManager>();
  const mockImodelToken = moq.Mock.ofType<IModelToken>();
  let selectionHandler: SelectionHandler;
  const source: string = "test";
  const ruleset: string = "ruleset";
  const keyset = new KeySet();

  use(spies);

  beforeEach(() => {
    mockSelectionManager.reset();
    mockImodelToken.reset();
    selectionHandler = new SelectionHandler(mockSelectionManager.object, source, ruleset, mockImodelToken.object);
  });

  describe("clearSelection", () => {

    it("calls manager's clearSelection", () => {

      selectionHandler.clearSelection();
      mockSelectionManager.verify((x) => x.clearSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

  });

  describe("addToSelection", () => {

    it("calls manager's addToSelection", () => {
      selectionHandler.addToSelection(keyset);
      mockSelectionManager.verify((x) => x.addToSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(keyset), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

  });

  describe("removeFromSelection", () => {

    it("calls manager's removeFromSelection", () => {
      selectionHandler.removeFromSelection(keyset);
      mockSelectionManager.verify((x) => x.removeFromSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(keyset), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

  });

  describe("replaceSelection", () => {

    it("calls manager's replaceSelection", () => {
      selectionHandler.replaceSelection(keyset);
      mockSelectionManager.verify((x) => x.replaceSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(keyset), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

  });

  describe("onSelect", () => {

    let callBackSpy: any;
    let event: SelectionChangeEvent;

    beforeEach(() => {
      event = new SelectionChangeEvent();
      mockSelectionManager.reset();
      mockSelectionManager.setup((x) => x.selectionChange).returns(() => event);
      callBackSpy = spy.on(() => { });
      selectionHandler = new SelectionHandler(mockSelectionManager.object, source, ruleset, mockImodelToken.object, callBackSpy);
    });

    it("raises SelectionChangeEvent with different source from SelectionHandler", () => {
      event.raiseEvent({ source: "someDifferentSource" });
      expect(callBackSpy).to.have.been.called.once;
    });

    it("raises SelectionChangeEvent with same source as SelectionHandler", () => {
      event.raiseEvent({ source });
      expect(callBackSpy).to.have.been.called.exactly(0);
    });

  });

});
