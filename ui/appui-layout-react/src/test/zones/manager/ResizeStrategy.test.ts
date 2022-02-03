/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import * as Moq from "typemoq";
import type { RectangleProps } from "@itwin/core-react";
import { Rectangle } from "@itwin/core-react";
import type { ResizeStrategy, WidgetZoneId, ZonesManagerProps} from "../../../appui-layout-react";
import {
  GrowBottom, GrowLeft, GrowRight, GrowStrategy, GrowTop, HorizontalAnchor, ShrinkBottom, ShrinkHorizontalStrategy, ShrinkLeft, ShrinkRight,
  ShrinkStrategy, ShrinkTop, ShrinkVerticalStrategy, UpdateWindowResizeSettings, ZonesManager,
} from "../../../appui-layout-react";
import type { BottomZones, LeftZones, RightZones, TopZones } from "../../../appui-layout-react/zones/manager/AdjacentZones";
import TestProps from "./TestProps";

const zonesManagerMock = Moq.Mock.ofType<ZonesManager>();
const zonesManagerPropsMock = Moq.Mock.ofType<ZonesManagerProps>();
const zonesMock = Moq.Mock.ofType<ZonesManagerProps["zones"]>();
const widgetsMock = Moq.Mock.ofType<ZonesManagerProps["widgets"]>();

beforeEach(() => {
  zonesManagerMock.reset();
  zonesManagerPropsMock.reset();
  zonesMock.reset();
  widgetsMock.reset();
  zonesManagerPropsMock.setup((x) => x.widgets).returns(() => widgetsMock.object);
  zonesManagerPropsMock.setup((x) => x.zones).returns(() => zonesMock.object);
});

