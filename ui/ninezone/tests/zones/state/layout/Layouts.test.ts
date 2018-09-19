/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as TypeMoq from "typemoq";
import { WidgetZoneLayout, NineZoneRoot, WidgetZoneLayoutProps } from "../../../../src/zones/state/layout/Layouts";
import { WidgetZone } from "../../../../src/zones/state/Zone";
import Widget from "../../../../src/zones/state/Widget";
import { expect } from "chai";
import Rectangle from "../../../../src/utilities/Rectangle";

describe("WidgetZoneLayout", () => {
  const rootMock = TypeMoq.Mock.ofType<NineZoneRoot>();
  const zoneMock = TypeMoq.Mock.ofType<WidgetZone>();
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

  describe("AdjacentZones", () => {
    const strategyMock = TypeMoq.Mock.ofType<WidgetZoneLayout.AdjacentZonesStrategy>();
    const layoutMock = TypeMoq.Mock.ofType<WidgetZoneLayout>();
    const sut = WidgetZoneLayout.adjacentZones(strategyMock.object);

    it("should return no zones", () => {
      sut(layoutMock.object).length.should.eq(0);
    });

    it("should return initial zone", () => {
      const initialZoneMock = TypeMoq.Mock.ofType<WidgetZone>();
      zoneMock.setup((x) => x.hasMergedWidgets).returns(() => false);
      zoneMock.setup((x) => x.hasSingleDefaultWidget).returns(() => false);
      layoutMock.setup((x) => x.zone).returns(() => zoneMock.object);
      strategyMock.setup((x) => x.getInitialZone(TypeMoq.It.is((layout) => layoutMock.object === layout))).returns(() => initialZoneMock.object);

      const zones = sut(layoutMock.object);
      zones.length.should.eq(1);
      expect(zones[0]).eq(initialZoneMock.object);
    });

    it("should return zone to which the initial zone is merged", () => {
      const mergedTo = TypeMoq.Mock.ofType<WidgetZone>();
      const defaultWidget = TypeMoq.Mock.ofType<Widget>();
      defaultWidget.setup((x) => x.zone).returns(() => mergedTo.object);
      const initialZoneMock = TypeMoq.Mock.ofType<WidgetZone>();
      initialZoneMock.setup((x) => x.isEmpty).returns(() => true);
      initialZoneMock.setup((x) => x.defaultWidget).returns(() => defaultWidget.object);
      zoneMock.setup((x) => x.hasMergedWidgets).returns(() => false);
      zoneMock.setup((x) => x.hasSingleDefaultWidget).returns(() => true);
      layoutMock.setup((x) => x.zone).returns(() => zoneMock.object);
      strategyMock.setup((x) => x.getInitialZone(TypeMoq.It.is((layout) => layoutMock.object === layout))).returns(() => initialZoneMock.object);

      const zones = sut(layoutMock.object);
      zones.length.should.eq(1);
      expect(zones[0]).eq(mergedTo.object);
    });

    it("should return multiple zones", () => {
      const initialOf1 = TypeMoq.Mock.ofType<WidgetZone>();
      const initialOf2 = TypeMoq.Mock.ofType<WidgetZone>();
      const l1 = TypeMoq.Mock.ofType<WidgetZoneLayout>();
      const l2 = TypeMoq.Mock.ofType<WidgetZoneLayout>();
      const z1 = TypeMoq.Mock.ofType<WidgetZone>();
      z1.setup((x) => x.getLayout()).returns(() => l1.object);
      const z2 = TypeMoq.Mock.ofType<WidgetZone>();
      z2.setup((x) => x.getLayout()).returns(() => l2.object);
      const w1 = TypeMoq.Mock.ofType<Widget>();
      w1.setup((x) => x.defaultZone).returns(() => z1.object);
      const w2 = TypeMoq.Mock.ofType<Widget>();
      w2.setup((x) => x.defaultZone).returns(() => z2.object);
      zoneMock.setup((x) => x.hasMergedWidgets).returns(() => true);
      zoneMock.setup((x) => x.getWidgets()).returns(() => [w1.object, w2.object]);
      layoutMock.setup((x) => x.zone).returns(() => zoneMock.object);
      strategyMock.setup((x) => x.getSingleMergedZone(TypeMoq.It.isAny())).returns(() => false);
      strategyMock.setup((x) => x.getInitialZone(TypeMoq.It.is((l) => l === l1.object))).returns(() => initialOf1.object);
      strategyMock.setup((x) => x.getInitialZone(TypeMoq.It.is((l) => l === l2.object))).returns(() => initialOf2.object);

      const zones = sut(layoutMock.object);
      zones.length.should.eq(2);
      zones.some((z) => z === initialOf1.object).should.eq(true, "initialOf1");
      zones.some((z) => z === initialOf2.object).should.eq(true, "initialOf2");
    });

    it("should return single zone if strategy expects single merged zone", () => {
      const initialOf1 = TypeMoq.Mock.ofType<WidgetZone>();
      const l1 = TypeMoq.Mock.ofType<WidgetZoneLayout>();
      const l2 = TypeMoq.Mock.ofType<WidgetZoneLayout>();
      const z1 = TypeMoq.Mock.ofType<WidgetZone>();
      z1.setup((x) => x.getLayout()).returns(() => l1.object);
      z1.setup((x) => x.id).returns(() => 1);
      const z2 = TypeMoq.Mock.ofType<WidgetZone>();
      z2.setup((x) => x.getLayout()).returns(() => l2.object);
      z2.setup((x) => x.id).returns(() => 2);
      const w1 = TypeMoq.Mock.ofType<Widget>();
      w1.setup((x) => x.defaultZone).returns(() => z1.object);
      const w2 = TypeMoq.Mock.ofType<Widget>();
      w2.setup((x) => x.defaultZone).returns(() => z2.object);
      zoneMock.setup((x) => x.hasMergedWidgets).returns(() => true);
      zoneMock.setup((x) => x.getWidgets()).returns(() => [w1.object, w2.object]);
      layoutMock.setup((x) => x.zone).returns(() => zoneMock.object);
      strategyMock.setup((x) => x.getSingleMergedZone(TypeMoq.It.isAny())).returns(() => true);
      strategyMock.setup((x) => x.getInitialZone(TypeMoq.It.is((l) => l === l1.object))).returns(() => initialOf1.object);
      strategyMock.setup((x) => x.getInitialZone(TypeMoq.It.isAny())).returns(() => TypeMoq.Mock.ofType<WidgetZone>().object);
      strategyMock.setup((x) => x.reduceToFirstZone()).returns(() => true);

      const zones = sut(layoutMock.object);
      zones.length.should.eq(1);
      zones.some((z) => z === initialOf1.object).should.true;
    });
  });
});
