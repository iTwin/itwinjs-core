/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { MinimalTile } from "../../ui-core";

describe("<MinimalTile />", () => {
  const icon = <i className="icon icon-placeholder" />;

  it("should render", () => {
    mount(<MinimalTile title="Test" icon={icon} />);
  });

  it("renders correctly", () => {
    shallow(<MinimalTile title="Test" icon={icon} />).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = mount(<MinimalTile title="Test" icon={icon} />);
    wrapper.find(".uicore-minimal").length.should.eq(1);
  });
});