describe("GrowStrategy", () => {
  class GrowStrategyMock extends GrowStrategy {
    public getZonesToShrink(_zoneId: WidgetZoneId, _props: ZonesManagerProps): WidgetZoneId[] {
      throw new Error("Method not implemented.");
    }
    public getDistanceToRoot(_bounds: RectangleProps): number {
      throw new Error("Method not implemented.");
    }
    public getDistanceToZoneToShrink(_zoneId: WidgetZoneId, _zoneToShrinkId: WidgetZoneId, _props: ZonesManagerProps): number {
      throw new Error("Method not implemented.");
    }
    public getShrinkStrategy(): ResizeStrategy {
      throw new Error("Method not implemented.");
    }
    public resize(_bounds: RectangleProps, _growBy: number): RectangleProps {
      throw new Error("Method not implemented.");
    }
  }

  describe("getMaxResize", () => {
    it("should return 0 if zone is not resizable", () => {
      zonesManagerMock.setup((x) => x.isResizable(6)).returns(() => false);
      const sut = new GrowStrategyMock(zonesManagerMock.object);
      const maxResize = sut.getMaxResize(6, zonesManagerPropsMock.object);
      maxResize.should.eq(0);
    });

    it("should return space to root", () => {
      zonesManagerMock.setup((x) => x.isResizable(6)).returns(() => true);
      const sut = new GrowStrategyMock(zonesManagerMock.object);
      sinon.stub(sut, "getZonesToShrink").returns([]);
      const getDistanceToRoot = sinon.stub(sut, "getDistanceToRoot").returns(100);
      const maxResize = sut.getMaxResize(6, zonesManagerPropsMock.object);

      getDistanceToRoot.calledOnce.should.true;
      maxResize.should.eq(100);
    });

    it("should return max resize", () => {
      const shrinkStrategy = Moq.Mock.ofType<ResizeStrategy>();
      shrinkStrategy.setup((x) => x.getMaxResize(4, Moq.It.isAny())).returns(() => 20);
      shrinkStrategy.setup((x) => x.getMaxResize(6, Moq.It.isAny())).returns(() => 5);
      zonesManagerMock.setup((x) => x.isResizable(7)).returns(() => true);
      const sut = new GrowStrategyMock(zonesManagerMock.object);
      const getDistanceToZoneToShrink = sinon.stub(sut, "getDistanceToZoneToShrink");
      sinon.stub(sut, "getZonesToShrink").returns([4, 6]);
      sinon.stub(sut, "getShrinkStrategy").returns(shrinkStrategy.object);
      getDistanceToZoneToShrink.withArgs(7, 4, sinon.match.any).returns(40);
      getDistanceToZoneToShrink.withArgs(7, 6, sinon.match.any).returns(50);

      const maxResize = sut.getMaxResize(7, zonesManagerPropsMock.object);
      maxResize.should.eq(55);
    });
  });

  describe("tryResize", () => {
    it("should resize bounds", () => {
      const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zonesMock.setup((x) => x[6]).returns(() => zone.object);
      zone.setup((x) => x.floating).returns(() => undefined);
      const sut = new GrowStrategyMock(zonesManagerMock.object);
      sinon.stub(sut, "getMaxResize").returns(100);
      sinon.stub(sut, "getZonesToShrink").returns([]);

      const resizedBounds: RectangleProps = {
        bottom: 0,
        left: 1,
        top: 2,
        right: 3,
      };
      sinon.stub(sut, "resize").returns(resizedBounds);
      const newProps = sut.tryResize(6, 100, zonesManagerPropsMock.object);

      newProps.should.not.eq(zonesManagerPropsMock.object, "props");
      newProps.zones.should.not.eq(zonesManagerPropsMock.object.zones, "zones");
      newProps.zones[6].should.not.eq(zonesManagerPropsMock.object.zones[6], "zones[6]");
      newProps.zones[6].bounds.should.eq(resizedBounds, "bounds");
    });

    it("should not modify props if resizing by 0", () => {
      const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zonesMock.setup((x) => x[6]).returns(() => zone.object);
      zone.setup((x) => x.floating).returns(() => undefined);
      const sut = new GrowStrategyMock(zonesManagerMock.object);
      sinon.stub(sut, "getMaxResize").returns(0);
      const newProps = sut.tryResize(6, 100, zonesManagerPropsMock.object);

      (newProps === zonesManagerPropsMock.object).should.eq(true, "props");
    });

    it("should shrink zones in same direction", () => {
      const z7 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const shrinkStrategy = Moq.Mock.ofType<ResizeStrategy>();
      zonesMock.setup((x) => x[7]).returns(() => z7.object);
      z7.setup((x) => x.floating).returns(() => undefined);
      shrinkStrategy.setup((x) => x.tryResize(6, 0, Moq.It.isAny())).returns(() => zonesManagerPropsMock.object);

      const sut = new GrowStrategyMock(zonesManagerMock.object);
      const getDistanceToZoneToShrinkStub = sinon.stub(sut, "getDistanceToZoneToShrink");
      const resizeStub = sinon.stub(sut, "resize");
      getDistanceToZoneToShrinkStub.withArgs(7, 4, sinon.match.any).returns(20);
      getDistanceToZoneToShrinkStub.withArgs(7, 6, sinon.match.any).returns(130);
      sinon.stub(sut, "getMaxResize").returns(100);
      sinon.stub(sut, "getZonesToShrink").returns([4, 6]);
      sinon.stub(sut, "getShrinkStrategy").returns(shrinkStrategy.object);
      const newProps = sut.tryResize(7, 100, zonesManagerPropsMock.object);

      shrinkStrategy.verify((x) => x.tryResize(4, 80, Moq.It.isAny()), Moq.Times.once());
      shrinkStrategy.verify((x) => x.tryResize(6, 0, Moq.It.isAny()), Moq.Times.once());
      resizeStub.calledOnceWithExactly(sinon.match.any, 100).should.true;
      (newProps !== zonesManagerPropsMock.object).should.eq(true, "props");
    });
  });

  describe("tryResizeFloating", () => {
    it("should throw if zone is not floating", () => {
      const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zonesMock.setup((x) => x[6]).returns(() => zone.object);
      zone.setup((x) => x.floating).returns(() => undefined);
      const sut = new GrowStrategyMock(zonesManagerMock.object);
      (() => sut.tryResizeFloating(6, 100, zonesManagerPropsMock.object)).should.throw();
    });

    it("should resize", () => {
      const props = Moq.Mock.ofType<ZonesManagerProps>();
      const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const floating = Moq.Mock.ofType<NonNullable<ZonesManagerProps["zones"][WidgetZoneId]["floating"]>>();
      const floatingBounds: RectangleProps = {
        bottom: 1,
        left: 2,
        right: 3,
        top: 4,
      };
      zonesMock.setup((x) => x[6]).returns(() => zone.object);
      zone.setup((x) => x.floating).returns(() => floating.object);
      floating.setup((x) => x.bounds).returns(() => floatingBounds);
      zonesManagerMock.setup((x) => x.setZoneFloatingBounds(6, Moq.It.isAny(), Moq.It.isAny())).returns(() => props.object);

      const resizedBounds: RectangleProps = {
        bottom: 0,
        left: 1,
        right: 2,
        top: 3,
      };
      const sut = new GrowStrategyMock(zonesManagerMock.object);
      sinon.stub(sut, "getDistanceToRoot").returns(40);
      const resizeStub = sinon.stub(sut, "resize").returns(resizedBounds);
      const newProps = sut.tryResizeFloating(6, 100, zonesManagerPropsMock.object);

      resizeStub.calledOnceWithExactly(floatingBounds, 40).should.true;

      (newProps !== zonesManagerPropsMock.object).should.true;
      (newProps === props.object).should.true;
    });
  });
});

describe("GrowTop", () => {
  it("should return zones to shrink", () => {
    const topZones = Moq.Mock.ofType<TopZones>();
    zonesManagerMock.setup((x) => x.topZones).returns(() => topZones.object);
    topZones.setup((x) => x.getCurrent(6, zonesManagerPropsMock.object)).returns(() => [3]);
    const sut = new GrowTop(zonesManagerMock.object);
    const zonesToShrink = sut.getZonesToShrink(6, zonesManagerPropsMock.object);

    topZones.verify((x) => x.getCurrent(6, zonesManagerPropsMock.object), Moq.Times.once());
    zonesToShrink.should.deep.eq([3]);
  });

  it("should return distance to root", () => {
    const sut = new GrowTop(zonesManagerMock.object);
    const distance = sut.getDistanceToRoot({ bottom: 0, left: 0, right: 0, top: 44 });
    distance.should.eq(44);
  });

  it("should return distance to zone to shrink", () => {
    const z3 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    zonesMock.setup((x) => x[3]).returns(() => z3.object);
    zonesMock.setup((x) => x[6]).returns(() => z6.object);
    z3.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 0, 50));
    z6.setup((x) => x.bounds).returns(() => new Rectangle(0, 80));
    const sut = new GrowTop(zonesManagerMock.object);
    const distance = sut.getDistanceToZoneToShrink(6, 3, zonesManagerPropsMock.object);
    distance.should.eq(30);
  });

  it("should return shrink strategy", () => {
    const shrinkStrategy = Moq.Mock.ofType<ZonesManager["shrinkBottom"]>();
    zonesManagerMock.setup((x) => x.shrinkBottom).returns(() => shrinkStrategy.object);
    const sut = new GrowTop(zonesManagerMock.object);
    const strategy = sut.getShrinkStrategy();

    (strategy === shrinkStrategy.object).should.true;
  });

  it("should resize bounds", () => {
    const sut = new GrowTop(zonesManagerMock.object);
    const resizedBounds = sut.resize(new Rectangle(0, 100), 20);
    resizedBounds.should.deep.eq(new Rectangle(0, 80));
  });
});

