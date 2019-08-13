/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { VerticalTabs } from "../../ui-core";

describe("<VerticalTabs />", () => {
  it("should render", () => {
    const wrapper = mount(<VerticalTabs labels={[]} />);
    wrapper.find(".uicore-tabs-vertical").length.should.equal(1);
  });

  it("renders correctly", () => {
    shallow(<VerticalTabs labels={[]} />).should.matchSnapshot();
  });

  it("labels render correctly", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2", "label 3"]} />);
    wrapper.find("a").length.should.equal(3);
  });

  it("onClickLabel triggers correctly", () => {
    const handler = sinon.spy();
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2"]} onClickLabel={handler} />);
    const label = wrapper.find("a").at(1);
    label.simulate("click");
    handler.should.have.been.calledOnce;
    handler.should.have.been.calledWithExactly(1);
  });

  it("activeIndex sets correctly", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1"]} activeIndex={0} />);
    wrapper.find(".active").length.should.eq(1);
  });

  it("green sets correctly", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1"]} green={true} />);
    wrapper.find(".uicore-tabs-green").length.should.eq(1);
  });
});
