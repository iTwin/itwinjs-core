/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { TabGroup, HorizontalAnchor, HandleMode, HandleModeHelpers } from "../../../../ui-ninezone";
import { VerticalAnchor } from "../../../../ui-ninezone/widget/Stacked";

describe("<TabGroup />", () => {
  it("should render", () => {
    mount(<TabGroup
      handle={HandleMode.Visible}
      horizontalAnchor={HorizontalAnchor.Left}
      verticalAnchor={VerticalAnchor.Middle}
    />);
  });

  it("renders correctly", () => {
    shallow(<TabGroup
      handle={HandleMode.Visible}
      horizontalAnchor={HorizontalAnchor.Left}
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
  });

  it("renders collapsed correctly", () => {
    shallow(<TabGroup
      handle={HandleMode.Visible}
      horizontalAnchor={HorizontalAnchor.Left}
      isCollapsed
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
  });
});

describe("HandleModeHelpers", () => {
  it("should get hovered handle mode class name", () => {
    HandleModeHelpers.getCssClassName(HandleMode.Hovered).should.eq("nz-handle-hovered");
  });

  it("should get visible handle mode class name", () => {
    HandleModeHelpers.getCssClassName(HandleMode.Visible).should.eq("nz-handle-visible");
  });

  it("should get timed-out handle mode class name", () => {
    HandleModeHelpers.getCssClassName(HandleMode.Timedout).should.eq("nz-handle-timedout");
  });
});
