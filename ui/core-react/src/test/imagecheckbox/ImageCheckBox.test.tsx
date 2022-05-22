/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ImageCheckBox } from "../../core-react";

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

  it("border renders correctly", () => {
    shallow(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" border={true} />,
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

  it("_onInputClick should be called on input click", () => {
    const wrapper = shallow(<ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" checked={false} />);
    const input = wrapper.find("input");
    input.simulate("click");
  });

  it("_onLabelClick  should be called on label click", () => {
    const wrapper = shallow(<ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" checked={false} />);
    const label = wrapper.find("label");
    label.simulate("click");
  });

});
