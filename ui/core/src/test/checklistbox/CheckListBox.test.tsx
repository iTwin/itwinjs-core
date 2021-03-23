/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import * as sinon from "sinon";
import { Checkbox, CheckListBox, CheckListBoxItem, CheckListBoxSeparator } from "../../ui-core.js";

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

    const cb = wrapper.find(Checkbox);
    cb.length.should.eq(1);
    cb.prop("onClick")!({} as React.MouseEvent);
    spyMethod.calledOnce.should.true;

    wrapper.unmount();
  });

});
