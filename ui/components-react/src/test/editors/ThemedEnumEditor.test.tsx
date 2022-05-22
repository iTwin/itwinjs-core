/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect } from "chai";
import { mount, shallow } from "enzyme";
import { fireEvent, render } from "@testing-library/react";
import * as React from "react";
import sinon from "sinon";
import { PropertyUpdatedArgs } from "../../components-react/editors/EditorContainer";
import { ThemedEnumEditor } from "../../components-react/editors/ThemedEnumEditor";
import TestUtils from "../TestUtils";

describe("<ThemedEnumEditor />", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("should render", () => {
    const wrapper = mount(<ThemedEnumEditor />);
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(<ThemedEnumEditor />).should.matchSnapshot();
  });

  it("getValue returns proper value after componentDidMount & setState", async () => {
    const record = TestUtils.createEnumProperty("Test", 0);
    const wrapper = mount(<ThemedEnumEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const editor = wrapper.instance() as ThemedEnumEditor;
    expect(editor.state.selectValue).to.equal(0);

    wrapper.unmount();
  });

  it("Changing react-select value calls editor commit", async () => {
    const record = TestUtils.createEnumProperty("Test1", "0");
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }

    const wrapper = render(<ThemedEnumEditor propertyRecord={record} onCommit={handleCommit} />);
    await TestUtils.flushAsyncOperations();
    // wrapper.debug();
    const selectNode = wrapper.container.querySelector(".react-select__input");

    expect(selectNode).not.to.be.null;
    fireEvent.change(selectNode!.firstChild as HTMLElement, { target: { value: "Blue" } });
    await TestUtils.flushAsyncOperations();
    fireEvent.keyDown(selectNode!.firstChild as HTMLElement, { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.calledOnce).to.be.true;
  });

  it("Escape does not call editor commit", async () => {
    const record = TestUtils.createEnumProperty("Test3", "0");
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }

    const wrapper = render(<ThemedEnumEditor propertyRecord={record} onCommit={handleCommit} />);
    await TestUtils.flushAsyncOperations();
    // wrapper.debug();
    const selectNode = wrapper.container.querySelector(".react-select__input");

    expect(selectNode).not.to.be.null;
    fireEvent.change(selectNode!.firstChild as HTMLElement, { target: { value: "Yellow" } });
    await TestUtils.flushAsyncOperations();
    fireEvent.keyDown(selectNode!.firstChild as HTMLElement, { key: "Escape" });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.called).to.be.false;
  });

  it("Changing react-select value calls editor commit", async () => {
    const record = TestUtils.createEnumProperty("Test2", 1);
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }

    const wrapper = render(<ThemedEnumEditor propertyRecord={record} onCommit={handleCommit} />);
    await TestUtils.flushAsyncOperations();
    // wrapper.debug();
    const selectNode = wrapper.container.querySelector(".react-select__input");

    expect(selectNode).not.to.be.null;
    fireEvent.change(selectNode!.firstChild as HTMLElement, { target: { value: "Green" } });
    await TestUtils.flushAsyncOperations();
    fireEvent.keyDown(selectNode!.firstChild as HTMLElement, { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.calledOnce).to.be.true;
  });

  it("componentDidUpdate updates the value", async () => {
    const record = TestUtils.createEnumProperty("Test", 0);
    const minWidthStyle: React.CSSProperties = {
      minWidth: `${12 * 0.75}em`,
    };

    const wrapper = mount(<ThemedEnumEditor propertyRecord={record} style={minWidthStyle} />);

    await TestUtils.flushAsyncOperations();
    const editor = wrapper.instance() as ThemedEnumEditor;
    expect(editor.state.selectValue).to.equal(0);

    const testValue = 1;
    const newRecord = TestUtils.createEnumProperty("Test", testValue);
    wrapper.setProps({ propertyRecord: newRecord });
    await TestUtils.flushAsyncOperations();
    expect(editor.state.selectValue).to.equal(testValue);

    wrapper.unmount();
  });

});
