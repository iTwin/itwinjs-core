/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import sinon from "sinon";
import { EditorContainer, PropertyUpdatedArgs } from "../../ui-components/editors/EditorContainer";
import TestUtils from "../TestUtils";
import { SpecialKey, StandardEditorNames } from "@bentley/ui-abstract";

describe("<EditorContainer />", () => {
  it("should render", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
  });

  it("renders correctly", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    shallow(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />).should.matchSnapshot();
  });

  it("renders editor for 'text' type using TextEditor", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
    expect(wrapper.find("input.components-text-editor").length).to.eq(1);
  });

  it("calls onCommit for Enter", async () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    const inputNode = wrapper.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.calledOnce).to.be.true;
  });

  it("calls onCancel for Escape", async () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const spyOnCancel = sinon.spy();
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={spyOnCancel} />);
    const inputNode = wrapper.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Escape" });
    expect(spyOnCancel.calledOnce).to.be.true;
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

    expect(spyOnCancel.calledOnce).to.be.true;
  });

  it("calls onCommit for Tab", async () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    const inputNode = wrapper.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Tab" });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.calledOnce).to.be.true;
  });

  it("processes other input node events", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    const inputNode = wrapper.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("blur");
    inputNode.simulate("keyDown", { key: SpecialKey.ArrowLeft }); // left arrow key
    inputNode.simulate("click");
    inputNode.simulate("contextMenu");
  });

});
