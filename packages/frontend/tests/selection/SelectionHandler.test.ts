/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet } from "@bentley/ecpresentation-common";
import { SelectionManager, SelectionHandler, SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType, ISelectionProvider } from "@src/selection";

describe("SelectionHandler", () => {

  const mockSelectionManager = moq.Mock.ofType<SelectionManager>();
  const mockImodelToken = moq.Mock.ofType<IModelToken>();
  const source: string = "test";
  const ruleset: string = "ruleset";
  const keyset = new KeySet();
  let selectionHandler: SelectionHandler;

  beforeEach(() => {
    const selectionChangeEvent = new SelectionChangeEvent();
    mockSelectionManager.reset();
    mockSelectionManager.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
    selectionHandler = new SelectionHandler(mockSelectionManager.object, source, mockImodelToken.object, ruleset);
  });

  afterEach(() => {
    selectionHandler.dispose();
  });

  describe("dispose", () => {

    it("stops listening for selection change events", () => {
      expect(mockSelectionManager.object.selectionChange.numberOfListeners).to.eq(1);
      selectionHandler.dispose();
      expect(mockSelectionManager.object.selectionChange.numberOfListeners).to.eq(0);
    });

  });

  describe("clearSelection", () => {

    it("calls manager's clearSelection", () => {
      selectionHandler.clearSelection();
      mockSelectionManager.verify((x) => x.clearSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

    it("doesn't call manager's clearSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.clearSelection();
      };
      mockSelectionManager.object.selectionChange.raiseEvent({
        changeType: SelectionChangeType.Clear,
        imodelToken: mockImodelToken.object,
        source: "different source",
        level: 0,
      } as SelectionChangeEventArgs, mockSelectionManager.object);
      mockSelectionManager.verify((x) => x.clearSelection(moq.It.isAny(), mockImodelToken.object), moq.Times.never());
    });

  });

  describe("addToSelection", () => {

    it("calls manager's addToSelection", () => {
      selectionHandler.addToSelection(keyset);
      mockSelectionManager.verify((x) => x.addToSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(keyset), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

    it("doesn't call manager's addToSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.addToSelection(keyset);
      };
      mockSelectionManager.object.selectionChange.raiseEvent({
        changeType: SelectionChangeType.Add,
        imodelToken: mockImodelToken.object,
        keys: keyset,
        source: "different source",
        level: 0,
      } as SelectionChangeEventArgs, mockSelectionManager.object);
      mockSelectionManager.verify((x) => x.addToSelection(moq.It.isAny(), mockImodelToken.object, keyset), moq.Times.never());
    });

  });

  describe("removeFromSelection", () => {

    it("calls manager's removeFromSelection", () => {
      selectionHandler.removeFromSelection(keyset);
      mockSelectionManager.verify((x) => x.removeFromSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(keyset), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

    it("doesn't call manager's removeFromSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.removeFromSelection(keyset);
      };
      mockSelectionManager.object.selectionChange.raiseEvent({
        changeType: SelectionChangeType.Remove,
        imodelToken: mockImodelToken.object,
        keys: keyset,
        source: "different source",
        level: 0,
      } as SelectionChangeEventArgs, mockSelectionManager.object);
      mockSelectionManager.verify((x) => x.removeFromSelection(moq.It.isAny(), mockImodelToken.object, keyset), moq.Times.never());
    });

  });

  describe("replaceSelection", () => {

    it("calls manager's replaceSelection", () => {
      selectionHandler.replaceSelection(keyset);
      mockSelectionManager.verify((x) => x.replaceSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(keyset), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

    it("doesn't call manager's replaceSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.replaceSelection(keyset);
      };
      mockSelectionManager.object.selectionChange.raiseEvent({
        changeType: SelectionChangeType.Clear,
        imodelToken: mockImodelToken.object,
        keys: keyset,
        source: "different source",
        level: 0,
      } as SelectionChangeEventArgs, mockSelectionManager.object);
      mockSelectionManager.verify((x) => x.replaceSelection(moq.It.isAny(), mockImodelToken.object, keyset), moq.Times.never());
    });

  });

  describe("onSelect", () => {

    const callbackMock = moq.Mock.ofInstance((_args: SelectionChangeEventArgs, _provider: ISelectionProvider) => { });

    beforeEach(() => {
      callbackMock.reset();
      selectionHandler.onSelect = callbackMock.object;
    });

    it("gets called when SelectionChangeEvent has different source than SelectionHandler", () => {
      const args: SelectionChangeEventArgs = {
        imodelToken: mockImodelToken.object,
        source: "someDifferentSource",
        changeType: SelectionChangeType.Clear,
        level: 0,
        keys: new KeySet(),
      };
      mockSelectionManager.object.selectionChange.raiseEvent(args, mockSelectionManager.object);
      callbackMock.verify((x) => x(args, mockSelectionManager.object), moq.Times.once());
    });

    it("doesn't get called when SelectionChangeEvent has same source as SelectionHandler", () => {
      const args: SelectionChangeEventArgs = {
        imodelToken: mockImodelToken.object,
        source: selectionHandler.name,
        changeType: SelectionChangeType.Clear,
        level: 0,
        keys: new KeySet(),
      };
      mockSelectionManager.object.selectionChange.raiseEvent(args, mockSelectionManager.object);
      callbackMock.verify((x) => x(args, mockSelectionManager.object), moq.Times.never());
    });

  });

});
