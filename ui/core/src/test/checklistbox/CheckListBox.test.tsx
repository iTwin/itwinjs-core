/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";

import { CheckListBox, CheckListBoxItem, CheckListBoxSeparator } from "../../ui-core";

describe("<CheckListBox />", () => {
  it("should render", () => {
    const wrapper = mount(
      <CheckListBox>
        <CheckListBoxItem label="label" />
        <CheckListBoxSeparator />
      </CheckListBox>);
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <CheckListBox>
        <CheckListBoxItem label="label" />
        <CheckListBoxSeparator />
      </CheckListBox>,
    ).should.matchSnapshot();
  });

  it("CheckListBoxItem should call onClick method", () => {
    const spyMethod = sinon.spy();

    const wrapper = mount(
      <CheckListBoxItem label="label" onClick={spyMethod} />,
    );

    const input = wrapper.find("input.chk-listboxitem-checkbox");
    input.should.exist;

    input.simulate("click");
    spyMethod.calledOnce.should.true;

    wrapper.unmount();
  });

});
