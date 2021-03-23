/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import { FeaturedTile } from "../../ui-core.js";

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
