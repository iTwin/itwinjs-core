/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import * as Moq from "typemoq";
import type { WidgetZoneId, ZonesManager, ZonesManagerProps } from "../../../appui-layout-react";
import { AdjacentZonesStrategy, BottomZones, LeftZones, RightZones, TopZones } from "../../../appui-layout-react/zones/manager/AdjacentZones";

describe("AdjacentZonesStrategy", () => {
  class AdjacentZones extends AdjacentZonesStrategy {
    public getInitial(_zoneId: WidgetZoneId, _isInFooterMode: boolean): WidgetZoneId | undefined {
      throw new Error("Method not implemented.");
    }
  }

  const manager = Moq.Mock.ofType<ZonesManager>();
  const managerProps = Moq.Mock.ofType<ZonesManagerProps>();
  const widgets = Moq.Mock.ofType<ZonesManagerProps["widgets"]>();
  const zones = Moq.Mock.ofType<ZonesManagerProps["zones"]>();

  beforeEach(() => {
    managerProps.reset();
    widgets.reset();
    zones.reset();
    manager.reset();
    managerProps.setup((x) => x.zones).returns(() => zones.object);
    managerProps.setup((x) => x.widgets).returns(() => widgets.object);
  });

  describe("getCurrent", () => {
    it("should return no zones", () => {
      const z1 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zones.setup((x) => x[1]).returns(() => z1.object);
      z1.setup((x) => x.widgets).returns(() => []);

      const sut = new AdjacentZones(manager.object);
      sinon.stub(sut, "getInitial").returns(undefined);

      const adjacentZones = sut.getCurrent(1, managerProps.object);
      adjacentZones.length.should.eq(0);
    });

    it("should return initial zone", () => {
      const z2 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zones.setup((x) => x[1]).returns(() => z2.object);
      z2.setup((x) => x.widgets).returns(() => [2]);
      manager.setup((x) => x.findZoneWithWidget(1, Moq.It.isAny())).returns(() => z2.object);

      const sut = new AdjacentZones(manager.object);
      sinon.stub(sut, "getInitial").returns(1);

      const adjacentZones = sut.getCurrent(1, managerProps.object);
      adjacentZones.length.should.eq(1, "length");
      adjacentZones[0].should.eq(1);
    });

    it("should return zone to which the initial zone is merged", () => {
      const z3 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const z9 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zones.setup((x) => x[3]).returns(() => z3.object);
      zones.setup((x) => x[6]).returns(() => z6.object);
      z3.setup((x) => x.id).returns(() => 3);
      z3.setup((x) => x.widgets).returns(() => [3]);
      z6.setup((x) => x.widgets).returns(() => []);
      z9.setup((x) => x.id).returns(() => 9);
      manager.setup((x) => x.findZoneWithWidget(6, Moq.It.isAny())).returns(() => z9.object);

      const sut = new AdjacentZones(manager.object);
      sinon.stub(sut, "getInitial").returns(6);

      const adjacentZones = sut.getCurrent(3, managerProps.object);
      adjacentZones.length.should.eq(1, "length");
      adjacentZones[0].should.eq(9);
    });

    it("should return multiple zones", () => {
      const z3 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const z9 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zones.setup((x) => x[3]).returns(() => z3.object);
      zones.setup((x) => x[6]).returns(() => z6.object);
      zones.setup((x) => x[9]).returns(() => z9.object);
      z3.setup((x) => x.id).returns(() => 3);
      z3.setup((x) => x.widgets).returns(() => [3, 6, 9]);
      z6.setup((x) => x.id).returns(() => 6);
      z6.setup((x) => x.widgets).returns(() => []);
      z9.setup((x) => x.id).returns(() => 9);
      manager.setup((x) => x.findZoneWithWidget(6, Moq.It.isAny())).returns(() => z9.object);

      const sut = new AdjacentZones(manager.object);
      const getInitial = sinon.stub(sut, "getInitial");
      getInitial.withArgs(3, sinon.match.any).returns(2);
      getInitial.withArgs(6, sinon.match.any).returns(undefined);
      getInitial.withArgs(9, sinon.match.any).returns(8);
      sinon.stub(sut, "getSingleMergedZone").returns(false);

      const adjacentZones = sut.getCurrent(3, managerProps.object);
      adjacentZones.length.should.eq(2, "length");
      adjacentZones[0].should.eq(2);
      adjacentZones[1].should.eq(8);
    });

    it("should return single zone if strategy expects single merged zone", () => {
      const z3 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const z9 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zones.setup((x) => x[3]).returns(() => z3.object);
      zones.setup((x) => x[6]).returns(() => z6.object);
      zones.setup((x) => x[9]).returns(() => z9.object);
      z3.setup((x) => x.id).returns(() => 3);
      z3.setup((x) => x.widgets).returns(() => [3, 6]);
      z6.setup((x) => x.id).returns(() => 6);
      z6.setup((x) => x.widgets).returns(() => []);
      z9.setup((x) => x.id).returns(() => 9);
      manager.setup((x) => x.findZoneWithWidget(6, Moq.It.isAny())).returns(() => z9.object);

      const sut = new AdjacentZones(manager.object);
      sinon.stub(sut, "getInitial").withArgs(6, sinon.match.any).returns(9);
      sinon.stub(sut, "reduceToFirstZone").returns(false);

      const adjacentZones = sut.getCurrent(3, managerProps.object);
      adjacentZones.length.should.eq(1, "length");
      adjacentZones[0].should.eq(9);
    });

    it("should return initial of single first zone", () => {
      const z3 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const z6 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      const z9 = Moq.Mock.ofType<ZonesManagerProps["zones"][WidgetZoneId]>();
      zones.setup((x) => x[3]).returns(() => z3.object);
      zones.setup((x) => x[6]).returns(() => z6.object);
      zones.setup((x) => x[9]).returns(() => z9.object);
      z3.setup((x) => x.id).returns(() => 3);
      z3.setup((x) => x.widgets).returns(() => [3, 6]);
      z6.setup((x) => x.id).returns(() => 6);
      z6.setup((x) => x.widgets).returns(() => []);
      z9.setup((x) => x.id).returns(() => 9);
      manager.setup((x) => x.findZoneWithWidget(6, Moq.It.isAny())).returns(() => z9.object);

      const sut = new AdjacentZones(manager.object);
      sinon.stub(sut, "getInitial").withArgs(6, sinon.match.any).returns(9);

      const adjacentZones = sut.getCurrent(3, managerProps.object);
      adjacentZones.length.should.eq(0, "length");
    });
  });

  describe("getSingleMergedZone", () => {
    it("should return true for zones that are merged vertically", () => {
      const sut = new AdjacentZones(manager.object);
      sut.getSingleMergedZone(true).should.true;
    });

    it("should return false for zones that are merged horizontally", () => {
      const sut = new AdjacentZones(manager.object);
      sut.getSingleMergedZone(false).should.false;
    });
  });

  describe("reduceToFirstZone", () => {
    it("should return true", () => {
      const sut = new AdjacentZones(manager.object);
      sut.reduceToFirstZone().should.true;
    });
  });
});

