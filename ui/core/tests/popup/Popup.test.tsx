/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Popup } from "../../src/index";

describe("<Popup />", () => {
  it("should render", () => {
    const wrapper = mount(
      <div>
        <Popup isShown={true} />
      </div>);
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <div>
        <Popup isShown={true} />
      </div>).should.matchSnapshot();
  });
});