describe("GrowBottom", () => {
  it("should return zones to shrink", () => {
    const bottomZones = Moq.Mock.ofType<BottomZones>();
    zonesManagerMock.setup((x) => x.bottomZones).returns(() => bottomZones.object);
    bottomZones.setup((x) => x.getCurrent(6, zonesManagerPropsMock.object)).returns(() => [9]);
    const sut = new GrowBottom(zonesManagerMock.object);
    const zonesToShrink = sut.getZonesToShrink(6, zonesManagerPropsMock.object);

    bottomZones.verify((x) => x.getCurrent(6, zonesManagerPropsMock.object), Moq.Times.once());
    zonesToShrink.should.deep.eq([9]);
  });

  it("should return distance to root", () => {
    const sut = new GrowBottom(zonesManagerMock.object);
    const distance = sut.getDistanceToRoot(new Rectangle(0, 0, 0, 100), new Rectangle(0, 0, 0, 155));
    distance.should.eq(55);
  });

  it("should return distance to zone to shrink", () => {
    const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    const z9 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    zonesMock.setup((x) => x[6]).returns(() => z6.object);
    zonesMock.setup((x) => x[9]).returns(() => z9.object);
    z6.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 0, 50));
    z9.setup((x) => x.bounds).returns(() => new Rectangle(0, 80));
    const sut = new GrowBottom(zonesManagerMock.object);
    const distance = sut.getDistanceToZoneToShrink(6, 9, zonesManagerPropsMock.object);
    distance.should.eq(30);
  });

  it("should return shrink strategy", () => {
    const shrinkStrategy = Moq.Mock.ofType<ZonesManager["shrinkTop"]>();
    zonesManagerMock.setup((x) => x.shrinkTop).returns(() => shrinkStrategy.object);
    const sut = new GrowBottom(zonesManagerMock.object);
    const strategy = sut.getShrinkStrategy();

    (strategy === shrinkStrategy.object).should.true;
  });

  it("should resize bounds", () => {
    const sut = new GrowBottom(zonesManagerMock.object);
    const resizedBounds = sut.resize(new Rectangle(0, 0, 0, 50), 20);
    resizedBounds.should.deep.eq(new Rectangle(0, 0, 0, 70));
  });
});

describe("GrowLeft", () => {
  it("should return zones to shrink", () => {
    const leftZones = Moq.Mock.ofType<LeftZones>();
    zonesManagerMock.setup((x) => x.leftZones).returns(() => leftZones.object);
    leftZones.setup((x) => x.getCurrent(9, zonesManagerPropsMock.object)).returns(() => [8]);
    const sut = new GrowLeft(zonesManagerMock.object);
    const zonesToShrink = sut.getZonesToShrink(9, zonesManagerPropsMock.object);

    leftZones.verify((x) => x.getCurrent(9, zonesManagerPropsMock.object), Moq.Times.once());
    zonesToShrink.should.deep.eq([8]);
  });

  it("should return distance to root", () => {
    const sut = new GrowLeft(zonesManagerMock.object);
    const distance = sut.getDistanceToRoot(new Rectangle(41));
    distance.should.eq(41);
  });

  it("should return distance to zone to shrink", () => {
    const z8 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    const z9 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    zonesMock.setup((x) => x[8]).returns(() => z8.object);
    zonesMock.setup((x) => x[9]).returns(() => z9.object);
    z8.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 10));
    z9.setup((x) => x.bounds).returns(() => new Rectangle(40));
    const sut = new GrowLeft(zonesManagerMock.object);
    const distance = sut.getDistanceToZoneToShrink(9, 8, zonesManagerPropsMock.object);
    distance.should.eq(30);
  });

  it("should return shrink strategy", () => {
    const shrinkStrategy = Moq.Mock.ofType<ZonesManager["shrinkRight"]>();
    zonesManagerMock.setup((x) => x.shrinkRight).returns(() => shrinkStrategy.object);
    const sut = new GrowLeft(zonesManagerMock.object);
    const strategy = sut.getShrinkStrategy();

    (strategy === shrinkStrategy.object).should.true;
  });

  it("should resize bounds", () => {
    const sut = new GrowLeft(zonesManagerMock.object);
    const resizedBounds = sut.resize(new Rectangle(50), 20);
    resizedBounds.should.deep.eq(new Rectangle(30));
  });

  it("should not resize zone over initial bounds", () => {
    const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    const widget = Moq.Mock.ofType<ZonesManagerProps["widgets"][WidgetZoneId]>();
    zonesMock.setup((x) => x[6]).returns(() => zone.object);
    widgetsMock.setup((x) => x[6]).returns(() => widget.object);
    zone.setup((x) => x.floating).returns(() => undefined);
    zone.setup((x) => x.bounds).returns(() => new Rectangle(80));
    widget.setup((x) => x.horizontalAnchor).returns(() => HorizontalAnchor.Right);
    sinon.stub(GrowStrategy.prototype, "getMaxResize").returns(50);
    zonesManagerMock.setup((x) => x.getInitialBounds(6, Moq.It.isAny())).returns(() => new Rectangle(50));

    const sut = new GrowLeft(zonesManagerMock.object);
    const maxResize = sut.getMaxResize(6, zonesManagerPropsMock.object);
    maxResize.should.eq(30);
  });

  it("should resize zone over initial bounds", () => {
    sinon.stub(GrowStrategy.prototype, "getMaxResize").returns(50);
    const sut = new GrowLeft(zonesManagerMock.object);
    const maxResize = sut.getMaxResize(6, zonesManagerPropsMock.object);
    maxResize.should.eq(50);
  });
});

