/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Direction, DirectionHelpers, OrthogonalDirection } from "../../appui-layout-react";

describe("Direction", () => {
  describe("CLASS_NAME", () => {
    it("bottom class name should be direction-bottom", () => {
      DirectionHelpers.BOTTOM_CLASS_NAME.should.eq("nz-direction-bottom");
    });

    it("left class name should be direction-bottom", () => {
      DirectionHelpers.LEFT_CLASS_NAME.should.eq("nz-direction-left");
    });

    it("top class name should be direction-bottom", () => {
      DirectionHelpers.TOP_CLASS_NAME.should.eq("nz-direction-top");
    });

    it("right class name should be direction-bottom", () => {
      DirectionHelpers.RIGHT_CLASS_NAME.should.eq("nz-direction-right");
    });
  });

  describe("getCssClassName", () => {
    it("should get css class name for bottom direction", () => {
      DirectionHelpers.getCssClassName(Direction.Bottom).should.eq(DirectionHelpers.BOTTOM_CLASS_NAME);
    });

    it("should get css class name for left direction", () => {
      DirectionHelpers.getCssClassName(Direction.Left).should.eq(DirectionHelpers.LEFT_CLASS_NAME);
    });

    it("should get css class name for top direction", () => {
      DirectionHelpers.getCssClassName(Direction.Top).should.eq(DirectionHelpers.TOP_CLASS_NAME);
    });

    it("should get css class name for right direction", () => {
      DirectionHelpers.getCssClassName(Direction.Right).should.eq(DirectionHelpers.RIGHT_CLASS_NAME);
    });
  });

  describe("getOrthogonalDirection", () => {
    it("should return vertical for top direction", () => {
      DirectionHelpers.getOrthogonalDirection(Direction.Top).should.eq(OrthogonalDirection.Vertical);
    });

    it("should return vertical for bottom direction", () => {
      DirectionHelpers.getOrthogonalDirection(Direction.Bottom).should.eq(OrthogonalDirection.Vertical);
    });

    it("should return horizontal for left direction", () => {
      DirectionHelpers.getOrthogonalDirection(Direction.Left).should.eq(OrthogonalDirection.Horizontal);
    });

    it("should return horizontal for right direction", () => {
      DirectionHelpers.getOrthogonalDirection(Direction.Right).should.eq(OrthogonalDirection.Horizontal);
    });
  });
});
