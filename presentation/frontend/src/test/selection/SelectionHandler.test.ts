/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */

import { expect } from "chai";
import sinon from "sinon";
import { IModelConnection } from "@itwin/core-frontend";
import { KeySet } from "@itwin/presentation-common";
import { SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType, SelectionHandler, SelectionManager } from "../../presentation-frontend.js";

describe("SelectionHandler", () => {
  let selectionManagerMock: ReturnType<typeof stubSelectionManager>;
  let selectionManager: SelectionManager;
  let imodel: IModelConnection;
  const source: string = "test";
  const ruleset: string = "ruleset";
  const keyset = new KeySet();
  let selectionHandler: SelectionHandler;

  beforeEach(() => {
    selectionManagerMock = stubSelectionManager();
    selectionManager = selectionManagerMock as unknown as SelectionManager;
    imodel = {} as IModelConnection;
    selectionHandler = new SelectionHandler({
      manager: selectionManager,
      imodel,
      rulesetId: ruleset,
      name: source,
    });
  });

  afterEach(() => {
    selectionHandler[Symbol.dispose]();
  });

  function stubSelectionManager() {
    return {
      selectionChange: new SelectionChangeEvent(),
      getSelectionLevels: sinon.stub(),
      getSelection: sinon.stub(),
      clearSelection: sinon.stub(),
      addToSelection: sinon.stub(),
      removeFromSelection: sinon.stub(),
      replaceSelection: sinon.stub(),
    };
  }

  describe("dispose", () => {
    it("stops listening for selection change events", () => {
      expect(selectionManager.selectionChange.numberOfListeners).to.eq(1);
      selectionHandler[Symbol.dispose]();
      expect(selectionManager.selectionChange.numberOfListeners).to.eq(0);
    });
  });

  describe("getSelectionLevels", () => {
    it("gets selection levels from manager", () => {
      const levels = [123, 456];
      selectionManagerMock.getSelectionLevels.returns(levels);
      const selection = selectionHandler.getSelectionLevels();
      expect(selection).to.eq(levels);
      expect(selectionManagerMock.getSelectionLevels).to.have.been.calledOnceWith(imodel);
    });
  });

  describe("getSelection", () => {
    it("gets selection from manager", () => {
      const keys = new KeySet();
      selectionManagerMock.getSelection.returns(keys);
      const selection = selectionHandler.getSelection(999);
      expect(selection).to.eq(keys);
      expect(selectionManagerMock.getSelection).to.have.been.calledOnceWith(imodel, 999);
    });
  });

  describe("clearSelection", () => {
    it("calls manager's clearSelection", () => {
      selectionHandler.clearSelection();
      expect(selectionManagerMock.clearSelection).to.have.been.calledOnceWith(source, sinon.match.any, 0, ruleset);
    });

    it("doesn't call manager's clearSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.clearSelection();
      };
      selectionManager.selectionChange.raiseEvent(
        {
          changeType: SelectionChangeType.Clear,
          imodel,
          source: "different source",
          level: 0,
        } as SelectionChangeEventArgs,
        selectionManager,
      );
      expect(selectionManagerMock.clearSelection).to.not.have.been.called;
    });
  });

  describe("addToSelection", () => {
    it("calls manager's addToSelection", () => {
      selectionHandler.addToSelection(keyset);
      expect(selectionManagerMock.addToSelection).to.have.been.calledOnceWith(source, sinon.match.any, keyset, 0, ruleset);
    });

    it("doesn't call manager's addToSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.addToSelection(keyset);
      };
      selectionManager.selectionChange.raiseEvent(
        {
          changeType: SelectionChangeType.Add,
          imodel,
          keys: keyset,
          source: "different source",
          level: 0,
          timestamp: new Date(),
        } as SelectionChangeEventArgs,
        selectionManager,
      );
      expect(selectionManagerMock.addToSelection).to.not.have.been.called;
    });
  });

  describe("removeFromSelection", () => {
    it("calls manager's removeFromSelection", () => {
      selectionHandler.removeFromSelection(keyset);
      expect(selectionManagerMock.removeFromSelection).to.have.been.calledOnceWith(source, sinon.match.any, keyset, 0, ruleset);
    });

    it("doesn't call manager's removeFromSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.removeFromSelection(keyset);
      };
      selectionManager.selectionChange.raiseEvent(
        {
          changeType: SelectionChangeType.Remove,
          imodel,
          keys: keyset,
          source: "different source",
          level: 0,
          timestamp: new Date(),
        } as SelectionChangeEventArgs,
        selectionManager,
      );
      expect(selectionManagerMock.removeFromSelection).to.not.have.been.called;
    });
  });

  describe("replaceSelection", () => {
    it("calls manager's replaceSelection", () => {
      selectionHandler.replaceSelection(keyset);
      expect(selectionManagerMock.replaceSelection).to.have.been.calledOnceWith(source, sinon.match.any, keyset, 0, ruleset);
    });

    it("doesn't call manager's replaceSelection while handling selection change", () => {
      selectionHandler.onSelect = () => {
        selectionHandler.replaceSelection(keyset);
      };
      selectionManager.selectionChange.raiseEvent(
        {
          changeType: SelectionChangeType.Clear,
          imodel,
          keys: keyset,
          source: "different source",
          level: 0,
          timestamp: new Date(),
        } as SelectionChangeEventArgs,
        selectionManager,
      );
      expect(selectionManagerMock.replaceSelection).to.not.have.been.called;
    });
  });

  describe("onSelect", () => {
    let callback: sinon.SinonSpy;

    beforeEach(() => {
      callback = sinon.spy();
      selectionHandler.onSelect = callback;
    });

    it("gets called when SelectionChangeEvent has different source than SelectionHandler", () => {
      const args: SelectionChangeEventArgs = {
        imodel,
        source: "someDifferentSource",
        changeType: SelectionChangeType.Clear,
        level: 0,
        keys: new KeySet(),
        timestamp: new Date(),
      };
      selectionManager.selectionChange.raiseEvent(args, selectionManager);
      expect(callback).to.have.been.calledOnceWith(args, selectionManager);
    });

    it("doesn't get called when SelectionChangeEvent has same source as SelectionHandler", () => {
      const args: SelectionChangeEventArgs = {
        imodel,
        source: selectionHandler.name,
        changeType: SelectionChangeType.Clear,
        level: 0,
        keys: new KeySet(),
        timestamp: new Date(),
      };
      selectionManager.selectionChange.raiseEvent(args, selectionManager);
      expect(callback).to.not.have.been.called;
    });
  });
});
