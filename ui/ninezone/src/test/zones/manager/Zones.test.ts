/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { should } from "chai";
import * as sinon from "sinon";
import * as Moq from "typemoq";
import { PointProps } from "@itwin/appui-abstract";
import { Point, Rectangle, RectangleProps } from "@itwin/core-react";
import {
  DisabledResizeHandles, DraggedWidgetManager, getClosedWidgetTabIndex, getColumnZones, getZoneCell, HorizontalAnchor, ResizeHandle,
  ResizeStrategy, ToolSettingsWidgetMode, WidgetZoneId, widgetZoneIds, ZoneManager, ZonesManager, ZonesManagerProps, ZoneTargetType,
} from "../../../appui-layout-react";
import { TestProps } from "./TestProps";

describe("ZonesManager", () => {
  const managerProps = Moq.Mock.ofType<ZonesManagerProps>();
  const zones = Moq.Mock.ofType<ZonesManagerProps["zones"]>();
  const widgets = Moq.Mock.ofType<ZonesManagerProps["widgets"]>();

  beforeEach(() => {
    managerProps.reset();
    zones.reset();
    widgets.reset();
    managerProps.setup((x) => x.zones).returns(() => zones.object);
    managerProps.setup((x) => x.widgets).returns(() => widgets.object);
  });

  it("should construct an instance", () => {
    new ZonesManager();
  });

  describe("handleWidgetTabClick", () => {
    it("should open widget", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabClick(6, 33, TestProps.defaultProps);
      newProps.widgets[6].tabIndex.should.eq(33);
    });

    it("should change tab", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabClick(6, 13, TestProps.openedZone6);
      newProps.widgets[6].tabIndex.should.eq(13);
    });

    it("should close widget", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabClick(6, 14, TestProps.openedZone6);
      newProps.widgets[6].tabIndex.should.eq(-1);
    });

    it("should not close widget when zone is floating", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabClick(6, 14, TestProps.floatingOpenedZone6);
      newProps.widgets[6].tabIndex.should.eq(14);
    });

    it("should not close widget in other zone", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabClick(6, 33, TestProps.openedZone6);
      newProps.widgets[9].tabIndex.should.eq(1, "w9");
    });

    it("should not update if widget zone is not found", () => {
      const props = {
        ...TestProps.openedZone6,
        zones: {
          ...TestProps.openedZone6.zones,
          [6]: {
            ...TestProps.openedZone6.zones[6],
            widgets: [],
          },
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabClick(6, 33, props);
      newProps.should.eq(props);
    });
  });

  describe("handleWidgetTabDrag", () => {
    it("should not update props if draggedWidget is unset", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDrag({ x: 10, y: 20 }, props);

      newProps.should.eq(props);
    });

    it("should not update props if dragged zone is not found", () => {
      const props: ZonesManagerProps = {
        ...TestProps.draggedOpenedZone6,
        zones: {
          ...TestProps.draggedOpenedZone6.zones,
          [6]: {
            ...TestProps.draggedOpenedZone6.zones[6],
            widgets: [],
          },
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDrag({ x: 10, y: 20 }, props);

      newProps.should.eq(props);
    });

    it("should not update props if dragged zone is not floating", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggedWidget: TestProps.draggedOpenedZone6.draggedWidget,
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDrag({ x: 10, y: 20 }, props);

      newProps.should.eq(props);
    });

    it("should drag floating zone", () => {
      const props = TestProps.draggedOpenedZone6;
      const sut = new ZonesManager();
      const setZoneFloatingBounds = sinon.spy(sut, "setZoneFloatingBounds");
      const setDraggedWidgetLastPosition = sinon.spy(sut, "setDraggedWidgetLastPosition");
      const newProps = sut.handleWidgetTabDrag({ x: 10, y: 20 }, props);

      newProps.should.not.eq(props);

      const bounds = sinon.match({ bottom: 100, left: 20, right: 50, top: 40 } as RectangleProps);
      setZoneFloatingBounds.calledOnceWithExactly(6, bounds, props).should.eq(true, "setZoneFloatingBounds");
      const lastPosition = sinon.match({ x: 20, y: 40 } as PointProps);
      setDraggedWidgetLastPosition.calledOnceWithExactly(lastPosition, setZoneFloatingBounds.firstCall.returnValue).should.eq(true, "setDraggedWidgetLastPosition");
    });
  });

  describe("handleWidgetTabDragEnd", () => {
    it("should merge zones", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);

      newProps.zones[6].widgets.length.should.eq(2);
      newProps.zones[6].widgets[0].should.eq(6);
      newProps.zones[6].widgets[1].should.eq(9);
    });

    it("should merge bounds", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);

      const bounds = newProps.zones[6].bounds;
      bounds.left.should.eq(10);
      bounds.top.should.eq(20);
      bounds.right.should.eq(99);
      bounds.bottom.should.eq(110);
    });

    it("should unset floating bounds of target zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.floatingOpenedZone6,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);
      (newProps.zones[6].floating === undefined).should.true;
    });

    it("should merge all vertical zones between dragged zone and target zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 1, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 7,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);

      newProps.zones[7].widgets.length.should.eq(3);
      newProps.zones[7].widgets.findIndex((w) => w === 1).should.eq(2);
      newProps.zones[7].widgets.findIndex((w) => w === 4).should.eq(1);
      newProps.zones[7].widgets.findIndex((w) => w === 7).should.eq(0);
    });

    it("should merge widget 6 to zone 4", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggedWidget: { id: 6, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 4,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);

      newProps.zones[4].widgets.length.should.eq(2);
      newProps.zones[4].widgets[0].should.eq(4);
      newProps.zones[4].widgets[1].should.eq(6);
    });

    it("should merge widget 9 to zone 7 when nine zone is in footer mode", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 7,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);

      newProps.zones[7].widgets.length.should.eq(2);
      newProps.zones[7].widgets[0].should.eq(7);
      newProps.zones[7].widgets[1].should.eq(9);
    });

    it("should set default anchor of dragged zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.inWidgetMode,
        draggedWidget: { id: 7, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        widgets: {
          ...TestProps.inWidgetMode.widgets,
          7: {
            ...TestProps.inWidgetMode.widgets[7],
            horizontalAnchor: HorizontalAnchor.Right,
          },
        },
        target: {
          zoneId: 8,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);

      newProps.widgets[8].horizontalAnchor.should.eq(HorizontalAnchor.Left);
    });

    it("should restore horizontal anchor", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        widgets: {
          ...TestProps.inWidgetMode.widgets,
          9: {
            ...TestProps.inWidgetMode.widgets[9],
            horizontalAnchor: HorizontalAnchor.Left,
          },
        },
        target: {
          zoneId: 9,
          type: ZoneTargetType.Back,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);
      newProps.widgets[9].horizontalAnchor.should.eq(HorizontalAnchor.Right);
    });

    it("should unset floating bounds", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        zones: {
          ...TestProps.defaultProps.zones,
          9: {
            ...TestProps.defaultProps.zones[9],
            floating: {
              bounds: {
                bottom: 10,
                left: 99,
                right: 999,
                top: 0,
              },
              stackId: 1,
            },
          },
        },
        target: {
          zoneId: 9,
          type: ZoneTargetType.Back,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);
      (newProps.zones[9].floating === undefined).should.true;
    });

    it("should not unset floating bounds of dragged widget", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 8, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        zones: {
          ...TestProps.defaultProps.zones,
          8: {
            ...TestProps.defaultProps.zones[8],
            floating: {
              bounds: {
                bottom: 10,
                left: 99,
                right: 999,
                top: 0,
              },
              stackId: 1,
            },
          },
        },
        zonesBounds: {
          bottom: 1000,
          left: 0,
          right: 1000,
          top: 0,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);
      (!!newProps.zones[8].floating).should.true;
      newProps.zones[8].floating!.should.eq(props.zones[8].floating);
    });

    it("should not modify props if dragged widget zone is not found", () => {
      const props: ZonesManagerProps = {
        ...TestProps.draggedOpenedZone6,
        zones: {
          ...TestProps.draggedOpenedZone6.zones,
          [6]: {
            ...TestProps.draggedOpenedZone6.zones[6],
            widgets: [],
          },
        },
        target: {
          zoneId: 9,
          type: ZoneTargetType.Back,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);
      newProps.should.eq(props);
    });

    it("should reset tool settings widget mode when merging back", () => {
      const props: ZonesManagerProps = {
        ...TestProps.draggedOpenedZone6,
        draggedWidget: {
          ...TestProps.draggedOpenedZone6.draggedWidget,
          id: 2 as WidgetZoneId,
        },
        target: { zoneId: 2, type: ZoneTargetType.Back },
        zones: {
          ...TestProps.draggedOpenedZone6.zones,
          2: {
            ...TestProps.draggedOpenedZone6.zones[2],
            widgets: [
              2,
            ],
          },
        },
      };
      const sut = new ZonesManager();
      const setToolSettingsWidgetModeSpy = sinon.spy(sut, "setToolSettingsWidgetMode");
      sut.handleWidgetTabDragEnd(props);

      setToolSettingsWidgetModeSpy.calledOnceWithExactly(ToolSettingsWidgetMode.TitleBar, sinon.match.any).should.true;
    });

    it("should save window settings on merge", () => {
      const props: ZonesManagerProps = {
        ...TestProps.draggedOpenedZone6,
        target: { zoneId: 9, type: ZoneTargetType.Merge },
      };
      const sut = new ZonesManager();
      const spy = sinon.spy(sut, "saveWindowSettings");
      sut.handleWidgetTabDragEnd(props);

      spy.calledOnceWithExactly(9, sinon.match.any).should.true;
    });

    it("should contain floating bounds to floatingZonesBounds", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        zones: {
          ...TestProps.defaultProps.zones,
          9: {
            ...TestProps.defaultProps.zones[9],
            floating: {
              bounds: {
                bottom: 800,
                left: 50,
                right: 1000,
                top: 0,
              },
              stackId: 1,
            },
          },
        },
        floatingZonesBounds: {
          left: 100,
          top: 0,
          bottom: 2000,
          right: 2000,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragEnd(props);
      should().exist(newProps.zones[9].floating);
      newProps.zones[9].floating?.bounds.should.eql({
        left: 100,
        top: 0,
        right: 1050,
        bottom: 800,
      });
    });
  });

  describe("handleWidgetTabDragStart", () => {
    it("should set floating bounds", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(6, 1, { x: 0, y: 0 }, new Rectangle(10, 20, 99, 54), TestProps.openedZone6);

      (!!newProps.zones[6].floating).should.true;
      newProps.zones[6].floating!.bounds.left.should.eq(10);
      newProps.zones[6].floating!.bounds.top.should.eq(20);
      newProps.zones[6].floating!.bounds.right.should.eq(99);
      newProps.zones[6].floating!.bounds.bottom.should.eq(54);
    });

    it("should unmerge merged zone", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9To6);

      newProps.zones[6].widgets.length.should.eq(1, "z6");
      newProps.zones[6].widgets[0].should.eq(6, "z6");
      newProps.zones[9].widgets.length.should.eq(1, "z9");
      newProps.zones[9].widgets[0].should.eq(9, "z9");
    });

    it("should set bounds when unmerging", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, new Rectangle(20, 10, 99, 110), TestProps.merged9To6);

      const bounds6 = newProps.zones[6].bounds;
      bounds6.top.should.eq(20, "bounds6.top");
      bounds6.left.should.eq(10, "bounds6.left");
      bounds6.right.should.eq(99, "bounds6.right");
      bounds6.bottom.should.eq(65, "bounds6.bottom");
      (newProps.zones[6].floating === undefined).should.eq(true, "floatingBounds6");

      const bounds9 = newProps.zones[9].bounds;
      bounds9.top.should.eq(65, "bounds9.top");
      bounds9.left.should.eq(10, "bounds9.left");
      bounds9.right.should.eq(99, "bounds9.right");
      bounds9.bottom.should.eq(110, "bounds9.bottom");
      (!!newProps.zones[9].floating).should.eq(true, "floatingBounds9");
      newProps.zones[9].floating!.bounds.left.should.eq(20, "floatingBounds9.left");
      newProps.zones[9].floating!.bounds.top.should.eq(10, "floatingBounds9.top");
      newProps.zones[9].floating!.bounds.right.should.eq(99, "floatingBounds9.right");
      newProps.zones[9].floating!.bounds.bottom.should.eq(110, "floatingBounds9.bottom");
    });

    it("should set bounds when unmerging switched widgets", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(6, 1, { x: 0, y: 0 }, new Rectangle(10, 54, 99, 110), TestProps.merged6To9);

      const bounds9 = newProps.zones[9].bounds;
      bounds9.top.should.eq(82, "bounds9.top");
      bounds9.left.should.eq(10, "bounds9.left");
      bounds9.right.should.eq(99, "bounds9.right");
      bounds9.bottom.should.eq(110, "bounds9.bottom");
      (newProps.zones[9].floating === undefined).should.eq(true, "floatingBounds9");

      const bounds6 = newProps.zones[6].bounds;
      bounds6.top.should.eq(54, "bounds6.top");
      bounds6.left.should.eq(10, "bounds6.left");
      bounds6.right.should.eq(99, "bounds6.right");
      bounds6.bottom.should.eq(82, "bounds6.bottom");
      (!!newProps.zones[6].floating).should.eq(true, "floatingBounds6");
      newProps.zones[6].floating!.bounds.left.should.eq(10, "floatingBounds6.left");
      newProps.zones[6].floating!.bounds.top.should.eq(54, "floatingBounds6.top");
      newProps.zones[6].floating!.bounds.right.should.eq(99, "floatingBounds6.right");
      newProps.zones[6].floating!.bounds.bottom.should.eq(110, "floatingBounds6.bottom");
    });

    it("should set bounds when unmerging horizontally merged zones", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, new Rectangle(10, 20, 99, 110), TestProps.merged9To8);

      const bounds8 = newProps.zones[8].bounds;
      bounds8.top.should.eq(20, "bounds8.top");
      bounds8.left.should.eq(10, "bounds8.left");
      bounds8.right.should.eq(54.5, "bounds8.right");
      bounds8.bottom.should.eq(110, "bounds8.bottom");
      (newProps.zones[8].floating === undefined).should.eq(true, "floatingBounds8");

      const bounds9 = newProps.zones[9].bounds;
      bounds9.top.should.eq(20, "bounds9.top");
      bounds9.left.should.eq(54.5, "bounds9.left");
      bounds9.right.should.eq(99, "bounds9.right");
      bounds9.bottom.should.eq(110, "bounds9.bottom");
      (!!newProps.zones[9].floating).should.eq(true, "floatingBounds9");
      newProps.zones[9].floating!.bounds.left.should.eq(10, "floatingBounds9.left");
      newProps.zones[9].floating!.bounds.top.should.eq(20, "floatingBounds9.top");
      newProps.zones[9].floating!.bounds.right.should.eq(99, "floatingBounds9.right");
      newProps.zones[9].floating!.bounds.bottom.should.eq(110, "floatingBounds9.bottom");
    });

    it("should set dragged widget when unmerging", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(9, 1, { x: 10, y: 20 }, new Rectangle(), TestProps.merged9To6);

      (!!newProps.draggedWidget).should.true;
      newProps.draggedWidget!.id.should.eq(9);
      newProps.draggedWidget!.lastPosition.x.should.eq(10);
      newProps.draggedWidget!.lastPosition.y.should.eq(20);
    });

    it("should open tab of zones default widget when unmerging active widget", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(9, 3, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9To6);

      newProps.zones[6].widgets.length.should.eq(1, "z6.widgets");
      newProps.zones[6].widgets[0].should.eq(6, "z6.widgets[0]");
      newProps.widgets[6].tabIndex.should.eq(0, "w6");

      newProps.zones[9].widgets.length.should.eq(1, "z9.widgets");
      newProps.zones[9].widgets[0].should.eq(9, "z9.widgets[0]");
      newProps.widgets[9].tabIndex.should.eq(1, "w9");
    });

    it("should open dragged tab when unmerging inactive widget", () => {
      const props: ZonesManagerProps = {
        ...TestProps.merged9To6,
        widgets: {
          ...TestProps.merged9To6.widgets,
          6: {
            ...TestProps.merged9To6.widgets[6],
            tabIndex: 2,
          },
          9: {
            ...TestProps.merged9To6.widgets[9],
            tabIndex: -1,
          },
        },
        zones: {
          ...TestProps.merged9To6.zones,
          6: {
            ...TestProps.merged9To6.zones[6],
            widgets: [6, 9],
          },
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(9, 5, { x: 0, y: 0 }, new Rectangle(), props);

      newProps.widgets[6].tabIndex.should.eq(2, "z6");
      newProps.widgets[9].tabIndex.should.eq(5, "z9");
    });

    it("return merged widget to default zone when dragging widget in default zone", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(6, 5, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9To6);

      newProps.zones[6].widgets.length.should.eq(1, "z6.widgets");
      newProps.zones[6].widgets[0].should.eq(6, "z6.widgets[0]");
      newProps.zones[9].widgets.length.should.eq(1, "z9.widgets");
      newProps.zones[9].widgets[0].should.eq(9, "z9.widgets[0]");
    });

    it("should unset anchors of unmerged zones", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(7, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9And8To7);
      newProps.widgets[8].horizontalAnchor.should.eq(HorizontalAnchor.Right, "z8");
      newProps.widgets[9].horizontalAnchor.should.eq(HorizontalAnchor.Right, "z9");
    });

    it("should not unset anchor of dragged zone", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(7, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9And8To7);
      newProps.widgets[7].horizontalAnchor.should.eq(HorizontalAnchor.Left);
    });

    it("should set bounds when unmerging 3 widgets to 3 zones", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, new Rectangle(20, 10, 80, 100), TestProps.merged9And8To7);

      newProps.zones[7].bounds.left.should.eq(20, "z7.left");
      newProps.zones[7].bounds.right.should.eq(40, "z7.right");
      newProps.zones[7].bounds.top.should.eq(10, "z7.top");
      newProps.zones[7].bounds.bottom.should.eq(100, "z7.bottom");
      (newProps.zones[7].floating === undefined).should.eq(true, "z7.floating");

      newProps.zones[8].bounds.left.should.eq(40, "z8.left");
      newProps.zones[8].bounds.right.should.eq(60, "z8.right");
      newProps.zones[8].bounds.top.should.eq(10, "z8.top");
      newProps.zones[8].bounds.bottom.should.eq(100, "z8.bottom");
      (newProps.zones[8].floating === undefined).should.eq(true, "z8.floating");

      newProps.zones[9].bounds.left.should.eq(60, "z9.left");
      newProps.zones[9].bounds.right.should.eq(80, "z9.right");
      newProps.zones[9].bounds.top.should.eq(10, "z9.top");
      newProps.zones[9].bounds.bottom.should.eq(100, "z9.bottom");

      (!!newProps.zones[9].floating).should.eq(true, "z9.floating");
      newProps.zones[9].floating!.bounds.left.should.eq(20, "z9.floating.left");
      newProps.zones[9].floating!.bounds.right.should.eq(80, "z9.floating.right");
      newProps.zones[9].floating!.bounds.top.should.eq(10, "z9.floating.top");
      newProps.zones[9].floating!.bounds.bottom.should.eq(100, "z9.floating.bottom");
    });

    it("should unmerge 3 widgets to 3 zones", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9And8To7);

      newProps.zones[7].widgets.length.should.eq(1, "z7.widgets");
      newProps.zones[7].widgets[0].should.eq(7, "z7.widgets[0]");

      newProps.zones[8].widgets.length.should.eq(1, "z8.widgets");
      newProps.zones[8].widgets[0].should.eq(8, "z8.widgets[0]");

      newProps.zones[9].widgets.length.should.eq(1, "z9.widgets");
      newProps.zones[9].widgets[0].should.eq(9, "z9.widgets[0]");
    });

    it("should unmerge all when dragging middle widget", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(8, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9And8To7);

      newProps.zones[7].widgets.length.should.eq(1, "zones7.widgets.length");
      newProps.zones[8].widgets.length.should.eq(1, "zones8.widgets.length");
      newProps.zones[9].widgets.length.should.eq(1, "zones9.widgets.length");

      newProps.zones[7].widgets[0].should.eq(7);
      newProps.zones[8].widgets[0].should.eq(8);
      newProps.zones[9].widgets[0].should.eq(9);
    });

    it("should open 1st tab of home widget when unmerging", () => {
      const props: ZonesManagerProps = {
        ...TestProps.merged9And8To7,
        widgets: {
          ...TestProps.merged9And8To7.widgets,
          7: {
            ...TestProps.merged9And8To7.widgets[7],
            tabIndex: -1,
          },
          8: {
            ...TestProps.merged9And8To7.widgets[8],
            tabIndex: -1,
          },
          9: {
            ...TestProps.merged9And8To7.widgets[9],
            tabIndex: 2,
          },
        },
        zones: {
          ...TestProps.merged9And8To7.zones,
          7: {
            ...TestProps.merged9And8To7.zones[7],
            widgets: [7, 8, 9],
          },
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(9, 3, { x: 0, y: 0 }, new Rectangle(), props);

      newProps.zones[7].widgets.length.should.eq(1, "z7.widgets");
      newProps.zones[7].widgets[0].should.eq(7, "z7.widgets[0]");

      newProps.zones[8].widgets.length.should.eq(1, "z8.widgets");
      newProps.zones[8].widgets[0].should.eq(8, "z8.widgets[0]");

      newProps.zones[9].widgets.length.should.eq(1, "z9.widgets");
      newProps.zones[9].widgets[0].should.eq(9, "z9.widgets[0]");

      newProps.widgets[7].tabIndex.should.eq(0, "w7");
      newProps.widgets[8].tabIndex.should.eq(-1, "w8");
      newProps.widgets[9].tabIndex.should.eq(2, "w9");
    });

    it("should not modify state when zone does not allow merging", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        zones: {
          ...TestProps.openedZone6.zones,
          [6]: {
            ...TestProps.openedZone6.zones[6],
            allowsMerging: false,
          },
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(6, 1, { x: 0, y: 0 }, new Rectangle(), props);

      newProps.should.eq(props);
    });

    it("should not modify props when widget zone is not found", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        zones: {
          ...TestProps.defaultProps.zones,
          [6]: {
            ...TestProps.defaultProps.zones[6],
            widgets: [],
          },
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetTabDragStart(6, 1, { x: 0, y: 0 }, new Rectangle(), props);

      newProps.should.eq(props);
    });

    it("should save window settings of unmerged zones", () => {
      const sut = new ZonesManager();
      const spy = sinon.spy(sut, "saveWindowSettings");
      sut.handleWidgetTabDragStart(7, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged7To4);

      spy.callCount.should.eq(2);
      spy.firstCall.calledWithExactly(4, sinon.match.any).should.true;
      spy.secondCall.calledWithExactly(7, sinon.match.any).should.true;
    });
  });

  describe("handleTargetChanged", () => {
    it("should set the target", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleTargetChanged({ zoneId: 9, type: ZoneTargetType.Merge }, props);

      (!!newProps.target).should.true;
      newProps.target!.zoneId.should.eq(9);
    });

    it("should unset target", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        target: { zoneId: 9, type: ZoneTargetType.Merge },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleTargetChanged(undefined, props);

      newProps.should.not.eq(props);
      (!!newProps.target).should.false;
    });

    it("should not modify props", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        target: undefined,
      };
      const sut = new ZonesManager();
      const newProps = sut.handleTargetChanged(undefined, props);

      newProps.should.eq(props);
    });

    it("should not modify props when targets are equal", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        target: { zoneId: 6, type: ZoneTargetType.Back },
      };
      const sut = new ZonesManager();
      const newProps = sut.handleTargetChanged({ zoneId: 6, type: ZoneTargetType.Back }, props);

      newProps.should.eq(props);
    });
  });

  describe("mergeZone", () => {
    it("should merge zone", () => {
      const sut = Moq.Mock.ofInstance(new ZonesManager());
      sut.callBase = true;
      sut.setup((x) => x.canBeMergedTo(4, 6, TestProps.defaultProps)).returns(() => true);

      const newProps = sut.object.mergeZone(4, 6, TestProps.defaultProps);
      newProps.should.matchSnapshot();
    });

    it("should not modify state when zone can not be merged", () => {
      const props = Moq.Mock.ofType<ZonesManagerProps>();
      const sut = Moq.Mock.ofInstance(new ZonesManager());
      sut.callBase = true;
      sut.setup((x) => x.canBeMergedTo(4, 6, TestProps.defaultProps)).returns(() => false);

      const newProps = sut.object.mergeZone(4, 6, props.object);
      (newProps === props.object).should.true;
    });

    it("should update window resize vStart setting", () => {
      const sut = new ZonesManager();

      sut.mergeZone(6, 9, TestProps.defaultProps);
      const managerSettings = sut.getZoneManager(9).windowResize;
      managerSettings.vStart.should.eq(1 / 3);
    });

    it("should update window resize vEnd setting", () => {
      const sut = new ZonesManager();

      sut.mergeZone(9, 6, TestProps.defaultProps);
      const managerSettings = sut.getZoneManager(6).windowResize;
      managerSettings.vEnd.should.eq(1);
    });

    it("should update window resize hStart setting", () => {
      const sut = new ZonesManager();

      sut.mergeZone(8, 9, TestProps.inWidgetMode);
      const managerSettings = sut.getZoneManager(9).windowResize;
      managerSettings.hStart.should.eq(1 / 3);
    });

    it("should update window resize hEnd setting", () => {
      const sut = new ZonesManager();

      sut.mergeZone(9, 8, TestProps.inWidgetMode);
      const managerSettings = sut.getZoneManager(8).windowResize;
      managerSettings.hEnd.should.eq(1);
    });

    it("should merge bounds", () => {
      const sut = new ZonesManager();
      const newProps = sut.mergeZone(9, 6, TestProps.openedZone6);

      const bounds = newProps.zones[6].bounds;
      bounds.left.should.eq(10);
      bounds.top.should.eq(20);
      bounds.right.should.eq(99);
      bounds.bottom.should.eq(110);
    });
  });

  describe("canBeMergedTo", () => {
    it("should not merge to zone 8 when in footer mode", () => {
      const sut = new ZonesManager();
      sut.canBeMergedTo(7, 8, TestProps.defaultProps).should.false;
    });

    it("should return false if merging to self", () => {
      const sut = new ZonesManager();
      sut.canBeMergedTo(7, 7, TestProps.defaultProps).should.false;
    });

    it("should return false if allowsMerging is false", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        zones: {
          ...TestProps.defaultProps.zones,
          [6]: {
            ...TestProps.defaultProps.zones[6],
            allowsMerging: false,
          },
        },
      };
      const sut = new ZonesManager();
      sut.canBeMergedTo(6, 9, props).should.false;
    });

    it("should return false if allowsMerging is false for zone between zone and target", () => {
      const props: ZonesManagerProps = {
        ...TestProps.inWidgetMode,
        zones: {
          ...TestProps.inWidgetMode.zones,
          [8]: {
            ...TestProps.inWidgetMode.zones[8],
            allowsMerging: false,
          },
        },
      };
      const sut = new ZonesManager();
      sut.canBeMergedTo(7, 9, props).should.false;
    });
  });

  describe("addWidget", () => {
    it("should add widget", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager();
      const newProps = sut.addWidget(6, 9, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones[6].widgets.should.not.eq(props.zones[6].widgets, "widgets");
      newProps.zones[6].widgets.length.should.eq(2, "widgets.length");
      newProps.zones[6].widgets[0].should.eq(6, "widgets[0]");
      newProps.zones[6].widgets[1].should.eq(9, "widgets[1]");
    });

    it("should not modify props if widget is already in a zone", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager();
      const newProps = sut.addWidget(6, 6, props);

      newProps.should.eq(props, "props");
      newProps.zones.should.eq(props.zones, "zones");
      newProps.zones[6].widgets.should.eq(props.zones[6].widgets, "widgets");
      newProps.zones[6].widgets.length.should.eq(1, "widgets.length");
      newProps.zones[6].widgets[0].should.eq(6, "widgets[0]");
    });
  });

  describe("removeWidget", () => {
    it("should remove widget", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager();
      const newProps = sut.removeWidget(6, 6, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones[6].widgets.should.not.eq(props.zones[6].widgets, "widgets");
      newProps.zones[6].widgets.length.should.eq(0, "widgets.length");
    });

    it("should not modify props if widget is not in a zone", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager();
      const newProps = sut.removeWidget(6, 9, props);

      newProps.should.eq(props, "props");
      newProps.zones.should.eq(props.zones, "zones");
      newProps.zones[6].widgets.should.eq(props.zones[6].widgets, "widgets");
      newProps.zones[6].widgets.length.should.eq(1, "widgets.length");
      newProps.zones[6].widgets[0].should.eq(6, "widgets[0]");
    });
  });

  describe("getDropTarget", () => {
    it("should return merge drop target for adjacent zone in same row", () => {
      const props: ZonesManagerProps = {
        ...TestProps.inWidgetMode,
        draggedWidget: { id: 7, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      sut.getDropTarget(8, props)!.should.eq(ZoneTargetType.Merge);
    });

    it("should return merge drop target for adjacent zone in same col", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 4, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      sut.getDropTarget(7, props)!.should.eq(ZoneTargetType.Merge);
    });

    it("should return merge drop target for distant zone in same row", () => {
      const props: ZonesManagerProps = {
        ...TestProps.inWidgetMode,
        draggedWidget: { id: 7, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      sut.getDropTarget(9, props)!.should.eq(ZoneTargetType.Merge);
    });

    it("should return back drop target for same zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 4, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      sut.getDropTarget(4, props)!.should.eq(ZoneTargetType.Back);
    });

    it("should return no drop target for zones merged diagonally", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 8, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      (sut.getDropTarget(1, props) === undefined).should.true;
      (sut.getDropTarget(4, props) === undefined).should.true;
    });

    it("should return no horizontal target if dragging vertically merged zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.merged9To6,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      (sut.getDropTarget(7, props) === undefined).should.true;
    });

    it("should return merge target for horizontal zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.inWidgetMode,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      sut.getDropTarget(7, props)!.should.eq(ZoneTargetType.Merge);
    });

    it("should return merge target for first widget in zone with multiple widgets", () => {
      const props: ZonesManagerProps = {
        ...TestProps.merged9To8,
        draggedWidget: { id: 7, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        isInFooterMode: false,
      };
      const sut = new ZonesManager();
      sut.getDropTarget(7, props)!.should.eq(ZoneTargetType.Back, "w7");
      sut.getDropTarget(8, props)!.should.eq(ZoneTargetType.Merge, "w8");
      (sut.getDropTarget(9, props) === undefined).should.eq(true, "w9");
    });

    it("should return no merge target if target widget is merged horizontally", () => {
      const props: ZonesManagerProps = {
        ...TestProps.merged9To7,
        draggedWidget: { id: 4, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      (sut.getDropTarget(7, props) === undefined).should.true;
    });

    it("should return no drop target for zones around unmergeable zone (content)", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 6, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      (sut.getDropTarget(4, props) === undefined).should.true;
    });

    it("should return no drop target for zones around unmergeable zone (footer)", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      (sut.getDropTarget(7, props) === undefined).should.true;
    });

    it("should return no drop target for non mergeable zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 4, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      (sut.getDropTarget(1, props) === undefined).should.true;
    });

    it("should return no drop target if widget is not dragged", () => {
      const sut = new ZonesManager();
      (sut.getDropTarget(6, TestProps.defaultProps) === undefined).should.true;
    });

    it("should return no drop target if dragged widget zone is not found", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        zones: {
          ...TestProps.defaultProps.zones,
          [4]: {
            ...TestProps.defaultProps.zones[4],
            widgets: [],
          },
        },
        draggedWidget: { id: 4, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const sut = new ZonesManager();
      (sut.getDropTarget(6, props) === undefined).should.true;
    });
  });

  describe("getGhostOutlineBounds", () => {
    it("should get merge dragged zone bounds (vertical)", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 9,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const bounds = sut.getGhostOutlineBounds(9, props);

      (!!bounds).should.true;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(54);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(110);
    });

    it("should set dragged zone bounds (horizontal)", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggedWidget: { id: 6, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 4,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const bounds = sut.getGhostOutlineBounds(4, props);

      (!!bounds).should.true;
      bounds!.left.should.eq(0);
      bounds!.top.should.eq(20);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(54);
    });

    it("should return outline for merge target", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const bounds = sut.getGhostOutlineBounds(6, props);

      (!!bounds).should.true;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(20);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(110);
    });

    it("should return outline for back target", () => {
      const props: ZonesManagerProps = {
        ...TestProps.draggedOpenedZone6,
        target: {
          zoneId: 6,
          type: ZoneTargetType.Back,
        },
      };
      const sut = new ZonesManager();
      const bounds = sut.getGhostOutlineBounds(6, props);

      (!!bounds).should.true;
      bounds!.left.should.eq(10);
      bounds!.top.should.eq(20);
      bounds!.right.should.eq(99);
      bounds!.bottom.should.eq(54);
    });

    it("should return undefined if zone target is not set", () => {
      const sut = new ZonesManager();
      const bounds = sut.getGhostOutlineBounds(9, TestProps.defaultProps);
      (!!bounds).should.false;
    });

    it("should return undefined if dragged widget is not set", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        target: {
          zoneId: 9,
          type: ZoneTargetType.Back,
        },
      };
      const sut = new ZonesManager();
      const bounds = sut.getGhostOutlineBounds(9, props);
      (!!bounds).should.false;
    });

    it("should return undefined if dragged widget zone is not found", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggedWidget: { id: 6, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 9,
          type: ZoneTargetType.Back,
        },
        zones: {
          ...TestProps.defaultProps.zones,
          [6]: {
            ...TestProps.defaultProps.zones[6],
            widgets: [],
          },
        },
      };
      const sut = new ZonesManager();
      const bounds = sut.getGhostOutlineBounds(9, props);
      (!!bounds).should.false;
    });

    it("should return undefined for zone that is not target when type is Merge", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggedWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: ZoneTargetType.Merge,
        },
      };
      const sut = new ZonesManager();
      const bounds = sut.getGhostOutlineBounds(3, props);

      (!!bounds).should.false;
    });
  });

  describe("getDisabledResizeHandles", () => {
    it("should not disable for floating widget", () => {
      const sut = new ZonesManager();
      sut.getDisabledResizeHandles(6, TestProps.floatingOpenedZone6).should.eq(DisabledResizeHandles.None);
    });

    it("should disable top handle", () => {
      const sut = new ZonesManager();
      sinon.stub(sut.growTop, "getMaxResize").returns(0);
      sinon.stub(sut.shrinkTop, "getMaxResize").returns(0);

      sinon.stub(sut.growLeft, "getMaxResize").returns(10);
      sinon.stub(sut.growRight, "getMaxResize").returns(10);
      sinon.stub(sut.growBottom, "getMaxResize").returns(10);

      sut.getDisabledResizeHandles(6, TestProps.defaultProps).should.eq(DisabledResizeHandles.Top);
    });

    it("should disable bottom handle", () => {
      const sut = new ZonesManager();
      sinon.stub(sut.growBottom, "getMaxResize").returns(0);
      sinon.stub(sut.shrinkBottom, "getMaxResize").returns(0);

      sinon.stub(sut.growLeft, "getMaxResize").returns(10);
      sinon.stub(sut.growRight, "getMaxResize").returns(10);
      sinon.stub(sut.growTop, "getMaxResize").returns(10);

      sut.getDisabledResizeHandles(6, TestProps.defaultProps).should.eq(DisabledResizeHandles.Bottom);
    });

    it("should disable left handle", () => {
      const sut = new ZonesManager();
      sinon.stub(sut.growLeft, "getMaxResize").returns(0);
      sinon.stub(sut.shrinkLeft, "getMaxResize").returns(0);

      sinon.stub(sut.growRight, "getMaxResize").returns(10);
      sinon.stub(sut.growTop, "getMaxResize").returns(10);
      sinon.stub(sut.growBottom, "getMaxResize").returns(10);

      sut.getDisabledResizeHandles(6, TestProps.defaultProps).should.eq(DisabledResizeHandles.Left);
    });

    it("should disable right handle", () => {
      const sut = new ZonesManager();
      sinon.stub(sut.growRight, "getMaxResize").returns(0);
      sinon.stub(sut.shrinkRight, "getMaxResize").returns(0);

      sinon.stub(sut.growLeft, "getMaxResize").returns(10);
      sinon.stub(sut.growTop, "getMaxResize").returns(10);
      sinon.stub(sut.growBottom, "getMaxResize").returns(10);

      sut.getDisabledResizeHandles(6, TestProps.defaultProps).should.eq(DisabledResizeHandles.Right);
    });

    it("should disable multiple handles", () => {
      const sut = new ZonesManager();
      sinon.stub(sut.growRight, "getMaxResize").returns(0);
      sinon.stub(sut.shrinkRight, "getMaxResize").returns(0);
      sinon.stub(sut.growTop, "getMaxResize").returns(0);
      sinon.stub(sut.shrinkTop, "getMaxResize").returns(0);

      sinon.stub(sut.growLeft, "getMaxResize").returns(10);
      sinon.stub(sut.growBottom, "getMaxResize").returns(10);

      sut.getDisabledResizeHandles(6, TestProps.defaultProps).should.eq(DisabledResizeHandles.Right | DisabledResizeHandles.Top);
    });
  });

  describe("restoreLayout", () => {
    it("should restore initial bounds of each zone", () => {
      const sut = new ZonesManager();
      const getInitialBounds = sinon.spy(sut, "getInitialBounds");
      const setZoneBounds = sinon.spy(sut, "setZoneBounds");
      const setZoneIsLayoutChanged = sinon.spy(sut, "setZoneIsLayoutChanged");
      sut.restoreLayout(TestProps.defaultProps);

      getInitialBounds.callCount.should.eq(widgetZoneIds.length);
      setZoneBounds.callCount.should.eq(widgetZoneIds.length);
      widgetZoneIds.forEach((zId) => {
        getInitialBounds.calledWithExactly(zId, sinon.match.any).should.eq(true, `getInitialBounds(${zId})`);
        setZoneBounds.calledWithExactly(zId, sinon.match.any, sinon.match.any).should.eq(true, `setZoneBounds(${zId})`);
        setZoneIsLayoutChanged.calledWithExactly(zId, sinon.match.any, sinon.match.any).should.eq(true, `setZoneIsLayoutChanged(${zId})`);
      });
    });

    it("should restore window resize settings", () => {
      const sut = new ZonesManager();
      sut.getZoneManager(1).windowResize.vMode = "Minimum";
      sut.restoreLayout(TestProps.defaultProps);
      sut.getZoneManager(1).windowResize.vMode.should.eq("Percentage");
    });
  });

  describe("getInitialBounds", () => {
    it("should return initial bounds", () => {
      const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const widget = Moq.Mock.ofType<ZonesManagerProps["widgets"][2]>();
      managerProps.setup((x) => x.zonesBounds).returns(() => new Rectangle(100, 50, 766, 383));
      widgets.setup((x) => x[2]).returns(() => widget.object);
      zones.setup((x) => x[2]).returns(() => zone.object);
      zone.setup((x) => x.widgets).returns(() => [2]);
      const sut = new ZonesManager();
      const initialBounds = sut.getInitialBounds(2, managerProps.object);
      initialBounds.left.should.eq(222);
      initialBounds.top.should.eq(0);
      initialBounds.right.should.eq(444);
      initialBounds.bottom.should.eq(111);
    });

    it("should return initial bounds when in footer mode", () => {
      const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const widget = Moq.Mock.ofType<ZonesManagerProps["widgets"][WidgetZoneId]>();
      managerProps.setup((x) => x.isInFooterMode).returns(() => true);
      managerProps.setup((x) => x.zonesBounds).returns(() => new Rectangle(0, 0, 999, 285));
      widgets.setup((x) => x[3]).returns(() => widget.object);
      zones.setup((x) => x[3]).returns(() => zone.object);
      zone.setup((x) => x.widgets).returns(() => [3]);
      const sut = new ZonesManager();
      const initialBounds = sut.getInitialBounds(3, managerProps.object);
      initialBounds.left.should.eq(666);
      initialBounds.top.should.eq(0);
      initialBounds.right.should.eq(999);
      initialBounds.bottom.should.eq(95);
    });

    it("should return initial bounds for merged zones", () => {
      const z3 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const z4 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const w3 = Moq.Mock.ofType<ZonesManagerProps["widgets"][WidgetZoneId]>();
      managerProps.setup((x) => x.zonesBounds).returns(() => new Rectangle(0, 0, 999, 333));
      const sut = new ZonesManager();
      const getInitialBounds = sinon.stub(sut, "getInitialBounds").onSecondCall().returns(new Rectangle(678, 234, 987, 345));
      getInitialBounds.callThrough();
      widgets.setup((x) => x[3]).returns(() => w3.object);
      zones.setup((x) => x[3]).returns(() => z3.object);
      zones.setup((x) => x[4]).returns(() => z4.object);
      z3.setup((x) => x.widgets).returns(() => [3, 4]);
      const initialBounds = sut.getInitialBounds(3, managerProps.object);
      initialBounds.left.should.eq(666);
      initialBounds.top.should.eq(0);
      initialBounds.right.should.eq(999);
      initialBounds.bottom.should.eq(345);
    });
  });

  describe("setAllowsMerging", () => {
    it("should set zone props", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager();
      const setAllowsMerging = sinon.spy(sut.getZoneManager(1), "setAllowsMerging");
      const setZoneProps = sinon.spy(sut, "setZoneProps");

      const newProps = sut.setAllowsMerging(1, true, props);
      setAllowsMerging.calledOnceWithExactly(true, props.zones[1]).should.true;
      setZoneProps.calledOnceWithExactly(setAllowsMerging.firstCall.returnValue, props).should.true;
      newProps.should.eq(setZoneProps.firstCall.returnValue);
    });
  });

  describe("setIsInFooterMode", () => {
    it("should not update props", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager();
      const newProps = sut.setIsInFooterMode(true, props);
      newProps.should.eq(props);
      newProps.isInFooterMode.should.true;
    });

    it("should update props", () => {
      const props = TestProps.inWidgetMode;
      const sut = new ZonesManager();
      const newProps = sut.setIsInFooterMode(true, props);
      newProps.should.not.eq(props);
      newProps.isInFooterMode.should.true;
    });
  });

  describe("setFloatingZonesBounds", () => {
    const floatingOpenedZone6: ZonesManagerProps = {
      ...TestProps.floatingOpenedZone6,
      zones: {
        ...TestProps.floatingOpenedZone6.zones,
        6: {
          ...TestProps.floatingOpenedZone6.zones[6],
          floating: {
            bounds: {
              left: 900,
              top: 800,
              right: 1000,
              bottom: 1000,
            },
            stackId: 1,
          },
        },
      },
    };

    it("should reset bounds", () => {
      const props: ZonesManagerProps = {
        ...TestProps.floatingOpenedZone6,
        floatingZonesBounds: new Rectangle().toProps(),
      };
      const sut = new ZonesManager();
      const newProps = sut.setFloatingZonesBounds(undefined, props);

      should().not.exist(newProps.floatingZonesBounds);
    });

    it("should update bounds", () => {
      const props: ZonesManagerProps = {
        ...TestProps.floatingOpenedZone6,
        floatingZonesBounds: new Rectangle().toProps(),
      };
      const sut = new ZonesManager();
      const newProps = sut.setFloatingZonesBounds(new Rectangle(100), props);

      newProps.floatingZonesBounds?.left.should.eq(100);
    });

    it("should init bounds", () => {
      const props: ZonesManagerProps = {
        ...TestProps.floatingOpenedZone6,
        floatingZonesBounds: undefined,
      };
      const sut = new ZonesManager();
      const newProps = sut.setFloatingZonesBounds(new Rectangle(100), props);

      newProps.floatingZonesBounds?.left.should.eq(100);
    });

    it("should contain floating zones", () => {
      const sut = new ZonesManager();
      const newProps = sut.setFloatingZonesBounds(new Rectangle(0, 0, 500, 500), floatingOpenedZone6);

      newProps.zones[6].floating?.bounds.should.eql({
        left: 400,
        top: 300,
        right: 500,
        bottom: 500,
      });
    });

    it("should not contain dragged zone", () => {
      const props: ZonesManagerProps = {
        ...floatingOpenedZone6,
        draggedWidget: {
          id: 6,
          isUnmerge: false,
          lastPosition: new Point(),
          tabIndex: 0,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.setFloatingZonesBounds(new Rectangle(0, 0, 500, 500), props);

      newProps.zones[6].floating?.bounds.should.eq(props.zones[6].floating?.bounds);
    });
  });

  describe("setZonesBounds", () => {
    it("should not modify props if last bounds are equal", () => {
      managerProps.setup((x) => x.zonesBounds).returns(() => new Rectangle(100, 50, 766, 383));
      const sut = new ZonesManager();
      const newProps = sut.setZonesBounds(new Rectangle(100, 50, 766, 383), managerProps.object);

      (newProps === managerProps.object).should.true;
    });

    it("should offset floating zones", () => {
      managerProps.setup((x) => x.zonesBounds).returns(() => new Rectangle(100, 50, 766, 383));
      const sut = new ZonesManager();
      const setZoneFloatingBounds = sinon.spy(sut, "setZoneFloatingBounds");
      const newProps = sut.setZonesBounds(new Rectangle(120, 20, 766, 383), TestProps.floatingOpenedZone6);

      newProps.should.not.eq(TestProps.floatingOpenedZone6);
      setZoneFloatingBounds.callCount.should.eq(1);
    });

    it("should not contain dragged zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.floatingOpenedZone6,
        zones: {
          ...TestProps.floatingOpenedZone6.zones,
          6: {
            ...TestProps.floatingOpenedZone6.zones[6],
            floating: {
              bounds: {
                left: 900,
                top: 800,
                right: 1000,
                bottom: 1000,
              },
              stackId: 1,
            },
          },
        },
        zonesBounds: {
          left: 0,
          top: 0,
          bottom: 1000,
          right: 1000,
        },
        draggedWidget: {
          id: 6,
          isUnmerge: false,
          lastPosition: {
            x: 0,
            y: 0,
          },
          tabIndex: 0,
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.setZonesBounds(new Rectangle(0, 0, 500, 500), props);

      newProps.zones[6].floating?.bounds.should.eql({
        left: 900,
        top: 800,
        right: 1000,
        bottom: 1000,
      });
    });
  });

  describe("getResizeStrategy", () => {
    it("should return growTop", () => {
      const sut = new ZonesManager();
      sut.getResizeStrategy(ResizeHandle.Top, -10).should.eq(sut.growTop);
    });

    it("should return shrinkTop", () => {
      const sut = new ZonesManager();
      sut.getResizeStrategy(ResizeHandle.Top, 10).should.eq(sut.shrinkTop);
    });

    it("should return growBottom", () => {
      const sut = new ZonesManager();
      sut.getResizeStrategy(ResizeHandle.Bottom, 10).should.eq(sut.growBottom);
    });

    it("should return shrinkBottom", () => {
      const sut = new ZonesManager();
      sut.getResizeStrategy(ResizeHandle.Bottom, -10).should.eq(sut.shrinkBottom);
    });

    it("should return growLeft", () => {
      const sut = new ZonesManager();
      sut.getResizeStrategy(ResizeHandle.Left, -10).should.eq(sut.growLeft);
    });

    it("should return shrinkLeft", () => {
      const sut = new ZonesManager();
      sut.getResizeStrategy(ResizeHandle.Left, 10).should.eq(sut.shrinkLeft);
    });

    it("should return growRight", () => {
      const sut = new ZonesManager();
      sut.getResizeStrategy(ResizeHandle.Right, 10).should.eq(sut.growRight);
    });

    it("should return shrinkRight", () => {
      const sut = new ZonesManager();
      sut.getResizeStrategy(ResizeHandle.Right, -10).should.eq(sut.shrinkRight);
    });
  });

  describe("handleWidgetResize", () => {
    it("should not update props", () => {
      const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const floating = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]["floating"]>();
      const resizeStrategy = Moq.Mock.ofType<ResizeStrategy>();
      const filledProps = Moq.Mock.ofType<ZonesManagerProps>();
      zones.setup((x) => x[6]).returns(() => z6.object);
      z6.setup((x) => x.bounds).returns(() => new Rectangle(10, 20, 30, 40));
      z6.setup((x) => x.floating).returns(() => floating.object);
      resizeStrategy.setup((x) => x.tryResizeFloating(6, 10, Moq.It.isAny())).returns(() => filledProps.object);
      const sut = new ZonesManager();
      sinon.stub(sut, "getResizeStrategy").returns(resizeStrategy.object);
      sinon.stub(sut, "setZoneProps").returns(filledProps.object);
      const newProps = sut.handleWidgetResize({
        filledHeightDiff: 0,
        handle: ResizeHandle.Top,
        resizeBy: 10,
        zoneId: 6,
      }, managerProps.object);

      (newProps === managerProps.object).should.true;
    });

    it("should resize", () => {
      const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const resizeStrategy = Moq.Mock.ofType<ResizeStrategy>();
      const filledProps = Moq.Mock.ofType<ZonesManagerProps>();
      zones.setup((x) => x[6]).returns(() => z6.object);
      z6.setup((x) => x.bounds).returns(() => new Rectangle(10, 20, 30, 40));
      z6.setup((x) => x.floating).returns(() => undefined);
      resizeStrategy.setup((x) => x.tryResize(6, 10, Moq.It.isAny())).returns(() => filledProps.object);
      const sut = new ZonesManager();
      sinon.stub(sut, "getResizeStrategy").returns(resizeStrategy.object);
      sinon.stub(sut, "setZoneProps").returns(filledProps.object);
      sut.handleWidgetResize({
        filledHeightDiff: 0,
        handle: ResizeHandle.Top,
        resizeBy: 10,
        zoneId: 6,
      }, managerProps.object);

      resizeStrategy.verify((x) => x.tryResize(6, 10, Moq.It.isAny()), Moq.Times.once());
    });

    it("should set is layout changed", () => {
      const sut = new ZonesManager();
      const newProps = sut.handleWidgetResize({
        filledHeightDiff: 0,
        handle: ResizeHandle.Top,
        resizeBy: 10,
        zoneId: 6,
      }, TestProps.openedZone6);
      newProps.zones[6].isLayoutChanged.should.true;
    });
  });

  describe("getZoneManager", () => {
    it("should return default zone manager", () => {
      const sut = new ZonesManager();
      const zoneManager = sut.getZoneManager(1);
      (zoneManager instanceof ZoneManager).should.true;
    });

    it("should return same instance of default manager", () => {
      const sut = new ZonesManager();
      const zoneManager1 = sut.getZoneManager(1);
      const zoneManager2 = sut.getZoneManager(1);
      zoneManager1.should.eq(zoneManager2);
    });
  });

  describe("draggedWidgetManager", () => {
    it("should return default zone manager", () => {
      const sut = new ZonesManager();
      (sut.draggedWidgetManager instanceof DraggedWidgetManager).should.true;
    });

    it("should return same instance of default manager", () => {
      const sut = new ZonesManager();
      sut.draggedWidgetManager.should.eq(sut.draggedWidgetManager);
    });
  });

  describe("setDraggedWidgetProps", () => {
    it("should not update props", () => {
      const props = TestProps.draggedOpenedZone6;
      const draggedWidget = TestProps.draggedOpenedZone6.draggedWidget;
      const sut = new ZonesManager();
      const newProps = sut.setDraggedWidgetProps(draggedWidget, props);
      newProps.should.eq(props);
    });

    it("should set dragged widget props", () => {
      const props = TestProps.defaultProps;
      const draggedWidget = TestProps.draggedOpenedZone6.draggedWidget;
      const sut = new ZonesManager();
      const newProps = sut.setDraggedWidgetProps(draggedWidget, props);

      newProps.should.not.eq(props);
      (!!newProps.draggedWidget).should.true;
      newProps.draggedWidget!.should.eq(draggedWidget);
    });
  });

  describe("setDraggedWidgetLastPosition", () => {
    it("should throw if not dragging", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager();
      (() => sut.setDraggedWidgetLastPosition({ x: 5, y: 10 }, props)).should.throw();
    });
  });

  describe("setWidgetTabIndex", () => {
    it("should not update props", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager();
      const newProps = sut.setWidgetTabIndex(6, -2, props);

      newProps.should.eq(props);
    });
  });

  describe("isResizable", () => {
    it("should return true", () => {
      const sut = new ZonesManager();
      sut.isResizable(6).should.true;
    });

    it("should return false for zone 1", () => {
      const sut = new ZonesManager();
      sut.isResizable(1).should.false;
    });

    it("should return false for zone 1", () => {
      const sut = new ZonesManager();
      sut.isResizable(2).should.false;
    });

    it("should return false for zone 1", () => {
      const sut = new ZonesManager();
      sut.isResizable(3).should.false;
    });
  });

  describe("getWindowResizeBounds", () => {
    describe("vertical", () => {
      it("should return bounds in percentage mode", () => {
        const props = {
          ...TestProps.defaultProps,
          zonesBounds: new Rectangle(0, 0, 0, 999),
        };
        const sut = new ZonesManager();

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[4].top.should.eq(333);
        resizeBounds[4].bottom.should.eq(666);
      });

      it("should return bounds in minimum vertical mode", () => {
        const props = {
          ...TestProps.defaultProps,
          zonesBounds: new Rectangle(0, 0, 0, 999),
        };
        const sut = new ZonesManager();
        const zoneManager = sut.getZoneManager(4);
        zoneManager.windowResize.vMode = "Minimum";

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[4].top.should.eq(333);
        resizeBounds[4].bottom.should.eq(333 + 220);
      });

      it("should shrink below min height in minimum mode", () => {
        const props = {
          ...TestProps.defaultProps,
          zonesBounds: new Rectangle(0, 0, 0, 600),
        };
        const sut = new ZonesManager();
        const zoneManager = sut.getZoneManager(4);
        zoneManager.windowResize.vMode = "Minimum";

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[4].top.should.eq(200);
        resizeBounds[4].bottom.should.eq(400);
      });

      it("should offset the zone", () => {
        const props = {
          ...TestProps.defaultProps,
          zonesBounds: new Rectangle(0, 0, 0, 1000),
        };
        const sut = new ZonesManager();
        const zoneManager = sut.getZoneManager(7);
        zoneManager.windowResize.vStart = 0.75;

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[7].top.should.eq(750);
        resizeBounds[7].bottom.should.eq(1000);
      });

      it("should shrink single zone", () => {
        const props = {
          ...TestProps.defaultProps,
          zonesBounds: new Rectangle(0, 0, 0, 900),
        };
        const sut = new ZonesManager();
        const zoneManager1 = sut.getZoneManager(1);
        zoneManager1.windowResize.vMode = "Minimum";
        zoneManager1.windowResize.vEnd = 0.1;
        const zoneManager4 = sut.getZoneManager(4);
        zoneManager4.windowResize.vStart = 0.1;
        zoneManager4.windowResize.vEnd = 0.9;
        const zoneManager7 = sut.getZoneManager(7);
        zoneManager7.windowResize.vStart = 0.9;
        zoneManager7.windowResize.vMode = "Minimum";

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[1].top.should.eq(0, "z1.top");
        resizeBounds[1].bottom.should.eq(220, "z1.bottom");
        resizeBounds[4].top.should.eq(220, "z4.top");
        resizeBounds[4].bottom.should.eq(680, "z4.bottom");
        resizeBounds[7].top.should.eq(680, "z7.top");
        resizeBounds[7].bottom.should.eq(900, "z7.bottom");
      });

      it("should leave bottom spacing for bottom zone", () => {
        const props = {
          ...TestProps.defaultProps,
          zonesBounds: new Rectangle(0, 0, 0, 900),
        };
        const sut = new ZonesManager();
        const zoneManager7 = sut.getZoneManager(7);
        zoneManager7.windowResize.vMode = "Minimum";

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[7].top.should.eq(600, "z7.top");
        resizeBounds[7].bottom.should.eq(820, "z7.bottom");
      });

      it("should not include merged zones", () => {
        const props = {
          ...TestProps.merged7To4,
          zonesBounds: new Rectangle(0, 0, 0, 500),
        };
        const sut = new ZonesManager();

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[4].top.should.eq(220, "z4.top");
        resizeBounds[4].bottom.should.eq(440, "z4.bottom");
      });

      it("should offset first zone", () => {
        const props = {
          ...TestProps.defaultProps,
          zones: {
            ...TestProps.defaultProps.zones,
            2: {
              ...TestProps.defaultProps.zones[2],
              widgets: [],
            },
          },
          zonesBounds: new Rectangle(0, 0, 0, 900),
        };
        const sut = new ZonesManager();

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[8].top.should.eq(600, "z8.top");
        resizeBounds[8].bottom.should.eq(900, "z8.bottom");
      });
    });

    describe("horizontal", () => {
      it("should return bounds in percentage mode", () => {
        const props = {
          ...TestProps.defaultProps,
          zonesBounds: new Rectangle(0, 0, 999, 0),
        };
        const sut = new ZonesManager();

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[4].left.should.eq(0);
        resizeBounds[4].right.should.eq(333);
      });

      it("should return bounds in minimum mode", () => {
        const props = {
          ...TestProps.defaultProps,
          zonesBounds: new Rectangle(0, 0, 900, 0),
        };
        const sut = new ZonesManager();
        const zoneManager = sut.getZoneManager(4);
        zoneManager.windowResize.hMode = "Minimum";

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[4].left.should.eq(0);
        resizeBounds[4].right.should.eq(296);
      });

      it("should anchor to the right", () => {
        const props = {
          ...TestProps.defaultProps,
          zonesBounds: new Rectangle(0, 0, 900, 0),
        };
        const sut = new ZonesManager();
        const zoneManager = sut.getZoneManager(6);
        zoneManager.windowResize.hMode = "Minimum";

        const resizeBounds = sut.getWindowResizeBounds(props);
        resizeBounds[6].left.should.eq(604);
        resizeBounds[6].right.should.eq(900);
      });
    });
  });

  describe("saveWindowSettings", () => {
    it("should save window settings", () => {
      const props = {
        ...TestProps.defaultProps,
        zones: {
          ...TestProps.defaultProps.zones,
          1: {
            ...TestProps.defaultProps.zones[1],
            bounds: {
              left: 100,
              top: 100,
              right: 200,
              bottom: 300,
            },
          },
        },
        zonesBounds: {
          left: 0,
          top: 0,
          right: 500,
          bottom: 1000,
        },
      };
      const sut = new ZonesManager();
      sut.saveWindowSettings(1, props);

      const zoneManager1 = sut.getZoneManager(1);
      zoneManager1.windowResize.hMode.should.eq("Percentage", "hMode");
      zoneManager1.windowResize.hStart.should.eq(0.2, "hStart");
      zoneManager1.windowResize.hEnd.should.eq(0.4, "hEnd");
      zoneManager1.windowResize.vMode.should.eq("Percentage", "vMode");
      zoneManager1.windowResize.vStart.should.eq(0.1, "vStart");
      zoneManager1.windowResize.vEnd.should.eq(0.3, "vEnd");
    });
  });

  describe("setZoneWidth", () => {
    const defaultProps = {
      ...TestProps.defaultProps,
      zones: {
        ...TestProps.defaultProps.zones,
        4: {
          ...TestProps.defaultProps.zones[4],
          bounds: new Rectangle(0, 0, 333, 0),
        },
        6: {
          ...TestProps.defaultProps.zones[6],
          bounds: new Rectangle(666, 0, 999, 0),
        },
      },
      zonesBounds: new Rectangle(0, 0, 999, 999),
    };

    it("should set width of left zone", () => {
      const sut = new ZonesManager();
      const newProps = sut.setZoneWidth(4, 300, defaultProps);

      newProps.should.not.eq(defaultProps);
      newProps.zones.should.not.eq(defaultProps.zones, "zones");
      newProps.zones[4].should.not.eq(defaultProps.zones[4], "zone");
      newProps.zones[4].bounds.should.not.eq(defaultProps.zones[4].bounds, "bounds");
      newProps.zones[4].bounds.should.deep.eq(new Rectangle(0, 0, 300, 0));
    });

    it("should set width and offset right zone", () => {
      const sut = new ZonesManager();
      const newProps = sut.setZoneWidth(6, 300, defaultProps);

      newProps.should.not.eq(defaultProps);
      newProps.zones.should.not.eq(defaultProps.zones, "zones");
      newProps.zones[6].should.not.eq(defaultProps.zones[6], "zone");
      newProps.zones[6].bounds.should.not.eq(defaultProps.zones[6].bounds, "bounds");
      newProps.zones[6].bounds.should.deep.eq(new Rectangle(699, 0, 999, 0));
    });

    it("should save window resize settings", () => {
      const sut = new ZonesManager();
      const spy = sinon.spy(sut, "saveWindowSettings");
      sut.setZoneWidth(6, 300, defaultProps);

      spy.calledOnceWithExactly(6, sinon.match.any).should.true;
    });

    it("should respect min width", () => {
      const sut = new ZonesManager();
      const manager = sut.getZoneManager(4);
      sinon.stub(manager.windowResize, "minWidth").get(() => 123);
      const newProps = sut.setZoneWidth(4, 100, defaultProps);

      newProps.zones[4].bounds.should.deep.eq(new Rectangle(0, 0, 123, 0));
    });

    it("should respect max width (determined from initial bounds)", () => {
      const props = {
        ...defaultProps,
        zones: {
          ...defaultProps.zones,
          4: {
            ...defaultProps.zones[4],
            bounds: new Rectangle(0, 0, 200, 0),
          },
        },
      };
      const sut = new ZonesManager();
      const newProps = sut.setZoneWidth(4, 500, props);

      newProps.zones[4].bounds.should.deep.eq(new Rectangle(0, 0, 333, 0));
    });
  });
});

