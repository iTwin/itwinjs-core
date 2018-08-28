/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import {
  SelectionHandler, SingleSelectionHandler, MultiSelectionHandler,
  OnItemsDeselectedCallback, OnItemsSelectedCallback, OnSelectionChanged, DragAction,
} from "../../../src/common/selection/SelectionHandler";
import { SelectionMode } from "../../../src/common";

describe("SelectionHandler", () => {
  let handler: SelectionHandler<string>;
  const eventMock = moq.Mock.ofType<React.MouseEvent>();
  const itemsSelectedCallback = moq.Mock.ofType<OnItemsSelectedCallback<string>>();
  const itemsDeselectedCallback = moq.Mock.ofType<OnItemsDeselectedCallback<string>>();
  const itemSelectionHandler1 = moq.Mock.ofType<SingleSelectionHandler<string>>();
  const itemSelectionHandler2 = moq.Mock.ofType<SingleSelectionHandler<string>>();
  const itemSelectionHandler3 = moq.Mock.ofType<SingleSelectionHandler<string>>();
  const componentSelectionHandler = moq.Mock.ofType<MultiSelectionHandler<string>>();

  beforeEach(() => {
    handler = new SelectionHandler(SelectionMode.Single);
    eventMock.reset();
    itemsSelectedCallback.reset();
    itemsDeselectedCallback.reset();
    itemSelectionHandler1.reset();
    itemSelectionHandler2.reset();
    itemSelectionHandler3.reset();
    componentSelectionHandler.reset();

    handler.onItemsSelectedCallback = itemsSelectedCallback.object;
    handler.onItemsDeselectedCallback = itemsDeselectedCallback.object;

    itemSelectionHandler1.setup((x) => x.item()).returns(() => "item1");
    itemSelectionHandler2.setup((x) => x.item()).returns(() => "item2");
    itemSelectionHandler3.setup((x) => x.item()).returns(() => "item3");
    componentSelectionHandler.setup((x) => x.areEqual(moq.It.isAny(), moq.It.isAny())).returns((item1, item2) => item1 === item2);
  });

  describe("updateDragAction", () => {

    beforeEach(() => {
      handler.selectionMode = SelectionMode.Multiple;
    });

    it("calls updateSelection", () => {
      itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
      itemSelectionHandler2.setup((x) => x.isSelected()).returns(() => true);
      itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => false);
      componentSelectionHandler.setup((x) => x.updateSelection(["item1", "item3"], ["item2"])).verifiable();
      handler.createDragAction(componentSelectionHandler.object, [[itemSelectionHandler1.object, itemSelectionHandler2.object, itemSelectionHandler3.object]], itemSelectionHandler1.object.item());
      handler.updateDragAction(itemSelectionHandler3.object.item());
      componentSelectionHandler.verifyAll();
    });

    it("does not call updateSelection if selection did not change", () => {
      itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
      itemSelectionHandler2.setup((x) => x.isSelected()).returns(() => true);
      itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => false);
      handler.createDragAction(componentSelectionHandler.object, [[itemSelectionHandler1.object, itemSelectionHandler2.object, itemSelectionHandler3.object]], itemSelectionHandler1.object.item());
      handler.updateDragAction(itemSelectionHandler1.object.item());
      componentSelectionHandler.verify((x) => x.updateSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

    it("does not call updateSelection if createDragAction was not called", () => {
      itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
      itemSelectionHandler2.setup((x) => x.isSelected()).returns(() => true);
      itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => false);
      handler.updateDragAction(itemSelectionHandler1.object.item());
      componentSelectionHandler.verify((x) => x.updateSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

    it("does not call updateSelection if selectionMode does not have DragEnabled flag", () => {
      handler.selectionMode = SelectionMode.Single;
      itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
      itemSelectionHandler2.setup((x) => x.isSelected()).returns(() => true);
      itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => false);
      handler.createDragAction(componentSelectionHandler.object, [[itemSelectionHandler1.object, itemSelectionHandler2.object, itemSelectionHandler3.object]], itemSelectionHandler1.object.item());
      handler.updateDragAction(itemSelectionHandler3.object.item());
      componentSelectionHandler.verify((x) => x.updateSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

  });

  describe("completeDragAction", () => {
    beforeEach(() => {
      handler.selectionMode = SelectionMode.Multiple;
    });

    it("calls callbacks", () => {
      itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
      itemSelectionHandler2.setup((x) => x.isSelected()).returns(() => true);
      itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => false);
      handler.createDragAction(componentSelectionHandler.object, [[itemSelectionHandler1.object, itemSelectionHandler2.object, itemSelectionHandler3.object]], itemSelectionHandler1.object.item());
      handler.updateDragAction(itemSelectionHandler3.object.item());
      handler.completeDragAction();
      itemsSelectedCallback.verify((x) => x([itemSelectionHandler1.object.item(), itemSelectionHandler3.object.item()], false), moq.Times.once());
      itemsDeselectedCallback.verify((x) => x([itemSelectionHandler2.object.item()]), moq.Times.once());
    });

    it("does not call callbacks if selection did not change", () => {
      itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
      itemSelectionHandler2.setup((x) => x.isSelected()).returns(() => true);
      itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => false);
      handler.createDragAction(componentSelectionHandler.object, [[itemSelectionHandler1.object, itemSelectionHandler2.object, itemSelectionHandler3.object]], itemSelectionHandler1.object.item());
      handler.updateDragAction(itemSelectionHandler1.object.item());
      handler.completeDragAction();
      itemsSelectedCallback.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
      itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
    });

    it("handles items selection changing twice during the operation", () => {
      itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
      itemSelectionHandler2.setup((x) => x.isSelected()).returns(() => true);
      itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => false);
      handler.createDragAction(componentSelectionHandler.object, [[itemSelectionHandler1.object, itemSelectionHandler2.object, itemSelectionHandler3.object]], itemSelectionHandler1.object.item());
      handler.updateDragAction(itemSelectionHandler3.object.item());

      itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => true);

      handler.updateDragAction(itemSelectionHandler2.object.item());
      handler.completeDragAction();
      itemsSelectedCallback.verify((x) => x([itemSelectionHandler1.object.item()], false), moq.Times.once());
      itemsDeselectedCallback.verify((x) => x([itemSelectionHandler2.object.item()]), moq.Times.once());
    });

    it("does not call callbacks if createDragAction was not called", () => {
      itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
      itemSelectionHandler2.setup((x) => x.isSelected()).returns(() => true);
      itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => false);
      handler.updateDragAction(itemSelectionHandler3.object.item());
      handler.completeDragAction();
      itemsSelectedCallback.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
      itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
    });

    it("handles not having callbacks", () => {
      handler.onItemsDeselectedCallback = undefined;
      handler.onItemsSelectedCallback = undefined;
      itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
      itemSelectionHandler2.setup((x) => x.isSelected()).returns(() => true);
      itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => false);
      handler.createDragAction(componentSelectionHandler.object, [[itemSelectionHandler1.object, itemSelectionHandler2.object, itemSelectionHandler3.object]], itemSelectionHandler1.object.item());
      handler.updateDragAction(itemSelectionHandler3.object.item());
      handler.completeDragAction();
    });

  });

  describe("createSelectionFunction", () => {
    let selectionFunction: OnSelectionChanged;
    beforeEach(() => {
      selectionFunction = handler.createSelectionFunction(componentSelectionHandler.object, itemSelectionHandler1.object);
    });

    describe("Single", () => {

      it("replaces selection", () => {
        handler.selectionMode = SelectionMode.Single;
        selectionFunction();

        itemsSelectedCallback.verify((x) => x([itemSelectionHandler1.object.item()], true), moq.Times.once());
        itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.once());
        itemSelectionHandler1.verify((x) => x.select(), moq.Times.once());
      });

    });

    describe("SingleAllowDeselect", () => {

      it("replaces selection if not selected item is selected", () => {
        itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
        handler.selectionMode = SelectionMode.SingleAllowDeselect;
        selectionFunction();

        itemsSelectedCallback.verify((x) => x([itemSelectionHandler1.object.item()], true), moq.Times.once());
        itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.once());
        itemSelectionHandler1.verify((x) => x.select(), moq.Times.once());
      });

      it("does not replace selection if selectionMode is SingleAllowDeselect and selected item is deselected", () => {
        itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => true);
        handler.selectionMode = SelectionMode.SingleAllowDeselect;
        selectionFunction();

        itemsSelectedCallback.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        itemsDeselectedCallback.verify((x) => x([itemSelectionHandler1.object.item()]), moq.Times.once());
        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.never());
        itemSelectionHandler1.verify((x) => x.deselect(), moq.Times.once());
      });

    });

    describe("Extended", () => {

      it("deselects everything if ctrlDown is false", () => {
        handler.selectionMode = SelectionMode.Extended;
        selectionFunction(false, false);

        itemsSelectedCallback.verify((x) => x([itemSelectionHandler1.object.item()], true), moq.Times.once());
        itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.once());
        itemSelectionHandler1.verify((x) => x.select(), moq.Times.once());
      });

      it("does not deselect everything if ctrlDown is true", () => {
        handler.selectionMode = SelectionMode.Extended;
        selectionFunction(false, true);

        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.never());
        itemsSelectedCallback.verify((x) => x([itemSelectionHandler1.object.item()], false), moq.Times.once());
        itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.never());
        itemSelectionHandler1.verify((x) => x.select(), moq.Times.once());
      });

      it("deselects a single node that is selected if ctrlDown is true", () => {
        handler.selectionMode = SelectionMode.Extended;
        itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => true);
        selectionFunction(false, true);

        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.never());
        itemsSelectedCallback.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        itemsDeselectedCallback.verify((x) => x([itemSelectionHandler1.object.item()]), moq.Times.once());
        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.never());
        itemSelectionHandler1.verify((x) => x.deselect(), moq.Times.once());
      });

      it("selects between if shiftDown is true and replaces selection if ctrlDown is false", () => {
        handler.selectionMode = SelectionMode.Extended;
        const selectionFunction2 = handler.createSelectionFunction(componentSelectionHandler.object, itemSelectionHandler2.object);
        componentSelectionHandler.setup((x) => x.selectBetween(moq.It.isAny(), moq.It.isAny())).returns((item1, item2) => [item1, item2]);
        selectionFunction();
        selectionFunction2(true);

        componentSelectionHandler.verify((x) => x.selectBetween(itemSelectionHandler1.object.item(), itemSelectionHandler2.object.item()), moq.Times.once());
        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.exactly(2));
        itemsSelectedCallback.verify((x) => x([itemSelectionHandler1.object.item(), itemSelectionHandler2.object.item()], true), moq.Times.once());
        itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
      });

      it("selects between if shiftDown is true and does not replace selection if ctrlDown is true", () => {
        handler.selectionMode = SelectionMode.Extended;
        const selectionFunction2 = handler.createSelectionFunction(componentSelectionHandler.object, itemSelectionHandler2.object);
        componentSelectionHandler.setup((x) => x.selectBetween(moq.It.isAny(), moq.It.isAny())).returns((item1, item2) => [item1, item2]);
        selectionFunction();
        selectionFunction2(true, true);

        componentSelectionHandler.verify((x) => x.selectBetween(itemSelectionHandler1.object.item(), itemSelectionHandler2.object.item()), moq.Times.once());
        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.once());
        itemsSelectedCallback.verify((x) => x([itemSelectionHandler1.object.item(), itemSelectionHandler2.object.item()], false), moq.Times.once());
        itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
      });

      it("does not select between if shiftDown is false", () => {
        handler.selectionMode = SelectionMode.Extended;
        const selectionFunction2 = handler.createSelectionFunction(componentSelectionHandler.object, itemSelectionHandler2.object);

        selectionFunction();
        selectionFunction2();

        componentSelectionHandler.verify((x) => x.selectBetween(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        itemSelectionHandler1.verify((x) => x.select(), moq.Times.once());
        itemSelectionHandler2.verify((x) => x.select(), moq.Times.once());
        itemsSelectedCallback.verify((x) => x([itemSelectionHandler1.object.item()], true), moq.Times.once());
        itemsSelectedCallback.verify((x) => x([itemSelectionHandler2.object.item()], true), moq.Times.once());
        itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
      });

      it("does not change last node interacted with if shiftDown is true", () => {
        handler.selectionMode = SelectionMode.Extended;
        const selectionFunction2 = handler.createSelectionFunction(componentSelectionHandler.object, itemSelectionHandler2.object);
        const selectionFunction3 = handler.createSelectionFunction(componentSelectionHandler.object, itemSelectionHandler3.object);

        selectionFunction2();
        selectionFunction(true);
        componentSelectionHandler.verify((x) => x.selectBetween(itemSelectionHandler2.object.item(), itemSelectionHandler1.object.item()), moq.Times.once());
        selectionFunction3(true);
        componentSelectionHandler.verify((x) => x.selectBetween(itemSelectionHandler2.object.item(), itemSelectionHandler1.object.item()), moq.Times.once());
      });

    });

    describe("Multiple", () => {

      it("does not call callback if drag operation is in progress", () => {
        handler.selectionMode = SelectionMode.Multiple;
        itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => false);
        itemSelectionHandler2.setup((x) => x.isSelected()).returns(() => true);
        itemSelectionHandler3.setup((x) => x.isSelected()).returns(() => false);
        handler.createDragAction(componentSelectionHandler.object, [[itemSelectionHandler1.object, itemSelectionHandler2.object, itemSelectionHandler3.object]], itemSelectionHandler1.object.item());
        handler.updateDragAction(itemSelectionHandler3.object.item());
        itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => true);
        selectionFunction();

        itemsSelectedCallback.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
        handler.completeDragAction();

        itemsSelectedCallback.verify((x) => x([itemSelectionHandler3.object.item()], false), moq.Times.once());
        itemsDeselectedCallback.verify((x) => x([itemSelectionHandler2.object.item()]), moq.Times.once());
      });

      it("selects a node", () => {
        handler.selectionMode = SelectionMode.Multiple;
        selectionFunction();

        itemsSelectedCallback.verify((x) => x([itemSelectionHandler1.object.item()], false), moq.Times.once());
        itemsDeselectedCallback.verify((x) => x(moq.It.isAny()), moq.Times.never());
        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.never());
        itemSelectionHandler1.verify((x) => x.select(), moq.Times.once());
      });

      it("deselects a node", () => {
        handler.selectionMode = SelectionMode.Multiple;
        itemSelectionHandler1.setup((x) => x.isSelected()).returns(() => true);
        selectionFunction();

        itemsSelectedCallback.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        itemsDeselectedCallback.verify((x) => x([itemSelectionHandler1.object.item()]), moq.Times.once());
        componentSelectionHandler.verify((x) => x.deselectAll(), moq.Times.never());
        itemSelectionHandler1.verify((x) => x.deselect(), moq.Times.once());
      });

    });

    it("handles not having callbacks", () => {
      handler.onItemsDeselectedCallback = undefined;
      handler.onItemsSelectedCallback = undefined;
      selectionFunction();
    });

  });

});

