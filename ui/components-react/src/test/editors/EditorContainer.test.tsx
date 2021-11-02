/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import sinon from "sinon";
import { EditorContainer } from "../../components-react/editors/EditorContainer";
import TestUtils from "../TestUtils";
import { SpecialKey, StandardEditorNames } from "@itwin/appui-abstract";
import { fireEvent, render } from "@testing-library/react";

describe("<EditorContainer />", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    sinon.restore();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("should render", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const sut = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
    sut.unmount();
  });

  it("renders correctly", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    shallow(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />).should.matchSnapshot();
  });

  it("renders editor for 'text' type using TextEditor", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
    expect(wrapper.find("input.components-text-editor").length).to.eq(1);
    wrapper.unmount();
  });

  it("calls onCommit for Enter", async () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const spyOnCommit = sinon.spy();
    const wrapper = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={spyOnCommit} onCancel={() => { }} />);
    const inputNode = wrapper.container.querySelector("input");
    expect(inputNode).not.to.be.null;

    fireEvent.keyDown(inputNode as HTMLElement, { key: SpecialKey.Enter });
    await TestUtils.flushAsyncOperations();
    sinon.assert.calledOnce(spyOnCommit);
  });

  it("calls onCancel for Escape", async () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const spyOnCancel = sinon.spy();
    const wrapper = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={spyOnCancel} />);
    const inputNode = wrapper.container.querySelector("input");
    expect(inputNode).not.to.be.null;

    fireEvent.keyDown(inputNode as HTMLElement, { key: SpecialKey.Escape });
    await TestUtils.flushAsyncOperations();
    sinon.assert.calledOnce(spyOnCancel);
  });

  it("calls onCancel for Cancel button in popup", async () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value", undefined, { name: StandardEditorNames.MultiLine });
    const spyOnCancel = sinon.spy();
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={spyOnCancel} />);

    const button = wrapper.find(".components-popup-button");
    expect(button.length).to.eq(1);
    button.first().simulate("click");
    await TestUtils.flushAsyncOperations();

    const okButton = wrapper.find("button.components-popup-cancel-button");
    expect(okButton.length).to.eq(1);
    okButton.first().simulate("click");
    await TestUtils.flushAsyncOperations();

    sinon.assert.calledOnce(spyOnCancel);
    wrapper.unmount();
  });

  it("calls onCommit for Tab", async () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const spyOnCommit = sinon.spy();
    const wrapper = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={spyOnCommit} onCancel={() => { }} />);
    const inputNode = wrapper.container.querySelector("input");
    expect(inputNode).not.to.be.null;

    fireEvent.keyDown(inputNode as HTMLElement, { key: SpecialKey.Tab });
    await TestUtils.flushAsyncOperations();

    sinon.assert.calledOnce(spyOnCommit);
  });

  it("processes other input node events", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
    const inputNode = wrapper.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("blur");
    inputNode.simulate("click");
    inputNode.simulate("contextMenu");

    const renderedWrapper = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
    const renderedInputNode = renderedWrapper.container.querySelector("input");
    fireEvent.keyDown(renderedInputNode as HTMLElement, { key: SpecialKey.ArrowLeft });
    wrapper.unmount();
  });

});
