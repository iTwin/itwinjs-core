/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import { SelectionManager, SelectionHandler, SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType, ISelectionProvider } from "@src/selection";

describe("SelectionHandler", () => {

  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const source: string = "test";
  const ruleset: string = "ruleset";
  const keyset = new KeySet();
  let selectionHandler: SelectionHandler;

  beforeEach(() => {
    const selectionChangeEvent = new SelectionChangeEvent();
    selectionManagerMock.reset();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
    selectionHandler = new SelectionHandler(selectionManagerMock.object, source, imodelMock.object, ruleset);
  });

  afterEach(() => {
    selectionHandler.dispose();
  });

  describe("dispose", () => {

    it("stops listening for selection change events", () => {
      expect(selectionManagerMock.object.selectionChange.numberOfListeners).to.eq(1);
      selectionHandler.dispose();
      expect(selectionManagerMock.object.selectionChange.numberOfListeners).to.eq(0);
    });

  });

  describe("getSelectionLevels", () => {

    it("gets selection levels from manager", () => {
      const levels = [123, 456];
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => levels).verifiable();
      const selection = selectionHandler.getSelectionLevels();
      expect(selection).to.eq(levels);
      selectionManagerMock.verifyAll();
    });

  });

  describe("getSelection", () => {

    it("gets selection from manager", () => {
      const keys = new KeySet();
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, 999)).returns(() => keys).verifiable();
      const selection = selectionHandler.getSelection(999);
      expect(selection).to.eq(keys);
      selectionManagerMock.verifyAll();
    });

  });

  describe("clearSelection", () => {

    it("calls manager's clearSelection", () => {
      selectionHandler.clearSelection();
      selectionManagerMock.verify((x) => x.clearSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

    it("doesn't call manager's clearSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.clearSelection();
      };
      selectionManagerMock.object.selectionChange.raiseEvent({
        changeType: SelectionChangeType.Clear,
        imodel: imodelMock.object,
        source: "different source",
        level: 0,
      } as SelectionChangeEventArgs, selectionManagerMock.object);
      selectionManagerMock.verify((x) => x.clearSelection(moq.It.isAny(), imodelMock.object), moq.Times.never());
    });

  });

  describe("addToSelection", () => {

    it("calls manager's addToSelection", () => {
      selectionHandler.addToSelection(keyset);
      selectionManagerMock.verify((x) => x.addToSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(keyset), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

    it("doesn't call manager's addToSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.addToSelection(keyset);
      };
      selectionManagerMock.object.selectionChange.raiseEvent({
        changeType: SelectionChangeType.Add,
        imodel: imodelMock.object,
        keys: keyset,
        source: "different source",
        level: 0,
        timestamp: new Date(),
      } as SelectionChangeEventArgs, selectionManagerMock.object);
      selectionManagerMock.verify((x) => x.addToSelection(moq.It.isAny(), imodelMock.object, keyset), moq.Times.never());
    });

  });

  describe("removeFromSelection", () => {

    it("calls manager's removeFromSelection", () => {
      selectionHandler.removeFromSelection(keyset);
      selectionManagerMock.verify((x) => x.removeFromSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(keyset), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

    it("doesn't call manager's removeFromSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.removeFromSelection(keyset);
      };
      selectionManagerMock.object.selectionChange.raiseEvent({
        changeType: SelectionChangeType.Remove,
        imodel: imodelMock.object,
        keys: keyset,
        source: "different source",
        level: 0,
        timestamp: new Date(),
      } as SelectionChangeEventArgs, selectionManagerMock.object);
      selectionManagerMock.verify((x) => x.removeFromSelection(moq.It.isAny(), imodelMock.object, keyset), moq.Times.never());
    });

  });

  describe("replaceSelection", () => {

    it("calls manager's replaceSelection", () => {
      selectionHandler.replaceSelection(keyset);
      selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isValue(source), moq.It.isAny(), moq.It.isValue(keyset), moq.It.isValue(0), moq.It.isValue(ruleset)), moq.Times.once());
    });

    it("doesn't call manager's replaceSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.replaceSelection(keyset);
      };
      selectionManagerMock.object.selectionChange.raiseEvent({
        changeType: SelectionChangeType.Clear,
        imodel: imodelMock.object,
        keys: keyset,
        source: "different source",
        level: 0,
        timestamp: new Date(),
      } as SelectionChangeEventArgs, selectionManagerMock.object);
      selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, keyset), moq.Times.never());
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
        imodel: imodelMock.object,
        source: "someDifferentSource",
        changeType: SelectionChangeType.Clear,
        level: 0,
        keys: new KeySet(),
        timestamp: new Date(),
      };
      selectionManagerMock.object.selectionChange.raiseEvent(args, selectionManagerMock.object);
      callbackMock.verify((x) => x(args, selectionManagerMock.object), moq.Times.once());
    });

    it("doesn't get called when SelectionChangeEvent has same source as SelectionHandler", () => {
      const args: SelectionChangeEventArgs = {
        imodel: imodelMock.object,
        source: selectionHandler.name,
        changeType: SelectionChangeType.Clear,
        level: 0,
        keys: new KeySet(),
        timestamp: new Date(),
      };
      selectionManagerMock.object.selectionChange.raiseEvent(args, selectionManagerMock.object);
      callbackMock.verify((x) => x(args, selectionManagerMock.object), moq.Times.never());
    });

  });

});
