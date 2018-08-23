/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { UnmergeCell, CellType } from "@src/zones/target/Unmerge";
import TestProps from "./TestProps";
import NineZone, { NineZoneProps } from "@src/zones/state/NineZone";
import { DropTarget } from "@src/zones/state/Widget";

// use expect, because dirty-chai ruins the should.exist() helpers
const expect = chai.expect;

describe("Widget", () => {
  describe("getDropTarget", () => {
    it("should return merge drop target for adjacent zone in same row", () => {
      const props: NineZoneProps = {
        ...TestProps.inWidgetMode,
        draggingWidgetId: 7,
      };

      new NineZone(props).getWidget(8).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for adjacent zone in same col", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 1,
      };
      new NineZone(props).getWidget(4).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for distant zone in same row", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 7,
      };
      new NineZone(props).getWidget(9).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for distant zone in same col", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 1,
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for same zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 4,
      };
      new NineZone(props).getWidget(4).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for swapped zones", () => {
      const props: NineZoneProps = {
        ...TestProps.swapped6and9,
        draggingWidgetId: 6,
      };
      const nineZone = new NineZone(props);
      nineZone.getWidget(6).getDropTarget().should.eq(DropTarget.Merge);
      nineZone.getWidget(9).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return no drop target for zones merged diagonally", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 8,
      };
      const nineZone = new NineZone(props);
      nineZone.getWidget(1).getDropTarget().should.eq(DropTarget.None);
      nineZone.getWidget(4).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return unmerge target", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To6,
        draggingWidgetId: 9,
      };
      new NineZone(props).getWidget(9).getDropTarget().should.eq(DropTarget.Unmerge);
    });

    it("should return no horizontal target if dragging vertically merged zone", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To6,
        draggingWidgetId: 9,
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return merge target for horizontal zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 9,
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge target for horizontal zone (swapped widgets)", () => {
      const props: NineZoneProps = {
        ...TestProps.swapped6and9,
        draggingWidgetId: 6,
      };
      new NineZone(props).getWidget(6).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge target for first widget in zone with multiple widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To8,
        draggingWidgetId: 7,
        zones: {
          ...TestProps.merged9To8.zones,
          8: {
            ...TestProps.merged9To8.zones[8],
            isInFooterMode: false,
          },
        },
      };
      const nineZone = new NineZone(props);
      nineZone.getWidget(7).getDropTarget().should.eq(DropTarget.Merge, "w7");
      nineZone.getWidget(8).getDropTarget().should.eq(DropTarget.Merge, "w8");
      nineZone.getWidget(9).getDropTarget().should.eq(DropTarget.None, "w9");
    });

    it("should return no merge target for zone 4 if dragging widget 6 in zone 9", () => {
      const props: NineZoneProps = {
        ...TestProps.swapped6and9,
        draggingWidgetId: 6,
      };
      new NineZone(props).getWidget(4).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no merge target if target widget is merged horizontally", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To7,
        draggingWidgetId: 4,
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no drop target for zones around zone5", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 6,
      };
      new NineZone(props).getWidget(4).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no drop target for non mergeable zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 4,
      };

      new NineZone(props).getWidget(1).getDropTarget().should.eq(DropTarget.None);
    });
  });

  describe("getMergeTargetCells", () => {
    it("should get target cells for same zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 9,
      };
      const cells = new NineZone(props).getWidget(9).getMergeTargetCells();

      cells.length.should.eq(1);
      cells[0].col.should.eq(2);
      cells[0].row.should.eq(2);
    });

    it("should get target cells for vertically adjacent zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 6,
      };
      const cells = new NineZone(props).getWidget(9).getMergeTargetCells();
      cells.length.should.eq(2);
    });

    it("should get target cells for horizontally adjacent zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 3,
      };
      const cells = new NineZone(props).getWidget(2).getMergeTargetCells();
      cells.length.should.eq(2);
    });

    it("should get target cells for horizontal zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 6,
      };
      const cells = new NineZone(props).getWidget(4).getMergeTargetCells();
      cells.length.should.eq(3);
    });

    it("should get target cells for vertical zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 6,
      };
      const cells = new NineZone(props).getWidget(4).getMergeTargetCells();
      cells.length.should.eq(3);
    });

    it("should get target cells for vertical zone (swapped zones)", () => {
      const props: NineZoneProps = {
        ...TestProps.swapped6and9,
        draggingWidgetId: 9,
      };
      const cells = new NineZone(props).getWidget(4).getMergeTargetCells();
      cells.length.should.eq(3);
    });

    it("should get target cells if dragging zone has merged widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To6,
        draggingWidgetId: 6,
      };
      const cells = new NineZone(props).getWidget(6).getMergeTargetCells();
      const z6 = cells.find((c) => c.col === 2 && c.row === 1);
      const z9 = cells.find((c) => c.col === 2 && c.row === 2);

      cells.length.should.eq(2);
      expect(z6).to.exist;
      expect(z9).to.exist;
    });

    it("should get target cell for swapped widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.swapped6and9,
        draggingWidgetId: 6,
      };
      const cells = new NineZone(props).getWidget(6).getMergeTargetCells();
      cells.length.should.eq(1);
    });

    it("should get correct target cell for swapped widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.swapped6and9,
        draggingWidgetId: 6,
      };
      const cells = new NineZone(props).getWidget(6).getMergeTargetCells();
      cells[0].col.should.eq(2);
      cells[0].row.should.eq(2);
    });

    it("should get target cells for swapped widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.swapped6and9,
        draggingWidgetId: 6,
      };
      const cells = new NineZone(props).getWidget(9).getMergeTargetCells();
      cells.length.should.eq(2);
    });

    it("should get target cells with zone 5", () => {
      const props: NineZoneProps = {
        ...TestProps.merged6To4,
        draggingWidgetId: 6,
      };
      const cells = new NineZone(props).getWidget(4).getMergeTargetCells();
      cells.length.should.eq(3);

      expect(cells.find((c) => c.col === 0 && c.row === 1)).to.exist;
      expect(cells.find((c) => c.col === 1 && c.row === 1)).to.exist;
      expect(cells.find((c) => c.col === 2 && c.row === 1)).to.exist;
    });

    it("should get target cells with zone 8 if is in footer mode", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To7,
        draggingWidgetId: 9,
      };
      const cells = new NineZone(props).getWidget(7).getMergeTargetCells();
      cells.length.should.eq(3);

      expect(cells.find((c) => c.col === 0 && c.row === 2)).to.exist;
      expect(cells.find((c) => c.col === 1 && c.row === 2)).to.exist;
      expect(cells.find((c) => c.col === 2 && c.row === 2)).to.exist;
    });

    it("should get cells based on widget zone", () => {
      const props: NineZoneProps = {
        ...TestProps.merged4To9,
        draggingWidgetId: 9,
      };
      const cells = new NineZone(props).getWidget(9).getMergeTargetCells();
      cells.length.should.eq(2);

      expect(cells.find((c) => c.col === 2 && c.row === 1)).to.exist;
      expect(cells.find((c) => c.col === 2 && c.row === 2)).to.exist;
    });
  });

  describe("getUnmergeTargetCells", () => {
    it("should get unmerge target cells for merged widget", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To6,
        draggingWidgetId: 9,
      };
      const cells = new NineZone(props).getWidget(9).getUnmergeTargetCells();
      const z6 = cells.find((c) => c.col === 2 && c.row === 1);
      const z9 = cells.find((c) => c.col === 2 && c.row === 2);

      cells.length.should.eq(2);
      expect(z6).to.exist;
      expect(z9).to.exist;
    });

    it("should get unmerge target with all cells unmerged", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9And3To6,
        draggingWidgetId: 9,
      };
      const cells = new NineZone(props).getWidget(9).getUnmergeTargetCells();

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
      const props: NineZoneProps = {
        ...TestProps.merged9And3To6,
        draggingWidgetId: 9,
      };
      const cells = new NineZone(props).getWidget(3).getUnmergeTargetCells();
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
});
