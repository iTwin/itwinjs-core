/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { RectangleProps } from "@src/utilities/Rectangle";
import DefaultStateManager, { StateManager } from "@src/zones/state/Manager";
import TestProps from "./TestProps";
import { TargetType } from "@src/zones/state/Target";

// use expect, because dirty-chai ruins the should.exist() helpers
const expect = chai.expect;

describe("StateManager", () => {
  it("should construct an instance", () => {
    new StateManager();
  });

  describe("handleTabClick", () => {
    it("should open widget", () => {
      const state = DefaultStateManager.handleTabClick(6, 33, TestProps.defaultProps);
      state.zones[6].widgets[0].tabIndex.should.eq(33);
    });

    it("should change tab", () => {
      const state = DefaultStateManager.handleTabClick(6, 13, TestProps.openedZone6);
      state.zones[6].widgets[0].tabIndex.should.eq(13);
    });

    it("should close widget", () => {
      const state = DefaultStateManager.handleTabClick(6, 14, TestProps.openedZone6);
      state.zones[6].widgets[0].tabIndex.should.eq(-1);
    });

    it("should not close widget when zone is floating", () => {
      const state = DefaultStateManager.handleTabClick(6, 14, TestProps.floatingOpenedZone6);

      state.zones[6].widgets[0].tabIndex.should.eq(14);
    });
  });

  describe("mergeDrop", () => {
    it("should merge zones", () => {
      const props = {
        ...TestProps.openedZone6,
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.mergeDrop(6, props);

      state.zones[6].widgets.length.should.eq(2);
      const w6 = state.zones[6].widgets[0];
      const w9 = state.zones[6].widgets[1];

      w6.id.should.eq(6);
      w9.id.should.eq(9);
    });

    it("should merge swapped zones", () => {
      const props = {
        ...TestProps.swapped6and9,
        draggingWidgetId: 6,
      };
      const state = DefaultStateManager.mergeDrop(9, props);

      state.zones[6].widgets.length.should.eq(2);
      const w6 = state.zones[6].widgets[1];
      const w9 = state.zones[6].widgets[0];

      w6.id.should.eq(6);
      w9.id.should.eq(9);
    });

    it("should merge bounds", () => {
      const props = {
        ...TestProps.openedZone6,
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.mergeDrop(6, props);

      const bounds = state.zones[6].bounds;
      bounds.left.should.eq(10);
      bounds.top.should.eq(20);
      bounds.right.should.eq(99);
      bounds.bottom.should.eq(110);
    });

    it("should unset floating bounds of target zone", () => {
      const props = {
        ...TestProps.floatingOpenedZone6,
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.mergeDrop(6, props);

      expect(state.zones[6].floatingBounds).to.not.exist;
    });

    it("should merge all vertical zones between dragging zone and target zone", () => {
      const props = {
        ...TestProps.defaultProps,
        draggingWidgetId: 1,
      };
      const state = DefaultStateManager.mergeDrop(7, props);

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
        ...TestProps.openedZone6,
        draggingWidgetId: 6,
      };
      const state = DefaultStateManager.mergeDrop(4, props);

      state.zones[4].widgets.length.should.eq(2);
      const w4 = state.zones[4].widgets[0];
      const w6 = state.zones[4].widgets[1];

      w4.id.should.eq(4);
      w6.id.should.eq(6);
    });

    it("should merge widget 9 to zone 7 when nine zone is in footer mode", () => {
      const props = {
        ...TestProps.defaultProps,
        isInFooterMode: true,
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.mergeDrop(7, props);

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
        ...TestProps.merged9To6,
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.unmergeDrop(9, props);

      const w6 = state.zones[6].widgets.find((w) => w.id === 6);
      const w9 = state.zones[9].widgets.find((w) => w.id === 9);

      state.zones[6].widgets.length.should.eq(1);
      state.zones[9].widgets.length.should.eq(1);
      expect(w6).to.exist;
      expect(w9).to.exist;
    });

    it("should unmerge horizontally merged zones", () => {
      const props = {
        ...TestProps.merged3To2,
        draggingWidgetId: 3,
      };
      const state = DefaultStateManager.unmergeDrop(3, props);

      const w2 = state.zones[2].widgets.find((w) => w.id === 2);
      const w3 = state.zones[3].widgets.find((w) => w.id === 3);

      state.zones[2].widgets.length.should.eq(1);
      state.zones[3].widgets.length.should.eq(1);
      expect(w2).to.exist;
      expect(w3).to.exist;
    });

    it("should unmerge bounds of vertically merged zones", () => {
      const props = {
        ...TestProps.merged9To6,
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.unmergeDrop(9, props);

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
        ...TestProps.merged3To2,
        draggingWidgetId: 3,
      };
      const state = DefaultStateManager.unmergeDrop(3, props);

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
        ...TestProps.merged9To6,
        draggingWidgetId: 6,
      };
      const state = DefaultStateManager.unmergeDrop(9, props);

      const w6 = state.zones[9].widgets.find((w) => w.id === 6);
      const w9 = state.zones[6].widgets.find((w) => w.id === 9);

      state.zones[6].widgets.length.should.eq(1);
      state.zones[9].widgets.length.should.eq(1);
      expect(w6).to.exist;
      expect(w9).to.exist;
    });

    it("should unmerge to lower zone", () => {
      const props = {
        ...TestProps.merged6To9,
        draggingWidgetId: 6,
      };
      const state = DefaultStateManager.unmergeDrop(6, props);

      const w6 = state.zones[9].widgets.find((w) => w.id === 6);
      const w9 = state.zones[6].widgets.find((w) => w.id === 9);

      state.zones[6].widgets.length.should.eq(1);
      state.zones[9].widgets.length.should.eq(1);
      expect(w6).to.exist;
      expect(w9).to.exist;
    });

    it("should unmerge widget 6 from zone 4 (and leave zone 5 empty)", () => {
      const props = {
        ...TestProps.merged6To4,
        draggingWidgetId: 6,
      };
      const state = DefaultStateManager.unmergeDrop(6, props);

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
        ...TestProps.merged9And6To6,
        draggingWidgetId: 6,
      };
      const state = DefaultStateManager.unmergeDrop(6, props);

      const w6 = state.zones[9].widgets.find((w) => w.id === 6);
      const w9 = state.zones[6].widgets.find((w) => w.id === 9);

      state.zones[6].widgets.length.should.eq(1);
      state.zones[9].widgets.length.should.eq(1);
      expect(w6).to.exist;
      expect(w9).to.exist;
    });

    it("widgets 6, 9 and 3 in zone 6 should unmerge: (widgets 3, 6 to zone 3), (widget 9 to zone 9)", () => {
      const props = {
        ...TestProps.merged9And3To6,
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.unmergeDrop(3, props);

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
        ...TestProps.merged9And3To6,
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.unmergeDrop(9, props);

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
        ...TestProps.merged9To7,
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.unmergeDrop(9, props);

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
        ...TestProps.merged9To6,
        draggingWidgetId: 6,
      };
      const state = DefaultStateManager.unmergeDrop(9, props);

      expect(state.zones[6].widgets[0].defaultZoneId).to.eq(6);
      expect(state.zones[9].widgets[0].defaultZoneId).to.eq(9);
    });

    it("should set defaultZoneId when swapping zones horizontally", () => {
      const props = {
        ...TestProps.merged6To4,
        draggingWidgetId: 4,
      };
      const state = DefaultStateManager.unmergeDrop(6, props);

      expect(state.zones[4].widgets[0].defaultZoneId).to.eq(4);
      expect(state.zones[6].widgets[0].defaultZoneId).to.eq(6);
    });

    it("widgets 3, 6 and 4 in zone 3 should unmerge: (w3 to z3), (w4 to z6), (w6 to z9)", () => {
      const props = {
        ...TestProps.merged6And4To3,
        draggingWidgetId: 4,
      };
      const state = DefaultStateManager.unmergeDrop(6, props);

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

  describe("handleWidgetTabDrag", () => {
    it("should move zone to which the widget is merged", () => {
      const props = {
        ...TestProps.defaultProps,
        zones: {
          ...TestProps.defaultProps.zones,
          [6]: {
            ...TestProps.defaultProps.zones[6],
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
            ...TestProps.defaultProps.zones[9],
            widgets: [],
          },
        },
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.handleWidgetTabDrag({ x: 5, y: -9 }, props);

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
      const state = DefaultStateManager.setDraggingWidget(6, true, TestProps.openedZone6);

      expect(state.zones[6].floatingBounds);
      const floatingBounds = state.zones[6].floatingBounds as RectangleProps;
      floatingBounds.top.should.eq(20);
      floatingBounds.right.should.eq(99);
      floatingBounds.bottom.should.eq(54);
    });
  });

  describe("handleTargetChanged", () => {
    it("should change the target", () => {
      const props = {
        ...TestProps.openedZone6,
        draggingWidgetId: 9,
      };
      const state = DefaultStateManager.handleTargetChanged({ widgetId: 9, type: TargetType.Merge }, props);

      expect(state.target).exist;
      state.target!.widgetId.should.eq(9);
    });
  });
});
