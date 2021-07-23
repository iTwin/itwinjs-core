/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";
import { HorizontalTabs, Orientation, Tabs, VerticalTabs } from "../../ui-core";

describe("<Tabs />", () => {
  it("labels render correctly", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2", "label 3"]} />);
    wrapper.find("a").length.should.equal(3);
  });

  it("activeIndex sets correctly", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1"]} activeIndex={0} />);
    wrapper.find(".core-active").length.should.eq(1);
    wrapper.unmount();
  });

  it("green sets correctly", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1"]} green={true} />);
    wrapper.find(".uicore-tabs-green").length.should.eq(1);
    wrapper.unmount();
  });

  it("onActivateTab triggers correctly", () => {
    const spyActivate = sinon.spy();
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2"]} onActivateTab={spyActivate} />);
    const label = wrapper.find("a").at(1);
    label.simulate("click");
    spyActivate.should.have.been.calledOnceWithExactly(1);
    wrapper.unmount();
  });

  ///

  it("Home key puts focus on 1st tab", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = wrapper.find("a").at(1);
    label.simulate("keydown", { key: "Home" });
    const first = wrapper.find("a").at(0).getDOMNode();
    expect(document.activeElement).to.eq(first);
  });

  it("End key puts focus on last tab", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = wrapper.find("a").at(1);
    label.simulate("keydown", { key: "End" });
    const last = wrapper.find("a").at(2).getDOMNode();
    expect(document.activeElement).to.eq(last);
    wrapper.unmount();
  });

  ///

  it("Up key in Vertical puts focus on previous tab", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = wrapper.find("a").at(1);
    label.simulate("keydown", { key: "ArrowUp" });
    const first = wrapper.find("a").at(0).getDOMNode();
    expect(document.activeElement).to.eq(first);
    wrapper.unmount();
  });

  it("Down key in Vertical puts focus on next tab", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = wrapper.find("a").at(1);
    label.simulate("keydown", { key: "ArrowDown" });
    const last = wrapper.find("a").at(2).getDOMNode();
    expect(document.activeElement).to.eq(last);
    wrapper.unmount();
  });

  it("Left key in Horizontal puts focus on previous tab", () => {
    // eslint-disable-next-line deprecation/deprecation
    const wrapper = mount(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = wrapper.find("a").at(1);
    label.simulate("keyup", { key: "ArrowLeft" });
    const first = wrapper.find("a").at(0).getDOMNode();
    expect(document.activeElement).to.eq(first);
    wrapper.unmount();
  });

  it("Right key in Horizontal puts focus on next tab", () => {
    // eslint-disable-next-line deprecation/deprecation
    const wrapper = mount(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = wrapper.find("a").at(1);
    label.simulate("keyup", { key: "ArrowRight" });
    const last = wrapper.find("a").at(2).getDOMNode();
    expect(document.activeElement).to.eq(last);
    wrapper.unmount();
  });

  ///

  it("Up key in Vertical puts focus on last tab when on first", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={0} />);
    const label = wrapper.find("a").at(0);
    label.simulate("keydown", { key: "ArrowUp" });
    const last = wrapper.find("a").at(2).getDOMNode();
    expect(document.activeElement).to.eq(last);
    wrapper.unmount();
  });

  it("Down key in Vertical puts focus on first tab when on last", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={2} />);
    const label = wrapper.find("a").at(2);
    label.simulate("keydown", { key: "ArrowDown" });
    const first = wrapper.find("a").at(0).getDOMNode();
    expect(document.activeElement).to.eq(first);
    wrapper.unmount();
  });

  it("Left key in Horizontal puts focus on last tab when on first", () => {
    // eslint-disable-next-line deprecation/deprecation
    const wrapper = mount(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={0} />);
    const label = wrapper.find("a").at(0);
    label.simulate("keyup", { key: "ArrowLeft" });
    const last = wrapper.find("a").at(2).getDOMNode();
    expect(document.activeElement).to.eq(last);
    wrapper.unmount();
  });

  it("Right key in Horizontal puts focus on first tab when on last", () => {
    // eslint-disable-next-line deprecation/deprecation
    const wrapper = mount(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={2} />);
    const label = wrapper.find("a").at(2);
    label.simulate("keyup", { key: "ArrowRight" });
    const first = wrapper.find("a").at(0).getDOMNode();
    expect(document.activeElement).to.eq(first);
    wrapper.unmount();
  });

  ///

  it("Left/Right key in Vertical does nothing", () => {
    const wrapper = mount(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = wrapper.find("a").at(1);
    label.simulate("keyup", { key: "ArrowLeft" });
    let node = wrapper.find("a").at(0).getDOMNode();
    expect(document.activeElement).to.not.eq(node);
    label.simulate("keyup", { key: "ArrowRight" });
    node = wrapper.find("a").at(2).getDOMNode();
    expect(document.activeElement).to.not.eq(node);
    wrapper.unmount();
  });

  it("Up/Down key in Horizontal does nothing", () => {
    // eslint-disable-next-line deprecation/deprecation
    const wrapper = mount(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = wrapper.find("a").at(1);
    label.simulate("keydown", { key: "ArrowUp" });
    let node = wrapper.find("a").at(0).getDOMNode();
    expect(document.activeElement).to.not.eq(node);
    label.simulate("keydown", { key: "ArrowDown" });
    node = wrapper.find("a").at(2).getDOMNode();
    expect(document.activeElement).to.not.eq(node);
    wrapper.unmount();
  });

  ///

  it("Enter key in activates tab", () => {
    const spyActivate = sinon.spy();
    const wrapper = mount<Tabs>(<Tabs orientation={Orientation.Vertical} mainClassName="" labels={["label 1", "label 2", "label 3"]} activeIndex={1} onActivateTab={spyActivate} />);
    expect(wrapper.state().activeIndex).to.eq(1);
    const label = wrapper.find("a").at(0);
    label.simulate("keydown", { key: "Enter" });
    label.simulate("keyup", { key: "Enter" });
    wrapper.update();
    expect(wrapper.state().activeIndex).to.eq(0);
    spyActivate.should.have.been.calledOnceWithExactly(0);
    wrapper.unmount();
  });

  it("Space key in activates tab", () => {
    const spyActivate = sinon.spy();
    const wrapper = mount<Tabs>(<Tabs orientation={Orientation.Vertical} mainClassName="" labels={["label 1", "label 2", "label 3"]} activeIndex={1} onActivateTab={spyActivate} />);
    expect(wrapper.state().activeIndex).to.eq(1);
    const label = wrapper.find("a").at(2);
    label.simulate("keydown", { key: " " });
    label.simulate("keyup", { key: " " });
    wrapper.update();
    expect(wrapper.state().activeIndex).to.eq(2);
    spyActivate.should.have.been.calledOnceWithExactly(2);
    wrapper.unmount();
  });

  ///

  it("Supports updating labels & orientation", () => {
    const wrapper = mount<Tabs>(<Tabs orientation={Orientation.Vertical} mainClassName="" labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    expect(wrapper.state().activeIndex).to.eq(1);
    expect(wrapper.props().orientation).to.eq(Orientation.Vertical);
    expect(wrapper.props().labels.length).to.eq(3);

    wrapper.setProps({ orientation: Orientation.Horizontal });
    expect(wrapper.props().orientation).to.eq(Orientation.Horizontal);

    wrapper.setProps({ labels: ["label 1", "label 2", "label 3", "label 4"] });
    expect(wrapper.props().labels.length).to.eq(4);

    const label = wrapper.find("a").at(1);
    label.simulate("keyup", { key: "ArrowRight" });
    const next = wrapper.find("a").at(2).getDOMNode();
    expect(document.activeElement).to.eq(next);

    wrapper.unmount();
  });

  it("Supports updating activeIndex", async () => {
    const wrapper = mount<Tabs>(<Tabs orientation={Orientation.Vertical} mainClassName="" labels={["label 1", "label 2", "label 3"]}
      activeIndex={0} />);
    expect(wrapper.state().activeIndex).to.eq(0);

    const label = wrapper.find("a").at(0);
    label.simulate("keydown", { key: "Home" });
    const first = wrapper.find("a").at(0).getDOMNode();
    expect(document.activeElement).to.eq(first);

    wrapper.setProps({ activeIndex: 1 });
    wrapper.update();
    expect(wrapper.state().activeIndex).to.eq(1);
    const second = wrapper.find("a").at(1).getDOMNode();
    expect(document.activeElement).to.eq(second);

    wrapper.setProps({ activeIndex: undefined });
    expect(wrapper.state().activeIndex).to.eq(0);

    document.documentElement.focus();
    wrapper.setProps({ activeIndex: 2 });
    expect(wrapper.state().activeIndex).to.eq(2);

    wrapper.setProps({ activeIndex: 3 });
    expect(wrapper.state().activeIndex).to.eq(0);

    wrapper.unmount();
  });

});
