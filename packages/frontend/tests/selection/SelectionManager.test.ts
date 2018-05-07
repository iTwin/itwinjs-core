/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { spy } from "@helpers/Spies";
import * as moq from "typemoq";
import { IModelToken } from "@bentley/imodeljs-common";
import { InstanceKey } from "@bentley/ecpresentation-common";
import { SelectionManager } from "@src/selection";
import { createRandomECInstanceKey } from "@helpers/random/EC";

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
  const mockImodelToken = moq.Mock.ofType<IModelToken>();
  const source: string = "test";

  beforeEach(() => {
    selectionManager = new SelectionManager();
    mockImodelToken.reset();
    baseSelection = generateSelection();
  });

  describe("addToSelection", () => {

    it("adds selection on an empty selection", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
    });

    it("adds selection on non empty selection", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, [baseSelection[0]]);
      selectionManager.addToSelection(source, mockImodelToken.object, [baseSelection[1], baseSelection[2]]);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
    });

    it("adds selection on different imodelTokens", () => {
      const anotherMockImodelToken = moq.Mock.ofType<IModelToken>();
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.addToSelection(source, anotherMockImodelToken.object, baseSelection);

      for (const imodelToken of [mockImodelToken.object, anotherMockImodelToken.object]) {
        const selectedItemsSet = selectionManager.getSelection(imodelToken);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      }
    });

    it("adds selection on different levels", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection, 1);
      for (let i = 0; i <= 1; i++) {
        const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object, i);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      }
    });

    it("clears higher level selection after adding items to lower level selection", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection, 1);
      selectionManager.addToSelection(source, mockImodelToken.object, [baseSelection[1]]);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object, 1);
      expect(selectedItemsSet.size).to.be.equal(0);
    });

  });

  describe("replaceSelection", () => {

    it("replaces selection on an empty selection", () => {
      selectionManager.replaceSelection(source, mockImodelToken.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
    });

    it("replaces on an non empty selection", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, [baseSelection[0]]);
      selectionManager.replaceSelection(source, mockImodelToken.object, [baseSelection[1], baseSelection[2]]);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 1);
      expect(selectedItemsSet.has(baseSelection[0])).false;
      expect(selectedItemsSet.has(baseSelection[1])).true;
      expect(selectedItemsSet.has(baseSelection[2])).true;
    });

    it("replaces on different imodelTokens", () => {
      const anotherMockImodelToken = moq.Mock.ofType<IModelToken>();
      selectionManager.replaceSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.replaceSelection(source, anotherMockImodelToken.object, baseSelection);

      for (const imodelToken of [mockImodelToken.object, anotherMockImodelToken.object]) {
        const selectedItemsSet = selectionManager.getSelection(imodelToken);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      }
    });

    it("replaces with different levels", () => {
      selectionManager.replaceSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.replaceSelection(source, mockImodelToken.object, baseSelection, 1);
      for (let i = 0; i <= 1; i++) {
        const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object, i);
        expect(selectedItemsSet.size).to.be.equal(baseSelection.length);
        for (const key of baseSelection) {
          expect(selectedItemsSet.has(key)).true;
        }
      }
    });

    it("clears higher level selection after replacing items of lower level selection", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection, 1);
      selectionManager.replaceSelection(source, mockImodelToken.object, [baseSelection[1]]);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object, 1);
      expect(selectedItemsSet.size).to.be.equal(0);
    });

  });

  describe("clearSelection", () => {

    it("clears empty selection", () => {
      selectionManager.clearSelection(source, mockImodelToken.object);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(0);
    });

    it("clears non empty selection", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.clearSelection(source, mockImodelToken.object);
      expect(selectionManager.getSelection(mockImodelToken.object).isEmpty).to.be.true;
    });

    it("clears on different imodelTokens", () => {
      const anotherMockImodelToken = moq.Mock.ofType<IModelToken>();
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.addToSelection(source, anotherMockImodelToken.object, baseSelection);

      selectionManager.clearSelection(source, anotherMockImodelToken.object);

      let selectedItemsSet = selectionManager.getSelection(anotherMockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(0);

      selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
    });

    it("clears with different levels", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection, 1);

      selectionManager.clearSelection(source, mockImodelToken.object, 1);
      let selectedItemsSet = selectionManager.getSelection(mockImodelToken.object, 1);
      expect(selectedItemsSet.size).to.be.equal(0);

      selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);

      for (const key of baseSelection) {
        expect(selectedItemsSet.has(key)).true;
      }
    });

    it("clears higher level selection after clearing items of lower level selection", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection, 1);
      selectionManager.clearSelection(source, mockImodelToken.object);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object, 1);
      expect(selectedItemsSet.size).to.be.equal(0);
    });

  });

  describe("removeSelection", () => {

    it("removes part of the selection", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.removeFromSelection(source, mockImodelToken.object, [baseSelection[1], baseSelection[2]]);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 2);
      expect(selectedItemsSet.has(baseSelection[0])).true;
      expect(selectedItemsSet.has(baseSelection[1])).false;
      expect(selectedItemsSet.has(baseSelection[2])).false;
    });

    it("removes whole selection", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.removeFromSelection(source, mockImodelToken.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(0);
    });

    it("removes on different imodelTokens", () => {
      const anotherMockImodelToken = moq.Mock.ofType<IModelToken>();
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.addToSelection(source, anotherMockImodelToken.object, baseSelection);

      selectionManager.removeFromSelection(source, mockImodelToken.object, [baseSelection[0]]);
      selectionManager.removeFromSelection(source, anotherMockImodelToken.object, [baseSelection[1], baseSelection[2]]);
      let selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 1);
      expect(selectedItemsSet.has(baseSelection[0])).false;
      expect(selectedItemsSet.has(baseSelection[1])).true;
      expect(selectedItemsSet.has(baseSelection[2])).true;

      selectedItemsSet = selectionManager.getSelection(anotherMockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 2);
      expect(selectedItemsSet.has(baseSelection[0])).true;
      expect(selectedItemsSet.has(baseSelection[1])).false;
      expect(selectedItemsSet.has(baseSelection[2])).false;
    });

    it("removes with different levels", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection, 1);
      selectionManager.removeFromSelection(source, mockImodelToken.object, [baseSelection[0]], 1);

      let selectedItemsSet = selectionManager.getSelection(mockImodelToken.object);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length);
      expect(selectedItemsSet.has(baseSelection[0])).true;
      expect(selectedItemsSet.has(baseSelection[1])).true;
      expect(selectedItemsSet.has(baseSelection[2])).true;

      selectedItemsSet = selectionManager.getSelection(mockImodelToken.object, 1);
      expect(selectedItemsSet.size).to.be.equal(baseSelection.length - 1);
      expect(selectedItemsSet.has(baseSelection[0])).false;
      expect(selectedItemsSet.has(baseSelection[1])).true;
      expect(selectedItemsSet.has(baseSelection[2])).true;
    });

    it("clears higher level selection after removing items of lower level selection", () => {
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection, 1);
      selectionManager.removeFromSelection(source, mockImodelToken.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(mockImodelToken.object, 1);
      expect(selectedItemsSet.size).to.be.equal(0);
    });

  });

  describe("handleEvent", () => {

    it("calls selectionChange.raiseEvent after addToSelection, replaceSelection, clearSelection, removeFromSelection", () => {
      const raiseEventSpy = spy.on(selectionManager.selectionChange, selectionManager.selectionChange.raiseEvent.name);
      selectionManager.addToSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.clearSelection(source, mockImodelToken.object);
      selectionManager.removeFromSelection(source, mockImodelToken.object, baseSelection);
      selectionManager.replaceSelection(source, mockImodelToken.object, baseSelection);
      expect(raiseEventSpy, "Expected selectionChange.raiseEvent to be called").to.have.been.called.exactly(4);
    });

  });

});
