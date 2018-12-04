/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import sinon from "sinon";
import { EditorContainer, PropertyUpdatedArgs } from "../../editors/EditorContainer";
import TestUtils from "../TestUtils";

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
    expect(wrapper.find(".components-text-editor").length).to.eq(1);
  });

  it("calls onCommit for Enter", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    const inputNode = wrapper.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Enter" });
    expect(spyOnCommit.calledOnce).to.be.true;
  });

  it("calls onCancel for Escape", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const spyonCancel = sinon.spy();
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={spyonCancel} />);
    const inputNode = wrapper.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Escape" });
    expect(spyonCancel.calledOnce).to.be.true;
  });

  it("calls onCommit for Tab", () => {
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test1", "my value");
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    const inputNode = wrapper.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Tab" });
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
    inputNode.simulate("keyDown", { keyCode: 37 }); // left arrow key
    inputNode.simulate("click");
    inputNode.simulate("contextMenu");
  });

});
