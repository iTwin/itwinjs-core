/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";

import { ImageCheckBox } from "../../ui-core";

describe("<ImageCheckBox />", () => {
  it("should render", () => {
    const wrapper = mount(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" checked={true} />,
    );
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" />,
    ).should.matchSnapshot();
  });

  it("disabled renders correctly", () => {
    shallow(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" disabled={true} />,
    ).should.matchSnapshot();
  });

  it("onClick should be called on change", () => {
    const handler = sinon.spy();
    const wrapper = shallow(<ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" onClick={handler} checked={false} />);
    const input = wrapper.find("input");
    input.simulate("change", { target: { checked: true } });
    handler.should.have.been.calledOnce;
    handler.should.have.been.calledWithExactly(true);
  });

});
