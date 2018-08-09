/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import ExpansionToggle from "@src/tree/ExpansionToggle";
import Node from "@src/tree/Node";

describe("<Node />", () => {
  it("should render", () => {
    mount(<Node />);
  });

  it("renders correctly", () => {
    shallow(<Node />).should.matchSnapshot();
  });

  it("should set is-focused class", () => {
    shallow(<Node isFocused />).should.matchSnapshot();
  });

  it("should set is-selected class", () => {
    shallow(<Node isSelected />).should.matchSnapshot();
  });

  it("should set is-hover-disabled class", () => {
    shallow(<Node isHoverDisabled />).should.matchSnapshot();
  });

  it("renders label correctly", () => {
    const label = (<span id="test">{"This is some test label"}</span>);
    shallow(<Node label={label} />).should.matchSnapshot();
  });

  it("renders icon correctly", () => {
    const icon = (<img src="testIcon" />);
    shallow(<Node icon={icon} />).should.matchSnapshot();
  });

  it("renders loader correctly", () => {
    shallow(<Node isLoading />).should.matchSnapshot();
  });

  it("renders expander correctly", () => {
    shallow(<Node isLeaf />).should.matchSnapshot();
    shallow(<Node isExpanded />).should.matchSnapshot();
    shallow(<Node isLeaf isExpanded />).should.matchSnapshot();
  });

  it("renders children correctly", () => {
    const wrapper = shallow(<Node><div className="unique" /></Node>);
    wrapper.find(".unique").should.have.lengthOf(1);
  });

  it("should handle click events", () => {
    const clickHandler = sinon.spy();
    const expandHandler = sinon.spy();
    const wrapper = shallow(<Node onClick={clickHandler} onClickExpansionToggle={expandHandler} />);
    wrapper.should.exist;

    const expander = wrapper.find(ExpansionToggle);
    expander.should.have.lengthOf(1);

    wrapper.simulate("click", new MouseEvent("click"));
    clickHandler.calledOnce.should.true;
    expandHandler.should.not.have.been.called;

    clickHandler.resetHistory();
    expandHandler.resetHistory();

    expander.simulate("click", new MouseEvent("click"));
    clickHandler.should.not.have.been.called;
    expandHandler.calledOnce.should.true;
  });

  it("should safely handle click events with undefined handlers", () => {
    const wrapper = shallow(<Node />);
    wrapper.should.exist;

    const expander = wrapper.find(ExpansionToggle);
    expander.should.have.lengthOf(1);

    wrapper.simulate("click", new MouseEvent("click"));
    expander.simulate("click", new MouseEvent("click"));
  });
});