describe("LeftZones", () => {
  const manager = Moq.Mock.ofType<ZonesManager>();

  beforeEach(() => {
    manager.reset();
  });

  describe("getInitial", () => {
    it("for zone 1", () => {
      (new LeftZones(manager.object).getInitial(1, false) === undefined).should.true;
    });

    it("for zone 2", () => {
      (new LeftZones(manager.object).getInitial(2, false) === 1).should.true;
    });

    it("for zone 3", () => {
      (new LeftZones(manager.object).getInitial(3, false) === 2).should.true;
    });

    it("for zone 4", () => {
      (new LeftZones(manager.object).getInitial(4, false) === undefined).should.true;
    });

    it("for zone 6", () => {
      (new LeftZones(manager.object).getInitial(6, false) === undefined).should.true;
    });

    it("for zone 7", () => {
      (new LeftZones(manager.object).getInitial(7, false) === undefined).should.true;
    });

    it("for zone 8", () => {
      (new LeftZones(manager.object).getInitial(8, false) === 7).should.true;
    });

    it("for zone 8 in footer mode", () => {
      (new LeftZones(manager.object).getInitial(8, true) === undefined).should.true;
    });

    it("for zone 9", () => {
      (new LeftZones(manager.object).getInitial(9, false) === 8).should.true;
    });

    it("for zone 9 in footer mode", () => {
      (new LeftZones(manager.object).getInitial(9, true) === undefined).should.true;
    });
  });

  describe("getSingleMergedZone", () => {
    it("should return false for zones that are merged vertically", () => {
      const sut = new LeftZones(manager.object);
      sut.getSingleMergedZone(true).should.false;
    });

    it("should return true for zones that are merged horizontally", () => {
      const sut = new LeftZones(manager.object);
      sut.getSingleMergedZone(false).should.true;
    });
  });
});