describe("DragAction", () => {
  interface Item {
    row: number;
    column: number;
  }
  const createItemHandler = (item: Item, isSelected?: boolean): SingleSelectionHandler<Item> => {
    return {
      select: () => { },
      deselect: () => { },
      isSelected: () => isSelected ? true : false,
      item: () => item,
    };
  };

  const createItemHandlers = (rowCount: number, columnCount: number, isSelected?: boolean): Array<Array<SingleSelectionHandler<Item>>> => {
    const itemHandlers: Array<Array<SingleSelectionHandler<Item>>> = [];
    for (let row = 0; row < rowCount; row++) {
      itemHandlers[row] = [];
      for (let column = 0; column < columnCount; column++) {
        itemHandlers[row][column] = createItemHandler({ row, column }, isSelected);
      }
    }
    return itemHandlers;
  };

  const componentSelectionHandler: MultiSelectionHandler<Item> = {
    deselectAll: () => { },
    selectBetween: () => [],
    updateSelection: () => { },
    areEqual: (item1: Item, item2: Item) => item1.row === item2.row && item1.column === item2.column,
  };

  const findItem = (items: Item[], item: Item): Item | undefined => {
    return items.find((x) => x.row === item.row && x.column === item.column);
  };

  describe("updateDragAction", () => {

    it("returns first item in deselections if isSelected returns true", () => {
      const itemHandlers = [[createItemHandler({ row: 0, column: 0 }, true), createItemHandler({ row: 0, column: 1 })]];
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[0][0].item());

      const selectionChanges = dragAction.updateDragAction(itemHandlers[0][1].item());
      expect(selectionChanges.deselections.length).to.be.equal(1);
      expect(findItem(selectionChanges.deselections, itemHandlers[0][0].item())).to.not.be.undefined;
    });

    it("returns first item in selections if isSelected returns false", () => {
      const itemHandlers = [[createItemHandler({ row: 0, column: 0 }, false), createItemHandler({ row: 0, column: 1 }, true)]];
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[0][0].item());

      const selectionChanges = dragAction.updateDragAction(itemHandlers[0][1].item());
      expect(selectionChanges.selections.length).to.be.equal(1);
      expect(findItem(selectionChanges.selections, itemHandlers[0][0].item())).to.not.be.undefined;
    });

    it("returns items in selections or deselections based on isSelected result", () => {
      const itemHandlers = [[
        createItemHandler({ row: 0, column: 0 }, false),
        createItemHandler({ row: 0, column: 1 }, true),
        createItemHandler({ row: 0, column: 2 }, false)]];
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[0][0].item());

      const selectionChanges = dragAction.updateDragAction(itemHandlers[0][2].item());
      expect(selectionChanges.selections.length).to.be.equal(2);
      expect(selectionChanges.deselections.length).to.be.equal(1);
      expect(findItem(selectionChanges.selections, itemHandlers[0][0].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[0][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.deselections, itemHandlers[0][1].item())).to.not.be.undefined;
    });

    it("returns empty selectionChanges if same item as before is specified", () => {
      const itemHandlers = createItemHandlers(2, 2);
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[0][0].item());

      const selectionChanges = dragAction.updateDragAction(itemHandlers[0][0].item());
      expect(selectionChanges.selections.length).to.be.equal(0);
      expect(selectionChanges.deselections.length).to.be.equal(0);
    });

    it("returns empty selectionChanges if cannot find item", () => {
      const itemHandlers = createItemHandlers(2, 2);
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[0][0].item());

      const selectionChanges = dragAction.updateDragAction(createItemHandler({ row: 3, column: 3 }).item());
      expect(selectionChanges.selections.length).to.be.equal(0);
      expect(selectionChanges.deselections.length).to.be.equal(0);
    });

    it("returns selection changes from left to right", () => {
      const itemHandlers = createItemHandlers(1, 5);
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[0][2].item());

      // move to left
      let selectionChanges = dragAction.updateDragAction(itemHandlers[0][3].item());
      expect(selectionChanges.selections.length).to.be.equal(2);
      expect(findItem(selectionChanges.selections, itemHandlers[0][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[0][3].item())).to.not.be.undefined;

      // move further left
      selectionChanges = dragAction.updateDragAction(itemHandlers[0][4].item());
      expect(selectionChanges.selections.length).to.be.equal(1);
      expect(findItem(selectionChanges.selections, itemHandlers[0][4].item())).to.not.be.undefined;

      // move back
      selectionChanges = dragAction.updateDragAction(itemHandlers[0][3].item());
      expect(selectionChanges.selections.length).to.be.equal(1);
      expect(findItem(selectionChanges.selections, itemHandlers[0][4].item())).to.not.be.undefined;

      // move to the right of the starting point
      selectionChanges = dragAction.updateDragAction(itemHandlers[0][1].item());
      expect(selectionChanges.selections.length).to.be.equal(2);
      expect(findItem(selectionChanges.selections, itemHandlers[0][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[0][3].item())).to.not.be.undefined;
    });

    it("returns selection changes from right to left", () => {
      const itemHandlers = createItemHandlers(1, 5);
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[0][3].item());

      // move to right
      let selectionChanges = dragAction.updateDragAction(itemHandlers[0][2].item());
      expect(selectionChanges.selections.length).to.be.equal(2);
      expect(findItem(selectionChanges.selections, itemHandlers[0][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[0][3].item())).to.not.be.undefined;

      // move further right
      selectionChanges = dragAction.updateDragAction(itemHandlers[0][1].item());
      expect(selectionChanges.selections.length).to.be.equal(1);
      expect(findItem(selectionChanges.selections, itemHandlers[0][1].item())).to.not.be.undefined;

      // move back
      selectionChanges = dragAction.updateDragAction(itemHandlers[0][2].item());
      expect(selectionChanges.selections.length).to.be.equal(1);
      expect(findItem(selectionChanges.selections, itemHandlers[0][1].item())).to.not.be.undefined;

      // move to the left of the starting point
      selectionChanges = dragAction.updateDragAction(itemHandlers[0][4].item());
      expect(selectionChanges.selections.length).to.be.equal(2);
      expect(findItem(selectionChanges.selections, itemHandlers[0][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[0][4].item())).to.not.be.undefined;
    });

    it("returns selection changes from top to bottom", () => {
      const itemHandlers = createItemHandlers(5, 1);
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[2][0].item());

      // move down
      let selectionChanges = dragAction.updateDragAction(itemHandlers[3][0].item());
      expect(selectionChanges.selections.length).to.be.equal(2);
      expect(findItem(selectionChanges.selections, itemHandlers[2][0].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][0].item())).to.not.be.undefined;

      // move further down
      selectionChanges = dragAction.updateDragAction(itemHandlers[4][0].item());
      expect(selectionChanges.selections.length).to.be.equal(1);
      expect(findItem(selectionChanges.selections, itemHandlers[4][0].item())).to.not.be.undefined;

      // move back up
      selectionChanges = dragAction.updateDragAction(itemHandlers[3][0].item());
      expect(selectionChanges.selections.length).to.be.equal(1);
      expect(findItem(selectionChanges.selections, itemHandlers[4][0].item())).to.not.be.undefined;

      // move above the starting point
      selectionChanges = dragAction.updateDragAction(itemHandlers[1][0].item());
      expect(selectionChanges.selections.length).to.be.equal(2);
      expect(findItem(selectionChanges.selections, itemHandlers[1][0].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][0].item())).to.not.be.undefined;
    });

    it("returns selection changes from bottom to top", () => {
      const itemHandlers = createItemHandlers(5, 1);
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[3][0].item());

      // move up
      let selectionChanges = dragAction.updateDragAction(itemHandlers[2][0].item());
      expect(selectionChanges.selections.length).to.be.equal(2);
      expect(findItem(selectionChanges.selections, itemHandlers[2][0].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][0].item())).to.not.be.undefined;

      // move further up
      selectionChanges = dragAction.updateDragAction(itemHandlers[1][0].item());
      expect(selectionChanges.selections.length).to.be.equal(1);
      expect(findItem(selectionChanges.selections, itemHandlers[1][0].item())).to.not.be.undefined;

      // move back down
      selectionChanges = dragAction.updateDragAction(itemHandlers[2][0].item());
      expect(selectionChanges.selections.length).to.be.equal(1);
      expect(findItem(selectionChanges.selections, itemHandlers[1][0].item())).to.not.be.undefined;

      // move below the starting point
      selectionChanges = dragAction.updateDragAction(itemHandlers[4][0].item());
      expect(selectionChanges.selections.length).to.be.equal(2);
      expect(findItem(selectionChanges.selections, itemHandlers[2][0].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[4][0].item())).to.not.be.undefined;
    });

    it("returns selection changes from bottom left to top right", () => {
      const itemHandlers = createItemHandlers(5, 5);
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[3][1].item());

      // move to top right
      let selectionChanges = dragAction.updateDragAction(itemHandlers[2][2].item());
      expect(selectionChanges.selections.length).to.be.equal(4);
      expect(findItem(selectionChanges.selections, itemHandlers[2][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][2].item())).to.not.be.undefined;

      // move further to top right
      selectionChanges = dragAction.updateDragAction(itemHandlers[1][3].item());
      expect(selectionChanges.selections.length).to.be.equal(5);
      expect(findItem(selectionChanges.selections, itemHandlers[1][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][3].item())).to.not.be.undefined;

      // move back to bottom left
      selectionChanges = dragAction.updateDragAction(itemHandlers[2][2].item());
      expect(selectionChanges.selections.length).to.be.equal(5);
      expect(findItem(selectionChanges.selections, itemHandlers[1][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][3].item())).to.not.be.undefined;

      // move to bottom left of the starting point
      selectionChanges = dragAction.updateDragAction(itemHandlers[4][0].item());
      expect(selectionChanges.selections.length).to.be.equal(6);
      expect(findItem(selectionChanges.selections, itemHandlers[2][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][0].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[4][0].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[4][1].item())).to.not.be.undefined;
    });

    it("returns selection changes from top right to bottom left", () => {
      const itemHandlers = createItemHandlers(5, 5);
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[1][3].item());

      // move to bottom left
      let selectionChanges = dragAction.updateDragAction(itemHandlers[2][2].item());
      expect(selectionChanges.selections.length).to.be.equal(4);
      expect(findItem(selectionChanges.selections, itemHandlers[1][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][3].item())).to.not.be.undefined;

      // move further to bottom left
      selectionChanges = dragAction.updateDragAction(itemHandlers[3][1].item());
      expect(selectionChanges.selections.length).to.be.equal(5);
      expect(findItem(selectionChanges.selections, itemHandlers[1][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][3].item())).to.not.be.undefined;

      // move back to top right
      selectionChanges = dragAction.updateDragAction(itemHandlers[2][2].item());
      expect(selectionChanges.selections.length).to.be.equal(5);
      expect(findItem(selectionChanges.selections, itemHandlers[1][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][3].item())).to.not.be.undefined;

      // move to top right of the starting point
      selectionChanges = dragAction.updateDragAction(itemHandlers[0][4].item());
      expect(selectionChanges.selections.length).to.be.equal(6);
      expect(findItem(selectionChanges.selections, itemHandlers[0][4].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[0][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][4].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][3].item())).to.not.be.undefined;
    });

    it("returns selection changes from top left right to bottom right", () => {
      const itemHandlers = createItemHandlers(5, 5);
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[1][1].item());

      // move to bottom right
      let selectionChanges = dragAction.updateDragAction(itemHandlers[2][2].item());
      expect(selectionChanges.selections.length).to.be.equal(4);
      expect(findItem(selectionChanges.selections, itemHandlers[1][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][2].item())).to.not.be.undefined;

      // move further to bottom right
      selectionChanges = dragAction.updateDragAction(itemHandlers[3][3].item());
      expect(selectionChanges.selections.length).to.be.equal(5);
      expect(findItem(selectionChanges.selections, itemHandlers[1][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][3].item())).to.not.be.undefined;

      // move back top left
      selectionChanges = dragAction.updateDragAction(itemHandlers[2][2].item());
      expect(selectionChanges.selections.length).to.be.equal(5);
      expect(findItem(selectionChanges.selections, itemHandlers[1][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][3].item())).to.not.be.undefined;

      // move to top left of the starting point
      selectionChanges = dragAction.updateDragAction(itemHandlers[0][0].item());
      expect(selectionChanges.selections.length).to.be.equal(6);
      expect(findItem(selectionChanges.selections, itemHandlers[0][0].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[0][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][0].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][2].item())).to.not.be.undefined;
    });

    it("returns selection changes from bottom right to top left", () => {
      const itemHandlers = createItemHandlers(5, 5);
      const dragAction = new DragAction(componentSelectionHandler, itemHandlers, itemHandlers[3][3].item());

      // move to top left
      let selectionChanges = dragAction.updateDragAction(itemHandlers[2][2].item());
      expect(selectionChanges.selections.length).to.be.equal(4);
      expect(findItem(selectionChanges.selections, itemHandlers[2][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][3].item())).to.not.be.undefined;

      // move further to top left
      selectionChanges = dragAction.updateDragAction(itemHandlers[1][1].item());
      expect(selectionChanges.selections.length).to.be.equal(5);
      expect(findItem(selectionChanges.selections, itemHandlers[1][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][1].item())).to.not.be.undefined;

      // move back to bottom right
      selectionChanges = dragAction.updateDragAction(itemHandlers[2][2].item());
      expect(selectionChanges.selections.length).to.be.equal(5);
      expect(findItem(selectionChanges.selections, itemHandlers[1][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[1][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][1].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][1].item())).to.not.be.undefined;

      // move to bottom right of the starting point
      selectionChanges = dragAction.updateDragAction(itemHandlers[4][4].item());
      expect(selectionChanges.selections.length).to.be.equal(6);
      expect(findItem(selectionChanges.selections, itemHandlers[2][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[2][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][2].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[3][4].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[4][3].item())).to.not.be.undefined;
      expect(findItem(selectionChanges.selections, itemHandlers[4][4].item())).to.not.be.undefined;
    });

  });

});
