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
        ...TestProps.inWidgetMode,
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
        ...TestProps.inWidgetMode,
        draggingWidgetId: 9,
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.Merge);
    });

    it("should return merge target for vertical zone (swapped widgets)", () => {
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

    it("should return no drop target for zones around unmergeable zone (content)", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 6,
      };
      new NineZone(props).getWidget(4).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no drop target for zones around unmergeable zone (footer)", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 9,
      };
      new NineZone(props).getWidget(7).getDropTarget().should.eq(DropTarget.None);
    });

    it("should return no drop target for non mergeable zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidgetId: 4,
      };

      new NineZone(props).getWidget(1).getDropTarget().should.eq(DropTarget.None);
    });
  });
});
