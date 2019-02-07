/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { HorizontalTabs } from "../../ui-core";

describe("<HorizontalTabs />", () => {
  it("should render", () => {
    mount(<HorizontalTabs labels={[]} />);
  });

  it("renders correctly", () => {
    shallow(<HorizontalTabs labels={[]} />).should.matchSnapshot();
  });

  it("labels render correctly", () => {
    const wrapper = shallow(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} />);
    wrapper.find("a").length.should.equal(3);
  });

  it("onClickLabel triggers correctly", () => {
    const handler = sinon.spy();
    const wrapper = shallow(<HorizontalTabs labels={["label 1", "label 2"]} onClickLabel={handler} />);
    const label = wrapper.find("a").at(1);
    label.simulate("click");
    handler.should.have.been.calledOnce;
    handler.should.have.been.calledWithExactly(1);
  });

  it("activeIndex sets correctly", () => {
    const wrapper = shallow(<HorizontalTabs labels={["label 1"]} activeIndex={0} />);
    wrapper.find(".active").should.exist;

  });

  it("green sets correctly", () => {
    const wrapper = shallow(<HorizontalTabs labels={["label 1"]} green={true} />);
    wrapper.find(".green").should.exist;

  });
});
