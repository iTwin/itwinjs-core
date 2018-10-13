/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, spy } from "chai";
import * as moq from "typemoq";
import { createRandomECInstanceKey } from "@bentley/presentation-common/tests/_helpers/random";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { InstanceKey } from "@bentley/presentation-common";
import { SelectionManager } from "../../lib/selection";

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
  const source: string = "test";

  beforeEach(() => {
    selectionManager = new SelectionManager();
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

    it("clears higher level selection after adding items to lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, baseSelection, 1);
      selectionManager.addToSelection(source, imodelMock.object, [baseSelection[1]]);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.size).to.be.equal(0);
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

    it("clears higher level selection after replacing items of lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, baseSelection, 1);
      selectionManager.replaceSelection(source, imodelMock.object, [baseSelection[1]]);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.size).to.be.equal(0);
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

    it("clears higher level selection after clearing items of lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, baseSelection, 1);
      selectionManager.clearSelection(source, imodelMock.object);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.size).to.be.equal(0);
    });

  });

  describe("removeSelection", () => {

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

    it("clears higher level selection after removing items of lower level selection", () => {
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.addToSelection(source, imodelMock.object, baseSelection, 1);
      selectionManager.removeFromSelection(source, imodelMock.object, baseSelection);
      const selectedItemsSet = selectionManager.getSelection(imodelMock.object, 1);
      expect(selectedItemsSet.size).to.be.equal(0);
    });

  });

  describe("handleEvent", () => {

    it("calls selectionChange.raiseEvent after addToSelection, replaceSelection, clearSelection, removeFromSelection", () => {
      const raiseEventSpy = spy.on(selectionManager.selectionChange, selectionManager.selectionChange.raiseEvent.name);
      selectionManager.addToSelection(source, imodelMock.object, baseSelection);
      selectionManager.clearSelection(source, imodelMock.object);
      selectionManager.removeFromSelection(source, imodelMock.object, baseSelection);
      selectionManager.replaceSelection(source, imodelMock.object, baseSelection);
      expect(raiseEventSpy, "Expected selectionChange.raiseEvent to be called").to.have.been.called.exactly(4);
    });

  });

});
