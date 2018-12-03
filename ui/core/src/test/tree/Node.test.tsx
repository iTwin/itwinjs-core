/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import ExpansionToggle from "../..//tree/ExpansionToggle";
import Node from "../..//tree/Node";

describe("<Node />", () => {
  it("should render", () => {
    mount(<Node label="a" level={0} />);
  });

  it("renders correctly", () => {
    shallow(<Node label="a" level={0} />).should.matchSnapshot();
  });

  it("should set is-focused class", () => {
    shallow(<Node label="a" level={0} isFocused />).should.matchSnapshot();
  });

  it("should set is-selected class", () => {
    shallow(<Node label="a" level={0} isSelected />).should.matchSnapshot();
  });

  it("should set is-hover-disabled class", () => {
    shallow(<Node label="a" level={0} isHoverDisabled />).should.matchSnapshot();
  });

  it("renders label correctly", () => {
    const label = (<span id="test">{"This is some test label"}</span>);
    shallow(<Node level={0} label={label} />).should.matchSnapshot();
  });

  it("renders icon correctly", () => {
    const icon = (<img src="testIcon" />);
    shallow(<Node label="a" level={0} icon={icon} />).should.matchSnapshot();
  });

  it("renders loader correctly", () => {
    shallow(<Node label="a" level={0} isLoading />).should.matchSnapshot();
  });

  it("renders expander correctly", () => {
    shallow(<Node label="a" level={0} isLeaf />).should.matchSnapshot();
    shallow(<Node label="a" level={0} isExpanded />).should.matchSnapshot();
    shallow(<Node label="a" level={0} isLeaf isExpanded />).should.matchSnapshot();
  });

  it("renders children correctly", () => {
    const wrapper = shallow(<Node label="a" level={0}><div className="unique" /></Node>);
    wrapper.find(".unique").should.have.lengthOf(1);
  });

  it("should handle click events", () => {
    const clickHandler = sinon.spy();
    const expandHandler = sinon.spy();
    const wrapper = shallow(<Node label="a" level={0} onClick={clickHandler} onClickExpansionToggle={expandHandler} />);
    wrapper.should.exist;

    const expander = wrapper.find(ExpansionToggle);
    expander.should.have.lengthOf(1);

    const content = wrapper.find("div.contents");
    content.should.have.lengthOf(1);
    content.simulate("click", new MouseEvent("click"));
    clickHandler.calledOnce.should.true;
    expandHandler.should.not.have.been.called;

    clickHandler.resetHistory();
    expandHandler.resetHistory();

    expander.simulate("click", new MouseEvent("click"));
    clickHandler.should.not.have.been.called;
    expandHandler.calledOnce.should.true;
  });

  it("should safely handle click events with undefined handlers", () => {
    const wrapper = shallow(<Node label="a" level={0} />);
    wrapper.should.exist;

    const expander = wrapper.find(ExpansionToggle);
    expander.should.have.lengthOf(1);

    wrapper.simulate("click", new MouseEvent("click"));
    expander.simulate("click", new MouseEvent("click"));
  });

  it("sets data-testid", () => {
    const wrapper = shallow(<Node label="a" level={0} data-testid="test" />);
    const elementsWithDataTestId = wrapper.find("[data-testid]");
    const dataTestIds = elementsWithDataTestId.map((w) => w.prop("data-testid"));
    dataTestIds.length.should.eq(3);
    dataTestIds.indexOf("test").should.not.eq(-1);
    dataTestIds.indexOf("test-expansion-toggle").should.not.eq(-1);
    dataTestIds.indexOf("test-contents").should.not.eq(-1);
  });

});
