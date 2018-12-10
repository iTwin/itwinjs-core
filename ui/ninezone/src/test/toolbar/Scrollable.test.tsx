/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Direction, Chevron, ToolbarPanelAlignment, Scrollable, ScrollableState, PanelsProvider } from "../../ui-ninezone";

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
    const rendered = shallow(renderProp!(undefined, undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("renders with expandsTo", () => {
    const sut = shallow(
      <Scrollable
        expandsTo={Direction.Left}
      />,
    );
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined, undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("renders with panelAlignment", () => {
    const sut = shallow(
      <Scrollable
        panelAlignment={ToolbarPanelAlignment.End}
      />,
    );
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined, undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("renders vertical with overflow scrolled left correctly", () => {
    const sut = shallow(
      <Scrollable
        visibleItemThreshold={3}
        items={
          <>
            <div />
            <div />
            <div />
            <div />
          </>
        }
      />,
    );
    sut.setState({
      scrollOffset: 1,
    });
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined, undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("renders vertical with overflow scrolled right most correctly", () => {
    const sut = shallow(
      <Scrollable
        visibleItemThreshold={2}
        items={
          <>
            <div />
            <div />
            <div />
            <div />
          </>
        }
      />,
    );
    sut.setState({
      scrollOffset: 2,
    });
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined, undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("initial scroll offset should be 0", () => {
    const sut = shallow<Scrollable, ScrollableState>(<Scrollable />);
    sut.state().scrollOffset.should.eq(0);
  });

  it("should handle left scroll indicator click events", () => {
    const sut = mount<Scrollable, ScrollableState>(<Scrollable visibleItemThreshold={3} />);
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
    const sut = mount<Scrollable, ScrollableState>(
      <Scrollable
        visibleItemThreshold={2}
        items={
          <>
            <div />
            <div />
            <div />
            <div />
            <div />
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
});