describe("getZoneCell", () => {
  it("should return zone 1 cell", () => {
    const cell = getZoneCell(1);
    cell.row.should.eq(0);
    cell.col.should.eq(0);
  });

  it("should return zone 2 cell", () => {
    const cell = getZoneCell(2);
    cell.row.should.eq(0);
    cell.col.should.eq(1);
  });

  it("should return zone 3 cell", () => {
    const cell = getZoneCell(3);
    cell.row.should.eq(0);
    cell.col.should.eq(2);
  });

  it("should return zone 4 cell", () => {
    const cell = getZoneCell(4);
    cell.row.should.eq(1);
    cell.col.should.eq(0);
  });

  it("should return zone 5 cell", () => {
    const cell = getZoneCell(5);
    cell.row.should.eq(1);
    cell.col.should.eq(1);
  });

  it("should return zone 6 cell", () => {
    const cell = getZoneCell(6);
    cell.row.should.eq(1);
    cell.col.should.eq(2);
  });

  it("should return zone 7 cell", () => {
    const cell = getZoneCell(7);
    cell.row.should.eq(2);
    cell.col.should.eq(0);
  });

  it("should return zone 8 cell", () => {
    const cell = getZoneCell(8);
    cell.row.should.eq(2);
    cell.col.should.eq(1);
  });

  it("should return zone 9 cell", () => {
    const cell = getZoneCell(9);
    cell.row.should.eq(2);
    cell.col.should.eq(2);
  });
});

