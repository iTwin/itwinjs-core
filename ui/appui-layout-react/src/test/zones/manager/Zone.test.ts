/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Rectangle, RectangleProps } from "@itwin/core-react";
import { getDefaultZoneManagerProps, ZoneManager, ZoneManagerFloatingProps, ZoneManagerProps } from "../../../appui-layout-react";

describe("ZoneManager", () => {
  describe("setAllowsMerging", () => {
    it("should modify props", () => {
      const props = getDefaultZoneManagerProps(1);
      const sut = new ZoneManager();
      const newProps = sut.setAllowsMerging(true, props);

      newProps.should.not.eq(props);
      newProps.allowsMerging.should.true;
    });

    it("should not modify props", () => {
      const props = getDefaultZoneManagerProps(1);
      const sut = new ZoneManager();
      const newProps = sut.setAllowsMerging(false, props);

      newProps.should.eq(props);
      newProps.allowsMerging.should.false;
    });
  });

  describe("setBounds", () => {
    it("should set bounds", () => {
      const bounds: RectangleProps = { bottom: 10, left: 20, right: 30, top: 40 };
      const props = getDefaultZoneManagerProps(1);
      const sut = new ZoneManager();
      const newProps = sut.setBounds(bounds, props);

      newProps.should.not.eq(props);
      newProps.bounds.should.eq(bounds);
    });

    it("should not modify props", () => {
      const bounds: RectangleProps = { bottom: 10, left: 20, right: 30, top: 40 };
      const props: ZoneManagerProps = {
        ...getDefaultZoneManagerProps(1),
        bounds: new Rectangle(20, 40, 30, 10),
      };

      const sut = new ZoneManager();
      const newProps = sut.setBounds(bounds, props);

      newProps.should.eq(props);
    });
  });

  describe("setIsLayoutChanged", () => {
    it("should set is layout changed", () => {
      const props = getDefaultZoneManagerProps(1);
      const sut = new ZoneManager();
      const newProps = sut.setIsLayoutChanged(true, props);

      newProps.should.not.eq(props);
      newProps.isLayoutChanged.should.eq(true);
    });

    it("should not modify props", () => {
      const props = getDefaultZoneManagerProps(1);
      const sut = new ZoneManager();
      const newProps = sut.setIsLayoutChanged(false, props);

      newProps.should.eq(props);
    });
  });

  describe("setFloatingProps", () => {
    it("should set floating props", () => {
      const floating: ZoneManagerFloatingProps = {
        bounds: {
          bottom: 10,
          left: 20,
          right: 30,
          top: 40,
        },
        stackId: 5,
      };
      const props = getDefaultZoneManagerProps(1);
      const sut = new ZoneManager();
      const newProps = sut.setFloatingProps(floating, props);

      newProps.should.not.eq(props);
      (newProps.floating === floating).should.true;
    });

    it("should not modify props", () => {
      const props = getDefaultZoneManagerProps(1);
      const sut = new ZoneManager();
      const newProps = sut.setFloatingProps(undefined, props);

      newProps.should.eq(props);
      (newProps.floating === undefined).should.true;
    });
  });

  describe("setFloatingBounds", () => {
    it("should set floating bounds", () => {
      const bounds: RectangleProps = { bottom: 10, left: 20, right: 30, top: 40 };
      const props: ZoneManagerProps = {
        ...getDefaultZoneManagerProps(1),
        floating: {
          bounds: new Rectangle(),
          stackId: 10,
        },
      };
      const sut = new ZoneManager();
      const newProps = sut.setFloatingBounds(bounds, props);

      newProps.should.not.eq(props);
      newProps.floating!.bounds.should.eq(bounds);
    });

    it("should not modify props", () => {
      const bounds: RectangleProps = { bottom: 10, left: 20, right: 30, top: 40 };
      const props: ZoneManagerProps = {
        ...getDefaultZoneManagerProps(1),
        floating: {
          bounds: new Rectangle(20, 40, 30, 10),
          stackId: 10,
        },
      };

      const sut = new ZoneManager();
      const newProps = sut.setFloatingBounds(bounds, props);

      newProps.should.eq(props);
    });

    it("should throw if not floating", () => {
      const bounds: RectangleProps = { bottom: 10, left: 20, right: 30, top: 40 };
      const props = getDefaultZoneManagerProps(1);

      const sut = new ZoneManager();
      (() => sut.setFloatingBounds(bounds, props)).should.throw();
    });
  });
});

describe("getDefaultZoneManagerProps", () => {
  it("should create default props for zone 1", () => {
    const sut = getDefaultZoneManagerProps(1);
    sut.should.matchSnapshot();
  });
});