describe("GrowRight", () => {
  it("should return zones to shrink", () => {
    const rightZones = Moq.Mock.ofType<RightZones>();
    zonesManagerMock.setup((x) => x.rightZones).returns(() => rightZones.object);
    rightZones.setup((x) => x.getCurrent(7, zonesManagerPropsMock.object)).returns(() => [8]);
    const sut = new GrowRight(zonesManagerMock.object);
    const zonesToShrink = sut.getZonesToShrink(7, zonesManagerPropsMock.object);

    rightZones.verify((x) => x.getCurrent(7, zonesManagerPropsMock.object), Moq.Times.once());
    zonesToShrink.should.deep.eq([8]);
  });

  it("should return distance to root", () => {
    const sut = new GrowRight(zonesManagerMock.object);
    const distance = sut.getDistanceToRoot(new Rectangle(0, 0, 59), new Rectangle(0, 0, 100));
    distance.should.eq(41);
  });

  it("should return distance to zone to shrink", () => {
    const z7 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    const z8 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    zonesMock.setup((x) => x[7]).returns(() => z7.object);
    zonesMock.setup((x) => x[8]).returns(() => z8.object);
    z7.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 40));
    z8.setup((x) => x.bounds).returns(() => new Rectangle(70));
    const sut = new GrowRight(zonesManagerMock.object);
    const distance = sut.getDistanceToZoneToShrink(7, 8, zonesManagerPropsMock.object);
    distance.should.eq(30);
  });

  it("should return shrink strategy", () => {
    const shrinkStrategy = Moq.Mock.ofType<ZonesManager["shrinkLeft"]>();
    zonesManagerMock.setup((x) => x.shrinkLeft).returns(() => shrinkStrategy.object);
    const sut = new GrowRight(zonesManagerMock.object);
    const strategy = sut.getShrinkStrategy();

    (strategy === shrinkStrategy.object).should.true;
  });

  it("should resize bounds", () => {
    const sut = new GrowRight(zonesManagerMock.object);
    const resizedBounds = sut.resize(new Rectangle(0, 0, 10), 20);
    resizedBounds.should.deep.eq(new Rectangle(0, 0, 30));
  });

  it("should not resize zone over initial bounds", () => {
    const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    const widget = Moq.Mock.ofType<ZonesManagerProps["widgets"][WidgetZoneId]>();
    zonesMock.setup((x) => x[4]).returns(() => zone.object);
    widgetsMock.setup((x) => x[4]).returns(() => widget.object);
    zone.setup((x) => x.floating).returns(() => undefined);
    zone.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 20));
    widget.setup((x) => x.horizontalAnchor).returns(() => HorizontalAnchor.Left);
    sinon.stub(GrowStrategy.prototype, "getMaxResize").returns(50);
    zonesManagerMock.setup((x) => x.getInitialBounds(4, Moq.It.isAny())).returns(() => new Rectangle(0, 0, 50));

    const sut = new GrowRight(zonesManagerMock.object);
    const maxResize = sut.getMaxResize(4, zonesManagerPropsMock.object);
    maxResize.should.eq(30);
  });

  it("should resize zone over initial bounds", () => {
    sinon.stub(GrowStrategy.prototype, "getMaxResize").returns(50);
    const sut = new GrowRight(zonesManagerMock.object);
    const maxResize = sut.getMaxResize(4, zonesManagerPropsMock.object);
    maxResize.should.eq(50);
  });
});

