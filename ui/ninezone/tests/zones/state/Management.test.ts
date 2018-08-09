/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { RectangleProps } from "@src/utilities/Rectangle";
import NineZone, { getDefaultProps } from "@src/zones/state/NineZone";
import StateManagement, { DropTarget } from "@src/zones/state/Management";
import { UnmergeCell, CellType } from "@src/zones/target/Unmerge";

// use expect, because dirty-chai ruins the should.exist() helpers
const expect = chai.expect;

const defaultProps = getDefaultProps();
const openedZone6Props: NineZone = {
  ...defaultProps,
  zones: {
    ...defaultProps.zones,
    [4]: {
      ...defaultProps.zones[4],
      bounds: {
        left: 0,
        top: 20,
        right: 5,
        bottom: 54,
      },
    },
    [6]: {
      ...defaultProps.zones[6],
      bounds: {
        left: 10,
        top: 20,
        right: 99,
        bottom: 54,
      },
      widgets: [
        {
          id: 6,
          tabIndex: 14,
        },
      ],
    },
    [9]: {
      ...defaultProps.zones[9],
      bounds: {
        left: 10,
        top: 54,
        right: 99,
        bottom: 110,
      },
      widgets: [
        {
          id: 9,
          tabIndex: 1,
        },
      ],
    },
  },
};

const floatingOpenedZone6Props: NineZone = {
  ...openedZone6Props,
  zones: {
    ...openedZone6Props.zones,
    6: {
      ...openedZone6Props.zones[6],
      floatingBounds: {
        left: 0,
        top: 0,
        right: 10,
        bottom: 10,
      },
    },
  },
};

const merged9To6Props: NineZone = {
  ...openedZone6Props,
  zones: {
    ...openedZone6Props.zones,
    6: {
      ...openedZone6Props.zones[6],
      bounds: {
        left: 10,
        top: 20,
        right: 99,
        bottom: 110,
      },
      widgets: [
        {
          id: 6,
          tabIndex: -1,
        },
        {
          id: 9,
          tabIndex: 1,
        },
      ],
    },
    9: {
      ...openedZone6Props.zones[9],
      widgets: [],
    },
  },
};

const merged6To9Props: NineZone = {
  ...openedZone6Props,
  zones: {
    ...openedZone6Props.zones,
    6: {
      ...openedZone6Props.zones[6],
      bounds: {
        left: 10,
        top: 20,
        right: 99,
        bottom: 110,
      },
      widgets: [],
    },
    9: {
      ...openedZone6Props.zones[9],
      widgets: [
        {
          id: 9,
          tabIndex: -1,
        },
        {
          id: 6,
          tabIndex: 1,
        },
      ],
    },
  },
};

const merged9And6To6Props: NineZone = {
  ...merged9To6Props,
  zones: {
    ...merged9To6Props.zones,
    6: {
      ...merged9To6Props.zones[6],
      widgets: [
        {
          id: 9,
          tabIndex: -1,
        },
        {
          id: 6,
          tabIndex: 1,
        },
      ],
    },
  },
};

const swapped6and9Props: NineZone = {
  ...defaultProps,
  zones: {
    ...defaultProps.zones,
    6: {
      ...defaultProps.zones[6],
      bounds: {
        left: 10,
        top: 20,
        right: 99,
        bottom: 54,
      },
      widgets: [
        {
          id: 9,
          tabIndex: 1,
        },
      ],
    },
    9: {
      ...defaultProps.zones[9],
      bounds: {
        left: 10,
        top: 54,
        right: 99,
        bottom: 110,
      },
      widgets: [
        {
          id: 6,
          tabIndex: 1,
        },
      ],
    },
  },
};

const merged9And3To6Props: NineZone = {
  ...merged9To6Props,
  zones: {
    ...merged9To6Props.zones,
    3: {
      ...merged9To6Props.zones[3],
      widgets: [],
    },
    6: {
      ...merged9To6Props.zones[6],
      bounds: {
        left: 10,
        top: 2,
        right: 99,
        bottom: 110,
      },
      widgets: [
        {
          id: 6,
          tabIndex: -1,
        },
        {
          id: 9,
          tabIndex: 1,
        },
        {
          id: 3,
          tabIndex: 1,
        },
      ],
    },
  },
};

const merged3To2Props: NineZone = {
  ...defaultProps,
  zones: {
    ...defaultProps.zones,
    2: {
      ...defaultProps.zones[2],
      bounds: {
        left: 55,
        top: 20,
        right: 125,
        bottom: 30,
      },
      widgets: [
        {
          id: 2,
          tabIndex: -1,
        },
        {
          id: 3,
          tabIndex: 1,
        },
      ],
    },
    3: {
      ...defaultProps.zones[3],
      widgets: [],
    },
  },
};