describe("RightZones", () => {
  const manager = Moq.Mock.ofType<ZonesManager>();

  beforeEach(() => {
    manager.reset();
  });

  describe("getInitial", () => {
    it("for zone 1", () => {
      (new RightZones(manager.object).getInitial(1, false) === 2).should.true;
    });

    it("for zone 2", () => {
      (new RightZones(manager.object).getInitial(2, false) === 3).should.true;
    });

    it("for zone 3", () => {
      (new RightZones(manager.object).getInitial(3, false) === undefined).should.true;
    });

    it("for zone 4", () => {
      (new RightZones(manager.object).getInitial(4, false) === undefined).should.true;
    });

    it("for zone 6", () => {
      (new RightZones(manager.object).getInitial(6, false) === undefined).should.true;
    });

    it("for zone 7", () => {
      (new RightZones(manager.object).getInitial(7, false) === 8).should.true;
    });

    it("for zone 7 in footer mode", () => {
      (new RightZones(manager.object).getInitial(7, true) === undefined).should.true;
    });

    it("for zone 8", () => {
      (new RightZones(manager.object).getInitial(8, false) === 9).should.true;
    });

    it("for zone 8 in footer mode", () => {
      (new RightZones(manager.object).getInitial(8, true) === undefined).should.true;
    });

    it("for zone 9", () => {
      (new RightZones(manager.object).getInitial(9, false) === undefined).should.true;
    });
  });

  describe("getSingleMergedZone", () => {
    it("should return false for zones that are merged vertically", () => {
      const sut = new RightZones(manager.object);
      sut.getSingleMergedZone(true).should.false;
    });

    it("should return true for zones that are merged horizontally", () => {
      const sut = new RightZones(manager.object);
      sut.getSingleMergedZone(false).should.true;
    });
  });

  describe("reduceToFirstZone", () => {
    it("should return false", () => {
      const sut = new RightZones(manager.object);
      sut.reduceToFirstZone().should.false;
    });
  });
});

describe("TopZones", () => {
  const manager = Moq.Mock.ofType<ZonesManager>();

  beforeEach(() => {
    manager.reset();
  });

  describe("getInitial", () => {
    it("for zone 1", () => {
      (new TopZones(manager.object).getInitial(1) === undefined).should.true;
    });

    it("for zone 2", () => {
      (new TopZones(manager.object).getInitial(2) === undefined).should.true;
    });

    it("for zone 3", () => {
      (new TopZones(manager.object).getInitial(3) === undefined).should.true;
    });

    it("for zone 4", () => {
      (new TopZones(manager.object).getInitial(4) === 1).should.true;
    });

    it("for zone 6", () => {
      (new TopZones(manager.object).getInitial(6) === 3).should.true;
    });

    it("for zone 7", () => {
      (new TopZones(manager.object).getInitial(7) === 4).should.true;
    });

    it("for zone 8", () => {
      (new TopZones(manager.object).getInitial(8) === undefined).should.true;
    });

    it("for zone 9", () => {
      (new TopZones(manager.object).getInitial(9) === 6).should.true;
    });
  });
});

describe("BottomZones", () => {
  const manager = Moq.Mock.ofType<ZonesManager>();

  beforeEach(() => {
    manager.reset();
  });

  describe("getInitial", () => {
    it("for zone 1", () => {
      (new BottomZones(manager.object).getInitial(1) === 4).should.true;
    });

    it("for zone 2", () => {
      (new BottomZones(manager.object).getInitial(2) === undefined).should.true;
    });

    it("for zone 3", () => {
      (new BottomZones(manager.object).getInitial(3) === 6).should.true;
    });

    it("for zone 4", () => {
      (new BottomZones(manager.object).getInitial(4) === 7).should.true;
    });

    it("for zone 6", () => {
      (new BottomZones(manager.object).getInitial(6) === 9).should.true;
    });

    it("for zone 7", () => {
      (new BottomZones(manager.object).getInitial(7) === undefined).should.true;
    });

    it("for zone 8", () => {
      (new BottomZones(manager.object).getInitial(8) === undefined).should.true;
    });

    it("for zone 9", () => {
      (new BottomZones(manager.object).getInitial(9) === undefined).should.true;
    });
  });

  describe("reduceToFirstZone", () => {
    it("should return false", () => {
      const sut = new BottomZones(manager.object);
      sut.reduceToFirstZone().should.false;
    });
  });
});