describe("ShrinkStrategy", () => {
  class ShrinkStrategyMock extends ShrinkStrategy {
    public getDistanceToRoot(_bounds: RectangleProps): number {
      throw new Error("Method not implemented.");
    }
    public getDistanceToZoneToShrink(_zoneId: WidgetZoneId, _zoneToShrinkId: WidgetZoneId, _props: ZonesManagerProps): number {
      throw new Error("Method not implemented.");
    }
    public getZonesToShrink(_zoneId: WidgetZoneId, _props: ZonesManagerProps): WidgetZoneId[] {
      throw new Error("Method not implemented.");
    }
    public getShrinkStrategy(): ResizeStrategy {
      throw new Error("Method not implemented.");
    }
    public getMinSize(): number {
      throw new Error("Method not implemented.");
    }
    public getCurrentSize(_bounds: RectangleProps): number {
      throw new Error("Method not implemented.");
    }
    public resize(_bounds: RectangleProps, _shrinkBy: number, _moveBy: number): RectangleProps {
      throw new Error("Method not implemented.");
    }
  }

  describe("getMaxResize", () => {
    it("should return 0 if zone is not resizable", () => {
      zonesManagerMock.setup((x) => x.isResizable(6)).returns(() => false);
      const sut = new ShrinkStrategyMock(zonesManagerMock.object);
      const maxResize = sut.getMaxResize(6, zonesManagerPropsMock.object);
      maxResize.should.eq(0);
    });

    it("should return distance to root + max shrink", () => {
      const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zonesMock.setup((x) => x[6]).returns(() => z6.object);
      zonesManagerMock.setup((x) => x.isResizable(6)).returns(() => true);
      const sut = new ShrinkStrategyMock(zonesManagerMock.object);
      sinon.stub(sut, "getMaxShrinkSelfBy").returns(100);
      sinon.stub(sut, "getDistanceToRoot").returns(100);
      sinon.stub(sut, "getZonesToShrink").returns([]);
      const maxResize = sut.getMaxResize(6, zonesManagerPropsMock.object);
      maxResize.should.eq(200);
    });

    it("should return max resize", () => {
      const shrinkStrategy = Moq.Mock.ofType<ResizeStrategy>();
      shrinkStrategy.setup((x) => x.getMaxResize(4, Moq.It.isAny())).returns(() => 20);
      shrinkStrategy.setup((x) => x.getMaxResize(6, Moq.It.isAny())).returns(() => 5);
      zonesManagerMock.setup((x) => x.isResizable(7)).returns(() => true);
      const sut = new ShrinkStrategyMock(zonesManagerMock.object);
      const getDistanceToZoneToShrink = sinon.stub(sut, "getDistanceToZoneToShrink");
      sinon.stub(sut, "getMaxShrinkSelfBy").returns(100);
      sinon.stub(sut, "getZonesToShrink").returns([4, 6]);
      sinon.stub(sut, "getShrinkStrategy").returns(shrinkStrategy.object);
      getDistanceToZoneToShrink.withArgs(7, 4, sinon.match.any).returns(40);
      getDistanceToZoneToShrink.withArgs(7, 6, sinon.match.any).returns(50);

      const maxResize = sut.getMaxResize(7, zonesManagerPropsMock.object);
      maxResize.should.eq(155);
    });
  });

  describe("tryResize", () => {
    it("should resize", () => {
      const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zonesMock.setup((x) => x[6]).returns(() => zone.object);
      zone.setup((x) => x.floating).returns(() => undefined);
      const sut = new ShrinkStrategyMock(zonesManagerMock.object);
      sinon.stub(sut, "getMaxResize").returns(100);
      sinon.stub(sut, "getMaxShrinkSelfBy").returns(100);
      sinon.stub(sut, "getZonesToShrink").returns([]);

      const resizedBounds: RectangleProps = {
        bottom: 0,
        left: 1,
        top: 2,
        right: 3,
      };
      sinon.stub(sut, "resize").returns(resizedBounds);
      const newProps = sut.tryResize(6, 100, zonesManagerPropsMock.object);

      newProps.should.not.eq(zonesManagerPropsMock.object, "props");
      newProps.zones.should.not.eq(zonesManagerPropsMock.object.zones, "zones");
      newProps.zones[6].should.not.eq(zonesManagerPropsMock.object.zones[6], "zones[6]");
      newProps.zones[6].bounds.should.eq(resizedBounds, "bounds");
    });

    it("should not modify props if resizing by 0", () => {
      const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zonesMock.setup((x) => x[6]).returns(() => zone.object);
      zone.setup((x) => x.floating).returns(() => undefined);
      const sut = new ShrinkStrategyMock(zonesManagerMock.object);
      sinon.stub(sut, "getMaxResize").returns(0);
      const newProps = sut.tryResize(6, 100, zonesManagerPropsMock.object);

      (newProps === zonesManagerPropsMock.object).should.eq(true, "props");
    });

    it("should shrink zones in same direction", () => {
      const z7 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const shrinkStrategy = Moq.Mock.ofType<ResizeStrategy>();
      zonesMock.setup((x) => x[7]).returns(() => z7.object);
      z7.setup((x) => x.floating).returns(() => undefined);
      shrinkStrategy.setup((x) => x.tryResize(6, 0, Moq.It.isAny())).returns(() => zonesManagerPropsMock.object);

      const sut = new ShrinkStrategyMock(zonesManagerMock.object);
      const getDistanceToZoneToShrinkStub = sinon.stub(sut, "getDistanceToZoneToShrink");
      const resizeStub = sinon.stub(sut, "resize");
      getDistanceToZoneToShrinkStub.withArgs(7, 4, sinon.match.any).returns(20);
      getDistanceToZoneToShrinkStub.withArgs(7, 6, sinon.match.any).returns(130);
      sinon.stub(sut, "getMaxResize").returns(150);
      sinon.stub(sut, "getMaxShrinkSelfBy").returns(100);
      sinon.stub(sut, "getZonesToShrink").returns([4, 6]);
      sinon.stub(sut, "getShrinkStrategy").returns(shrinkStrategy.object);
      const newProps = sut.tryResize(7, 200, zonesManagerPropsMock.object);

      shrinkStrategy.verify((x) => x.tryResize(4, 30, Moq.It.isAny()), Moq.Times.once());
      shrinkStrategy.verify((x) => x.tryResize(6, 0, Moq.It.isAny()), Moq.Times.once());
      resizeStub.calledOnceWithExactly(sinon.match.any, 100, 50).should.true;
      (newProps !== zonesManagerPropsMock.object).should.eq(true, "props");
    });
  });

  describe("tryResizeFloating", () => {
    it("should throw if zone is not floating", () => {
      const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zonesMock.setup((x) => x[6]).returns(() => zone.object);
      zone.setup((x) => x.floating).returns(() => undefined);
      const sut = new ShrinkStrategyMock(zonesManagerMock.object);
      (() => sut.tryResizeFloating(6, 100, zonesManagerPropsMock.object)).should.throw();
    });

    it("should resize", () => {
      const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const floating = Moq.Mock.ofType<NonNullable<ZonesManagerProps["zones"][WidgetZoneId]["floating"]>>();
      const floatingBounds: RectangleProps = {
        bottom: 1,
        left: 2,
        right: 3,
        top: 4,
      };
      zonesMock.setup((x) => x[6]).returns(() => zone.object);
      zone.setup((x) => x.floating).returns(() => floating.object);
      floating.setup((x) => x.bounds).returns(() => floatingBounds);
      const resizedBounds: RectangleProps = {
        bottom: 0,
        left: 1,
        right: 2,
        top: 3,
      };
      const sut = new ShrinkStrategyMock(zonesManagerMock.object);
      sinon.stub(sut, "getMaxShrinkSelfBy").returns(40);
      const resizeStub = sinon.stub(sut, "resize").returns(resizedBounds);
      const newProps = sut.tryResizeFloating(6, 100, zonesManagerPropsMock.object);

      resizeStub.calledOnceWithExactly(floatingBounds, 40, 0).should.true;
      newProps.should.not.eq(zonesManagerPropsMock.object);
    });
  });

  describe("getMaxShrinkSelfBy", () => {
    const zone = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    zonesMock.setup((x) => x[6]).returns(() => zone.object);
    zone.setup((x) => x.floating).returns(() => undefined);
    const sut = new ShrinkStrategyMock(zonesManagerMock.object);
    sinon.stub(sut, "getMinSize").returns(40);
    sinon.stub(sut, "getCurrentSize").returns(100);
    sut.getMaxShrinkSelfBy(new Rectangle()).should.eq(60);
  });
});

