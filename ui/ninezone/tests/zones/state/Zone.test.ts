/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import TestProps from "./TestProps";
import { TargetType } from "../../../src/zones/state/Target";
import NineZone, { NineZoneProps } from "../../../src/zones/state/NineZone";
import { DropTarget } from "../../../src/zones/state/Zone";

// use expect, because dirty-chai ruins the should.exist() helpers
const expect = chai.expect;

describe("Zone", () => {
  it("should have correct cell", () => {
    const sut = new NineZone(TestProps.defaultProps);

    const zone1 = sut.getZone(1);
    zone1.cell.row.should.eq(0);
    zone1.cell.col.should.eq(0);

    const zone2 = sut.getZone(2);
    zone2.cell.row.should.eq(0);
    zone2.cell.col.should.eq(1);

    const zone3 = sut.getZone(3);
    zone3.cell.row.should.eq(0);
    zone3.cell.col.should.eq(2);

    const zone4 = sut.getZone(4);
    zone4.cell.row.should.eq(1);
    zone4.cell.col.should.eq(0);

    const zone6 = sut.getZone(6);
    zone6.cell.row.should.eq(1);
    zone6.cell.col.should.eq(2);

    const zone7 = sut.getZone(7);
    zone7.cell.row.should.eq(2);
    zone7.cell.col.should.eq(0);

    const zone8 = sut.getZone(8);
    zone8.cell.row.should.eq(2);
    zone8.cell.col.should.eq(1);

    const zone9 = sut.getZone(9);
    zone9.cell.row.should.eq(2);
    zone9.cell.col.should.eq(2);
  });

  describe("getGhostOutlineBounds", () => {
    it("should get merge dragging zone bounds (vertical)", () => {
      const props: NineZoneProps = {
        ...TestProps.openedZone6,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 9,
          type: TargetType.Merge,
        },
      };
      const bounds = new NineZone(props).getWidgetZone(9).getGhostOutlineBounds();

      expect(bounds).exist;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(54);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(110);
    });

    it("should set dragging zone bounds (horizontal)", () => {
      const props: NineZoneProps = {
        ...TestProps.openedZone6,
        draggingWidget: { id: 6, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 4,
          type: TargetType.Merge,
        },
      };
      const bounds = new NineZone(props).getWidgetZone(4).getGhostOutlineBounds();

      expect(bounds).exist;
      bounds!.left.should.eq(0);
      bounds!.top.should.eq(20);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(54);
    });

    it("should merge dragging zone bounds to target", () => {
      const props: NineZoneProps = {
        ...TestProps.openedZone6,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: TargetType.Merge,
        },
      };
      const bounds = new NineZone(props).getWidgetZone(6).getGhostOutlineBounds();

      expect(bounds).exist;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(20);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(110);
    });

    it("should set unmerge dragging zone bounds for 2 vertically merged widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9And6To6,
        draggingWidget: { id: 6, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: TargetType.Back,
        },
      };
      const nineZone = new NineZone(props);
      const z6 = nineZone.getWidgetZone(6).getGhostOutlineBounds();
      const z9 = nineZone.getWidgetZone(9).getGhostOutlineBounds();

      expect(z6).exist;
      z6!.left.should.eq(10);
      z6!.top.should.eq(20);
      z6!.right.should.eq(99);
      z6!.bottom.should.eq(65);

      expect(z9).exist;
      z9!.left.should.eq(10);
      z9!.top.should.eq(65);
      z9!.right.should.eq(99);
      z9!.bottom.should.eq(110);
    });

    it("should set dragging zone bounds for zones 3, 6 and 9", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9And3To6,
        draggingWidget: { id: 3, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 9,
          type: TargetType.Back,
        },
      };
      const nineZone = new NineZone(props);
      const z3 = nineZone.getWidgetZone(3).getGhostOutlineBounds();
      const z6 = nineZone.getWidgetZone(6).getGhostOutlineBounds();
      const z9 = nineZone.getWidgetZone(9).getGhostOutlineBounds();

      expect(z3).exist;
      z3!.left.should.eq(10);
      z3!.top.should.eq(2);
      z3!.right.should.eq(99);
      z3!.bottom.should.eq(38);

      expect(z6).exist;
      z6!.left.should.eq(10);
      z6!.top.should.eq(38);
      z6!.right.should.eq(99);
      z6!.bottom.should.eq(74);

      expect(z9).exist;
      z9!.left.should.eq(10);
      z9!.top.should.eq(74);
      z9!.right.should.eq(99);
      z9!.bottom.should.eq(110);
    });

    it("should set unmerge dragging zone bounds for 2 horizontally merged widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.merged3To2,
        draggingWidget: { id: 3, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 3,
          type: TargetType.Back,
        },
      };
      const nineZone = new NineZone(props);
      const z2 = nineZone.getWidgetZone(2).getGhostOutlineBounds();
      const z3 = nineZone.getWidgetZone(3).getGhostOutlineBounds();

      expect(z2).exist;
      z2!.left.should.eq(55);
      z2!.top.should.eq(20);
      z2!.right.should.eq(90);
      z2!.bottom.should.eq(30);

      expect(z3).exist;
      z3!.left.should.eq(90);
      z3!.top.should.eq(20);
      z3!.right.should.eq(125);
      z3!.bottom.should.eq(30);
    });

    it("should set unmerge dragging zone bounds for zone 4 and 6", () => {
      const props: NineZoneProps = {
        ...TestProps.merged6To4,
        draggingWidget: { id: 6, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: TargetType.Back,
        },
      };
      const nineZone = new NineZone(props);
      const z4 = nineZone.getWidgetZone(4).getGhostOutlineBounds();
      const z6 = nineZone.getWidgetZone(6).getGhostOutlineBounds();

      expect(z4).exist;
      z4!.left.should.eq(5);
      z4!.top.should.eq(20);
      z4!.right.should.eq(45);
      z4!.bottom.should.eq(30);

      expect(z6).exist;
      z6!.left.should.eq(85);
      z6!.top.should.eq(20);
      z6!.right.should.eq(125);
      z6!.bottom.should.eq(30);
    });

    it("should set unmerge dragging zone bounds for zone 7 and 9 in footer mode", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To7,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 9,
          type: TargetType.Back,
        },
      };
      const nineZone = new NineZone(props);
      const z7 = nineZone.getWidgetZone(7).getGhostOutlineBounds();
      const z9 = nineZone.getWidgetZone(9).getGhostOutlineBounds();

      expect(z7).exist;
      z7!.left.should.eq(5);
      z7!.top.should.eq(20);
      z7!.right.should.eq(45);
      z7!.bottom.should.eq(30);

      expect(z9).exist;
      z9!.left.should.eq(85);
      z9!.top.should.eq(20);
      z9!.right.should.eq(125);
      z9!.bottom.should.eq(30);
    });
  });

  describe("getDropTarget", () => {
    it("should return merge drop target for adjacent zone in same row", () => {
      const props: NineZoneProps = {
        ...TestProps.inWidgetMode,
        draggingWidget: { id: 7, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };

      new NineZone(props).getWidgetZone(8).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for adjacent zone in same col", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 1, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      new NineZone(props).getWidgetZone(4).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for distant zone in same row", () => {
      const props: NineZoneProps = {
        ...TestProps.inWidgetMode,
        draggingWidget: { id: 7, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      new NineZone(props).getWidgetZone(9).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for distant zone in same col", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 1, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      new NineZone(props).getWidgetZone(7).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return back drop target for same zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 4, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      new NineZone(props).getWidgetZone(4).getDropTarget().should.eq(DropTarget.Back);
    });

    it("should return no drop target for zones merged diagonally", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 8, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const nineZone = new NineZone(props);
      nineZone.getWidgetZone(1).getDropTarget().should.eq(DropTarget.None);
      nineZone.getWidgetZone(4).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no horizontal target if dragging vertically merged zone", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To6,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      new NineZone(props).getWidgetZone(7).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return merge target for horizontal zone", () => {
      const props: NineZoneProps = {
        ...TestProps.inWidgetMode,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      new NineZone(props).getWidgetZone(7).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge target for first widget in zone with multiple widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To8,
        draggingWidget: { id: 7, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        zones: {
          ...TestProps.merged9To8.zones,
          8: {
            ...TestProps.merged9To8.zones[8],
            isInFooterMode: false,
          },
        },
      };
      const nineZone = new NineZone(props);
      nineZone.getWidgetZone(7).getDropTarget().should.eq(DropTarget.Back, "w7");
      nineZone.getWidgetZone(8).getDropTarget().should.eq(DropTarget.Merge, "w8");
      nineZone.getWidgetZone(9).getDropTarget().should.eq(DropTarget.None, "w9");
    });

    it("should return no merge target if target widget is merged horizontally", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To7,
        draggingWidget: { id: 4, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      new NineZone(props).getWidgetZone(7).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no drop target for zones around unmergeable zone (content)", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 6, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      new NineZone(props).getWidgetZone(4).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no drop target for zones around unmergeable zone (footer)", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      new NineZone(props).getWidgetZone(7).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no drop target for non mergeable zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 4, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };

      new NineZone(props).getWidgetZone(1).getDropTarget().should.eq(DropTarget.None);
    });
  });
});
