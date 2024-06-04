/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { assert, BeDuration, Id64, Id64Arg, Id64String, StopWatch, using } from "@itwin/core-bentley";
import { IModelApp, IModelConnection, SelectionSet, SelectionSetEventType } from "@itwin/core-frontend";
import { InstanceKey, KeySet, NodeKey, SelectionScope, StandardNodeTypes } from "@itwin/presentation-common";
import {
  createRandomId,
  createRandomSelectionScope,
  createRandomTransientId,
  createTestECInstanceKey,
  createTestNodeKey,
  ResolvablePromise,
  waitForPendingAsyncs,
} from "@itwin/presentation-common/lib/cjs/test";
import { createStorage, CustomSelectable, SelectionStorage } from "@itwin/unified-selection";
import { Presentation } from "../../presentation-frontend/Presentation";
import { PresentationManager } from "../../presentation-frontend/PresentationManager";
import { HiliteSetProvider } from "../../presentation-frontend/selection/HiliteSetProvider";
import { SelectionChangeEventArgs, SelectionChangesListener } from "../../presentation-frontend/selection/SelectionChangeEvent";
import { SelectionManager, ToolSelectionSyncHandler, TRANSIENT_ELEMENT_CLASSNAME } from "../../presentation-frontend/selection/SelectionManager";
import { SelectionScopesManager } from "../../presentation-frontend/selection/SelectionScopesManager";