describe("ShrinkHorizontalStrategy ", () => {
  class ShrinkHorizontalStrategyMock extends ShrinkHorizontalStrategy {
    public getDistanceToRoot(_bounds: RectangleProps): number {
      throw new Error("Method not implemented.");
    }
    public getDistanceToZoneToShrink(_zoneId: WidgetZoneId, _zoneToShrinkId: WidgetZoneId, _props: ZonesManagerProps): number {
      throw new Error("Method not implemented.");
    }
    public getZonesToShrink(_zoneId: WidgetZoneId, _props: ZonesManagerProps): WidgetZoneId[] {
      throw new Error("Method not implemented.");
    }
    public getShrinkStrategy(): ResizeStrategy {
      throw new Error("Method not implemented.");
    }
    public resize(_bounds: RectangleProps, _shrinkBy: number, _moveBy: number): RectangleProps {
      throw new Error("Method not implemented.");
    }
  }

  it("should return min size", () => {
    new ShrinkHorizontalStrategyMock(zonesManagerMock.object).getMinSize().should.eq(296);
  });

  it("should return current size", () => {
    new ShrinkHorizontalStrategyMock(zonesManagerMock.object).getCurrentSize(new Rectangle(0, 100, 200, 400)).should.eq(200);
  });
});

describe("ShrinkVerticalStrategy ", () => {
  class ShrinkVerticalStrategyMock extends ShrinkVerticalStrategy {
    public getDistanceToRoot(_bounds: RectangleProps): number {
      throw new Error("Method not implemented.");
    }
    public getDistanceToZoneToShrink(_zoneId: WidgetZoneId, _zoneToShrinkId: WidgetZoneId, _props: ZonesManagerProps): number {
      throw new Error("Method not implemented.");
    }
    public getZonesToShrink(_zoneId: WidgetZoneId, _props: ZonesManagerProps): WidgetZoneId[] {
      throw new Error("Method not implemented.");
    }
    public getShrinkStrategy(): ResizeStrategy {
      throw new Error("Method not implemented.");
    }
    public resize(_bounds: RectangleProps, _shrinkBy: number, _moveBy: number): RectangleProps {
      throw new Error("Method not implemented.");
    }
  }

  it("should return min size", () => {
    new ShrinkVerticalStrategyMock(zonesManagerMock.object).getMinSize().should.eq(220);
  });

  it("should return current size", () => {
    new ShrinkVerticalStrategyMock(zonesManagerMock.object).getCurrentSize(new Rectangle(0, 100, 200, 400)).should.eq(300);
  });
});

describe("ShrinkTop", () => {
  it("should return zones to shrink", () => {
    const bottomZones = Moq.Mock.ofType<BottomZones>();
    zonesManagerMock.setup((x) => x.bottomZones).returns(() => bottomZones.object);
    bottomZones.setup((x) => x.getCurrent(6, zonesManagerPropsMock.object)).returns(() => [9]);
    const sut = new ShrinkTop(zonesManagerMock.object);
    const zonesToShrink = sut.getZonesToShrink(6, zonesManagerPropsMock.object);

    bottomZones.verify((x) => x.getCurrent(6, zonesManagerPropsMock.object), Moq.Times.once());
    zonesToShrink.should.deep.eq([9]);
  });

  it("should return distance to root", () => {
    const sut = new ShrinkTop(zonesManagerMock.object);
    const distance = sut.getDistanceToRoot(new Rectangle(0, 0, 0, 100), new Rectangle(0, 0, 0, 144));
    distance.should.eq(44);
  });

  it("should return distance to zone to shrink", () => {
    const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    const z9 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    zonesMock.setup((x) => x[6]).returns(() => z6.object);
    zonesMock.setup((x) => x[9]).returns(() => z9.object);
    z6.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 0, 50));
    z9.setup((x) => x.bounds).returns(() => new Rectangle(0, 80, 0, 0));
    const sut = new ShrinkTop(zonesManagerMock.object);
    const distance = sut.getDistanceToZoneToShrink(6, 9, zonesManagerPropsMock.object);
    distance.should.eq(30);
  });

  it("should return shrink strategy", () => {
    const shrinkStrategy = Moq.Mock.ofType<ZonesManager["shrinkTop"]>();
    zonesManagerMock.setup((x) => x.shrinkTop).returns(() => shrinkStrategy.object);
    const sut = new ShrinkTop(zonesManagerMock.object);
    const strategy = sut.getShrinkStrategy();

    (strategy === shrinkStrategy.object).should.true;
  });

  it("should resize bounds", () => {
    const sut = new ShrinkTop(zonesManagerMock.object);
    const resizedBounds = sut.resize(new Rectangle(0, 100, 200, 300), 20, 10);
    resizedBounds.should.deep.eq(new Rectangle(0, 130, 200, 310));
  });
});

