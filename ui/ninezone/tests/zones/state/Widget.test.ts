/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import TestProps from "./TestProps";
import NineZone, { NineZoneProps } from "@src/zones/state/NineZone";
import { DropTarget } from "@src/zones/state/Widget";

describe("Widget", () => {
  describe("getDropTarget", () => {
    it("should return merge drop target for adjacent zone in same row", () => {
      const props: NineZoneProps = {
        ...TestProps.inWidgetMode,
        draggingWidget: { id: 7, lastPosition: { x: 0, y: 0, }, },
      };

      new NineZone(props).getWidget(8).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for adjacent zone in same col", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 1, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(4).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for distant zone in same row", () => {
      const props: NineZoneProps = {
        ...TestProps.inWidgetMode,
        draggingWidget: { id: 7, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(9).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge drop target for distant zone in same col", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 1, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return back drop target for same zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 4, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(4).getDropTarget().should.eq(DropTarget.Back);
    });

    it("should return no drop target for zones merged diagonally", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 8, lastPosition: { x: 0, y: 0, }, },
      };
      const nineZone = new NineZone(props);
      nineZone.getWidget(1).getDropTarget().should.eq(DropTarget.None);
      nineZone.getWidget(4).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return back target", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To6,
        draggingWidget: { id: 9, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(9).getDropTarget().should.eq(DropTarget.Back);
    });

    it("should return no horizontal target if dragging vertically merged zone", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To6,
        draggingWidget: { id: 9, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return merge target for horizontal zone", () => {
      const props: NineZoneProps = {
        ...TestProps.inWidgetMode,
        draggingWidget: { id: 9, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge target for first widget in zone with multiple widgets", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To8,
        draggingWidget: { id: 7, lastPosition: { x: 0, y: 0, }, },
        zones: {
          ...TestProps.merged9To8.zones,
          8: {
            ...TestProps.merged9To8.zones[8],
            isInFooterMode: false,
          },
        },
      };
      const nineZone = new NineZone(props);
      nineZone.getWidget(7).getDropTarget().should.eq(DropTarget.Back, "w7");
      nineZone.getWidget(8).getDropTarget().should.eq(DropTarget.Merge, "w8");
      nineZone.getWidget(9).getDropTarget().should.eq(DropTarget.None, "w9");
    });

    it("should return no merge target for zone 4 if dragging widget 6 in zone 9", () => {
      const props: NineZoneProps = {
        ...TestProps.swapped6and9,
        draggingWidget: { id: 6, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(4).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no merge target if target widget is merged horizontally", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To7,
        draggingWidget: { id: 4, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no drop target for zones around unmergeable zone (content)", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 6, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(4).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no drop target for zones around unmergeable zone (footer)", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 9, lastPosition: { x: 0, y: 0, }, },
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no drop target for non mergeable zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 4, lastPosition: { x: 0, y: 0, }, },
      };

      new NineZone(props).getWidget(1).getDropTarget().should.eq(DropTarget.None);
    });
  });
});
