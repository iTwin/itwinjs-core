/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import Direction, { DirectionHelpers } from "../../src/utilities/Direction";

describe("Direction", () => {
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