describe("ShrinkBottom", () => {
  it("should return zones to shrink", () => {
    const topZones = Moq.Mock.ofType<TopZones>();
    zonesManagerMock.setup((x) => x.topZones).returns(() => topZones.object);
    topZones.setup((x) => x.getCurrent(6, zonesManagerPropsMock.object)).returns(() => [3]);
    const sut = new ShrinkBottom(zonesManagerMock.object);
    const zonesToShrink = sut.getZonesToShrink(6, zonesManagerPropsMock.object);

    topZones.verify((x) => x.getCurrent(6, zonesManagerPropsMock.object), Moq.Times.once());
    zonesToShrink.should.deep.eq([3]);
  });

  it("should return distance to root", () => {
    const sut = new ShrinkBottom(zonesManagerMock.object);
    const distance = sut.getDistanceToRoot(new Rectangle(0, 100));
    distance.should.eq(100);
  });

  it("should return distance to zone to shrink", () => {
    const z3 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    zonesMock.setup((x) => x[3]).returns(() => z3.object);
    zonesMock.setup((x) => x[6]).returns(() => z6.object);
    z3.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 0, 50));
    z6.setup((x) => x.bounds).returns(() => new Rectangle(0, 80));
    const sut = new ShrinkBottom(zonesManagerMock.object);
    const distance = sut.getDistanceToZoneToShrink(6, 3, zonesManagerPropsMock.object);
    distance.should.eq(30);
  });

  it("should return shrink strategy", () => {
    const shrinkStrategy = Moq.Mock.ofType<ZonesManager["shrinkBottom"]>();
    zonesManagerMock.setup((x) => x.shrinkBottom).returns(() => shrinkStrategy.object);
    const sut = new ShrinkBottom(zonesManagerMock.object);
    const strategy = sut.getShrinkStrategy();

    (strategy === shrinkStrategy.object).should.true;
  });

  it("should resize bounds", () => {
    const sut = new ShrinkBottom(zonesManagerMock.object);
    const resizedBounds = sut.resize(new Rectangle(0, 100, 200, 300), 20, 10);
    resizedBounds.should.deep.eq(new Rectangle(0, 90, 200, 270));
  });
});

describe("ShrinkLeft", () => {
  it("should return zones to shrink", () => {
    const rightZones = Moq.Mock.ofType<RightZones>();
    zonesManagerMock.setup((x) => x.rightZones).returns(() => rightZones.object);
    rightZones.setup((x) => x.getCurrent(7, zonesManagerPropsMock.object)).returns(() => [8]);
    const sut = new ShrinkLeft(zonesManagerMock.object);
    const zonesToShrink = sut.getZonesToShrink(7, zonesManagerPropsMock.object);

    rightZones.verify((x) => x.getCurrent(7, zonesManagerPropsMock.object), Moq.Times.once());
    zonesToShrink.should.deep.eq([8]);
  });

  it("should return distance to root", () => {
    const sut = new ShrinkLeft(zonesManagerMock.object);
    const distance = sut.getDistanceToRoot(new Rectangle(0, 0, 100), new Rectangle(0, 0, 200));
    distance.should.eq(100);
  });

  it("should return distance to zone to shrink", () => {
    const z7 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    const z8 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    zonesMock.setup((x) => x[7]).returns(() => z7.object);
    zonesMock.setup((x) => x[8]).returns(() => z8.object);
    z7.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 50));
    z8.setup((x) => x.bounds).returns(() => new Rectangle(80));
    const sut = new ShrinkLeft(zonesManagerMock.object);
    const distance = sut.getDistanceToZoneToShrink(7, 8, zonesManagerPropsMock.object);
    distance.should.eq(30);
  });

  it("should return shrink strategy", () => {
    const shrinkStrategy = Moq.Mock.ofType<ZonesManager["shrinkLeft"]>();
    zonesManagerMock.setup((x) => x.shrinkLeft).returns(() => shrinkStrategy.object);
    const sut = new ShrinkLeft(zonesManagerMock.object);
    const strategy = sut.getShrinkStrategy();

    (strategy === shrinkStrategy.object).should.true;
  });

  it("should resize bounds", () => {
    const sut = new ShrinkLeft(zonesManagerMock.object);
    const resizedBounds = sut.resize(new Rectangle(0, 100, 200, 300), 20, 10);
    resizedBounds.should.deep.eq(new Rectangle(30, 100, 210, 300));
  });
});

