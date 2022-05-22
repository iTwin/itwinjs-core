/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount } from "enzyme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";
import { HorizontalTabs, Orientation, Tabs, VerticalTabs } from "../../core-react";
import { findInstance } from "../ReactInstance";

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
    const { getAllByRole } = render(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 1");
    userEvent.type(label, "{home}");
    const first = getAllByRole("button")[0];
    expect(document.activeElement).to.eq(first);
  });

  it("End key puts focus on last tab", () => {
    const { getAllByRole } = render(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 1");
    userEvent.type(label, "{end}");
    const last = getAllByRole("button")[2];
    expect(document.activeElement).to.eq(last);
  });

  ///

  it("Up key in Vertical puts focus on previous tab", () => {
    const { getAllByRole } = render(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 2");
    userEvent.type(label, "{arrowup}");
    const previous = getAllByRole("button")[0];
    expect(document.activeElement).to.eq(previous);
  });

  it("Down key in Vertical puts focus on next tab", () => {
    const { getAllByRole } = render(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 2");
    userEvent.type(label, "{arrowdown}");
    const nextTab = getAllByRole("button")[2];
    expect(document.activeElement).to.eq(nextTab);
  });

  it("Left key in Horizontal puts focus on previous tab", () => {
    // eslint-disable-next-line deprecation/deprecation
    const { getAllByRole } = render(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 2");
    userEvent.type(label, "{arrowleft}");
    const previous = getAllByRole("button")[0];
    expect(document.activeElement).to.eq(previous);
  });

  it("Right key in Horizontal puts focus on next tab", () => {
    // eslint-disable-next-line deprecation/deprecation
    const { getAllByRole } = render(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 2");
    userEvent.type(label, "{arrowright}");
    const nextTab = getAllByRole("button")[2];
    expect(document.activeElement).to.eq(nextTab);
  });

  ///

  it("Up key in Vertical puts focus on last tab when on first", () => {
    const { getAllByRole } = render(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 1");
    userEvent.type(label, "{arrowup}");
    const last = getAllByRole("button")[2];
    expect(document.activeElement).to.eq(last);
  });

  it("Down key in Vertical puts focus on first tab when on last", () => {
    const { getAllByRole } = render(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 3");
    userEvent.type(label, "{arrowdown}");
    const first = getAllByRole("button")[0];
    expect(document.activeElement).to.eq(first);
  });

  it("Left key in Horizontal puts focus on last tab when on first", () => {
    // eslint-disable-next-line deprecation/deprecation
    const { getAllByRole } = render(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 1");
    userEvent.type(label, "{arrowleft}");
    const last = getAllByRole("button")[2];
    expect(document.activeElement).to.eq(last);
  });

  it("Right key in Horizontal puts focus on first tab when on last", () => {
    // eslint-disable-next-line deprecation/deprecation
    const { getAllByRole } = render(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 3");
    userEvent.type(label, "{arrowright}");
    const first = getAllByRole("button")[0];
    expect(document.activeElement).to.eq(first);
  });

  ///

  it("Left/Right key in Vertical does nothing", () => {
    const { getAllByRole } = render(<VerticalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 2");
    userEvent.type(label, "{arrowleft}");
    const first = getAllByRole("button")[0];
    expect(document.activeElement).to.not.eq(first);
    userEvent.type(label, "{arrowleft}");
    const last = getAllByRole("button")[2];
    expect(document.activeElement).to.not.eq(last);
  });

  it("Up/Down key in Horizontal does nothing", () => {
    // eslint-disable-next-line deprecation/deprecation
    const { getAllByRole } = render(<HorizontalTabs labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    const label = screen.getByText("label 2");
    userEvent.type(label, "{arrowup}");
    const first = getAllByRole("button")[0];
    expect(document.activeElement).to.not.eq(first);
    userEvent.type(label, "{arrowdown}");
    const last = getAllByRole("button")[2];
    expect(document.activeElement).to.not.eq(last);
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
    const { container, getAllByRole, rerender } = render(<Tabs orientation={Orientation.Vertical} mainClassName="" labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    container.focus();
    let tabButtons = getAllByRole("button");
    expect(tabButtons.length).to.eq(3);
    let label = screen.getByText("label 2");
    // verify they're vertical by using arrow up to change focus
    userEvent.type(label, "{arrowup}");
    expect(document.activeElement).to.eq(tabButtons[0]);

    rerender(<Tabs orientation={Orientation.Horizontal} mainClassName="" labels={["label 1", "label 2", "label 3", "label 4"]} activeIndex={1} />);
    tabButtons = getAllByRole("button");
    expect(tabButtons.length).to.eq(4);
    label = screen.getByText("label 2");
    userEvent.type(label, "{enter}"); // focus in the tab
    userEvent.type(label, "{arrowup}");
    // arrow up does not change focus because they're horizontal
    expect(document.activeElement).to.eq(tabButtons[1]);
  });

  it("Supports updating activeIndex", async () => {
    const { container, getByText, getAllByRole, rerender } = render(<Tabs orientation={Orientation.Vertical} mainClassName="" labels={["label 1", "label 2", "label 3"]} activeIndex={0} />);
    const tabsInstance = findInstance(container.firstChild);
    expect(tabsInstance.state.activeIndex).to.eq(0);

    const label = getByText("label 1");
    userEvent.type(label, "{home}");
    const tabButtons = getAllByRole("button");
    expect(document.activeElement).to.eq(tabButtons[0]);

    rerender(<Tabs orientation={Orientation.Vertical} mainClassName="" labels={["label 1", "label 2", "label 3"]} activeIndex={1} />);
    expect(tabsInstance.state.activeIndex).to.eq(1);
    expect(document.activeElement).to.eq(tabButtons[1]);

    rerender(<Tabs orientation={Orientation.Vertical} mainClassName="" labels={["label 1", "label 2", "label 3"]} />);
    expect(document.activeElement).to.eq(tabButtons[0]);

    document.documentElement.focus();
    rerender(<Tabs orientation={Orientation.Vertical} mainClassName="" labels={["label 1", "label 2", "label 3"]} activeIndex={2} />);
    expect(tabsInstance.state.activeIndex).to.eq(2);

    rerender(<Tabs orientation={Orientation.Vertical} mainClassName="" labels={["label 1", "label 2", "label 3"]} activeIndex={3} />);
    expect(tabsInstance.state.activeIndex).to.eq(0);
  });

});
