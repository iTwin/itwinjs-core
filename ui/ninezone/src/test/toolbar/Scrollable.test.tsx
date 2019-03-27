/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Direction, Chevron, ToolbarPanelAlignment, Scrollable, PanelsProvider } from "../../ui-ninezone";

// tslint:disable-next-line:variable-name
const ToolbarItem = () => <div />;

describe("<Scrollable />", () => {
  it("should render", () => {
    mount(<Scrollable />);
  });

  it("renders correctly", () => {
    shallow(<Scrollable />).should.matchSnapshot();
  });

  it("renders with visible item threshold", () => {
    const sut = shallow(
      <Scrollable
        visibleItemThreshold={2}
      />,
    );
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("renders with expandsTo", () => {
    const sut = shallow(
      <Scrollable
        expandsTo={Direction.Left}
      />,
    );
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("renders with panelAlignment", () => {
    const sut = shallow(
      <Scrollable
        panelAlignment={ToolbarPanelAlignment.End}
      />,
    );
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("renders vertical with overflow scrolled left correctly", () => {
    const sut = shallow(
      <Scrollable
        visibleItemThreshold={3}
        items={
          <>

          </>
        }
      />,
    );
    sut.setState({
      scrollOffset: 1,
    });
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("renders vertical with overflow scrolled right most correctly", () => {
    const sut = shallow(
      <Scrollable
        visibleItemThreshold={2}
        items={
          <>
            <ToolbarItem />
            <ToolbarItem />
            <ToolbarItem />
            <ToolbarItem />
          </>
        }
      />,
    );
    sut.setState({
      scrollOffset: 2,
    });
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("initial scroll offset should be 0", () => {
    const sut = shallow<Scrollable>(<Scrollable />);
    sut.state().scrollOffset.should.eq(0);
  });

  it("should handle left scroll indicator click events", () => {
    const sut = mount<Scrollable>(<Scrollable visibleItemThreshold={3} />);
    sut.setState({
      scrollOffset: 2,
    });

    const scroll = sut.findWhere((node) => node.name() === "div" && node.hasClass("nz-left"));
    scroll.exists().should.true;

    const indicator = scroll.findWhere((node) => node.type() === Chevron);
    indicator.exists().should.true;

    indicator.simulate("click");
    sut.state().scrollOffset.should.eq(1);
  });

  it("should handle right scroll indicator click events", () => {
    const sut = mount<Scrollable>(
      <Scrollable
        visibleItemThreshold={2}
        items={
          <>
            <ToolbarItem />
            <ToolbarItem />
            <ToolbarItem />
            <ToolbarItem />
            <ToolbarItem />
          </>
        }
      />,
    );
    sut.setState({
      scrollOffset: 1,
    });
    const scroll = sut.findWhere((node) => node.name() === "div" && node.hasClass("nz-right"));
    scroll.exists().should.true;

    const indicator = scroll.findWhere((node) => node.type() === Chevron);
    indicator.exists().should.true;

    indicator.simulate("click");
    sut.state().scrollOffset.should.eq(2);
  });

  it("should invoke scroll handler when scrolling left", () => {
    const spy = sinon.spy();
    const sut = mount<Scrollable>(
      <Scrollable
        visibleItemThreshold={3}
        onScroll={spy}
      />,
    );
    sut.setState({
      scrollOffset: 2,
    });

    const scroll = sut.findWhere((node) => node.name() === "div" && node.hasClass("nz-left"));
    const indicator = scroll.findWhere((node) => node.type() === Chevron);

    indicator.simulate("click");
    spy.calledOnce.should.true;
  });

  it("should invoke scroll handler when scrolling right", () => {
    const spy = sinon.spy();
    const sut = mount<Scrollable>(
      <Scrollable
        items={
          <>
            <ToolbarItem />
            <ToolbarItem />
            <ToolbarItem />
            <ToolbarItem />
            <ToolbarItem />
          </>
        }
        onScroll={spy}
        visibleItemThreshold={2}
      />,
    );
    sut.setState({
      scrollOffset: 1,
    });
    const scroll = sut.findWhere((node) => node.name() === "div" && node.hasClass("nz-right"));
    const indicator = scroll.findWhere((node) => node.type() === Chevron);

    indicator.simulate("click");
    spy.calledOnce.should.true;
  });

  it("should scroll left-most when item count changes", () => {
    const sut = mount<Scrollable>(
      <Scrollable
        items={
          <ToolbarItem />
        }
      />,
    );
    sut.setState({
      scrollOffset: 50,
    });
    sut.state().scrollOffset.should.eq(50);

    sut.setProps({
      items: (
        <>
          <ToolbarItem />
          <ToolbarItem />
        </>
      ),
    });
    sut.state().scrollOffset.should.eq(0);
  });
});