const generateSelection = (): InstanceKey[] => {
  return [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" }), createTestECInstanceKey({ id: "0x3" })];
};

describe("SelectionManager", () => {
  let selectionManager: SelectionManager;
  let baseSelection: InstanceKey[];

  let ss: SelectionSet;
  const imodel = {
    key: "imodel-key",
  } as IModelConnection;

  const scopesManager = {
    getSelectionScopes: sinon.stub<Parameters<SelectionScopesManager["getSelectionScopes"]>, ReturnType<SelectionScopesManager["getSelectionScopes"]>>(),
    computeSelection: sinon.stub<Parameters<SelectionScopesManager["computeSelection"]>, ReturnType<SelectionScopesManager["computeSelection"]>>(),
  };

  const source: string = "test";

  function setActiveScope(scope: SelectionScope | string) {
    Object.assign(scopesManager, { activeScope: scope });
  }

  async function waitForSelection(size: number, targetImodel: IModelConnection, level?: number) {
    return waitFor(() => {
      const selection = selectionManager.getSelection(targetImodel, level);
      expect(selection.size).to.be.eq(size);
      return selection;
    });
  }

  beforeEach(() => {
    ss = new SelectionSet(imodel);
    Object.assign(imodel, { selectionSet: ss });

    scopesManager.computeSelection.reset();
    scopesManager.getSelectionScopes.reset();
    Object.assign(scopesManager, { activeScope: undefined });
    baseSelection = generateSelection();
  });

  describe("with own storage", () => {
    beforeEach(() => {
      selectionManager = new SelectionManager({ scopes: scopesManager as unknown as SelectionScopesManager });
      IModelConnection.onOpen.raiseEvent(imodel);
    });

    afterEach(() => {
      IModelConnection.onClose.raiseEvent(imodel);
    });

    it("clears imodel selection when it's closed", async () => {
      selectionManager.addToSelection(source, imodel, [createTestECInstanceKey()]);
      await waitForSelection(1, imodel);

      IModelConnection.onClose.raiseEvent(imodel);
      await waitForSelection(0, imodel);
    });

    describe("getSelectionLevels", () => {
      it("returns empty list when there're no selection levels", () => {
        expect(selectionManager.getSelectionLevels(imodel)).to.be.empty;
      });

      it("returns available selection levels", async () => {
        selectionManager.addToSelection("", imodel, [createTestECInstanceKey({ id: "0x1" })], 0);
        selectionManager.addToSelection("", imodel, [createTestECInstanceKey({ id: "0x2" })], 3);
        await waitFor(() => {
          expect(selectionManager.getSelectionLevels(imodel)).to.deep.eq([0, 3]);
        });
      });

      it("doesn't include empty selection levels", async () => {
        selectionManager.addToSelection("", imodel, [createTestECInstanceKey({ id: "0x1" })], 0);
        selectionManager.addToSelection("", imodel, [createTestECInstanceKey({ id: "0x2" })], 1);
        selectionManager.addToSelection("", imodel, [], 2);
        await waitFor(() => {
          expect(selectionManager.getSelectionLevels(imodel)).to.deep.eq([0, 1]);
        });
      });
    });

    describe("addToSelection", () => {
      it("adds selection on an empty selection", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);

        const selectedItemsSet = await waitForSelection(baseSelection.length, imodel);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      });

      it("adds selection on non empty selection", async () => {
        selectionManager.addToSelection(source, imodel, [baseSelection[0]]);
        selectionManager.addToSelection(source, imodel, [baseSelection[1], baseSelection[2]]);

        const selectedItemsSet = await waitForSelection(baseSelection.length, imodel);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      });

      it("adds selection on different imodels", async () => {
        const imodel2 = { key: "imodel-key-2" } as IModelConnection;
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel2, baseSelection);

        for (const currIModel of [imodel, imodel2]) {
          const selectedItemsSet = await waitForSelection(baseSelection.length, currIModel);

          for (const key of baseSelection) {
            expect(selectedItemsSet.has(key)).true;
          }
        }
      });

      it("adds selection on different levels", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel, baseSelection, 1);
        for (let i = 0; i <= 1; i++) {
          const selectedItemsSet = await waitForSelection(baseSelection.length, imodel, i);

          for (const key of baseSelection) {
            expect(selectedItemsSet.has(key)).true;
          }
        }
      });

      it("clears higher level selection when adding items to lower level selection", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel, [createTestECInstanceKey({ id: "0x1" })], 1);
        selectionManager.addToSelection(source, imodel, [createTestECInstanceKey({ id: "0x21" })]);

        await waitForSelection(0, imodel, 1);
      });

      it("doesn't clear higher level selection when adding same items to lower level selection", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel, [createTestECInstanceKey()], 1);
        selectionManager.addToSelection(source, imodel, baseSelection);

        await waitForSelection(1, imodel, 1);
      });
    });

    describe("replaceSelection", () => {
      it("replaces selection on an empty selection", async () => {
        selectionManager.replaceSelection(source, imodel, baseSelection);

        const selectedItemsSet = await waitForSelection(baseSelection.length, imodel);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      });

      it("replaces on an non empty selection", async () => {
        selectionManager.addToSelection(source, imodel, [baseSelection[0]]);
        selectionManager.replaceSelection(source, imodel, [baseSelection[1], baseSelection[2]]);

        const selectedItemsSet = await waitForSelection(baseSelection.length - 1, imodel);
        expect(selectedItemsSet.has(baseSelection[0])).false;
        expect(selectedItemsSet.has(baseSelection[1])).true;
        expect(selectedItemsSet.has(baseSelection[2])).true;
      });

      it("replaces on different imodels", async () => {
        const imodel2 = { key: "imodel-key-2" } as IModelConnection;
        selectionManager.replaceSelection(source, imodel, baseSelection);
        selectionManager.replaceSelection(source, imodel2, baseSelection);

        for (const currIModel of [imodel, imodel2]) {
          const selectedItemsSet = await waitForSelection(baseSelection.length, currIModel);

          for (const key of baseSelection) {
            expect(selectedItemsSet.has(key)).true;
          }
        }
      });

      it("replaces with different levels", async () => {
        selectionManager.replaceSelection(source, imodel, baseSelection);
        selectionManager.replaceSelection(source, imodel, baseSelection, 1);
        for (let i = 0; i <= 1; i++) {
          const selectedItemsSet = await waitForSelection(baseSelection.length, imodel, i);

          for (const key of baseSelection) {
            expect(selectedItemsSet.has(key)).true;
          }
        }
      });

      it("clears higher level selection when replacing lower level selection", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel, [createTestECInstanceKey({ id: "0x1" })], 1);
        selectionManager.replaceSelection(source, imodel, [createTestECInstanceKey({ id: "0x2" })]);

        await waitForSelection(0, imodel, 1);
      });

      it("doesn't clear higher level selection when replacing lower level selection with same items", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel, [createTestECInstanceKey()], 1);
        selectionManager.replaceSelection(source, imodel, baseSelection);

        await waitForSelection(1, imodel, 1);
      });
    });

    describe("clearSelection", () => {
      it("clears empty selection", async () => {
        selectionManager.clearSelection(source, imodel);
        await waitForSelection(0, imodel);
      });

      it("clears non empty selection", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.clearSelection(source, imodel);
        await waitForSelection(0, imodel);
      });

      it("clears on different imodels", async () => {
        const imodel2 = { key: "imodel-key-2" } as IModelConnection;
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel2, baseSelection);

        selectionManager.clearSelection(source, imodel2);

        await waitForSelection(0, imodel2);
        const selectedItemsSet = await waitForSelection(baseSelection.length, imodel);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      });

      it("clears with different levels", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel, baseSelection, 1);

        selectionManager.clearSelection(source, imodel, 1);
        await waitForSelection(0, imodel, 1);

        const selectedItemsSet = await waitForSelection(baseSelection.length, imodel);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      });

      it("clears higher level selection when clearing items in lower level selection", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel, [createTestECInstanceKey()], 1);
        selectionManager.clearSelection(source, imodel);
        await waitForSelection(0, imodel, 1);
      });

      it("doesn't clear higher level selection when clearing empty lower level selection", async () => {
        selectionManager.addToSelection(source, imodel, [createTestECInstanceKey()], 1);
        selectionManager.clearSelection(source, imodel);
        await waitForSelection(1, imodel, 1);
      });
    });

    describe("removeFromSelection", () => {
      it("removes part of the selection", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.removeFromSelection(source, imodel, [baseSelection[1], baseSelection[2]]);

        const selectedItemsSet = await waitForSelection(baseSelection.length - 2, imodel);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 2);
        expect(selectedItemsSet.has(baseSelection[0])).true;
        expect(selectedItemsSet.has(baseSelection[1])).false;
        expect(selectedItemsSet.has(baseSelection[2])).false;
      });

      it("removes whole selection", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.removeFromSelection(source, imodel, baseSelection);

        await waitForSelection(0, imodel);
      });

      it("removes on different imodels", async () => {
        const imodel2 = { key: "imodel-key-2" } as IModelConnection;
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel2, baseSelection);

        selectionManager.removeFromSelection(source, imodel, [baseSelection[0]]);
        selectionManager.removeFromSelection(source, imodel2, [baseSelection[1], baseSelection[2]]);

        let selectedItemsSet = await waitForSelection(baseSelection.length - 1, imodel);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 1);
        expect(selectedItemsSet.has(baseSelection[0])).false;
        expect(selectedItemsSet.has(baseSelection[1])).true;
        expect(selectedItemsSet.has(baseSelection[2])).true;

        selectedItemsSet = await waitForSelection(baseSelection.length - 2, imodel2);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 2);
        expect(selectedItemsSet.has(baseSelection[0])).true;
        expect(selectedItemsSet.has(baseSelection[1])).false;
        expect(selectedItemsSet.has(baseSelection[2])).false;
      });

      it("removes with different levels", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel, baseSelection, 1);
        selectionManager.removeFromSelection(source, imodel, [baseSelection[0]], 1);

        let selectedItemsSet = await waitForSelection(baseSelection.length, imodel);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length);
        expect(selectedItemsSet.has(baseSelection[0])).true;
        expect(selectedItemsSet.has(baseSelection[1])).true;
        expect(selectedItemsSet.has(baseSelection[2])).true;

        selectedItemsSet = await waitForSelection(baseSelection.length - 1, imodel, 1);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 1);
        expect(selectedItemsSet.has(baseSelection[0])).false;
        expect(selectedItemsSet.has(baseSelection[1])).true;
        expect(selectedItemsSet.has(baseSelection[2])).true;
      });

      it("clears higher level selection when removing items from lower level selection", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel, [createTestECInstanceKey()], 1);
        selectionManager.removeFromSelection(source, imodel, baseSelection);

        await waitForSelection(0, imodel, 1);
      });

      it("doesn't clear higher level selection when removing non-existing items from lower level selection", async () => {
        selectionManager.addToSelection(source, imodel, baseSelection);
        selectionManager.addToSelection(source, imodel, [createTestECInstanceKey({ className: "TestSchema:AdditionalClass", id: "0x1" })], 1);
        selectionManager.removeFromSelection(source, imodel, [createTestECInstanceKey({ className: "TestSchema:AdditionalClass", id: "0x2" })]);

        await waitForSelection(1, imodel, 1);
      });
    });

    describe("addToSelectionWithSelectionScope", () => {
      it("adds scoped selection", async () => {
        const scope = createRandomSelectionScope();
        const ids = [createRandomId()];
        scopesManager.getSelectionScopes.resolves([scope]);
        scopesManager.computeSelection.resolves(new KeySet(baseSelection));

        await selectionManager.addToSelectionWithScope(source, imodel, ids, scope);
        const selectedItemsSet = await waitForSelection(baseSelection.length, imodel);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
        expect(scopesManager.computeSelection).to.be.called;
      });
    });

    describe("replaceSelectionWithSelectionScope", () => {
      it("replaces empty selection with scoped selection", async () => {
        const scope = createRandomSelectionScope();
        const ids = [createRandomId()];
        scopesManager.getSelectionScopes.resolves([scope]);
        scopesManager.computeSelection.resolves(new KeySet(baseSelection));

        await selectionManager.replaceSelectionWithScope(source, imodel, ids, scope);
        const selectedItemsSet = await waitForSelection(baseSelection.length, imodel);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
        expect(scopesManager.computeSelection).to.be.called;
      });
    });

    describe("removeFromSelectionWithSelectionScope", () => {
      it("removes scoped selection", async () => {
        const scope = createRandomSelectionScope();
        const ids = [createRandomId()];
        scopesManager.getSelectionScopes.resolves([scope]);
        scopesManager.computeSelection.resolves(new KeySet(baseSelection));

        const additionalKey = createTestECInstanceKey({ className: "TestSchema:AdditionalClass", id: "0x1" });
        selectionManager.addToSelection(source, imodel, [...baseSelection, additionalKey]);
        await selectionManager.removeFromSelectionWithScope(source, imodel, ids, scope);
        const selectedItemsSet = await waitForSelection(1, imodel);
        expect(selectedItemsSet.has(additionalKey)).true;
        expect(scopesManager.computeSelection).to.be.called;
      });
    });

    describe("handleEvent", () => {
      it("fires `selectionChange` event after `addToSelection`, `replaceSelection`, `clearSelection`, `removeFromSelection`", async () => {
        const raiseEventSpy = sinon.spy(selectionManager.selectionChange, "raiseEvent");
        selectionManager.addToSelection(source, imodel, baseSelection);
        await waitFor(() => expect(raiseEventSpy, "Expected selectionChange.raiseEvent to be called").to.have.callCount(1));
        selectionManager.removeFromSelection(source, imodel, baseSelection);
        await waitFor(() => expect(raiseEventSpy, "Expected selectionChange.raiseEvent to be called").to.have.callCount(2));
        selectionManager.replaceSelection(source, imodel, baseSelection);
        await waitFor(() => expect(raiseEventSpy, "Expected selectionChange.raiseEvent to be called").to.have.callCount(3));
        selectionManager.clearSelection(source, imodel);
        await waitFor(() => expect(raiseEventSpy, "Expected selectionChange.raiseEvent to be called").to.have.callCount(4));
      });

      it("doesn't fire `selectionChange` event after addToSelection, replaceSelection, clearSelection, removeFromSelection if nothing changes", () => {
        const raiseEventSpy = sinon.spy(selectionManager.selectionChange, "raiseEvent");
        selectionManager.addToSelection(source, imodel, []);
        selectionManager.clearSelection(source, imodel);
        selectionManager.removeFromSelection(source, imodel, baseSelection);
        selectionManager.replaceSelection(source, imodel, []);
        expect(raiseEventSpy, "Expected selectionChange.raiseEvent to not be called").to.not.have.been.called;
      });
    });

    describe("setSyncWithIModelToolSelection", () => {
      beforeEach(() => {
        // hacks to avoid instantiating the whole core..
        (IModelApp as any)._viewManager = {
          onSelectionSetChanged: sinon.stub(),
        };
      });

      afterEach(() => {
        (IModelApp as any)._viewManager = undefined;
      });

      it("registers tool selection change listener once per imodel", () => {
        const imodel2 = { key: "imodel-key-2" } as IModelConnection;
        const ss2 = new SelectionSet(imodel2);
        Object.assign(imodel2, { selectionSet: ss2 });

        selectionManager.setSyncWithIModelToolSelection(imodel);
        expect(ss.onChanged.numberOfListeners).to.eq(1); // verify listener added

        selectionManager.setSyncWithIModelToolSelection(imodel);
        expect(ss.onChanged.numberOfListeners).to.eq(1); // verify listener _not_ added for the same imodel

        selectionManager.setSyncWithIModelToolSelection(imodel2);
        expect(ss2.onChanged.numberOfListeners).to.eq(1); // verify listener added for a different imodel

        selectionManager.setSyncWithIModelToolSelection(imodel2, false);
        expect(ss2.onChanged.numberOfListeners).to.eq(0); // verify listener removed

        selectionManager.setSyncWithIModelToolSelection(imodel, false);
        expect(ss.onChanged.numberOfListeners).to.eq(1); // verify listener _not_ removed as the imodel was registered to sync twice

        selectionManager.setSyncWithIModelToolSelection(imodel, false);
        expect(ss.onChanged.numberOfListeners).to.eq(0); // verify listener removed

        selectionManager.setSyncWithIModelToolSelection(imodel, false);
        expect(ss.onChanged.numberOfListeners).to.eq(0); // verify nothing happens as the listeners was removed previously
      });

      describe("syncing with imodel tool selection", () => {
        let syncer: ToolSelectionSyncHandler;

        const matchKeyset = (keys: KeySet) =>
          sinon.match((value: KeySet) => {
            return value instanceof KeySet && value.size === keys.size && value.hasAll(keys);
          });

        const equalId64Arg = (lhs: Id64Arg, rhs: Id64Arg) => {
          if (Id64.sizeOf(lhs) !== Id64.sizeOf(rhs)) {
            return false;
          }

          for (const lhsId of Id64.iterable(lhs)) {
            if (!Id64.has(rhs, lhsId)) {
              return false;
            }
          }

          return true;
        };

        beforeEach(() => {
          syncer = new ToolSelectionSyncHandler(imodel, selectionManager);
        });

        describe("choosing scope", () => {
          it('uses "element" scope when `activeScope = undefined`', async () => {
            scopesManager.computeSelection.resolves(new KeySet([createTestECInstanceKey()]));
            ss.add(createRandomId());
            await waitForPendingAsyncs(syncer);
            await waitForSelection(1, imodel);
            expect(scopesManager.computeSelection).to.be.calledWith(
              sinon.match(() => true),
              sinon.match(() => true),
              sinon.match((options) => options.id === "element"),
            );
          });

          it('uses "element" scope when `activeScope = "element"`', async () => {
            setActiveScope("element");
            scopesManager.computeSelection.resolves(new KeySet([createTestECInstanceKey()]));
            ss.add(createRandomId());
            await waitForPendingAsyncs(syncer);
            await waitForSelection(1, imodel);
            expect(scopesManager.computeSelection).to.be.calledWith(
              sinon.match(() => true),
              sinon.match(() => true),
              sinon.match((options) => options.id === "element"),
            );
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
            scopedKey = createTestECInstanceKey();

            logicalSelectionChangesListener.reset();
            selectionManager.selectionChange.addListener(logicalSelectionChangesListener);

            setActiveScope(scope);
            scopesManager.computeSelection.callsFake(async (_, ids) => {
              if (equalId64Arg(ids, [persistentElementId])) {
                return new KeySet([scopedKey]);
              }
              return new KeySet();
            });
          });

          it("ignores events with different imodel", async () => {
            const spy = sinon.spy(selectionManager, "addToSelectionWithScope");
            const imodel2 = { key: "imodel-key-2" } as IModelConnection;
            const ss2 = new SelectionSet(imodel2);
            Object.assign(imodel2, { selectionSet: ss2 });
            ss.onChanged.raiseEvent({ type: SelectionSetEventType.Add, set: ss2, added: createRandomId() });
            await waitForPendingAsyncs(syncer);
            await waitForSelection(0, imodel);
            expect(spy).to.not.be.called;
          });

          it("adds persistent elements to logical selection when tool selection changes", async () => {
            const spy = sinon.spy(selectionManager, "addToSelection");

            ss.add(persistentElementId);
            await waitForPendingAsyncs(syncer);

            const selection = await waitForSelection(1, imodel);
            expect(selection.has(scopedKey)).to.be.true;

            expect(spy).to.be.calledOnceWith("Tool", imodel, matchKeyset(new KeySet([scopedKey])), 0);
            expect(logicalSelectionChangesListener).to.be.calledOnce;
          });

          it("adds transient elements to logical selection when tool selection changes", async () => {
            const spy = sinon.spy(selectionManager, "addToSelection");

            ss.add(transientElementId);
            await waitForPendingAsyncs(syncer);
            const selection = await waitForSelection(1, imodel);
            expect(selection.has(transientElementKey)).to.be.true;

            expect(spy).to.be.calledOnceWith("Tool", imodel, matchKeyset(new KeySet([transientElementKey])), 0);
            expect(logicalSelectionChangesListener).to.be.calledOnce;
          });

          it("adds mixed elements to logical selection when tool selection changes", async () => {
            const spy = sinon.spy(selectionManager, "addToSelection");

            ss.add([transientElementId, persistentElementId]);
            await waitForPendingAsyncs(syncer);

            const selection = await waitForSelection(2, imodel);
            expect(selection.has(scopedKey)).to.be.true;
            expect(selection.has(transientElementKey)).to.be.true;

            expect(spy).to.be.calledOnceWith("Tool", imodel, matchKeyset(new KeySet([scopedKey, transientElementKey])), 0);
            expect(logicalSelectionChangesListener).to.be.calledOnce;
          });

          it("replaces persistent elements in logical selection when tool selection changes", async () => {
            selectionManager.addToSelection("", imodel, [createTestECInstanceKey({ className: "TestSchema:AdditionalClass" })]);
            await waitForSelection(1, imodel);
            logicalSelectionChangesListener.reset();

            const spy = sinon.spy(selectionManager, "replaceSelection");

            ss.replace(persistentElementId);
            await waitForPendingAsyncs(syncer);

            const selection = await waitForSelection(1, imodel);
            expect(selection.has(scopedKey)).to.be.true;

            expect(spy).to.be.calledOnceWith("Tool", imodel, matchKeyset(new KeySet([scopedKey])), 0);
            expect(logicalSelectionChangesListener).to.be.calledOnce;
          });

          it("replaces transient elements in logical selection when tool selection changes", async () => {
            selectionManager.addToSelection("", imodel, [createTestECInstanceKey()]);
            await waitForSelection(1, imodel);
            logicalSelectionChangesListener.reset();

            const spy = sinon.spy(selectionManager, "replaceSelection");

            ss.replace(transientElementId);
            await waitForPendingAsyncs(syncer);

            const selection = await waitForSelection(1, imodel);
            expect(selection.has(transientElementKey)).to.be.true;

            expect(spy).to.be.calledOnceWith("Tool", imodel, matchKeyset(new KeySet([transientElementKey])), 0);
            expect(logicalSelectionChangesListener).to.be.calledOnce;
          });

          it("replaces mixed elements in logical selection when tool selection changes", async () => {
            selectionManager.addToSelection("", imodel, [createTestECInstanceKey()]);
            await waitForSelection(1, imodel);
            logicalSelectionChangesListener.reset();

            const spy = sinon.spy(selectionManager, "replaceSelection");

            ss.replace([persistentElementId, transientElementId]);
            await waitForPendingAsyncs(syncer);

            const selection = await waitForSelection(2, imodel);
            expect(selection.has(scopedKey)).to.be.true;
            expect(selection.has(transientElementKey)).to.be.true;

            expect(spy).to.be.calledOnceWith("Tool", imodel, matchKeyset(new KeySet([scopedKey, transientElementKey])), 0);
            expect(logicalSelectionChangesListener).to.be.calledOnce;
          });

          it("removes persistent elements from logical selection when tool selection changes", async () => {
            (ss as any)._add([persistentElementId, transientElementId], false);
            selectionManager.addToSelection("", imodel, [scopedKey, transientElementKey]);
            await waitForSelection(2, imodel);
            logicalSelectionChangesListener.reset();

            const spy = sinon.spy(selectionManager, "removeFromSelection");

            ss.remove(persistentElementId);
            await waitForPendingAsyncs(syncer);

            const selection = await waitForSelection(1, imodel);
            expect(selection.has(transientElementKey)).to.be.true;

            expect(spy).to.be.calledOnceWith("Tool", imodel, matchKeyset(new KeySet([scopedKey])), 0);
            expect(logicalSelectionChangesListener).to.be.calledOnce;
          });

          it("removes transient elements from logical selection when tool selection changes", async () => {
            (ss as any)._add([persistentElementId, transientElementId], false);
            selectionManager.addToSelection("", imodel, [scopedKey, transientElementKey]);
            await waitForSelection(2, imodel);
            logicalSelectionChangesListener.reset();

            const spy = sinon.spy(selectionManager, "removeFromSelection");

            ss.remove(transientElementId);
            await waitForPendingAsyncs(syncer);

            const selection = await waitForSelection(1, imodel);
            expect(selection.has(scopedKey)).to.be.true;

            expect(spy).to.be.calledOnceWith("Tool", imodel, matchKeyset(new KeySet([transientElementKey])), 0);
            expect(logicalSelectionChangesListener).to.be.calledOnce;
          });

          it("removes mixed elements from logical selection when tool selection changes", async () => {
            (ss as any)._add([persistentElementId, transientElementId], false);
            selectionManager.addToSelection("", imodel, [scopedKey, transientElementKey]);
            await waitForSelection(2, imodel);
            logicalSelectionChangesListener.reset();

            const spy = sinon.spy(selectionManager, "removeFromSelection");

            ss.remove([persistentElementId, transientElementId]);
            await waitForPendingAsyncs(syncer);

            await waitForSelection(0, imodel);

            expect(spy).to.be.calledOnceWith("Tool", imodel, matchKeyset(new KeySet([scopedKey, transientElementKey])), 0);
            expect(logicalSelectionChangesListener).to.be.calledOnce;
          });

          it("clears elements from logical selection when tool selection is cleared", async () => {
            (ss as any)._add(createRandomId(), false);
            selectionManager.addToSelection("", imodel, [scopedKey, transientElementKey]);
            await waitForSelection(2, imodel);
            logicalSelectionChangesListener.reset();

            const spy = sinon.spy(selectionManager, "clearSelection");

            ss.emptyAll();
            await waitForPendingAsyncs(syncer);

            await waitForSelection(0, imodel);

            expect(spy).to.be.calledOnceWith("Tool", imodel, 0);
            expect(logicalSelectionChangesListener).to.be.calledOnce;
          });
        });
      });
    });

    describe("suspendIModelToolSelectionSync", () => {
      beforeEach(() => {
        scopesManager.computeSelection.resolves(new KeySet());

        selectionManager.setSyncWithIModelToolSelection(imodel, true);
      });

      it("suspends selection synchronization", () => {
        const spy = sinon.spy(selectionManager, "clearSelection");
        using(selectionManager.suspendIModelToolSelectionSync(imodel), (_) => {
          ss.onChanged.raiseEvent({ type: SelectionSetEventType.Clear, set: ss, removed: [] });
        });
        expect(spy).to.not.be.called;

        ss.onChanged.raiseEvent({ type: SelectionSetEventType.Clear, set: ss, removed: [] });
        expect(spy).to.be.called;
      });

      it("does nothing if synchronization is not set up", () => {
        const spy = sinon.spy(selectionManager, "clearSelection");
        selectionManager.setSyncWithIModelToolSelection(imodel, false);
        using(selectionManager.suspendIModelToolSelectionSync(imodel), (_) => {
          ss.onChanged.raiseEvent({ type: SelectionSetEventType.Clear, set: ss, removed: [] });
        });
        expect(spy).to.not.be.called;
      });

      it("doesn't suspend synchronization for other imodels", () => {
        const imodel2 = { key: "imodel-key-2" } as IModelConnection;
        const ss2 = new SelectionSet(imodel2);
        Object.assign(imodel2, { selectionSet: ss2 });
        selectionManager.setSyncWithIModelToolSelection(imodel2);

        const spy = sinon.spy(selectionManager, "clearSelection");
        using(selectionManager.suspendIModelToolSelectionSync(imodel2), (_) => {
          ss.onChanged.raiseEvent({ type: SelectionSetEventType.Clear, set: ss, removed: [] });
        });
        expect(spy).to.be.called;
      });
    });

    describe("getHiliteSet", () => {
      let factory: sinon.SinonStub<[{ imodel: IModelConnection }], HiliteSetProvider>;

      beforeEach(() => {
        const provider = {
          getHiliteSet: async () => ({}),
        };
        factory = sinon.stub(HiliteSetProvider, "create").returns(provider as unknown as HiliteSetProvider);
      });

      afterEach(() => {
        factory.restore();
      });

      it("creates provider once for imodel", async () => {
        const imodel2 = { key: "imodel-key-2" } as IModelConnection;

        // call for the first with an imodel should create a provider
        await selectionManager.getHiliteSet(imodel);
        expect(factory).to.be.calledOnceWith({ imodel });
        factory.resetHistory();

        // second call with same imodel shouldn't create a new provider
        await selectionManager.getHiliteSet(imodel);
        expect(factory).to.not.be.called;

        // another imodel - new provider
        await selectionManager.getHiliteSet(imodel2);
        expect(factory).to.be.calledOnceWith({ imodel: imodel2 });
        factory.resetHistory();

        // make sure we still have provider for the first imodel
        await selectionManager.getHiliteSet(imodel);
        expect(factory).to.not.be.called;
      });
    });

    describe("getHiliteSetIterator", () => {
      let factory: sinon.SinonStub<[{ imodel: IModelConnection }], HiliteSetProvider>;

      beforeEach(() => {
        const provider = {
          async *getHiliteSetIterator() {
            return;
          },
        };
        factory = sinon.stub(HiliteSetProvider, "create").returns(provider as unknown as HiliteSetProvider);
      });

      afterEach(() => {
        factory.restore();
      });

      it("creates provider once for imodel", () => {
        const imodel2 = { key: "imodel-key-2" } as IModelConnection;

        // call for the first with an imodel should create a provider
        selectionManager.getHiliteSetIterator(imodel);
        expect(factory).to.be.calledOnceWith({ imodel });
        factory.resetHistory();

        // second call with same imodel shouldn't create a new provider
        selectionManager.getHiliteSetIterator(imodel);
        expect(factory).to.not.be.called;

        // another imodel - new provider
        selectionManager.getHiliteSetIterator(imodel2);
        expect(factory).to.be.calledOnceWith({ imodel: imodel2 });
        factory.resetHistory();

        // make sure we still have provider for the first imodel
        selectionManager.getHiliteSetIterator(imodel);
        expect(factory).to.not.be.called;
      });
    });
  });

  describe("with custom storage", () => {
    let storage: SelectionStorage;
    const presentationManager = {
      getContentInstanceKeys: sinon.stub<
        Parameters<PresentationManager["getContentInstanceKeys"]>,
        ReturnType<PresentationManager["getContentInstanceKeys"]>
      >(),
    };

    const changeListener = sinon.stub<Parameters<SelectionChangesListener>, ReturnType<SelectionChangesListener>>();

    beforeEach(() => {
      storage = createStorage();
      presentationManager.getContentInstanceKeys.reset();
      sinon.stub(Presentation, "presentation").get(() => presentationManager);

      selectionManager = new SelectionManager({ selectionStorage: storage, scopes: scopesManager as unknown as SelectionScopesManager });
      IModelConnection.onOpen.raiseEvent(imodel);

      changeListener.reset();
      selectionManager.selectionChange.addListener(changeListener);
    });

    afterEach(() => {
      IModelConnection.onClose.raiseEvent(imodel);
    });

    function createNodeKey({ id, ...props }: Partial<NodeKey> & { id: string }) {
      return createTestNodeKey({ ...props, pathFromRoot: [id] });
    }

    async function collectInstanceKeys(seletableId: string) {
      const selectables = storage.getSelection({ iModelKey: imodel.key });
      const selectable = selectables.custom.get(seletableId);
      assert(selectable !== undefined);
      const loadedKeys = [];
      for await (const key of selectable.loadInstanceKeys()) {
        loadedKeys.push(key);
      }
      return loadedKeys;
    }

    describe("creates selectable from", () => {
      it("instances node key", async () => {
        const instanceKeys = [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" })];
        const instancesNodeKey = createNodeKey({ id: "test-node", instanceKeys, type: StandardNodeTypes.ECInstancesNode });
        selectionManager.addToSelection(source, imodel, [instancesNodeKey]);

        const selectionSet = await waitForSelection(1, imodel);
        expect(selectionSet.has(instancesNodeKey));

        const loadedKeys = await collectInstanceKeys("test-node");
        expect(loadedKeys[0].id).to.be.eq("0x1");
        expect(loadedKeys[1].id).to.be.eq("0x2");
      });

      it("grouping node key", async () => {
        const instanceKeys = [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" })];
        const groupingNodeKey = createNodeKey({
          id: "test-node",
          type: StandardNodeTypes.ECClassGroupingNode,
          className: "Schema:Class",
          groupedInstancesCount: 2,
          instanceKeysSelectQuery: {
            query: "key-query",
          },
        });
        selectionManager.addToSelection(source, imodel, [groupingNodeKey]);
        presentationManager.getContentInstanceKeys.resolves({
          total: 2,
          items: () => createAsyncGenerator(instanceKeys),
        });

        const selectionSet = await waitForSelection(1, imodel);
        expect(selectionSet.has(groupingNodeKey));

        const loadedKeys = await collectInstanceKeys("test-node");
        expect(loadedKeys[0].id).to.be.eq("0x1");
        expect(loadedKeys[1].id).to.be.eq("0x2");
      });
    });

    describe("creates selection set from", () => {
      it("instance key selectable", async () => {
        const instanceKey = createTestECInstanceKey({ id: "0x1" });
        storage.addToSelection({ iModelKey: imodel.key, source, selectables: [instanceKey], level: 0 });
        const selectionSet = await waitForSelection(1, imodel);
        expect(selectionSet.has(instanceKey)).to.be.true;
      });

      it("custom selectable", async () => {
        const instanceKeys = [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" })];
        storage.addToSelection({
          iModelKey: imodel.key,
          source,
          selectables: [{ identifier: "custom", loadInstanceKeys: () => createAsyncGenerator(instanceKeys), data: {} }],
          level: 0,
        });

        const selectionSet = await waitForSelection(2, imodel);
        expect(selectionSet.has(instanceKeys[0])).to.be.true;
        expect(selectionSet.has(instanceKeys[1])).to.be.true;
      });

      it("custom selectable once", async () => {
        const instanceKeys = [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" })];
        const loadInstanceKeys = sinon.fake<Parameters<CustomSelectable["loadInstanceKeys"]>, ReturnType<CustomSelectable["loadInstanceKeys"]>>(() =>
          createAsyncGenerator(instanceKeys),
        );
        storage.addToSelection({
          iModelKey: imodel.key,
          source,
          selectables: [{ identifier: "custom", loadInstanceKeys, data: {} }],
          level: 0,
        });

        const selectionSet = await waitForSelection(2, imodel);
        expect(selectionSet.has(instanceKeys[0])).to.be.true;
        expect(selectionSet.has(instanceKeys[1])).to.be.true;

        expect(changeListener).to.be.calledWith(
          sinon.match((args: SelectionChangeEventArgs) => {
            return args.keys.size === 2 && args.keys.hasAll([instanceKeys[0], instanceKeys[1]]);
          }),
        );
        expect(loadInstanceKeys).to.be.calledOnce;
      });
    });

    describe("handles multiple changes", () => {
      it("returns latest selection set", async () => {
        const firstDelay = new ResolvablePromise<void>();
        const secondDelay = new ResolvablePromise<void>();

        const instanceKeys = [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" }), createTestECInstanceKey({ id: "0x3" })];

        storage.replaceSelection({
          iModelKey: imodel.key,
          source,
          selectables: [{ identifier: "custom1", loadInstanceKeys: () => createAsyncGenerator(instanceKeys.slice(0, 1), firstDelay), data: {} }],
          level: 0,
        });
        storage.replaceSelection({
          iModelKey: imodel.key,
          source,
          selectables: [{ identifier: "custom2", loadInstanceKeys: () => createAsyncGenerator(instanceKeys.slice(1), secondDelay), data: {} }],
          level: 0,
        });

        await waitForSelection(0, imodel);

        await secondDelay.resolve();
        await waitForSelection(2, imodel);

        await firstDelay.resolve();
        const selectionSet = await waitForSelection(2, imodel);
        expect(selectionSet.has(instanceKeys[0])).to.be.false;
        expect(selectionSet.has(instanceKeys[1])).to.be.true;
        expect(selectionSet.has(instanceKeys[2])).to.be.true;
      });

      it("returns intermediate selection set", async () => {
        const firstDelay = new ResolvablePromise<void>();
        const secondDelay = new ResolvablePromise<void>();

        const instanceKeys = [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" }), createTestECInstanceKey({ id: "0x3" })];

        storage.replaceSelection({
          iModelKey: imodel.key,
          source,
          selectables: [{ identifier: "custom1", loadInstanceKeys: () => createAsyncGenerator(instanceKeys.slice(0, 1), firstDelay), data: {} }],
          level: 0,
        });
        storage.replaceSelection({
          iModelKey: imodel.key,
          source,
          selectables: [{ identifier: "custom2", loadInstanceKeys: () => createAsyncGenerator(instanceKeys.slice(1), secondDelay), data: {} }],
          level: 0,
        });

        await waitForSelection(0, imodel);

        await firstDelay.resolve();
        const intermediateSelectionSet = await waitForSelection(1, imodel);
        expect(intermediateSelectionSet.has(instanceKeys[0])).to.be.true;

        await secondDelay.resolve();
        const selectionSet = await waitForSelection(2, imodel);
        expect(selectionSet.has(instanceKeys[0])).to.be.false;
        expect(selectionSet.has(instanceKeys[1])).to.be.true;
        expect(selectionSet.has(instanceKeys[2])).to.be.true;
      });

      it("returns selection sets for different levels", async () => {
        const firstDelay = new ResolvablePromise<void>();
        const secondDelay = new ResolvablePromise<void>();

        const instanceKeys = [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" }), createTestECInstanceKey({ id: "0x3" })];

        storage.replaceSelection({
          iModelKey: imodel.key,
          source,
          selectables: [{ identifier: "custom1", loadInstanceKeys: () => createAsyncGenerator(instanceKeys.slice(0, 1), firstDelay), data: {} }],
          level: 0,
        });
        storage.replaceSelection({
          iModelKey: imodel.key,
          source,
          selectables: [{ identifier: "custom2", loadInstanceKeys: () => createAsyncGenerator(instanceKeys.slice(1), secondDelay), data: {} }],
          level: 1,
        });

        await waitForSelection(0, imodel);

        await secondDelay.resolve();
        const selectionSet1 = await waitForSelection(2, imodel, 1);
        expect(selectionSet1.has(instanceKeys[1])).to.be.true;
        expect(selectionSet1.has(instanceKeys[2])).to.be.true;

        await firstDelay.resolve();
        const selectionSet0 = await waitForSelection(1, imodel);
        expect(selectionSet0.has(instanceKeys[0])).to.be.true;

        // make sure level 1 selection is not cleared
        const selectionSet = await waitForSelection(2, imodel, 1);
        expect(selectionSet.has(instanceKeys[1])).to.be.true;
        expect(selectionSet.has(instanceKeys[2])).to.be.true;
      });

      it("returns empty selection sets for lower levels", async () => {
        const firstDelay = new ResolvablePromise<void>();
        const secondDelay = new ResolvablePromise<void>();

        const instanceKeys = [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" }), createTestECInstanceKey({ id: "0x3" })];

        storage.replaceSelection({
          iModelKey: imodel.key,
          source,
          selectables: [{ identifier: "custom1", loadInstanceKeys: () => createAsyncGenerator(instanceKeys.slice(0, 1), firstDelay), data: {} }],
          level: 1,
        });

        storage.replaceSelection({
          iModelKey: imodel.key,
          source,
          selectables: [{ identifier: "custom2", loadInstanceKeys: () => createAsyncGenerator(instanceKeys.slice(1), secondDelay), data: {} }],
          level: 0,
        });

        await waitForSelection(0, imodel, 0);
        await waitForSelection(0, imodel, 1);

        await secondDelay.resolve();
        const selectionSet0 = await waitForSelection(2, imodel);
        expect(selectionSet0.has(instanceKeys[1])).to.be.true;
        expect(selectionSet0.has(instanceKeys[2])).to.be.true;

        await firstDelay.resolve();
        await waitForSelection(0, imodel, 1);
      });
    });

    describe("selection change event", () => {
      const instanceKeys = [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" })];
      const selectable1instanceKeys = [createTestECInstanceKey({ id: "0x3" }), createTestECInstanceKey({ id: "0x4" })];
      const selectable2instanceKeys = [createTestECInstanceKey({ id: "0x5" }), createTestECInstanceKey({ id: "0x6" })];

      it("converts add event selectables", async () => {
        const selectable1: CustomSelectable = { identifier: "custom-1", loadInstanceKeys: () => createAsyncGenerator(selectable1instanceKeys), data: {} };
        const selectable2: CustomSelectable = { identifier: "custom-2", loadInstanceKeys: () => createAsyncGenerator(selectable2instanceKeys), data: {} };

        storage.addToSelection({
          iModelKey: imodel.key,
          source,
          selectables: [instanceKeys[0], selectable1],
        });

        await waitFor(() => {
          expect(changeListener).to.be.calledWith(
            sinon.match((args: SelectionChangeEventArgs) => {
              return args.keys.size === 3 && args.keys.hasAll([instanceKeys[0], ...selectable1instanceKeys]);
            }),
          );
        });

        // verify current selection size
        await waitForSelection(3, imodel);
        changeListener.resetHistory();

        storage.addToSelection({
          iModelKey: imodel.key,
          source,
          selectables: [instanceKeys[1], selectable2],
        });

        await waitFor(() => {
          expect(changeListener).to.be.calledWith(
            sinon.match((args: SelectionChangeEventArgs) => {
              return args.keys.size === 3 && args.keys.hasAll([instanceKeys[1], ...selectable2instanceKeys]);
            }),
          );
        });

        // verify current selection size
        await waitForSelection(6, imodel);
      });

      it("converts replace event selectables", async () => {
        const selectable1: CustomSelectable = { identifier: "custom-1", loadInstanceKeys: () => createAsyncGenerator(selectable1instanceKeys), data: {} };
        const selectable2: CustomSelectable = { identifier: "custom-2", loadInstanceKeys: () => createAsyncGenerator(selectable2instanceKeys), data: {} };

        storage.replaceSelection({
          iModelKey: imodel.key,
          source,
          selectables: [instanceKeys[0], selectable1],
        });

        await waitFor(() => {
          expect(changeListener).to.be.calledWith(
            sinon.match((args: SelectionChangeEventArgs) => {
              return args.keys.size === 3 && args.keys.hasAll([instanceKeys[0], ...selectable1instanceKeys]);
            }),
          );
        });

        // verify current selection size
        await waitForSelection(3, imodel);
        changeListener.resetHistory();

        storage.replaceSelection({
          iModelKey: imodel.key,
          source,
          selectables: [instanceKeys[1], selectable2],
        });

        await waitFor(() => {
          expect(changeListener).to.be.calledWith(
            sinon.match((args: SelectionChangeEventArgs) => {
              return args.keys.size === 3 && args.keys.hasAll([instanceKeys[1], ...selectable2instanceKeys]);
            }),
          );
        });

        // verify current selection size
        await waitForSelection(3, imodel);
      });

      it("converts remove event selectables", async () => {
        const selectable1: CustomSelectable = { identifier: "custom-1", loadInstanceKeys: () => createAsyncGenerator(selectable1instanceKeys), data: {} };
        const selectable2: CustomSelectable = { identifier: "custom-2", loadInstanceKeys: () => createAsyncGenerator(selectable2instanceKeys), data: {} };

        storage.addToSelection({
          iModelKey: imodel.key,
          source,
          selectables: [instanceKeys[0], instanceKeys[1], selectable1, selectable2],
        });

        // verify current selection size
        await waitForSelection(6, imodel);
        changeListener.resetHistory();

        storage.removeFromSelection({
          iModelKey: imodel.key,
          source,
          selectables: [instanceKeys[0], selectable1],
        });

        await waitFor(() => {
          expect(changeListener).to.be.calledWith(
            sinon.match((args: SelectionChangeEventArgs) => {
              return args.keys.size === 3 && args.keys.hasAll([instanceKeys[0], ...selectable1instanceKeys]);
            }),
          );
        });

        // verify current selection size
        await waitForSelection(3, imodel);
        changeListener.resetHistory();

        storage.removeFromSelection({
          iModelKey: imodel.key,
          source,
          selectables: [instanceKeys[1], selectable2],
        });

        await waitFor(() => {
          expect(changeListener).to.be.calledWith(
            sinon.match((args: SelectionChangeEventArgs) => {
              return args.keys.size === 3 && args.keys.hasAll([instanceKeys[1], ...selectable2instanceKeys]);
            }),
          );
        });

        // verify current selection size
        await waitForSelection(0, imodel);
      });
    });
  });
});

function createAsyncGenerator<T extends object>(values: T[], delay?: Promise<void>): AsyncGenerator<T> {
  return (async function* () {
    await delay;
    for (const value of values) {
      yield value;
    }
  })();
}

async function waitFor<T>(check: () => Promise<T> | T, timeout?: number): Promise<T> {
  if (timeout === undefined) {
    timeout = 5000;
  }
  const timer = new StopWatch(undefined, true);
  let lastError: unknown;
  do {
    try {
      const res = check();
      return res instanceof Promise ? await res : res;
    } catch (e) {
      lastError = e;
      await BeDuration.wait(0);
    }
  } while (timer.current.milliseconds < timeout);
  throw lastError;
}
