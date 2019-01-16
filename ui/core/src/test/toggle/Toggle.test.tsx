/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";

import { Toggle } from "../../ui-core";

describe("<Toggle />", () => {
  it("should render", () => {
    const wrapper = mount(
      <Toggle />,
    );
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <Toggle />,
    ).should.matchSnapshot();
  });

  it("Toggle should call onChange handler", () => {
    const spyMethod = sinon.spy();
    const handleChange = (_checked: boolean) => {
      spyMethod();
    };

    const wrapper = mount(
      <Toggle isOn={false} onChange={handleChange} />,
    );

    const input = wrapper.find("input.toggle-input");
    input.should.exist;

    input.simulate("change", { checked: true });
    spyMethod.calledOnce.should.true;

    wrapper.unmount();
  });

});