describe("getColumnZones", () => {
  it("should return zone 1 column zones", () => {
    const zones = getColumnZones(1);
    zones.should.deep.eq([1, 4, 7]);
  });

  it("should return zone 2 column zones", () => {
    const zones = getColumnZones(2);
    zones.should.deep.eq([2, 8]);
  });

  it("should return zone 3 column zones", () => {
    const zones = getColumnZones(3);
    zones.should.deep.eq([3, 6, 9]);
  });

  it("should return zone 4 column zones", () => {
    const zones = getColumnZones(4);
    zones.should.deep.eq([1, 4, 7]);
  });

  it("should return zone 6 column zones", () => {
    const zones = getColumnZones(6);
    zones.should.deep.eq([3, 6, 9]);
  });

  it("should return zone 7 column zones", () => {
    const zones = getColumnZones(7);
    zones.should.deep.eq([1, 4, 7]);
  });

  it("should return zone 8 column zones", () => {
    const zones = getColumnZones(8);
    zones.should.deep.eq([2, 8]);
  });

  it("should return zone 9 column zones", () => {
    const zones = getColumnZones(9);
    zones.should.deep.eq([3, 6, 9]);
  });
});

describe("getClosedWidgetTabIndex", () => {
  it("should return -1", () => {
    getClosedWidgetTabIndex(2).should.eq(-1);
  });

  it("should return existing tabIndex", () => {
    getClosedWidgetTabIndex(-2).should.eq(-2);
  });
});
