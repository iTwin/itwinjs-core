/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";
import * as React from "react";
import Tree from "../../tree/Tree";

describe("<Tree />", () => {

  const createRect = (x0: number, y0: number, x1: number, y1: number): ClientRect => ({
    left: x0,
    top: y0,
    right: x1,
    bottom: y1,
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  });
  const createRandomRect = () => createRect(1, 2, 3, 4);

  it("should render", () => {
    mount(<Tree />);
  });

  it("renders correctly", () => {
    shallow(<Tree />).should.matchSnapshot();
  });

  it("renders children correctly", () => {
    const wrapper = shallow(<Tree><div id="unique" /></Tree>);
    wrapper.find("#unique").should.have.lengthOf(1);
  });

  describe("scrollToElement", () => {
    const overrides = {
      scrollTo: Element.prototype.scrollTo,
    };
    const scrollToSpy = sinon.spy();

    beforeEach(() => {
      Element.prototype.scrollTo = scrollToSpy;
      scrollToSpy.resetHistory();
    });

    afterEach(() => {
      Element.prototype.scrollTo = overrides.scrollTo;
    });

    it("scrolls x to 0 if current scroll is not 0 but scrolling to 0 still keeps the whole element visible", () => {
      const wrapper = mount(<Tree style={{ overflow: "scroll" }} />);
      wrapper.getDOMNode().getBoundingClientRect = () => createRect(1000, 0, 1100, 100);
      wrapper.getDOMNode().scrollLeft = 100;
      const tree = wrapper.instance() as Tree;
      const elementRect = createRect(980, 0, 1000, 20);
      tree.scrollToElement(elementRect);
      expect(scrollToSpy).to.be.calledWithMatch(sinon.match(({ left }) => left === 0));
    });

    it("keeps current x scroll if the whole element is already visible", () => {
      const wrapper = mount(<Tree style={{ overflow: "scroll" }} />);
      wrapper.getDOMNode().getBoundingClientRect = () => createRect(1000, 0, 1100, 100);
      wrapper.getDOMNode().scrollLeft = 100;
      const tree = wrapper.instance() as Tree;
      const elementRect = createRect(1000, 0, 1020, 20);
      tree.scrollToElement(elementRect);
      expect(scrollToSpy).to.be.calledWithMatch(sinon.match(({ left }) => left === 100));
    });

    it("scrolls to x position to make the whole element visible", () => {
      const wrapper = mount(<Tree style={{ overflow: "scroll" }} />);
      wrapper.getDOMNode().getBoundingClientRect = () => createRect(1000, 0, 1100, 100);
      wrapper.getDOMNode().scrollLeft = 0;
      const tree = wrapper.instance() as Tree;
      const elementRect = createRect(1100, 0, 1120, 20);
      tree.scrollToElement(elementRect);
      expect(scrollToSpy).to.be.calledWithMatch(sinon.match(({ left }) => left === 100));
    });

    it("keeps current y scroll if the whole element is already visible", () => {
      const wrapper = mount(<Tree style={{ overflow: "scroll" }} />);
      wrapper.getDOMNode().getBoundingClientRect = () => createRect(0, 100, 100, 220);
      wrapper.getDOMNode().scrollTop = 20;
      const tree = wrapper.instance() as Tree;
      const elementRect = createRect(0, 120, 20, 140);
      tree.scrollToElement(elementRect);
      expect(scrollToSpy).to.be.calledWithMatch(sinon.match(({ top }) => top === 20));
    });

    it("scrolls to y position to make the whole element visible", () => {
      const wrapper = mount(<Tree style={{ overflow: "scroll" }} />);
      wrapper.getDOMNode().getBoundingClientRect = () => createRect(0, 100, 100, 220);
      wrapper.getDOMNode().scrollLeft = 0;
      const tree = wrapper.instance() as Tree;
      const elementRect = createRect(0, 220, 20, 240);
      tree.scrollToElement(elementRect);
      expect(scrollToSpy).to.be.calledWithMatch(sinon.match(({ top }) => top === 120));
    });

    it("does nothing if Tree isn't mounted properly", () => {
      const tree = new Tree({});
      tree.scrollToElement(createRandomRect());
      expect(scrollToSpy).to.not.be.called;
    });

    it("does nothing if Tree is not scrollable and doesn't have a scrollable child", () => {
      const wrapper = mount(<Tree><div /></Tree>);
      const tree = wrapper.instance() as Tree;
      tree.scrollToElement(createRandomRect());
      expect(scrollToSpy).to.not.be.called;
    });
  });

  describe("getElementsByClassName", () => {

    it("returns empty array when component is not mounted", () => {
      const instance = new Tree({});
      expect(instance.getElementsByClassName("test").length).to.eq(0);
    });

    it("returns child elements by class name", () => {
      const wrapper = mount(<Tree><div className="test" /></Tree>);
      const instance = wrapper.instance() as Tree;
      expect(instance.getElementsByClassName("no").length).to.eq(0);
      expect(instance.getElementsByClassName("test").length).to.eq(1);
    });

  });

});
