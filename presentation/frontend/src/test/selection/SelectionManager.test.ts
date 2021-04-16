/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { Id64, Id64Arg, Id64String, using } from "@bentley/bentleyjs-core";
import { IModelApp, IModelConnection, SelectionSet, SelectionSetEventType } from "@bentley/imodeljs-frontend";
import { InstanceKey, KeySet, SelectionScope } from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { waitForPendingAsyncs } from "@bentley/presentation-common/lib/test/_helpers/PendingAsyncsHelper";
import {
  createRandomECInstanceKey, createRandomId, createRandomSelectionScope, createRandomTransientId,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { HiliteSetProvider, SelectionManager, SelectionScopesManager } from "../../presentation-frontend";
import { ToolSelectionSyncHandler, TRANSIENT_ELEMENT_CLASSNAME } from "../../presentation-frontend/selection/SelectionManager";

const generateSelection = (): InstanceKey[] => {
  return [
    createRandomECInstanceKey(),
    createRandomECInstanceKey(),
    createRandomECInstanceKey(),
  ];
};

describe("SelectionManager", () => {

  let selectionManager: SelectionManager;
  let baseSelection: InstanceKey[];
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const scopesMock = moq.Mock.ofType<SelectionScopesManager>();
  const source: string = "test";

  beforeEach(() => {
    selectionManager = new SelectionManager({ scopes: scopesMock.object });
    scopesMock.reset();
    imodelMock.reset();
    baseSelection = generateSelection();
  });

  it("clears imodel selection when it's closed", () => {
    selectionManager.addToSelection(source, imodelMock.object, [createRandomECInstanceKey()]);
    expect(selectionManager.getSelection(imodelMock.object).isEmpty).to.be.false;

    IModelConnection.onClose.raiseEvent(imodelMock.object);
    expect(selectionManager.getSelection(imodelMock.object).isEmpty).to.be.true;
  });

  describe("getSelectionLevels", () => {

    it("returns empty list when there're no selection levels", () => {
      expect(selectionManager.getSelectionLevels(imodelMock.object)).to.be.empty;
    });

    it("returns available selection levels", () => {
      selectionManager.addToSelection("", imodelMock.object, [createRandomECInstanceKey()], 0);
      selectionManager.addToSelection("", imodelMock.object, [createRandomECInstanceKey()], 3);
      expect(selectionManager.getSelectionLevels(imodelMock.object)).to.deep.eq([0, 3]);
    });

    it("doesn't include empty selection levels", () => {
      selectionManager.addToSelection("", imodelMock.object, [createRandomECInstanceKey()], 0);
      selectionManager.addToSelection("", imodelMock.object, [createRandomECInstanceKey()], 1);
      selectionManager.addToSelection("", imodelMock.object, [], 2);
      expect(selectionManager.getSelectionLevels(imodelMock.object)).to.deep.eq([0, 1]);
    });

  });

  describe("addToSelection", () => {

    it("adds selection on an empty selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
    });

    it("adds selection on non empty selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, [baseSelection[0]]);
      selectionManager.addToSelection(source, imodelMock.object, [baseSelection[1], baseSelection[2]]);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
    });

    it("adds selection on different imodels", () => {
      const imodelMock2 = moq.Mock.ofType<IModelConnection>();
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock2.object, baseSelection);

      for (const imodelToken of [imodelMock.object, imodelMock2.object]) {
        const selectedItemsSet = selectionManager.getSelection(imodelToken);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      }
    });

    it("adds selection on different levels", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, baseSelection, 1);
      for (let i = 0; i <= 1; i++) {
        const selectedItemsSet = selectionManager.getSelection(imodelMock.object, i);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      }
    });

    it("clears higher level selection when adding items to lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, [createRandomECInstanceKey()], 1);
      selectionManager.addToSelection(source, imodelMock.object, [createRandomECInstanceKey()]);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.isEmpty).to.be.true;
    });

    it("doesn't clear higher level selection when adding same items to lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, [createRandomECInstanceKey()], 1);
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.isEmpty).to.be.false;
    });

  });

  describe("replaceSelection", () => {

    it("replaces selection on an empty selection", () => {
      selectionManager.replaceSelection(source, imodelMock.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
    });

    it("replaces on an non empty selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, [baseSelection[0]]);
      selectionManager.replaceSelection(source, imodelMock.object, [baseSelection[1], baseSelection[2]]);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 1);
      expect(selectedItemsSet.has(baseSelection[0])).false;
      expect(selectedItemsSet.has(baseSelection[1])).true;
      expect(selectedItemsSet.has(baseSelection[2])).true;
    });

    it("replaces on different imodels", () => {
      const imodelMock2 = moq.Mock.ofType<IModelConnection>();
      selectionManager.replaceSelection(source, imodelMock.object, baseSelection);
      selectionManager.replaceSelection(source, imodelMock2.object, baseSelection);

      for (const imodelToken of [imodelMock.object, imodelMock2.object]) {
        const selectedItemsSet = selectionManager.getSelection(imodelToken);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      }
    });

    it("replaces with different levels", () => {
      selectionManager.replaceSelection(source, imodelMock.object, baseSelection);
      selectionManager.replaceSelection(source, imodelMock.object, baseSelection, 1);
      for (let i = 0; i <= 1; i++) {
        const selectedItemsSet = selectionManager.getSelection(imodelMock.object, i);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      }
    });

    it("clears higher level selection when replacing lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, [createRandomECInstanceKey()], 1);
      selectionManager.replaceSelection(source, imodelMock.object, [createRandomECInstanceKey()]);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.isEmpty).to.be.true;
    });

    it("doesn't clear higher level selection when replacing lower level selection with same items", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, [createRandomECInstanceKey()], 1);
      selectionManager.replaceSelection(source, imodelMock.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.isEmpty).to.be.false;
    });

  });

  describe("clearSelection", () => {

    it("clears empty selection", () => {
      selectionManager.clearSelection(source, imodelMock.object);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(0);
    });

    it("clears non empty selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.clearSelection(source, imodelMock.object);
      expect(selectionManager.getSelection(imodelMock.object).isEmpty).to.be.true;
    });

    it("clears on different imodels", () => {
      const imodelMock2 = moq.Mock.ofType<IModelConnection>();
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock2.object, baseSelection);

      selectionManager.clearSelection(source, imodelMock2.object);

      let selectedItemsSet = selectionManager.getSelection(imodelMock2.object);
      expect(selectedItemsSet.size).to.be.equal(0);

      selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
    });

    it("clears with different levels", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, baseSelection, 1);

      selectionManager.clearSelection(source, imodelMock.object, 1);
      let selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.size).to.be.equal(0);

      selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
    });

    it("clears higher level selection when clearing items in lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, [createRandomECInstanceKey()], 1);
      selectionManager.clearSelection(source, imodelMock.object);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.isEmpty).to.be.true;
    });

    it("doesn't clears higher level selection when clearing empty lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, [createRandomECInstanceKey()], 1);
      selectionManager.clearSelection(source, imodelMock.object);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.isEmpty).to.be.false;
    });

  });

  describe("removeFromSelection", () => {

    it("removes part of the selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.removeFromSelection(source, imodelMock.object, [baseSelection[1], baseSelection[2]]);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 2);
      expect(selectedItemsSet.has(baseSelection[0])).true;
      expect(selectedItemsSet.has(baseSelection[1])).false;
      expect(selectedItemsSet.has(baseSelection[2])).false;
    });

    it("removes whole selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.removeFromSelection(source, imodelMock.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(0);
    });

    it("removes on different imodels", () => {
      const imodelMock2 = moq.Mock.ofType<IModelConnection>();
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock2.object, baseSelection);

      selectionManager.removeFromSelection(source, imodelMock.object, [baseSelection[0]]);
      selectionManager.removeFromSelection(source, imodelMock2.object, [baseSelection[1], baseSelection[2]]);
      let selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 1);
      expect(selectedItemsSet.has(baseSelection[0])).false;
      expect(selectedItemsSet.has(baseSelection[1])).true;
      expect(selectedItemsSet.has(baseSelection[2])).true;

      selectedItemsSet = selectionManager.getSelection(imodelMock2.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 2);
      expect(selectedItemsSet.has(baseSelection[0])).true;
      expect(selectedItemsSet.has(baseSelection[1])).false;
      expect(selectedItemsSet.has(baseSelection[2])).false;
    });

    it("removes with different levels", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, baseSelection, 1);
      selectionManager.removeFromSelection(source, imodelMock.object, [baseSelection[0]], 1);

      let selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);
      expect(selectedItemsSet.has(baseSelection[0])).true;
      expect(selectedItemsSet.has(baseSelection[1])).true;
      expect(selectedItemsSet.has(baseSelection[2])).true;

      selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 1);
      expect(selectedItemsSet.has(baseSelection[0])).false;
      expect(selectedItemsSet.has(baseSelection[1])).true;
      expect(selectedItemsSet.has(baseSelection[2])).true;
    });

    it("clears higher level selection when removing items from lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, [createRandomECInstanceKey()], 1);
      selectionManager.removeFromSelection(source, imodelMock.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.isEmpty).to.be.true;
    });

    it("doesn't clear higher level selection when removing non-existing items from lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, [createRandomECInstanceKey()], 1);
      selectionManager.removeFromSelection(source, imodelMock.object, [createRandomECInstanceKey()]);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.isEmpty).to.be.false;
    });

  });

  describe("addToSelectionWithSelectionScope", () => {

    let scope: SelectionScope;
    let ids: Id64String[];

    beforeEach(() => {
      scope = createRandomSelectionScope();
      ids = [createRandomId()];
      scopesMock.setup(async (x) => x.getSelectionScopes(imodelMock.object)).returns(async () => [scope]);
      scopesMock.setup(async (x) => x.computeSelection(imodelMock.object, ids, scope)).returns(async () => new KeySet(baseSelection)).verifiable();
    });

    it("adds scoped selection", async () => {
      await selectionManager.addToSelectionWithScope(source, imodelMock.object, ids, scope);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);
      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
      scopesMock.verifyAll();
    });

  });

  describe("replaceSelectionWithSelectionScope", () => {

    let scope: SelectionScope;
    let ids: Id64String[];

    beforeEach(() => {
      scope = createRandomSelectionScope();
      ids = [createRandomId()];
      scopesMock.setup(async (x) => x.getSelectionScopes(imodelMock.object)).returns(async () => [scope]);
      scopesMock.setup(async (x) => x.computeSelection(imodelMock.object, ids, scope)).returns(async () => new KeySet(baseSelection)).verifiable();
    });

    it("replaces empty selection with scoped selection", async () => {
      await selectionManager.replaceSelectionWithScope(source, imodelMock.object, ids, scope);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);
      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
      scopesMock.verifyAll();
    });

  });

  describe("removeFromSelectionWithSelectionScope", () => {

    let scope: SelectionScope;
    let ids: Id64String[];

    beforeEach(() => {
      scope = createRandomSelectionScope();
      ids = [createRandomId()];
      scopesMock.setup(async (x) => x.getSelectionScopes(imodelMock.object)).returns(async () => [scope]);
      scopesMock.setup(async (x) => x.computeSelection(imodelMock.object, ids, scope)).returns(async () => new KeySet(baseSelection)).verifiable();
    });

    it("removes scoped selection", async () => {
      const additionalKey = createRandomECInstanceKey();
      selectionManager.addToSelection(source, imodelMock.object, [...baseSelection, additionalKey]);
      await selectionManager.removeFromSelectionWithScope(source, imodelMock.object, ids, scope);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object);
      expect(selectedItemsSet.size).to.equal(1);
      expect(selectedItemsSet.has(additionalKey)).true;
      scopesMock.verifyAll();
    });

  });

  describe("handleEvent", () => {

    it("fires `selectionChange` event after `addToSelection`, `replaceSelection`, `clearSelection`, `removeFromSelection`", () => {
      const raiseEventSpy = sinon.spy(selectionManager.selectionChange, "raiseEvent");
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.removeFromSelection(source, imodelMock.object, baseSelection);
      selectionManager.replaceSelection(source, imodelMock.object, baseSelection);
      selectionManager.clearSelection(source, imodelMock.object);
      expect(raiseEventSpy, "Expected selectionChange.raiseEvent to be called").to.have.callCount(4);
    });

    it("doesn't fire `selectionChange` event after addToSelection, replaceSelection, clearSelection, removeFromSelection if nothing changes", () => {
      const raiseEventSpy = sinon.spy(selectionManager.selectionChange, "raiseEvent");
      selectionManager.addToSelection(source, imodelMock.object, []);
      selectionManager.clearSelection(source, imodelMock.object);
      selectionManager.removeFromSelection(source, imodelMock.object, baseSelection);
      selectionManager.replaceSelection(source, imodelMock.object, []);
      expect(raiseEventSpy, "Expected selectionChange.raiseEvent to not be called").to.not.have.been.called;
    });

  });

  describe("setSyncWithIModelToolSelection", () => {

    let ss: SelectionSet;

    beforeEach(() => {
      ss = new SelectionSet(imodelMock.object);
      imodelMock.setup((x) => x.selectionSet).returns(() => ss);

      // hacks to avoid instantiating the whole core..
      (IModelApp as any)._viewManager = {
        onSelectionSetChanged: sinon.stub(),
      };
    });

    afterEach(() => {
      (IModelApp as any)._viewManager = undefined;
    });

    it("registers tool selection change listener once per imodel", () => {
      const imodelMock2 = moq.Mock.ofType<IModelConnection>();
      const ss2 = new SelectionSet(imodelMock2.object);
      imodelMock2.setup((x) => x.selectionSet).returns(() => ss2);

      selectionManager.setSyncWithIModelToolSelection(imodelMock.object);
      expect(ss.onChanged.numberOfListeners).to.eq(1); // verify listener added

      selectionManager.setSyncWithIModelToolSelection(imodelMock.object);
      expect(ss.onChanged.numberOfListeners).to.eq(1); // verify listener _not_ added for the same imodel

      selectionManager.setSyncWithIModelToolSelection(imodelMock2.object);
      expect(ss2.onChanged.numberOfListeners).to.eq(1); // verify listener added for a different imodel

      selectionManager.setSyncWithIModelToolSelection(imodelMock2.object, false);
      expect(ss2.onChanged.numberOfListeners).to.eq(0); // verify listener removed

      selectionManager.setSyncWithIModelToolSelection(imodelMock.object, false);
      expect(ss.onChanged.numberOfListeners).to.eq(1); // verify listener _not_ removed as the imodel was registered to sync twice

      selectionManager.setSyncWithIModelToolSelection(imodelMock.object, false);
      expect(ss.onChanged.numberOfListeners).to.eq(0); // verify listener removed

      selectionManager.setSyncWithIModelToolSelection(imodelMock.object, false);
      expect(ss.onChanged.numberOfListeners).to.eq(0); // verify nothing happens as the listeners was removed previously
    });

    describe("syncing with imodel tool selection", () => {

      let syncer: ToolSelectionSyncHandler;

      const matchKeyset = (keys: KeySet) => sinon.match((value: KeySet) => {
        return (value instanceof KeySet)
          && value.size === keys.size
          && value.hasAll(keys);
      });

      const equalId64Arg = (lhs: Id64Arg, rhs: Id64Arg) => {
        if (Id64.sizeOf(lhs) !== Id64.sizeOf(rhs))
          return false;

        for (const lhsId of Id64.iterable(lhs))
          if (!Id64.has(rhs, lhsId))
            return false;

        return true;
      };

      beforeEach(() => {
        syncer = new ToolSelectionSyncHandler(imodelMock.object, selectionManager);
      });

      describe("choosing scope", () => {

        it("uses \"element\" scope when `activeScope = undefined`", async () => {
          scopesMock.setup((x) => x.activeScope).returns(() => undefined);
          scopesMock.setup(async (x) => x.computeSelection(imodelMock.object, moq.It.isAny(), "element"))
            .returns(async () => new KeySet([createRandomECInstanceKey()]))
            .verifiable();
          ss.add(createRandomId());
          await waitForPendingAsyncs(syncer);
          scopesMock.verifyAll();
          expect(selectionManager.getSelection(imodelMock.object).size).to.eq(1);
        });

        it("uses \"element\" scope when `activeScope = \"element\"`", async () => {
          scopesMock.setup((x) => x.activeScope).returns(() => "element");
          scopesMock.setup(async (x) => x.computeSelection(imodelMock.object, moq.It.isAny(), "element"))
            .returns(async () => new KeySet([createRandomECInstanceKey()]))
            .verifiable();
          ss.add(createRandomId());
          await waitForPendingAsyncs(syncer);
          scopesMock.verifyAll();
          expect(selectionManager.getSelection(imodelMock.object).size).to.eq(1);
        });

      });

      describe("changing logical selection", () => {

        let transientElementId: Id64String;
        let transientElementKey: InstanceKey;
        let persistentElementId: Id64String;
        let scopedKey: InstanceKey;
        const logicalSelectionChangesListener = sinon.stub();

        beforeEach(() => {
          const scope: SelectionScope = {
            id: "test scope",
            label: "Test",
          };
          transientElementId = createRandomTransientId();
          transientElementKey = { className: TRANSIENT_ELEMENT_CLASSNAME, id: transientElementId };
          persistentElementId = createRandomId();
          scopedKey = createRandomECInstanceKey();

          logicalSelectionChangesListener.reset();
          selectionManager.selectionChange.addListener(logicalSelectionChangesListener);

          scopesMock.setup((x) => x.activeScope).returns(() => scope);
          scopesMock.setup(async (x) => x.computeSelection(imodelMock.object, [], moq.It.isAnyString()))
            .returns(async () => new KeySet());
          scopesMock.setup(async (x) => x.computeSelection(imodelMock.object, moq.It.is((v) => equalId64Arg(v, [persistentElementId])), moq.It.isAnyString()))
            .returns(async () => new KeySet([scopedKey]));
        });

        it("ignores events with different imodel", async () => {
          const spy = sinon.spy(selectionManager, "addToSelectionWithScope");
          const imodelMock2 = moq.Mock.ofType<IModelConnection>();
          const ss2 = new SelectionSet(imodelMock2.object);
          ss.onChanged.raiseEvent({ type: SelectionSetEventType.Add, set: ss2, added: createRandomId() });
          await waitForPendingAsyncs(syncer);
          expect(spy).to.not.be.called;
        });

        it("adds persistent elements to logical selection when tool selection changes", async () => {
          const spy = sinon.spy(selectionManager, "addToSelection");

          ss.add(persistentElementId);
          await waitForPendingAsyncs(syncer);
          expect(spy).to.be.calledOnceWith("Tool", imodelMock.object, matchKeyset(new KeySet([scopedKey])), 0);
          expect(logicalSelectionChangesListener).to.be.calledOnce;

          const selection = selectionManager.getSelection(imodelMock.object);
          expect(selection.size).to.eq(1);
          expect(selection.has(scopedKey)).to.be.true;
        });

        it("adds transient elements to logical selection when tool selection changes", async () => {
          const spy = sinon.spy(selectionManager, "addToSelection");

          ss.add(transientElementId);
          await waitForPendingAsyncs(syncer);
          expect(spy).to.be.calledOnceWith("Tool", imodelMock.object, matchKeyset(new KeySet([transientElementKey])), 0);
          expect(logicalSelectionChangesListener).to.be.calledOnce;

          const selection = selectionManager.getSelection(imodelMock.object);
          expect(selection.size).to.eq(1);
          expect(selection.has(transientElementKey)).to.be.true;
        });

        it("adds mixed elements to logical selection when tool selection changes", async () => {
          const spy = sinon.spy(selectionManager, "addToSelection");

          ss.add([transientElementId, persistentElementId]);
          await waitForPendingAsyncs(syncer);
          expect(spy).to.be.calledOnceWith("Tool", imodelMock.object, matchKeyset(new KeySet([scopedKey, transientElementKey])), 0);
          expect(logicalSelectionChangesListener).to.be.calledOnce;

          const selection = selectionManager.getSelection(imodelMock.object);
          expect(selection.size).to.eq(2);
          expect(selection.has(scopedKey)).to.be.true;
          expect(selection.has(transientElementKey)).to.be.true;
        });

        it("replaces persistent elements in logical selection when tool selection changes", async () => {
          selectionManager.addToSelection("", imodelMock.object, [createRandomECInstanceKey()]);
          logicalSelectionChangesListener.reset();

          const spy = sinon.spy(selectionManager, "replaceSelection");

          ss.replace(persistentElementId);
          await waitForPendingAsyncs(syncer);
          expect(spy).to.be.calledOnceWith("Tool", imodelMock.object, matchKeyset(new KeySet([scopedKey])), 0);
          expect(logicalSelectionChangesListener).to.be.calledOnce;

          const selection = selectionManager.getSelection(imodelMock.object);
          expect(selection.size).to.eq(1);
          expect(selection.has(scopedKey)).to.be.true;
        });

        it("replaces transient elements in logical selection when tool selection changes", async () => {
          selectionManager.addToSelection("", imodelMock.object, [createRandomECInstanceKey()]);
          logicalSelectionChangesListener.reset();

          const spy = sinon.spy(selectionManager, "replaceSelection");

          ss.replace(transientElementId);
          await waitForPendingAsyncs(syncer);
          expect(spy).to.be.calledOnceWith("Tool", imodelMock.object, matchKeyset(new KeySet([transientElementKey])), 0);
          expect(logicalSelectionChangesListener).to.be.calledOnce;

          const selection = selectionManager.getSelection(imodelMock.object);
          expect(selection.size).to.eq(1);
          expect(selection.has(transientElementKey)).to.be.true;
        });

        it("replaces mixed elements in logical selection when tool selection changes", async () => {
          selectionManager.addToSelection("", imodelMock.object, [createRandomECInstanceKey()]);
          logicalSelectionChangesListener.reset();

          const spy = sinon.spy(selectionManager, "replaceSelection");

          ss.replace([persistentElementId, transientElementId]);
          await waitForPendingAsyncs(syncer);
          expect(spy).to.be.calledOnceWith("Tool", imodelMock.object, matchKeyset(new KeySet([scopedKey, transientElementKey])), 0);
          expect(logicalSelectionChangesListener).to.be.calledOnce;

          const selection = selectionManager.getSelection(imodelMock.object);
          expect(selection.size).to.eq(2);
          expect(selection.has(scopedKey)).to.be.true;
          expect(selection.has(transientElementKey)).to.be.true;
        });

        it("removes persistent elements from logical selection when tool selection changes", async () => {
          (ss as any)._add([persistentElementId, transientElementId], false);
          selectionManager.addToSelection("", imodelMock.object, [scopedKey, transientElementKey]);
          logicalSelectionChangesListener.reset();

          const spy = sinon.spy(selectionManager, "removeFromSelection");

          ss.remove(persistentElementId);
          await waitForPendingAsyncs(syncer);
          expect(spy).to.be.calledOnceWith("Tool", imodelMock.object, matchKeyset(new KeySet([scopedKey])), 0);
          expect(logicalSelectionChangesListener).to.be.calledOnce;

          const selection = selectionManager.getSelection(imodelMock.object);
          expect(selection.size).to.eq(1);
          expect(selection.has(transientElementKey)).to.be.true;
        });

        it("removes transient elements from logical selection when tool selection changes", async () => {
          (ss as any)._add([persistentElementId, transientElementId], false);
          selectionManager.addToSelection("", imodelMock.object, [scopedKey, transientElementKey]);
          logicalSelectionChangesListener.reset();

          const spy = sinon.spy(selectionManager, "removeFromSelection");

          ss.remove(transientElementId);
          await waitForPendingAsyncs(syncer);
          expect(spy).to.be.calledOnceWith("Tool", imodelMock.object, matchKeyset(new KeySet([transientElementKey])), 0);
          expect(logicalSelectionChangesListener).to.be.calledOnce;

          const selection = selectionManager.getSelection(imodelMock.object);
          expect(selection.size).to.eq(1);
          expect(selection.has(scopedKey)).to.be.true;
        });

        it("removes mixed elements from logical selection when tool selection changes", async () => {
          (ss as any)._add([persistentElementId, transientElementId], false);
          selectionManager.addToSelection("", imodelMock.object, [scopedKey, transientElementKey]);
          logicalSelectionChangesListener.reset();

          const spy = sinon.spy(selectionManager, "removeFromSelection");

          ss.remove([persistentElementId, transientElementId]);
          await waitForPendingAsyncs(syncer);
          expect(spy).to.be.calledOnceWith("Tool", imodelMock.object, matchKeyset(new KeySet([scopedKey, transientElementKey])), 0);
          expect(logicalSelectionChangesListener).to.be.calledOnce;

          const selection = selectionManager.getSelection(imodelMock.object);
          expect(selection.size).to.eq(0);
        });

        it("clears elements from logical selection when tool selection is cleared", async () => {
          (ss as any)._add(createRandomId(), false);
          selectionManager.addToSelection("", imodelMock.object, [scopedKey, transientElementKey]);
          logicalSelectionChangesListener.reset();

          const spy = sinon.spy(selectionManager, "clearSelection");

          ss.emptyAll();
          await waitForPendingAsyncs(syncer);
          expect(spy).to.be.calledOnceWith("Tool", imodelMock.object, 0);
          expect(logicalSelectionChangesListener).to.be.calledOnce;

          const selection = selectionManager.getSelection(imodelMock.object);
          expect(selection.size).to.eq(0);
        });

      });

    });

  });

  describe("suspendIModelToolSelectionSync", () => {

    let ss: SelectionSet;

    beforeEach(() => {
      ss = new SelectionSet(imodelMock.object);
      imodelMock.setup((x) => x.selectionSet).returns(() => ss);

      scopesMock.setup((x) => x.activeScope).returns(() => undefined);
      scopesMock.setup(async (x) => x.computeSelection(imodelMock.object, [], moq.It.isAnyString())).returns(async () => new KeySet());

      selectionManager.setSyncWithIModelToolSelection(imodelMock.object, true);
    });

    it("suspends selection synchronization", () => {
      const spy = sinon.spy(selectionManager, "clearSelection");
      using(selectionManager.suspendIModelToolSelectionSync(imodelMock.object), (_) => {
        ss.onChanged.raiseEvent({ type: SelectionSetEventType.Clear, set: ss, removed: [] });
      });
      expect(spy).to.not.be.called;

      ss.onChanged.raiseEvent({ type: SelectionSetEventType.Clear, set: ss, removed: [] });
      expect(spy).to.be.called;
    });

    it("does nothing if synchronization is not set up", () => {
      const spy = sinon.spy(selectionManager, "clearSelection");
      selectionManager.setSyncWithIModelToolSelection(imodelMock.object, false);
      using(selectionManager.suspendIModelToolSelectionSync(imodelMock.object), (_) => {
        ss.onChanged.raiseEvent({ type: SelectionSetEventType.Clear, set: ss, removed: [] });
      });
      expect(spy).to.not.be.called;
    });

    it("doesn't suspend synchronization for other imodels", () => {
      const imodelMock2 = moq.Mock.ofType<IModelConnection>();
      const ss2 = new SelectionSet(imodelMock2.object);
      imodelMock2.setup((x) => x.selectionSet).returns(() => ss2);
      selectionManager.setSyncWithIModelToolSelection(imodelMock2.object);

      const spy = sinon.spy(selectionManager, "clearSelection");
      using(selectionManager.suspendIModelToolSelectionSync(imodelMock2.object), (_) => {
        ss.onChanged.raiseEvent({ type: SelectionSetEventType.Clear, set: ss, removed: [] });
      });
      expect(spy).to.be.called;
    });

  });

  describe("getHiliteSet", () => {

    let factory: sinon.SinonStub<[{ imodel: IModelConnection }], HiliteSetProvider>;

    beforeEach(() => {
      const providerMock = moq.Mock.ofType<HiliteSetProvider>();
      providerMock.setup(async (x) => x.getHiliteSet(moq.It.isAny())).returns(async () => ({}));
      factory = sinon.stub(HiliteSetProvider, "create").returns(providerMock.object);
    });

    afterEach(() => {
      factory.restore();
    });

    it("creates provider once for imodel", async () => {
      const imodelMock1 = moq.Mock.ofType<IModelConnection>();
      const imodelMock2 = moq.Mock.ofType<IModelConnection>();

      // call for the first with an imodel should create a provider
      await selectionManager.getHiliteSet(imodelMock1.object);
      expect(factory).to.be.calledOnceWith({ imodel: imodelMock1.object });
      factory.resetHistory();

      // second call with same imodel shouldn't create a new provider
      await selectionManager.getHiliteSet(imodelMock1.object);
      expect(factory).to.not.be.called;

      // another imodel - new provider
      await selectionManager.getHiliteSet(imodelMock2.object);
      expect(factory).to.be.calledOnceWith({ imodel: imodelMock2.object });
      factory.resetHistory();

      // make sure we still have provider for the first imodel
      await selectionManager.getHiliteSet(imodelMock1.object);
      expect(factory).to.not.be.called;
    });

  });

});
