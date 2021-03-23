/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { HandleMode, HandleModeHelpers, HorizontalAnchor, TabGroup, VerticalAnchor } from "../../../../ui-ninezone.js";
import { mount } from "../../../Utils.js";

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
