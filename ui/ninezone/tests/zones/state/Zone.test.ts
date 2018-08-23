/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import TestProps from "./TestProps";
import { TargetType } from "@src/zones/state/Target";
import NineZone, { NineZoneProps } from "@src/zones/state/NineZone";

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
        draggingWidgetId: 9,
        target: {
          widgetId: 9,
          type: TargetType.Merge,
        },
      };
      const bounds = new NineZone(props).getWidgetZone(9).getGhostOutlineBounds();

      expect(bounds).to.exist;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(54);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(110);
    });

    it("should set dragging zone bounds (horizontal)", () => {
      const props: NineZoneProps = {
        ...TestProps.openedZone6,
        draggingWidgetId: 6,
        target: {
          widgetId: 4,
          type: TargetType.Merge,
        },
      };
      const bounds = new NineZone(props).getWidgetZone(4).getGhostOutlineBounds();

      expect(bounds).to.exist;
      bounds!.left.should.eq(0);
      bounds!.top.should.eq(20);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(54);
    });

    it("should merge dragging zone bounds to target", () => {
      const props: NineZoneProps = {
        ...TestProps.openedZone6,
        draggingWidgetId: 9,
        target: {
          widgetId: 6,
          type: TargetType.Merge,
        },
      };
      const bounds = new NineZone(props).getWidgetZone(6).getGhostOutlineBounds();

      expect(bounds).to.exist;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(20);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(110);
    });

    it("should set dragging zone bounds for swapped widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.swapped6and9,
        draggingWidgetId: 6,
        target: {
          widgetId: 6,
          type: TargetType.Merge,
        },
      };
      const bounds = new NineZone(props).getWidgetZone(6).getGhostOutlineBounds();

      expect(bounds).to.exist;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(54);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(110);
    });

    it("should set unmerge dragging zone bounds for 2 vertically merged widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9And6To6,
        draggingWidgetId: 6,
        target: {
          widgetId: 6,
          type: TargetType.Unmerge,
        },
      };
      const nineZone = new NineZone(props);
      const z6 = nineZone.getWidgetZone(6).getGhostOutlineBounds();
      const z9 = nineZone.getWidgetZone(9).getGhostOutlineBounds();

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
      const props: NineZoneProps = {
        ...TestProps.merged9And3To6,
        draggingWidgetId: 3,
        target: {
          widgetId: 9,
          type: TargetType.Unmerge,
        },
      };
      const nineZone = new NineZone(props);
      const z3 = nineZone.getWidgetZone(3).getGhostOutlineBounds();
      const z6 = nineZone.getWidgetZone(6).getGhostOutlineBounds();
      const z9 = nineZone.getWidgetZone(9).getGhostOutlineBounds();

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
      const props: NineZoneProps = {
        ...TestProps.merged9And3To6,
        draggingWidgetId: 3,
        target: {
          widgetId: 3,
          type: TargetType.Unmerge,
        },
      };
      const nineZone = new NineZone(props);
      const z3 = nineZone.getWidgetZone(3).getGhostOutlineBounds();
      const z9 = nineZone.getWidgetZone(9).getGhostOutlineBounds();

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
      const props: NineZoneProps = {
        ...TestProps.merged3To2,
        draggingWidgetId: 3,
        target: {
          widgetId: 3,
          type: TargetType.Unmerge,
        },
      };
      const nineZone = new NineZone(props);
      const z2 = nineZone.getWidgetZone(2).getGhostOutlineBounds();
      const z3 = nineZone.getWidgetZone(3).getGhostOutlineBounds();

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
      const props: NineZoneProps = {
        ...TestProps.merged6To4,
        draggingWidgetId: 6,
        target: {
          widgetId: 6,
          type: TargetType.Unmerge,
        },
      };
      const nineZone = new NineZone(props);
      const z4 = nineZone.getWidgetZone(4).getGhostOutlineBounds();
      const z6 = nineZone.getWidgetZone(6).getGhostOutlineBounds();

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
      const props: NineZoneProps = {
        ...TestProps.merged9To7,
        draggingWidgetId: 9,
        target: {
          widgetId: 9,
          type: TargetType.Unmerge,
        },
      };
      const nineZone = new NineZone(props);
      const z7 = nineZone.getWidgetZone(7).getGhostOutlineBounds();
      const z9 = nineZone.getWidgetZone(9).getGhostOutlineBounds();

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
