/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import sinon from "sinon";
import { ToggleEditor } from "../../ui-components/editors/ToggleEditor";
import { EditorContainer, PropertyUpdatedArgs } from "../../ui-components/editors/EditorContainer";
import TestUtils from "../TestUtils";
import { PrimitiveValue } from "@bentley/imodeljs-frontend";

describe("<ToggleEditor />", () => {
  it("should render", () => {
    mount(<ToggleEditor />);
  });

  it("renders correctly", () => {
    shallow(<ToggleEditor />).should.matchSnapshot();
  });

  it("getValue returns proper value after componentDidMount & setState", async () => {
    const record = TestUtils.createBooleanProperty("Test", false, "toggle");
    const wrapper = mount(<ToggleEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const enumEditor = wrapper.instance() as ToggleEditor;
    expect(enumEditor.getValue()).to.equal(false);

    wrapper.unmount();
  });

  it("HTML input onChange updates boolean value", async () => {
    const record = TestUtils.createBooleanProperty("Test1", false, "toggle");
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }
    const wrapper = mount(<ToggleEditor propertyRecord={record} onCommit={handleCommit} />);
    const enumEditor = wrapper.instance() as ToggleEditor;
    const inputNode = wrapper.find("input");

    expect(inputNode.length).to.eq(1);
    if (inputNode) {
      const testValue = true;
      inputNode.simulate("change", { target: { value: testValue } });
      wrapper.update();
      expect(enumEditor.getValue()).to.equal(testValue);
      await TestUtils.flushAsyncOperations();
      expect(spyOnCommit.calledOnce).to.be.true;
    }
  });

  it("onCommit should be called for Space", async () => {
    let booleanValue = false;
    const propertyRecord = TestUtils.createBooleanProperty("Test2", booleanValue, "toggle");
    const spyOnCommit = sinon.spy();
    function handleCommit(commit: PropertyUpdatedArgs): void {
      booleanValue = (commit.newValue as PrimitiveValue).value as boolean;
      spyOnCommit();
    }
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    const inputNode = wrapper.find("input");
    expect(inputNode.length).to.eq(1);

    const testValue = true;
    inputNode.simulate("change", { target: { value: testValue } });

    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.calledOnce).to.be.true;
    expect(booleanValue).to.be.true;
  });

  it("componentDidUpdate updates the value", async () => {
    const record = TestUtils.createBooleanProperty("Test", false, "toggle");
    const wrapper = mount(<ToggleEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const enumEditor = wrapper.instance() as ToggleEditor;
    expect(enumEditor.getValue()).to.equal(false);

    const newRecord = TestUtils.createBooleanProperty("Test", true);
    wrapper.setProps({ propertyRecord: newRecord });
    await TestUtils.flushAsyncOperations();
    expect(enumEditor.getValue()).to.equal(true);

    wrapper.unmount();
  });

});