const merged6To4Props: NineZone = {
  ...defaultProps,
  zones: {
    ...defaultProps.zones,
    4: {
      ...defaultProps.zones[4],
      bounds: {
        left: 5,
        top: 20,
        right: 125,
        bottom: 30,
      },
      widgets: [
        {
          id: 4,
          tabIndex: -1,
        },
        {
          id: 6,
          tabIndex: 1,
        },
      ],
    },
    6: {
      ...defaultProps.zones[6],
      widgets: [],
    },
  },
};

const merged9To7Props: NineZone = {
  ...defaultProps,
  zones: {
    ...defaultProps.zones,
    7: {
      ...defaultProps.zones[7],
      bounds: {
        left: 5,
        top: 20,
        right: 125,
        bottom: 30,
      },
      widgets: [
        {
          id: 7,
          tabIndex: -1,
        },
        {
          id: 9,
          tabIndex: 1,
        },
      ],
    },
    9: {
      ...defaultProps.zones[9],
      widgets: [],
    },
  },
};

const merged4To9Props: NineZone = {
  ...defaultProps,
  zones: {
    ...defaultProps.zones,
    9: {
      ...defaultProps.zones[9],
      widgets: [
        {
          id: 9,
          tabIndex: -1,
        },
        {
          id: 4,
          defaultZoneId: 6,
          tabIndex: 1,
        },
      ],
    },
  },
};

const merged6And4To3Props: NineZone = {
  ...defaultProps,
  zones: {
    ...defaultProps.zones,
    3: {
      ...defaultProps.zones[3],
      widgets: [
        {
          id: 3,
          tabIndex: -1,
        },
        {
          id: 6,
          tabIndex: -1,
        },
        {
          id: 4,
          defaultZoneId: 9,
          tabIndex: -1,
        },
      ],
    },
    6: {
      ...merged9To6Props.zones[6],
      bounds: {
        left: 10,
        top: 2,
        right: 99,
        bottom: 110,
      },
      widgets: [
        {
          id: 6,
          tabIndex: -1,
        },
        {
          id: 9,
          tabIndex: 1,
        },
        {
          id: 3,
          tabIndex: 1,
        },
      ],
    },
  },
};

