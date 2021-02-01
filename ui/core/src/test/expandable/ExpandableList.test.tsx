/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ExpandableBlock, ExpandableList } from "../../ui-core";
import TestUtils from "../TestUtils";

describe("ExpandableList", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  it("should render", () => {
    mount(<ExpandableList />);
  });

  it("renders correctly", () => {
    shallow(<ExpandableList />).should.matchSnapshot();
  });

  it("should support singleExpandOnly & defaultActiveBlock props", () => {
    const wrapper = mount(
      <ExpandableList singleExpandOnly={true} defaultActiveBlock={1}>
        <ExpandableBlock title="Test0" isExpanded={true} onClick={() => { }}>
          Hello0
        </ExpandableBlock>
        <ExpandableBlock title="Test1" isExpanded={true} onClick={() => { }}>
          Hello1
        </ExpandableBlock>
      </ExpandableList>);

    const blocks = wrapper.find("div.uicore-expandable-blocks-block");
    const expanded = wrapper.find("div.is-expanded");

    expect(expanded.length).to.eq(1);
    expect(blocks.length).to.eq(2);
    expect(expanded.find("div.content").text()).to.eq("Hello1");

    wrapper.unmount();
  });

  it("should handle block click", () => {
    const clickSpy = sinon.spy();
    const wrapper = mount(
      <ExpandableList>
        <ExpandableBlock title="Test" isExpanded={true} onClick={clickSpy}>
          <div>Hello</div>
        </ExpandableBlock>
      </ExpandableList>);

    wrapper.find("div.uicore-expandable-blocks-block > .header").simulate("click");
    expect(clickSpy.calledOnce).to.be.true;

    wrapper.unmount();
  });

  it("should support singleExpandOnly & singleIsCollapsible props", () => {
    const wrapper = mount(
      <ExpandableList singleExpandOnly={true} singleIsCollapsible={true} defaultActiveBlock={1}>
        <ExpandableBlock title="Test0" isExpanded={true} onClick={() => { }}>
          Hello0
        </ExpandableBlock>
        <ExpandableBlock title="Test1" isExpanded={true} onClick={() => { }}>
          Hello1
        </ExpandableBlock>
      </ExpandableList>);

    let blocks = wrapper.find("div.uicore-expandable-blocks-block");
    let expanded = wrapper.find("div.is-expanded");

    expect(expanded.length).to.eq(1);
    expect(blocks.length).to.eq(2);
    expect(expanded.find("div.content").text()).to.eq("Hello1");

    blocks.at(0).find(".header").simulate("click");
    wrapper.update();
    expanded = wrapper.find("div.is-expanded");
    expect(expanded.length).to.eq(1);
    expect(expanded.find("div.content").text()).to.eq("Hello0");

    blocks = wrapper.find("div.uicore-expandable-blocks-block");
    blocks.at(0).find(".header").simulate("click");
    wrapper.update();
    expanded = wrapper.find("div.is-expanded");
    expect(expanded.length).to.eq(0);

    wrapper.unmount();
  });

  it("should support changing defaultActiveBlock in update", () => {
    const wrapper = mount(
      <ExpandableList singleExpandOnly={true} singleIsCollapsible={true} defaultActiveBlock={1}>
        <ExpandableBlock title="Test0" isExpanded={true} onClick={() => { }}>
          Hello0
        </ExpandableBlock>
        <ExpandableBlock title="Test1" isExpanded={true} onClick={() => { }}>
          Hello1
        </ExpandableBlock>
      </ExpandableList>);

    const blocks = wrapper.find("div.uicore-expandable-blocks-block");
    let expanded = wrapper.find("div.is-expanded");

    expect(expanded.length).to.eq(1);
    expect(blocks.length).to.eq(2);
    expect(expanded.find("div.content").text()).to.eq("Hello1");

    wrapper.setProps({ defaultActiveBlock: 0 });
    wrapper.update();
    expanded = wrapper.find("div.is-expanded");
    expect(expanded.length).to.eq(1);
    expect(expanded.find("div.content").text()).to.eq("Hello0");

    wrapper.setProps({ defaultActiveBlock: 1 });
    wrapper.update();
    expanded = wrapper.find("div.is-expanded");
    expect(expanded.length).to.eq(1);
    expect(expanded.find("div.content").text()).to.eq("Hello1");

    wrapper.unmount();
  });

});
