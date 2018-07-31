/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Scrollable, { ScrollableState } from "@src/toolbar/Scrollable";
import { Direction } from "@src/utilities/Direction";

describe("<Scrollable />", () => {
  it("should render", () => {
    mount(<Scrollable />);
  });

  it("renders correctly", () => {
    shallow(<Scrollable />).should.matchSnapshot();
  });

  it("renders with visible item threshold", () => {
    shallow(<Scrollable visibleItemThreshold={2} />).should.matchSnapshot();
  });

  it("renders with expandsTo", () => {
    shallow(<Scrollable expandsTo={Direction.Left} />).should.matchSnapshot();
  });

  it("renders vertical with overflow scrolled left correctly", () => {
    const sut = shallow(
      <Scrollable visibleItemThreshold={3}>
        <div />
        <div />
        <div />
        <div />
      </Scrollable>,
    );
    sut.setState({
      scrollOffset: 1,
    });
    sut.should.matchSnapshot();
  });

  it("renders vertical with overflow scrolled right most correctly", () => {
    const sut = shallow(
      <Scrollable
        visibleItemThreshold={2}
      >
        <div />
        <div />
        <div />
        <div />
      </Scrollable>,
    );
    sut.setState({
      scrollOffset: 2,
    });
    sut.should.matchSnapshot();
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

    const indicator = scroll.findWhere((node) => node.name() === "div" && node.hasClass("nz-indicator"));
    indicator.exists().should.true;

    indicator.simulate("click");
    sut.state().scrollOffset.should.eq(1);
  });

  it("should handle right scroll indicator click events", () => {
    const sut = mount<Scrollable, ScrollableState>(
      <Scrollable
        visibleItemThreshold={2}
      >
        <div />
        <div />
        <div />
        <div />
        <div />
      </Scrollable>,
    );
    sut.setState({
      scrollOffset: 1,
    });
    const scroll = sut.findWhere((node) => node.name() === "div" && node.hasClass("nz-right"));
    scroll.exists().should.true;

    const indicator = scroll.findWhere((node) => node.name() === "div" && node.hasClass("nz-indicator"));
    indicator.exists().should.true;

    indicator.simulate("click");
    sut.state().scrollOffset.should.eq(2);
  });
});
