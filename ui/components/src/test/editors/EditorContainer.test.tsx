/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import sinon from "sinon";

import { SamplePropertyRecord } from "../propertygrid/PropertyTestHelpers";
import { EditorContainer, PropertyUpdatedArgs } from "../../editors/EditorContainer";

describe("<EditorContainer />", () => {
  it("should render", () => {
    const propertyRecord = new SamplePropertyRecord("Test1", 0, "my value");
    mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
  });

  it("renders correctly", () => {
    const propertyRecord = new SamplePropertyRecord("Test1", 0, "my value");
    shallow(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />).should.matchSnapshot();
  });

  it("renders editor for 'text' type using TextEditor", () => {
    const propertyRecord = new SamplePropertyRecord("Test1", 0, "my value");
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
    expect(wrapper.find(".components-text-editor").length).to.eq(1);
  });

  it("calls onCommit for Enter", () => {
    const propertyRecord = new SamplePropertyRecord("Test1", 0, "my value");
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

  it("calls onCommitCancel for Escape", () => {
    const propertyRecord = new SamplePropertyRecord("Test1", 0, "my value");
    const spyOnCommitCancel = sinon.spy();
    const wrapper = mount(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={spyOnCommitCancel} />);
    const inputNode = wrapper.find("input");
    expect(inputNode.length).to.eq(1);

    inputNode.simulate("keyDown", { key: "Escape" });
    expect(spyOnCommitCancel.calledOnce).to.be.true;
  });

  it("calls onCommit for Tab", () => {
    const propertyRecord = new SamplePropertyRecord("Test1", 0, "my value");
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
    const propertyRecord = new SamplePropertyRecord("Test1", 0, "my value");
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
