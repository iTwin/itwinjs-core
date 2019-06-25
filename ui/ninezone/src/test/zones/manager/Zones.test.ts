/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as Moq from "typemoq";
import {
  Rectangle, DefaultStateManager, NineZoneFactory, TargetType, getDefaultZonesManagerProps, NineZone,
  ZonesManagerProps, HorizontalAnchor, WidgetZone, ZonesManager,
} from "../../../ui-ninezone";
import { TestProps } from "./TestProps";
const defaultProps = getDefaultZonesManagerProps();

describe("NineZone", () => {
  it("should construct an instance", () => {
    new NineZone(defaultProps);
  });
});

// use expect, because dirty-chai ruins the should.exist() helpers
const expect = chai.expect;

describe("ZonesManager", () => {
  const nineZoneFactoryMock = Moq.Mock.ofType<NineZoneFactory>();
  const zonesManagerPropsMock = Moq.Mock.ofType<ZonesManagerProps>();
  const nineZoneMock = Moq.Mock.ofType<NineZone>();

  beforeEach(() => {
    nineZoneFactoryMock.reset();
    zonesManagerPropsMock.reset();

    nineZoneFactoryMock.setup((x) => x(Moq.It.isAny())).returns(() => nineZoneMock.object);
  });

  it("should construct an instance", () => {
    new ZonesManager(nineZoneFactoryMock.object);
  });

  describe("handleTabClick", () => {
    it("should open widget", () => {
      const state = DefaultStateManager.handleTabClick(6, 33, TestProps.defaultProps);
      state.widgets[6].tabIndex.should.eq(33);
    });

    it("should change tab", () => {
      const state = DefaultStateManager.handleTabClick(6, 13, TestProps.openedZone6);
      state.widgets[6].tabIndex.should.eq(13);
    });

    it("should close widget", () => {
      const state = DefaultStateManager.handleTabClick(6, 14, TestProps.openedZone6);
      state.widgets[6].tabIndex.should.eq(-1);
    });

    it("should not close widget when zone is floating", () => {
      const state = DefaultStateManager.handleTabClick(6, 14, TestProps.floatingOpenedZone6);
      state.widgets[6].tabIndex.should.eq(14);
    });

    it("should not close widget in other zone", () => {
      const state = DefaultStateManager.handleTabClick(6, 33, TestProps.openedZone6);
      state.widgets[9].tabIndex.should.eq(1, "w9");
    });
  });

  describe("handleWidgetStateChange", () => {
    it("should not update if tab is already closed", () => {
      const state = DefaultStateManager.handleWidgetStateChange(6, 13, false, TestProps.openedZone6);
      state.widgets[6].tabIndex.should.eq(14);
      state.should.eq(TestProps.openedZone6);
    });
  });

  describe("handleWidgetTabDragEnd", () => {
    it("should merge zones", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: TargetType.Merge,
        },
      };
      const state = DefaultStateManager.handleWidgetTabDragEnd(props);

      state.zones[6].widgets.length.should.eq(2);
      state.zones[6].widgets[0].should.eq(6);
      state.zones[6].widgets[1].should.eq(9);
    });

    it("should merge bounds", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: TargetType.Merge,
        },
      };
      const state = DefaultStateManager.handleWidgetTabDragEnd(props);

      const bounds = state.zones[6].bounds;
      bounds.left.should.eq(10);
      bounds.top.should.eq(20);
      bounds.right.should.eq(99);
      bounds.bottom.should.eq(110);
    });

    it("should unset floating bounds of target zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.floatingOpenedZone6,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 6,
          type: TargetType.Merge,
        },
      };
      const state = DefaultStateManager.handleWidgetTabDragEnd(props);

      expect(state.zones[6].floating).undefined;
    });

    it("should merge all vertical zones between dragging zone and target zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 1, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 7,
          type: TargetType.Merge,
        },
      };
      const state = DefaultStateManager.handleWidgetTabDragEnd(props);

      state.zones[7].widgets.length.should.eq(3);
      state.zones[7].widgets.findIndex((w) => w === 1).should.eq(2);
      state.zones[7].widgets.findIndex((w) => w === 4).should.eq(1);
      state.zones[7].widgets.findIndex((w) => w === 7).should.eq(0);
    });

    it("should merge widget 6 to zone 4", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggingWidget: { id: 6, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 4,
          type: TargetType.Merge,
        },
      };
      const state = DefaultStateManager.handleWidgetTabDragEnd(props);

      state.zones[4].widgets.length.should.eq(2);
      state.zones[4].widgets[0].should.eq(4);
      state.zones[4].widgets[1].should.eq(6);
    });

    it("should merge widget 9 to zone 7 when nine zone is in footer mode", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        target: {
          zoneId: 7,
          type: TargetType.Merge,
        },
      };
      const state = DefaultStateManager.handleWidgetTabDragEnd(props);

      state.zones[7].widgets.length.should.eq(2);
      state.zones[7].widgets[0].should.eq(7);
      state.zones[7].widgets[1].should.eq(9);
    });

    it("should set default anchor of dragged zone", () => {
      const props: ZonesManagerProps = {
        ...TestProps.inWidgetMode,
        draggingWidget: { id: 7, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        widgets: {
          ...TestProps.inWidgetMode.widgets,
          7: {
            ...TestProps.inWidgetMode.widgets[7],
            horizontalAnchor: HorizontalAnchor.Right,
          },
        },
        target: {
          zoneId: 8,
          type: TargetType.Merge,
        },
      };
      const state = DefaultStateManager.handleWidgetTabDragEnd(props);

      state.widgets[8].horizontalAnchor.should.eq(HorizontalAnchor.Left);
    });

    it("should restore horizontal anchor", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
        widgets: {
          ...TestProps.inWidgetMode.widgets,
          9: {
            ...TestProps.inWidgetMode.widgets[9],
            horizontalAnchor: HorizontalAnchor.Left,
          },
        },
        target: {
          zoneId: 9,
          type: TargetType.Back,
        },
      };
      const state = DefaultStateManager.handleWidgetTabDragEnd(props);
      state.widgets[9].horizontalAnchor.should.eq(HorizontalAnchor.Right);
    });

    it("should unset floating bounds", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
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
          type: TargetType.Back,
        },
      };
      const state = DefaultStateManager.handleWidgetTabDragEnd(props);
      expect(state.zones[9].floating).undefined;
    });

    it("should not unset floating bounds of dragging widget", () => {
      const props: ZonesManagerProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 8, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
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
      };
      const state = DefaultStateManager.handleWidgetTabDragEnd(props);
      expect(state.zones[8].floating).exist;
      state.zones[8].floating!.should.eq(props.zones[8].floating);
    });
  });

  describe("handleWidgetTabDragStart", () => {
    it("should set floating bounds", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(6, 1, { x: 0, y: 0 }, new Rectangle(10, 20, 99, 54), TestProps.openedZone6);

      expect(state.zones[6].floating).exist;
      state.zones[6].floating!.bounds.left.should.eq(10);
      state.zones[6].floating!.bounds.top.should.eq(20);
      state.zones[6].floating!.bounds.right.should.eq(99);
      state.zones[6].floating!.bounds.bottom.should.eq(54);
    });

    it("should unmerge merged zone", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9To6);

      state.zones[6].widgets.length.should.eq(1, "z6");
      state.zones[6].widgets[0].should.eq(6, "z6");
      state.zones[9].widgets.length.should.eq(1, "z9");
      state.zones[9].widgets[0].should.eq(9, "z9");
    });

    it("should set bounds when unmerging", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, new Rectangle(20, 10, 99, 110), TestProps.merged9To6);

      const bounds6 = state.zones[6].bounds;
      bounds6.top.should.eq(20, "bounds6.top");
      bounds6.left.should.eq(10, "bounds6.left");
      bounds6.right.should.eq(99, "bounds6.right");
      bounds6.bottom.should.eq(65, "bounds6.bottom");
      expect(state.zones[6].floating, "floatingBounds6").undefined;

      const bounds9 = state.zones[9].bounds;
      bounds9.top.should.eq(65, "bounds9.top");
      bounds9.left.should.eq(10, "bounds9.left");
      bounds9.right.should.eq(99, "bounds9.right");
      bounds9.bottom.should.eq(110, "bounds9.bottom");
      expect(state.zones[9].floating, "floatingBounds9").exist;
      state.zones[9].floating!.bounds.left.should.eq(20, "floatingBounds9.left");
      state.zones[9].floating!.bounds.top.should.eq(10, "floatingBounds9.top");
      state.zones[9].floating!.bounds.right.should.eq(99, "floatingBounds9.right");
      state.zones[9].floating!.bounds.bottom.should.eq(110, "floatingBounds9.bottom");
    });

    it("should set bounds when unmerging switched widgets", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(6, 1, { x: 0, y: 0 }, new Rectangle(10, 54, 99, 110), TestProps.merged6To9);

      const bounds9 = state.zones[9].bounds;
      bounds9.top.should.eq(82, "bounds9.top");
      bounds9.left.should.eq(10, "bounds9.left");
      bounds9.right.should.eq(99, "bounds9.right");
      bounds9.bottom.should.eq(110, "bounds9.bottom");
      expect(state.zones[9].floating, "floatingBounds9").undefined;

      const bounds6 = state.zones[6].bounds;
      bounds6.top.should.eq(54, "bounds6.top");
      bounds6.left.should.eq(10, "bounds6.left");
      bounds6.right.should.eq(99, "bounds6.right");
      bounds6.bottom.should.eq(82, "bounds6.bottom");
      expect(state.zones[6].floating, "floatingBounds6").exist;
      state.zones[6].floating!.bounds.left.should.eq(10, "floatingBounds6.left");
      state.zones[6].floating!.bounds.top.should.eq(54, "floatingBounds6.top");
      state.zones[6].floating!.bounds.right.should.eq(99, "floatingBounds6.right");
      state.zones[6].floating!.bounds.bottom.should.eq(110, "floatingBounds6.bottom");
    });

    it("should set bounds when unmerging horizontally merged zones", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, new Rectangle(10, 20, 99, 110), TestProps.merged9To8);

      const bounds8 = state.zones[8].bounds;
      bounds8.top.should.eq(20, "bounds8.top");
      bounds8.left.should.eq(10, "bounds8.left");
      bounds8.right.should.eq(54.5, "bounds8.right");
      bounds8.bottom.should.eq(110, "bounds8.bottom");
      expect(state.zones[8].floating, "floatingBounds8").undefined;

      const bounds9 = state.zones[9].bounds;
      bounds9.top.should.eq(20, "bounds9.top");
      bounds9.left.should.eq(54.5, "bounds9.left");
      bounds9.right.should.eq(99, "bounds9.right");
      bounds9.bottom.should.eq(110, "bounds9.bottom");
      expect(state.zones[9].floating, "floatingBounds9").exist;
      state.zones[9].floating!.bounds.left.should.eq(10, "floatingBounds9.left");
      state.zones[9].floating!.bounds.top.should.eq(20, "floatingBounds9.top");
      state.zones[9].floating!.bounds.right.should.eq(99, "floatingBounds9.right");
      state.zones[9].floating!.bounds.bottom.should.eq(110, "floatingBounds9.bottom");
    });

    it("should set dragging widget when unmerging", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 10, y: 20 }, new Rectangle(), TestProps.merged9To6);

      expect(state.draggingWidget).exist;
      state.draggingWidget!.id.should.eq(9);
      state.draggingWidget!.lastPosition.x.should.eq(10);
      state.draggingWidget!.lastPosition.y.should.eq(20);
    });

    it("should open tab of zones default widget when unmerging active widget", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 3, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9To6);

      state.zones[6].widgets.length.should.eq(1, "z6.widgets");
      state.zones[6].widgets[0].should.eq(6, "z6.widgets[0]");
      state.widgets[6].tabIndex.should.eq(0, "w6");

      state.zones[9].widgets.length.should.eq(1, "z9.widgets");
      state.zones[9].widgets[0].should.eq(9, "z9.widgets[0]");
      state.widgets[9].tabIndex.should.eq(1, "w9");
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
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 5, { x: 0, y: 0 }, new Rectangle(), props);

      state.widgets[6].tabIndex.should.eq(2, "z6");
      state.widgets[9].tabIndex.should.eq(5, "z9");
    });

    it("return merged widget to default zone when dragging widget in default zone", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(6, 5, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9To6);

      state.zones[6].widgets.length.should.eq(1, "z6.widgets");
      state.zones[6].widgets[0].should.eq(6, "z6.widgets[0]");
      state.zones[9].widgets.length.should.eq(1, "z9.widgets");
      state.zones[9].widgets[0].should.eq(9, "z9.widgets[0]");
    });

    it("should unset anchors of unmerged zones", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(7, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9And8To7);
      state.widgets[8].horizontalAnchor.should.eq(HorizontalAnchor.Right, "z8");
      state.widgets[9].horizontalAnchor.should.eq(HorizontalAnchor.Right, "z9");
    });

    it("should not unset anchor of dragged zone", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(7, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9And8To7);
      state.widgets[7].horizontalAnchor.should.eq(HorizontalAnchor.Left);
    });

    it("should set bounds when unmerging 3 widgets to 3 zones", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, new Rectangle(20, 10, 80, 100), TestProps.merged9And8To7);

      state.zones[7].bounds.left.should.eq(20, "z7.left");
      state.zones[7].bounds.right.should.eq(40, "z7.right");
      state.zones[7].bounds.top.should.eq(10, "z7.top");
      state.zones[7].bounds.bottom.should.eq(100, "z7.bottom");
      expect(state.zones[7].floating, "z7.floating").undefined;

      state.zones[8].bounds.left.should.eq(40, "z8.left");
      state.zones[8].bounds.right.should.eq(60, "z8.right");
      state.zones[8].bounds.top.should.eq(10, "z8.top");
      state.zones[8].bounds.bottom.should.eq(100, "z8.bottom");
      expect(state.zones[8].floating, "z8.floating").undefined;

      state.zones[9].bounds.left.should.eq(60, "z9.left");
      state.zones[9].bounds.right.should.eq(80, "z9.right");
      state.zones[9].bounds.top.should.eq(10, "z9.top");
      state.zones[9].bounds.bottom.should.eq(100, "z9.bottom");

      expect(state.zones[9].floating, "z9.floating").exist;
      state.zones[9].floating!.bounds.left.should.eq(20, "z9.floating.left");
      state.zones[9].floating!.bounds.right.should.eq(80, "z9.floating.right");
      state.zones[9].floating!.bounds.top.should.eq(10, "z9.floating.top");
      state.zones[9].floating!.bounds.bottom.should.eq(100, "z9.floating.bottom");
    });

    it("should unmerge 3 widgets to 3 zones", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9And8To7);

      state.zones[7].widgets.length.should.eq(1, "z7.widgets");
      state.zones[7].widgets[0].should.eq(7, "z7.widgets[0]");

      state.zones[8].widgets.length.should.eq(1, "z8.widgets");
      state.zones[8].widgets[0].should.eq(8, "z8.widgets[0]");

      state.zones[9].widgets.length.should.eq(1, "z9.widgets");
      state.zones[9].widgets[0].should.eq(9, "z9.widgets[0]");
    });

    it("should unmerge all when dragging middle widget", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(8, 1, { x: 0, y: 0 }, new Rectangle(), TestProps.merged9And8To7);

      state.zones[7].widgets.length.should.eq(1, "zones7.widgets.length");
      state.zones[8].widgets.length.should.eq(1, "zones8.widgets.length");
      state.zones[9].widgets.length.should.eq(1, "zones9.widgets.length");

      state.zones[7].widgets[0].should.eq(7);
      state.zones[8].widgets[0].should.eq(8);
      state.zones[9].widgets[0].should.eq(9);
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
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 3, { x: 0, y: 0 }, new Rectangle(), props);

      state.zones[7].widgets.length.should.eq(1, "z7.widgets");
      state.zones[7].widgets[0].should.eq(7, "z7.widgets[0]");

      state.zones[8].widgets.length.should.eq(1, "z8.widgets");
      state.zones[8].widgets[0].should.eq(8, "z8.widgets[0]");

      state.zones[9].widgets.length.should.eq(1, "z9.widgets");
      state.zones[9].widgets[0].should.eq(9, "z9.widgets[0]");

      state.widgets[7].tabIndex.should.eq(0, "w7");
      state.widgets[8].tabIndex.should.eq(-1, "w8");
      state.widgets[9].tabIndex.should.eq(2, "w9");
    });

    it("should not modify state when zone does not allow merging", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        zones: {
          ...TestProps.openedZone6.zones,
          6: {
            ...TestProps.openedZone6.zones[6],
            allowsMerging: false,
          },
        },
      };
      const state = DefaultStateManager.handleWidgetTabDragStart(6, 1, { x: 0, y: 0 }, new Rectangle(), props);

      state.should.eq(props);
    });
  });

  describe("handleTargetChanged", () => {
    it("should change the target", () => {
      const props: ZonesManagerProps = {
        ...TestProps.openedZone6,
        draggingWidget: { id: 9, tabIndex: 1, lastPosition: { x: 0, y: 0 }, isUnmerge: false },
      };
      const state = DefaultStateManager.handleTargetChanged({ zoneId: 9, type: TargetType.Merge }, props);

      expect(state.target).exist;
      state.target!.zoneId.should.eq(9);
    });
  });

  describe("setAllowsMerging", () => {
    it("should set allowsMerging", () => {
      const state = DefaultStateManager.setAllowsMerging(9, false, TestProps.defaultProps);

      state.zones[9].allowsMerging.should.false;
    });

    it("should not modify state when allowsMerging matches", () => {
      const state = DefaultStateManager.setAllowsMerging(9, true, TestProps.defaultProps);

      state.zones[9].allowsMerging.should.true;
      state.should.eq(TestProps.defaultProps);
    });
  });

  describe("mergeZone", () => {
    it("should merge zone", () => {
      const zone4Mock = Moq.Mock.ofType<WidgetZone>();
      const zone6Mock = Moq.Mock.ofType<WidgetZone>();
      zone4Mock.setup((x) => x.canBeMergedTo(Moq.It.is((z) => z === zone6Mock.object))).returns(() => true);
      nineZoneMock.setup((x) => x.getWidgetZone(Moq.It.isValue(4))).returns(() => zone4Mock.object).verifiable(Moq.Times.once());
      nineZoneMock.setup((x) => x.getWidgetZone(Moq.It.isValue(6))).returns(() => zone6Mock.object).verifiable(Moq.Times.once());

      const sut = new ZonesManager(nineZoneFactoryMock.object);
      const state = sut.mergeZone(4, 6, TestProps.defaultProps);
      state.should.matchSnapshot();
    });

    it("should not modify state when zone can not be merged", () => {
      const zone4Mock = Moq.Mock.ofType<WidgetZone>();
      const zone6Mock = Moq.Mock.ofType<WidgetZone>();
      zone4Mock.setup((x) => x.canBeMergedTo(Moq.It.is((z) => z === zone6Mock.object))).returns(() => false);
      nineZoneMock.setup((x) => x.getWidgetZone(Moq.It.isValue(4))).returns(() => zone4Mock.object).verifiable(Moq.Times.once());
      nineZoneMock.setup((x) => x.getWidgetZone(Moq.It.isValue(6))).returns(() => zone6Mock.object).verifiable(Moq.Times.once());
      const sut = new ZonesManager(nineZoneFactoryMock.object);

      const state = sut.mergeZone(4, 6, zonesManagerPropsMock.object);
      expect(state).eq(zonesManagerPropsMock.object);
    });
  });

  describe("addWidget", () => {
    it("should add widget", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager(nineZoneFactoryMock.object);
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
      const sut = new ZonesManager(nineZoneFactoryMock.object);
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
      const sut = new ZonesManager(nineZoneFactoryMock.object);
      const newProps = sut.removeWidget(6, 6, props);

      newProps.should.not.eq(props, "props");
      newProps.zones.should.not.eq(props.zones, "zones");
      newProps.zones[6].widgets.should.not.eq(props.zones[6].widgets, "widgets");
      newProps.zones[6].widgets.length.should.eq(0, "widgets.length");
    });

    it("should not modify props if widget is not in a zone", () => {
      const props = TestProps.defaultProps;
      const sut = new ZonesManager(nineZoneFactoryMock.object);
      const newProps = sut.removeWidget(6, 9, props);

      newProps.should.eq(props, "props");
      newProps.zones.should.eq(props.zones, "zones");
      newProps.zones[6].widgets.should.eq(props.zones[6].widgets, "widgets");
      newProps.zones[6].widgets.length.should.eq(1, "widgets.length");
      newProps.zones[6].widgets[0].should.eq(6, "widgets[0]");
    });
  });
});
