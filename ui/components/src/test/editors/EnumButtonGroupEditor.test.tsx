/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import sinon from "sinon";
import { EnumButtonGroupEditor } from "../../ui-components/editors/EnumButtonGroupEditor";
import { EditorContainer, PropertyUpdatedArgs } from "../../ui-components/editors/EditorContainer";
import TestUtils from "../TestUtils";

describe("<EnumButtonGroupEditor />", () => {
  it("should render", () => {
    mount(<EnumButtonGroupEditor />);
  });

  it("renders correctly", () => {
    shallow(<EnumButtonGroupEditor />).should.matchSnapshot();
  });

  it("getValue returns proper value after componentDidMount & setState", async () => {
    const record = TestUtils.createEnumProperty("Test", 0);
    const wrapper = mount(<EnumButtonGroupEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const enumEditor = wrapper.instance() as EnumButtonGroupEditor;
    expect(enumEditor.getValue()).to.equal(0);

    wrapper.unmount();
  });

  it("onCommit should be called for Enter", async () => {
    const propertyRecord = TestUtils.createEnumProperty("Test", 0);
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    const selectNode = wrapper.find("select");
    expect(selectNode.length).to.eq(1);

    selectNode.simulate("keyDown", { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.calledOnce).to.be.true;
  });

  it("componentDidUpdate updates the value", async () => {
    const record = TestUtils.createEnumProperty("Test", 0);
    const wrapper = mount(<EnumButtonGroupEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const enumEditor = wrapper.instance() as EnumButtonGroupEditor;
    expect(enumEditor.getValue()).to.equal(0);

    const testValue = 1;
    const newRecord = TestUtils.createEnumProperty("Test", testValue);
    wrapper.setProps({ propertyRecord: newRecord });
    await TestUtils.flushAsyncOperations();
    expect(enumEditor.getValue()).to.equal(testValue);

    wrapper.unmount();
  });

});
