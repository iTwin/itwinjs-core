/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { FeaturedTile } from "../../ui-core";

describe("<FeaturedTile />", () => {
  const icon = <i className="icon icon-placeholder" />;

  it("should render", () => {
    mount(<FeaturedTile title="Test" icon={icon} />);
  });

  it("renders correctly", () => {
    shallow(<FeaturedTile title="Test" icon={icon} />).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = mount(<FeaturedTile title="Test" icon={icon} />);
    wrapper.find(".uicore-featured").length.should.eq(1);
  });
});