describe("StateManagement", () => {
  it("should construct an instance", () => {
    new StateManagement();
  });

  describe("getDropTarget", () => {
    it("should return merge drop target for adjacent zone in same row", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 1,
      };
      new StateManagement().getDropTarget(2, props).should.be.eq(DropTarget.Merge);
    });

    it("should return merge drop target for adjacent zone in same col", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 1,
      };
      new StateManagement().getDropTarget(4, props).should.be.eq(DropTarget.Merge);
    });

    it("should return merge drop target for any zone in same row", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 1,
      };
      new StateManagement().getDropTarget(2, props).should.be.eq(DropTarget.Merge);
    });

    it("should return merge drop target for any zone in same col", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 1,
      };
      new StateManagement().getDropTarget(7, props).should.be.eq(DropTarget.Merge);
    });

    it("should return merge drop target for same zone", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 1,
      };
      new StateManagement().getDropTarget(1, props).should.be.eq(DropTarget.Merge);
    });

    it("should return merge drop target for swapped zones", () => {
      const props = {
        ...swapped6and9Props,
        draggingWidgetId: 6,
      };
      new StateManagement().getDropTarget(6, props).should.be.eq(DropTarget.Merge);
      new StateManagement().getDropTarget(9, props).should.be.eq(DropTarget.Merge);
    });

    it("should return no drop target for zones merged diagonally", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 8,
      };
      new StateManagement().getDropTarget(1, props).should.be.eq(DropTarget.None);
      new StateManagement().getDropTarget(4, props).should.be.eq(DropTarget.None);
    });

    it("should return unmerge target", () => {
      const props = {
        ...merged9To6Props,
        draggingWidgetId: 9,
      };
      new StateManagement().getDropTarget(9, props).should.be.eq(DropTarget.Unmerge);
    });

    it("should return no horizontal target if dragging vertically merged zone", () => {
      const props = {
        ...merged9To6Props,
        draggingWidgetId: 9,
      };
      new StateManagement().getDropTarget(7, props).should.be.eq(DropTarget.None);
    });

    it("should return merge target for horizontal zone", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 9,
      };
      new StateManagement().getDropTarget(7, props).should.be.eq(DropTarget.Merge);
    });

    it("should return merge target for horizontal zone (swapped widgets)", () => {
      const props = {
        ...swapped6and9Props,
        draggingWidgetId: 6,
      };
      new StateManagement().getDropTarget(6, props).should.be.eq(DropTarget.Merge);
    });

    it("should return merge target for first widget in zone with multiple widgets", () => {
      const props = {
        ...merged9To6Props,
        draggingWidgetId: 3,
      };
      new StateManagement().getDropTarget(3, props).should.be.eq(DropTarget.Merge);
      new StateManagement().getDropTarget(6, props).should.be.eq(DropTarget.Merge);
      new StateManagement().getDropTarget(9, props).should.be.eq(DropTarget.None);
    });

    it("should return no merge target for zone 4 if dragging widget 6 in zone 9", () => {
      const props = {
        ...swapped6and9Props,
        draggingWidgetId: 6,
      };
      new StateManagement().getDropTarget(4, props).should.be.eq(DropTarget.None);
    });

    it("should return no merge target if target widget is merged horizontally", () => {
      const props = {
        ...merged9To7Props,
        draggingWidgetId: 4,
      };
      new StateManagement().getDropTarget(7, props).should.be.eq(DropTarget.None);
    });
  });

  describe("getMergeTargetCells", () => {
    it("should get target cells for same zone", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 9,
      };
      const cells = new StateManagement().getMergeTargetCells(9, props);

      cells.length.should.eq(1);
      cells[0].col.should.eq(2);
      cells[0].row.should.eq(2);
    });

    it("should get target cells for vertically adjacent zone", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 6,
      };
      const cells = new StateManagement().getMergeTargetCells(9, props);
      cells.length.should.eq(2);
    });

    it("should get target cells for horizontally adjacent zone", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 3,
      };
      const cells = new StateManagement().getMergeTargetCells(2, props);
      cells.length.should.eq(2);
    });

    it("should get target cells for horizontal zone", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 6,
      };
      const cells = new StateManagement().getMergeTargetCells(4, props);
      cells.length.should.eq(3);
    });

    it("should get target cells for vertical zone", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 6,
      };
      const cells = new StateManagement().getMergeTargetCells(4, props);
      cells.length.should.eq(3);
    });

    it("should get target cells for vertical zone (swapped zones)", () => {
      const props = {
        ...swapped6and9Props,
        draggingWidgetId: 9,
      };
      const cells = new StateManagement().getMergeTargetCells(4, props);
      cells.length.should.eq(3);
    });

    it("should get target cells if dragging zone has merged widgets", () => {
      const props = {
        ...merged9To6Props,
        draggingWidgetId: 6,
      };
      const cells = new StateManagement().getMergeTargetCells(6, props);
      const z6 = cells.find((c) => c.col === 2 && c.row === 1);
      const z9 = cells.find((c) => c.col === 2 && c.row === 2);

      cells.length.should.eq(2);
      expect(z6).to.exist;
      expect(z9).to.exist;
    });

    it("should get target cell for swapped widgets", () => {
      const props = {
        ...swapped6and9Props,
        draggingWidgetId: 6,
      };
      const cells = new StateManagement().getMergeTargetCells(6, props);
      cells.length.should.eq(1);
    });

    it("should get correct target cell for swapped widgets", () => {
      const props = {
        ...swapped6and9Props,
        draggingWidgetId: 6,
      };
      const cells = new StateManagement().getMergeTargetCells(6, props);
      cells[0].col.should.eq(2);
      cells[0].row.should.eq(2);
    });

    it("should get target cells for swapped widgets", () => {
      const props = {
        ...swapped6and9Props,
        draggingWidgetId: 6,
      };
      const cells = new StateManagement().getMergeTargetCells(9, props);
      cells.length.should.eq(2);
    });

    it("should get target cells with zone 5", () => {
      const props = {
        ...merged6To4Props,
        draggingWidgetId: 6,
      };
      const cells = new StateManagement().getMergeTargetCells(4, props);
      cells.length.should.eq(3);

      expect(cells.find((c) => c.col === 0 && c.row === 1)).to.exist;
      expect(cells.find((c) => c.col === 1 && c.row === 1)).to.exist;
      expect(cells.find((c) => c.col === 2 && c.row === 1)).to.exist;
    });

    it("should get target cells with zone 8 if is in footer mode", () => {
      const props = {
        ...merged9To7Props,
        draggingWidgetId: 9,
      };
      const cells = new StateManagement().getMergeTargetCells(7, props);
      cells.length.should.eq(3);

      expect(cells.find((c) => c.col === 0 && c.row === 2)).to.exist;
      expect(cells.find((c) => c.col === 1 && c.row === 2)).to.exist;
      expect(cells.find((c) => c.col === 2 && c.row === 2)).to.exist;
    });

    it("should get cells based on widget zone", () => {
      const props = {
        ...merged4To9Props,
        draggingWidgetId: 9,
      };
      const cells = new StateManagement().getMergeTargetCells(9, props);
      cells.length.should.eq(2);

      expect(cells.find((c) => c.col === 2 && c.row === 1)).to.exist;
      expect(cells.find((c) => c.col === 2 && c.row === 2)).to.exist;
    });
  });

  describe("getUnmergeTargetCells", () => {
    it("should get unmerge target cells for merged widget", () => {
      const props = {
        ...merged9To6Props,
        draggingWidgetId: 9,
      };
      const cells = new StateManagement().getUnmergeTargetCells(9, props);
      const z6 = cells.find((c) => c.col === 2 && c.row === 1);
      const z9 = cells.find((c) => c.col === 2 && c.row === 2);

      cells.length.should.eq(2);
      expect(z6).to.exist;
      expect(z9).to.exist;
    });

    it("should get unmerge target with all cells unmerged", () => {
      const props = {
        ...merged9And3To6Props,
        draggingWidgetId: 9,
      };
      const cells = new StateManagement().getUnmergeTargetCells(9, props);

      const z3 = cells.find((c) => c.col === 2 && c.row === 0) as UnmergeCell;
      const z6 = cells.find((c) => c.col === 2 && c.row === 1) as UnmergeCell;
      const z9 = cells.find((c) => c.col === 2 && c.row === 2) as UnmergeCell;

      cells.length.should.eq(3);
      expect(z3).to.exist;
      expect(z6).to.exist;
      expect(z9).to.exist;

      z3.type.should.eq(CellType.Unmerge);
      z6.type.should.eq(CellType.Unmerge);
      z9.type.should.eq(CellType.Unmerge);
    });

    it("should get unmerge target with one cell unmerged and 2 cells merged", () => {
      const props = {
        ...merged9And3To6Props,
        draggingWidgetId: 9,
      };
      const cells = new StateManagement().getUnmergeTargetCells(3, props);
      const c3 = cells.find((c) => c.col === 2 && c.row === 0) as UnmergeCell;
      const c6 = cells.find((c) => c.col === 2 && c.row === 1) as UnmergeCell;
      const c9 = cells.find((c) => c.col === 2 && c.row === 2) as UnmergeCell;

      cells.length.should.eq(3);
      expect(c3).to.exist;
      expect(c6).to.exist;
      expect(c9).to.exist;

      c3.type.should.eq(CellType.Merge);
      c6.type.should.eq(CellType.Merge);
      c9.type.should.eq(CellType.Unmerge);
    });
  });

  describe("onTabClick", () => {
    it("should open widget", () => {
      const state = new StateManagement().onTabClick(6, 33, defaultProps);
      state.zones[6].widgets[0].tabIndex.should.eq(33);
    });

    it("should change tab", () => {
      const state = new StateManagement().onTabClick(6, 13, openedZone6Props);
      state.zones[6].widgets[0].tabIndex.should.eq(13);
    });

    it("should close widget", () => {
      const state = new StateManagement().onTabClick(6, 14, openedZone6Props);
      state.zones[6].widgets[0].tabIndex.should.eq(-1);
    });

    it("should not close widget when in zone is floating", () => {
      const state = new StateManagement().onTabClick(6, 14, floatingOpenedZone6Props);

      state.zones[6].widgets[0].tabIndex.should.eq(14);
    });
  });

  describe("mergeDrop", () => {
    it("should merge zones", () => {
      const props = {
        ...openedZone6Props,
        draggingWidgetId: 9,
      };
      const state = new StateManagement().mergeDrop(6, props);

      state.zones[6].widgets.length.should.eq(2);
      const w6 = state.zones[6].widgets[0];
      const w9 = state.zones[6].widgets[1];

      w6.id.should.eq(6);
      w9.id.should.eq(9);
    });

    it("should merge swapped zones", () => {
      const props = {
        ...swapped6and9Props,
        draggingWidgetId: 6,
      };
      const state = new StateManagement().mergeDrop(9, props);

      state.zones[6].widgets.length.should.eq(2);
      const w6 = state.zones[6].widgets[1];
      const w9 = state.zones[6].widgets[0];

      w6.id.should.eq(6);
      w9.id.should.eq(9);
    });

    it("should merge bounds", () => {
      const props = {
        ...openedZone6Props,
        draggingWidgetId: 9,
      };
      const state = new StateManagement().mergeDrop(6, props);

      const bounds = state.zones[6].bounds;
      bounds.left.should.eq(10);
      bounds.top.should.eq(20);
      bounds.right.should.eq(99);
      bounds.bottom.should.eq(110);
    });

    it("should unset floating bounds of target zone", () => {
      const props = {
        ...floatingOpenedZone6Props,
        draggingWidgetId: 9,
      };
      const state = new StateManagement().mergeDrop(6, props);

      expect(state.zones[6].floatingBounds).to.not.exist;
    });

    it("should merge all vertical zones between dragging zone and target zone", () => {
      const props = {
        ...defaultProps,
        draggingWidgetId: 1,
      };
      const state = new StateManagement().mergeDrop(7, props);

      const w1 = state.zones[7].widgets.find((w) => w.id === 1);
      const w4 = state.zones[7].widgets.find((w) => w.id === 4);
      const w7 = state.zones[7].widgets.find((w) => w.id === 7);

      state.zones[7].widgets.length.should.eq(3);
      expect(w1).to.exist;
      expect(w4).to.exist;
      expect(w7).to.exist;
    });

    it("should merge widget 6 to zone 4", () => {
      const props = {
        ...openedZone6Props,
        draggingWidgetId: 6,
      };
      const state = new StateManagement().mergeDrop(4, props);

      state.zones[4].widgets.length.should.eq(2);
      const w4 = state.zones[4].widgets[0];
      const w6 = state.zones[4].widgets[1];

      w4.id.should.eq(4);
      w6.id.should.eq(6);
    });

    it("should merge widget 9 to zone 7 when nine zone is in footer mode", () => {
      const props = {
        ...defaultProps,
        isInFooterMode: true,
        draggingWidgetId: 9,
      };
      const state = new StateManagement().mergeDrop(7, props);

      state.zones[7].widgets.length.should.eq(2);
      const w7 = state.zones[7].widgets[0];
      const w9 = state.zones[7].widgets[1];

      w7.id.should.eq(7);
      w9.id.should.eq(9);
    });
  });

  describe("unmergeDrop", () => {
    it("should unmerge vertically merged zones", () => {
      const props = {
        ...merged9To6Props,
        draggingWidgetId: 9,
      };
      const state = new StateManagement().unmergeDrop(9, props);

      const w6 = state.zones[6].widgets.find((w) => w.id === 6);
      const w9 = state.zones[9].widgets.find((w) => w.id === 9);

      state.zones[6].widgets.length.should.eq(1);
      state.zones[9].widgets.length.should.eq(1);
      expect(w6).to.exist;
      expect(w9).to.exist;
    });

    it("should unmerge horizontally merged zones", () => {
      const props = {
        ...merged3To2Props,
        draggingWidgetId: 3,
      };
      const state = new StateManagement().unmergeDrop(3, props);

      const w2 = state.zones[2].widgets.find((w) => w.id === 2);
      const w3 = state.zones[3].widgets.find((w) => w.id === 3);

      state.zones[2].widgets.length.should.eq(1);
      state.zones[3].widgets.length.should.eq(1);
      expect(w2).to.exist;
      expect(w3).to.exist;
    });

    it("should unmerge bounds of vertically merged zones", () => {
      const props = {
        ...merged9To6Props,
        draggingWidgetId: 9,
      };
      const state = new StateManagement().unmergeDrop(9, props);

      const b1 = state.zones[6].bounds;
      b1.left.should.eq(10);
      b1.top.should.eq(20);
      b1.right.should.eq(99);
      b1.bottom.should.eq(65);

      const b2 = state.zones[9].bounds;
      b2.left.should.eq(10);
      b2.top.should.eq(65);
      b2.right.should.eq(99);
      b2.bottom.should.eq(110);
    });

    it("should unmerge bounds of horizontally merged zones", () => {
      const props = {
        ...merged3To2Props,
        draggingWidgetId: 3,
      };
      const state = new StateManagement().unmergeDrop(3, props);

      const b1 = state.zones[2].bounds;
      b1.left.should.eq(55);
      b1.top.should.eq(20);
      b1.right.should.eq(90);
      b1.bottom.should.eq(30);

      const b2 = state.zones[3].bounds;
      b2.left.should.eq(90);
      b2.top.should.eq(20);
      b2.right.should.eq(125);
      b2.bottom.should.eq(30);
    });

    it("should swap zones", () => {
      const props = {
        ...merged9To6Props,
        draggingWidgetId: 6,
      };
      const state = new StateManagement().unmergeDrop(9, props);

      const w6 = state.zones[9].widgets.find((w) => w.id === 6);
      const w9 = state.zones[6].widgets.find((w) => w.id === 9);

      state.zones[6].widgets.length.should.eq(1);
      state.zones[9].widgets.length.should.eq(1);
      expect(w6).to.exist;
      expect(w9).to.exist;
    });

    it("should unmerge to lower zone", () => {
      const props = {
        ...merged6To9Props,
        draggingWidgetId: 6,
      };
      const state = new StateManagement().unmergeDrop(6, props);

      const w6 = state.zones[9].widgets.find((w) => w.id === 6);
      const w9 = state.zones[6].widgets.find((w) => w.id === 9);

      state.zones[6].widgets.length.should.eq(1);
      state.zones[9].widgets.length.should.eq(1);
      expect(w6).to.exist;
      expect(w9).to.exist;
    });

    it("should unmerge widget 6 from zone 4 (and leave zone 5 empty)", () => {
      const props = {
        ...merged6To4Props,
        draggingWidgetId: 6,
      };
      const state = new StateManagement().unmergeDrop(6, props);

      const z4 = state.zones[4];
      const z6 = state.zones[6];

      const w4 = z4.widgets.find((w) => w.id === 4);
      const w6 = z6.widgets.find((w) => w.id === 6);

      z4.widgets.length.should.eq(1);
      z6.widgets.length.should.eq(1);
      expect(w4).to.exist;
      expect(w6).to.exist;

      z4.bounds.left.should.eq(5);
      z4.bounds.top.should.eq(20);
      z4.bounds.right.should.eq(45);
      z4.bounds.bottom.should.eq(30);

      z6.bounds.left.should.eq(85);
      z6.bounds.top.should.eq(20);
      z6.bounds.right.should.eq(125);
      z6.bounds.bottom.should.eq(30);
    });

    it("should unmerge widget 6 to zone 9 (widgets 9 and 6 in zone 6)", () => {
      const props = {
        ...merged9And6To6Props,
        draggingWidgetId: 6,
      };
      const state = new StateManagement().unmergeDrop(6, props);

      const w6 = state.zones[9].widgets.find((w) => w.id === 6);
      const w9 = state.zones[6].widgets.find((w) => w.id === 9);

      state.zones[6].widgets.length.should.eq(1);
      state.zones[9].widgets.length.should.eq(1);
      expect(w6).to.exist;
      expect(w9).to.exist;
    });

    it("widgets 6, 9 and 3 in zone 6 should unmerge: (widgets 3, 6 to zone 3), (widget 9 to zone 9)", () => {
      const props = {
        ...merged9And3To6Props,
        draggingWidgetId: 9,
      };
      const state = new StateManagement().unmergeDrop(3, props);

      const w3 = state.zones[3].widgets.find((w) => w.id === 3);
      const w6 = state.zones[3].widgets.find((w) => w.id === 6);
      const w9 = state.zones[9].widgets.find((w) => w.id === 9);

      state.zones[3].widgets.length.should.eq(2);
      state.zones[9].widgets.length.should.eq(1);

      expect(w3).to.exist;
      expect(w6).to.exist;
      expect(w9).to.exist;
    });

    it("widgets 6, 9 and 3 in zone 6 should unmerge: (w6 to z3), (w9 to z6), (w3 to z9)", () => {
      const props = {
        ...merged9And3To6Props,
        draggingWidgetId: 9,
      };
      const state = new StateManagement().unmergeDrop(9, props);

      const w3 = state.zones[9].widgets.find((w) => w.id === 3);
      const w6 = state.zones[3].widgets.find((w) => w.id === 6);
      const w9 = state.zones[6].widgets.find((w) => w.id === 9);

      state.zones[3].widgets.length.should.eq(1);
      state.zones[6].widgets.length.should.eq(1);
      state.zones[9].widgets.length.should.eq(1);

      expect(w3).to.exist;
      expect(w6).to.exist;
      expect(w9).to.exist;
    });

    it("should unmerge widget 9 from zone 7 (and leave zone 8 empty if is in footer state)", () => {
      const props = {
        ...merged9To7Props,
        draggingWidgetId: 9,
      };
      const state = new StateManagement().unmergeDrop(9, props);

      const z7 = state.zones[7];
      const z9 = state.zones[9];

      const w7 = z7.widgets.find((w) => w.id === 7);
      const w9 = z9.widgets.find((w) => w.id === 9);

      z7.widgets.length.should.eq(1);
      z9.widgets.length.should.eq(1);
      expect(w7).to.exist;
      expect(w9).to.exist;

      z7.bounds.left.should.eq(5);
      z7.bounds.top.should.eq(20);
      z7.bounds.right.should.eq(45);
      z7.bounds.bottom.should.eq(30);

      z9.bounds.left.should.eq(85);
      z9.bounds.top.should.eq(20);
      z9.bounds.right.should.eq(125);
      z9.bounds.bottom.should.eq(30);
    });

    it("should set defaultZoneId when swapping zones vertically", () => {
      const props = {
        ...merged9To6Props,
        draggingWidgetId: 6,
      };
      const state = new StateManagement().unmergeDrop(9, props);

      expect(state.zones[6].widgets[0].defaultZoneId).to.eq(6);
      expect(state.zones[9].widgets[0].defaultZoneId).to.eq(9);
    });

    it("should set defaultZoneId when swapping zones horizontally", () => {
      const props = {
        ...merged6To4Props,
        draggingWidgetId: 4,
      };
      const state = new StateManagement().unmergeDrop(6, props);

      expect(state.zones[4].widgets[0].defaultZoneId).to.eq(4);
      expect(state.zones[6].widgets[0].defaultZoneId).to.eq(6);
    });

    it("widgets 3, 6 and 4 in zone 3 should unmerge: (w3 to z3), (w4 to z6), (w6 to z9)", () => {
      const props = {
        ...merged6And4To3Props,
        draggingWidgetId: 4,
      };
      const state = new StateManagement().unmergeDrop(6, props);

      const w3 = state.zones[3].widgets.find((w) => w.id === 3);
      const w4 = state.zones[6].widgets.find((w) => w.id === 4);
      const w6 = state.zones[9].widgets.find((w) => w.id === 6);

      state.zones[3].widgets.length.should.eq(1);
      state.zones[6].widgets.length.should.eq(1);
      state.zones[9].widgets.length.should.eq(1);

      expect(w3).to.exist;
      expect(w4).to.exist;
      expect(w6).to.exist;
    });
  });

  describe("onWidgetTabDrag", () => {
    it("should move zone to which the widget is merged", () => {
      const props = {
        ...defaultProps,
        zones: {
          ...defaultProps.zones,
          [6]: {
            ...defaultProps.zones[6],
            floatingBounds: {
              left: 1,
              top: 2,
              right: 10,
              bottom: 20,
            },
            widgets: [
              {
                id: 6,
                tabIndex: 1,
              },
              {
                id: 9,
                tabIndex: -1,
              },
            ],
          },
          [9]: {
            ...defaultProps.zones[9],
            widgets: [],
          },
        },
        draggingWidgetId: 9,
      };
      const state = new StateManagement().onWidgetTabDrag({ x: 5, y: -9 }, props);

      expect(state.zones[6].floatingBounds);
      const bounds = state.zones[6].floatingBounds as RectangleProps;
      bounds.left.should.eq(6);
      bounds.top.should.eq(-7);
      bounds.right.should.eq(15);
      bounds.bottom.should.eq(11);
    });
  });

  describe("onChangeDragBehavior", () => {
    it("should set floating bounds", () => {
      const state = new StateManagement().changeDraggingWidget(6, true, openedZone6Props);

      expect(state.zones[6].floatingBounds);
      const floatingBounds = state.zones[6].floatingBounds as RectangleProps;
      floatingBounds.top.should.eq(20);
      floatingBounds.right.should.eq(99);
      floatingBounds.bottom.should.eq(54);
    });
  });

  describe("onTargetChanged", () => {
    it("should change the target", () => {
      const props = {
        ...openedZone6Props,
        draggingWidgetId: 9,
      };
      const state = new StateManagement().onTargetChanged(9, DropTarget.Merge, props);

      expect(state.targetedZone).exist;
      state.targetedZone!.widgetId.should.eq(9);
    });
  });

  describe("getGhostOutlineBounds", () => {
    it("should get merge dragging zone bounds (vertical)", () => {
      const props = {
        ...openedZone6Props,
        draggingWidgetId: 9,
        targetedZone: {
          widgetId: 9,
          target: DropTarget.Merge,
        },
      };
      const bounds = new StateManagement().getGhostOutlineBounds(9, props);

      expect(bounds).to.exist;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(54);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(110);
    });

    it("should set dragging zone bounds (horizontal)", () => {
      const props = {
        ...openedZone6Props,
        draggingWidgetId: 6,
        targetedZone: {
          widgetId: 4,
          target: DropTarget.Merge,
        },
      };
      const bounds = new StateManagement().getGhostOutlineBounds(4, props);

      expect(bounds).to.exist;
      bounds!.left.should.eq(0);
      bounds!.top.should.eq(20);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(54);
    });

    it("should merge dragging zone bounds to target", () => {
      const props = {
        ...openedZone6Props,
        draggingWidgetId: 9,
        targetedZone: {
          widgetId: 6,
          target: DropTarget.Merge,
        },
      };
      const bounds = new StateManagement().getGhostOutlineBounds(6, props);

      expect(bounds).to.exist;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(20);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(110);
    });

    it("should set dragging zone bounds for swapped widgets", () => {
      const props = {
        ...swapped6and9Props,
        draggingWidgetId: 6,
        targetedZone: {
          widgetId: 6,
          target: DropTarget.Merge,
        },
      };
      const bounds = new StateManagement().getGhostOutlineBounds(6, props);

      expect(bounds).to.exist;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(54);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(110);
    });

    it("should set unmerge dragging zone bounds for 2 vertically merged widgets", () => {
      const props = {
        ...merged9And6To6Props,
        draggingWidgetId: 6,
        targetedZone: {
          widgetId: 6,
          target: DropTarget.Unmerge,
        },
      };
      const z6 = new StateManagement().getGhostOutlineBounds(6, props);
      const z9 = new StateManagement().getGhostOutlineBounds(9, props);

      expect(z6).to.exist;
      z6!.left.should.eq(10);
      z6!.top.should.eq(20);
      z6!.right.should.eq(99);
      z6!.bottom.should.eq(65);

      expect(z9).to.exist;
      z9!.left.should.eq(10);
      z9!.top.should.eq(65);
      z9!.right.should.eq(99);
      z9!.bottom.should.eq(110);
    });

    it("should set dragging zone bounds for zones 3, 6 and 9", () => {
      const props = {
        ...merged9And3To6Props,
        draggingWidgetId: 3,
        targetedZone: {
          widgetId: 9,
          target: DropTarget.Unmerge,
        },
      };
      const z3 = new StateManagement().getGhostOutlineBounds(3, props);
      const z6 = new StateManagement().getGhostOutlineBounds(6, props);
      const z9 = new StateManagement().getGhostOutlineBounds(9, props);

      expect(z3).to.exist;
      z3!.left.should.eq(10);
      z3!.top.should.eq(2);
      z3!.right.should.eq(99);
      z3!.bottom.should.eq(38);

      expect(z6).to.exist;
      z6!.left.should.eq(10);
      z6!.top.should.eq(38);
      z6!.right.should.eq(99);
      z6!.bottom.should.eq(74);

      expect(z9).to.exist;
      z9!.left.should.eq(10);
      z9!.top.should.eq(74);
      z9!.right.should.eq(99);
      z9!.bottom.should.eq(110);
    });

    it("should set dragging zone bounds for: merged 3, 6 and unmerged 9", () => {
      const props = {
        ...merged9And3To6Props,
        draggingWidgetId: 3,
        targetedZone: {
          widgetId: 3,
          target: DropTarget.Unmerge,
        },
      };
      const z3 = new StateManagement().getGhostOutlineBounds(3, props);
      const z9 = new StateManagement().getGhostOutlineBounds(9, props);

      expect(z3).to.exist;
      z3!.left.should.eq(10);
      z3!.top.should.eq(2);
      z3!.right.should.eq(99);
      z3!.bottom.should.eq(74);

      expect(z9).to.exist;
      z9!.left.should.eq(10);
      z9!.top.should.eq(74);
      z9!.right.should.eq(99);
      z9!.bottom.should.eq(110);
    });

    it("should set unmerge dragging zone bounds for 2 horizontally merged widgets", () => {
      const props = {
        ...merged3To2Props,
        draggingWidgetId: 3,
        targetedZone: {
          widgetId: 3,
          target: DropTarget.Unmerge,
        },
      };
      const z2 = new StateManagement().getGhostOutlineBounds(2, props);
      const z3 = new StateManagement().getGhostOutlineBounds(3, props);

      expect(z2).to.exist;
      z2!.left.should.eq(55);
      z2!.top.should.eq(20);
      z2!.right.should.eq(90);
      z2!.bottom.should.eq(30);

      expect(z3).to.exist;
      z3!.left.should.eq(90);
      z3!.top.should.eq(20);
      z3!.right.should.eq(125);
      z3!.bottom.should.eq(30);
    });

    it("should set unmerge dragging zone bounds for zone 4 and 6", () => {
      const props = {
        ...merged6To4Props,
        draggingWidgetId: 6,
        targetedZone: {
          widgetId: 6,
          target: DropTarget.Unmerge,
        },
      };
      const z4 = new StateManagement().getGhostOutlineBounds(4, props);
      const z6 = new StateManagement().getGhostOutlineBounds(6, props);

      expect(z4).to.exist;
      z4!.left.should.eq(5);
      z4!.top.should.eq(20);
      z4!.right.should.eq(45);
      z4!.bottom.should.eq(30);

      expect(z6).to.exist;
      z6!.left.should.eq(85);
      z6!.top.should.eq(20);
      z6!.right.should.eq(125);
      z6!.bottom.should.eq(30);
    });

    it("should set unmerge dragging zone bounds for zone 7 and 9 in footer mode", () => {
      const props = {
        ...merged9To7Props,
        draggingWidgetId: 9,
        targetedZone: {
          widgetId: 9,
          target: DropTarget.Unmerge,
        },
      };
      const z7 = new StateManagement().getGhostOutlineBounds(7, props);
      const z9 = new StateManagement().getGhostOutlineBounds(9, props);

      expect(z7).to.exist;
      z7!.left.should.eq(5);
      z7!.top.should.eq(20);
      z7!.right.should.eq(45);
      z7!.bottom.should.eq(30);

      expect(z9).to.exist;
      z9!.left.should.eq(85);
      z9!.top.should.eq(20);
      z9!.right.should.eq(125);
      z9!.bottom.should.eq(30);
    });
  });
});
