/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as Moq from "typemoq";
import { WidgetZoneLayout, NineZoneRoot, WidgetZoneLayoutProps } from "../../../../src/zones/state/layout/Layouts";
import { WidgetZone } from "../../../../src/zones/state/Zone";
import Widget from "../../../../src/zones/state/Widget";
import { expect } from "chai";
import Rectangle from "../../../../src/utilities/Rectangle";
import NineZone from "../../../../src/zones/state/NineZone";
import Cell from "../../../../src/utilities/Cell";

describe("WidgetZoneLayout", () => {
  const rootMock = Moq.Mock.ofType<NineZoneRoot>();
  const zoneMock = Moq.Mock.ofType<WidgetZone>();
  const props: WidgetZoneLayoutProps = {
    zone: zoneMock.object,
    root: rootMock.object,
  };

  beforeEach(() => {
    rootMock.reset();
    zoneMock.reset();
  });

  it("should construct an instance", () => {
    zoneMock.setup((x) => x.bounds).returns(() => new Rectangle());
    new WidgetZoneLayout(props);
  });

  describe("#getInitialBounds()", () => {
    it("should return initial bounds", () => {
      const nineZoneMock = Moq.Mock.ofType<NineZone>();
      const nineZoneRootMock = Moq.Mock.ofType<NineZoneRoot>();
      nineZoneRootMock.setup((x) => x.isInFooterMode).returns(() => false);
      nineZoneRootMock.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 666, 333));
      nineZoneMock.setup((x) => x.root).returns(() => nineZoneRootMock.object);
      zoneMock.setup((x) => x.nineZone).returns(() => nineZoneMock.object);
      zoneMock.setup((x) => x.cell).returns(() => new Cell(0, 1));
      const sut = new WidgetZoneLayout(props);
      const initialBounds = sut.getInitialBounds();
      initialBounds.left.should.eq(222);
      initialBounds.top.should.eq(0);
      initialBounds.right.should.eq(444);
      initialBounds.bottom.should.eq(111);
    });

    it("should return initial bounds when in footer mode", () => {
      const nineZoneMock = Moq.Mock.ofType<NineZone>();
      const nineZoneRootMock = Moq.Mock.ofType<NineZoneRoot>();
      nineZoneRootMock.setup((x) => x.isInFooterMode).returns(() => true);
      nineZoneRootMock.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 999, 333));
      nineZoneMock.setup((x) => x.root).returns(() => nineZoneRootMock.object);
      zoneMock.setup((x) => x.nineZone).returns(() => nineZoneMock.object);
      zoneMock.setup((x) => x.cell).returns(() => new Cell(0, 2));
      const sut = new WidgetZoneLayout(props);
      const initialBounds = sut.getInitialBounds();
      initialBounds.left.should.eq(666);
      initialBounds.top.should.eq(0);
      initialBounds.right.should.eq(999);
      initialBounds.bottom.should.eq(95);
    });

    it("should return initial bounds for merged zones", () => {
      const nineZoneMock = Moq.Mock.ofType<NineZone>();
      const nineZoneRootMock = Moq.Mock.ofType<NineZoneRoot>();
      const widgetMock = Moq.Mock.ofType<Widget>();
      const mergedWidgetMock = Moq.Mock.ofType<Widget>();
      const mergedZoneMock = Moq.Mock.ofType<WidgetZone>();
      const mergedLayoutMock = Moq.Mock.ofType<WidgetZoneLayout>();
      nineZoneRootMock.setup((x) => x.isInFooterMode).returns(() => true);
      nineZoneRootMock.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 999, 333));
      nineZoneMock.setup((x) => x.root).returns(() => nineZoneRootMock.object);
      zoneMock.setup((x) => x.nineZone).returns(() => nineZoneMock.object);
      zoneMock.setup((x) => x.cell).returns(() => new Cell(0, 2));
      zoneMock.setup((x) => x.hasSingleDefaultWidget).returns(() => false);
      zoneMock.setup((x) => x.getWidgets()).returns(() => [widgetMock.object, mergedWidgetMock.object]);
      zoneMock.setup((x) => x.equals(Moq.It.isAny())).returns((z) => z === zoneMock.object);
      widgetMock.setup((x) => x.defaultZone).returns(() => zoneMock.object);
      mergedWidgetMock.setup((x) => x.defaultZone).returns(() => mergedZoneMock.object);
      mergedZoneMock.setup((x) => x.getLayout()).returns(() => mergedLayoutMock.object);
      mergedLayoutMock.setup((x) => x.getInitialBounds()).returns(() => new Rectangle(678, 234, 987, 345));
      const sut = new WidgetZoneLayout(props);
      const initialBounds = sut.getInitialBounds();
      initialBounds.left.should.eq(666);
      initialBounds.top.should.eq(0);
      initialBounds.right.should.eq(999);
      initialBounds.bottom.should.eq(345);
    });
  });

  describe("AdjacentZones", () => {
    const strategyMock = Moq.Mock.ofType<WidgetZoneLayout.AdjacentZonesStrategy>();
    const layoutMock = Moq.Mock.ofType<WidgetZoneLayout>();
    const sut = WidgetZoneLayout.adjacentZones(strategyMock.object);

    it("should return no zones", () => {
      sut(layoutMock.object).length.should.eq(0);
    });

    it("should return initial zone", () => {
      const initialZoneMock = Moq.Mock.ofType<WidgetZone>();
      zoneMock.setup((x) => x.hasMergedWidgets).returns(() => false);
      zoneMock.setup((x) => x.hasSingleDefaultWidget).returns(() => false);
      layoutMock.setup((x) => x.zone).returns(() => zoneMock.object);
      strategyMock.setup((x) => x.getInitialZone(Moq.It.is((layout) => layoutMock.object === layout))).returns(() => initialZoneMock.object);

      const zones = sut(layoutMock.object);
      zones.length.should.eq(1);
      expect(zones[0]).eq(initialZoneMock.object);
    });

    it("should return zone to which the initial zone is merged", () => {
      const mergedTo = Moq.Mock.ofType<WidgetZone>();
      const defaultWidget = Moq.Mock.ofType<Widget>();
      defaultWidget.setup((x) => x.zone).returns(() => mergedTo.object);
      const initialZoneMock = Moq.Mock.ofType<WidgetZone>();
      initialZoneMock.setup((x) => x.isEmpty).returns(() => true);
      initialZoneMock.setup((x) => x.defaultWidget).returns(() => defaultWidget.object);
      zoneMock.setup((x) => x.hasMergedWidgets).returns(() => false);
      zoneMock.setup((x) => x.hasSingleDefaultWidget).returns(() => true);
      layoutMock.setup((x) => x.zone).returns(() => zoneMock.object);
      strategyMock.setup((x) => x.getInitialZone(Moq.It.is((layout) => layoutMock.object === layout))).returns(() => initialZoneMock.object);

      const zones = sut(layoutMock.object);
      zones.length.should.eq(1);
      expect(zones[0]).eq(mergedTo.object);
    });

    it("should return multiple zones", () => {
      const initialOf1 = Moq.Mock.ofType<WidgetZone>();
      const initialOf2 = Moq.Mock.ofType<WidgetZone>();
      const l1 = Moq.Mock.ofType<WidgetZoneLayout>();
      const l2 = Moq.Mock.ofType<WidgetZoneLayout>();
      const z1 = Moq.Mock.ofType<WidgetZone>();
      z1.setup((x) => x.getLayout()).returns(() => l1.object);
      const z2 = Moq.Mock.ofType<WidgetZone>();
      z2.setup((x) => x.getLayout()).returns(() => l2.object);
      const w1 = Moq.Mock.ofType<Widget>();
      w1.setup((x) => x.defaultZone).returns(() => z1.object);
      const w2 = Moq.Mock.ofType<Widget>();
      w2.setup((x) => x.defaultZone).returns(() => z2.object);
      zoneMock.setup((x) => x.hasMergedWidgets).returns(() => true);
      zoneMock.setup((x) => x.getWidgets()).returns(() => [w1.object, w2.object]);
      layoutMock.setup((x) => x.zone).returns(() => zoneMock.object);
      strategyMock.setup((x) => x.getSingleMergedZone(Moq.It.isAny())).returns(() => false);
      strategyMock.setup((x) => x.getInitialZone(Moq.It.is((l) => l === l1.object))).returns(() => initialOf1.object);
      strategyMock.setup((x) => x.getInitialZone(Moq.It.is((l) => l === l2.object))).returns(() => initialOf2.object);

      const zones = sut(layoutMock.object);
      zones.length.should.eq(2);
      zones.some((z) => z === initialOf1.object).should.eq(true, "initialOf1");
      zones.some((z) => z === initialOf2.object).should.eq(true, "initialOf2");
    });

    it("should return single zone if strategy expects single merged zone", () => {
      const initialOf1 = Moq.Mock.ofType<WidgetZone>();
      const l1 = Moq.Mock.ofType<WidgetZoneLayout>();
      const l2 = Moq.Mock.ofType<WidgetZoneLayout>();
      const z1 = Moq.Mock.ofType<WidgetZone>();
      z1.setup((x) => x.getLayout()).returns(() => l1.object);
      z1.setup((x) => x.id).returns(() => 1);
      const z2 = Moq.Mock.ofType<WidgetZone>();
      z2.setup((x) => x.getLayout()).returns(() => l2.object);
      z2.setup((x) => x.id).returns(() => 2);
      const w1 = Moq.Mock.ofType<Widget>();
      w1.setup((x) => x.defaultZone).returns(() => z1.object);
      const w2 = Moq.Mock.ofType<Widget>();
      w2.setup((x) => x.defaultZone).returns(() => z2.object);
      zoneMock.setup((x) => x.hasMergedWidgets).returns(() => true);
      zoneMock.setup((x) => x.getWidgets()).returns(() => [w1.object, w2.object]);
      layoutMock.setup((x) => x.zone).returns(() => zoneMock.object);
      strategyMock.setup((x) => x.getSingleMergedZone(Moq.It.isAny())).returns(() => true);
      strategyMock.setup((x) => x.getInitialZone(Moq.It.is((l) => l === l1.object))).returns(() => initialOf1.object);
      strategyMock.setup((x) => x.getInitialZone(Moq.It.isAny())).returns(() => Moq.Mock.ofType<WidgetZone>().object);
      strategyMock.setup((x) => x.reduceToFirstZone()).returns(() => true);

      const zones = sut(layoutMock.object);
      zones.length.should.eq(1);
      zones.some((z) => z === initialOf1.object).should.true;
    });
  });
});