describe("ShrinkRight", () => {
  it("should return zones to shrink", () => {
    const leftZones = Moq.Mock.ofType<LeftZones>();
    zonesManagerMock.setup((x) => x.leftZones).returns(() => leftZones.object);
    leftZones.setup((x) => x.getCurrent(7, zonesManagerPropsMock.object)).returns(() => [8]);
    const sut = new ShrinkRight(zonesManagerMock.object);
    const zonesToShrink = sut.getZonesToShrink(7, zonesManagerPropsMock.object);

    leftZones.verify((x) => x.getCurrent(7, zonesManagerPropsMock.object), Moq.Times.once());
    zonesToShrink.should.deep.eq([8]);
  });

  it("should return distance to root", () => {
    const sut = new ShrinkRight(zonesManagerMock.object);
    const distance = sut.getDistanceToRoot(new Rectangle(100));
    distance.should.eq(100);
  });

  it("should return distance to zone to shrink", () => {
    const z8 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    const z9 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
    zonesMock.setup((x) => x[8]).returns(() => z8.object);
    zonesMock.setup((x) => x[9]).returns(() => z9.object);
    z8.setup((x) => x.bounds).returns(() => new Rectangle(0, 0, 50));
    z9.setup((x) => x.bounds).returns(() => new Rectangle(80));
    const sut = new ShrinkRight(zonesManagerMock.object);
    const distance = sut.getDistanceToZoneToShrink(9, 8, zonesManagerPropsMock.object);
    distance.should.eq(30);
  });

  it("should return shrink strategy", () => {
    const shrinkStrategy = Moq.Mock.ofType<ZonesManager["shrinkRight"]>();
    zonesManagerMock.setup((x) => x.shrinkRight).returns(() => shrinkStrategy.object);
    const sut = new ShrinkRight(zonesManagerMock.object);
    const strategy = sut.getShrinkStrategy();

    (strategy === shrinkStrategy.object).should.true;
  });

  it("should resize bounds", () => {
    const sut = new ShrinkRight(zonesManagerMock.object);
    const resizedBounds = sut.resize(new Rectangle(0, 100, 200, 300), 20, 10);
    resizedBounds.should.deep.eq(new Rectangle(-10, 100, 170, 300));
  });
});

describe("UpdateWindowResizeSettings", () => {
  describe("getMaxResize", () => {
    it("should call resizeStrategy", () => {
      const resizeStrategy = Moq.Mock.ofType<ResizeStrategy>();
      resizeStrategy.setup((x) => x.getMaxResize(4, zonesManagerPropsMock.object)).returns(() => 50);
      const sut = new UpdateWindowResizeSettings(zonesManagerMock.object, resizeStrategy.object);
      const returned = sut.getMaxResize(4, zonesManagerPropsMock.object);

      resizeStrategy.verify((x) => x.getMaxResize(4, zonesManagerPropsMock.object), Moq.Times.once());
      returned.should.eq(50);
    });
  });

  describe("tryResizeFloating", () => {
    it("should call resizeStrategy", () => {
      const resizeStrategy = Moq.Mock.ofType<ResizeStrategy>();
      const result = Moq.Mock.ofType<ZonesManagerProps>();
      resizeStrategy.setup((x) => x.tryResizeFloating(4, 10, zonesManagerPropsMock.object)).returns(() => result.object);
      const sut = new UpdateWindowResizeSettings(zonesManagerMock.object, resizeStrategy.object);
      const returned = sut.tryResizeFloating(4, 10, zonesManagerPropsMock.object);

      resizeStrategy.verify((x) => x.tryResizeFloating(4, 10, zonesManagerPropsMock.object), Moq.Times.once());
      (returned === result.object).should.true;
    });
  });

  describe("tryResize", () => {
    it("should call resizeStrategy", () => {
      const resizeStrategy = Moq.Mock.ofType<ResizeStrategy>();
      resizeStrategy.setup((x) => x.tryResize(4, 10, Moq.It.isAny())).returns(() => TestProps.defaultProps);
      const sut = new UpdateWindowResizeSettings(new ZonesManager(), resizeStrategy.object);
      const returned = sut.tryResize(4, 10, TestProps.defaultProps);

      resizeStrategy.verify((x) => x.tryResize(4, 10, Moq.It.isAny()), Moq.Times.once());
      (returned === TestProps.defaultProps).should.true;
    });

    it("should set horizontal percentage mode", () => {
      const resizeStrategy = Moq.Mock.ofType<ResizeStrategy>();
      const resizedProps = {
        ...TestProps.defaultProps,
        zones: {
          ...TestProps.defaultProps.zones,
          4: {
            ...TestProps.defaultProps.zones[4],
            bounds: {
              ...TestProps.defaultProps.zones[4].bounds,
              right: 297,
            },
          },
        },
      };

      resizeStrategy.setup((x) => x.tryResize(4, 10, Moq.It.isAny())).returns(() => resizedProps);
      const zonesManager = new ZonesManager();
      const sut = new UpdateWindowResizeSettings(zonesManager, resizeStrategy.object);
      sut.tryResize(4, 10, TestProps.defaultProps);

      zonesManager.getZoneManager(4).windowResize.hMode.should.eq("Percentage");
    });

    it("should set vertical percentage mode", () => {
      const resizeStrategy = Moq.Mock.ofType<ResizeStrategy>();
      const resizedProps = {
        ...TestProps.defaultProps,
        zones: {
          ...TestProps.defaultProps.zones,
          4: {
            ...TestProps.defaultProps.zones[4],
            bounds: {
              ...TestProps.defaultProps.zones[4].bounds,
              top: 200,
              bottom: 421,
            },
          },
        },
      };

      resizeStrategy.setup((x) => x.tryResize(4, 10, Moq.It.isAny())).returns(() => resizedProps);
      const zonesManager = new ZonesManager();
      const sut = new UpdateWindowResizeSettings(zonesManager, resizeStrategy.object);
      sut.tryResize(4, 10, TestProps.defaultProps);

      zonesManager.getZoneManager(4).windowResize.vMode.should.eq("Percentage");
    });
  });
});
