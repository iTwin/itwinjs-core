/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import { render, RenderResult } from "react-testing-library";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";

import { Popup, Position } from "../../ui-core";

describe("Popup />", () => {

  it("renders correctly", () => {
    const component = render(<Popup isOpen={true} top={30} left={70} />);
    expect(component.getByTestId("core-popup")).to.exist;
  });
  it("mounts and unmounts correctly", () => {
    const wrapper = render(<Popup isOpen={true} top={30} left={70} />);
    wrapper.unmount();
  });

  describe("renders", () => {
    it("should render with few props", () => {
      const wrapper = mount(
        <div>
          <Popup isOpen={true} />
        </div>);
      wrapper.unmount();
    });

    it("should render with many props", () => {
      const wrapper = mount(
        <div>
          <Popup isOpen={true} onOpen={() => { }} onClose={() => { }} showShadow={true} showArrow={true} position={Position.BottomRight} />
        </div>);
      wrapper.unmount();
    });

    it("renders correctly with few props", () => {
      shallow(
        <div>
          <Popup isOpen={true} />
        </div>).should.matchSnapshot();
    });

    it("renders correctly with many props", () => {
      shallow(
        <div>
          <Popup isOpen={true} onOpen={() => { }} onClose={() => { }} showShadow={true} showArrow={true} position={Position.BottomRight} />
        </div>).should.matchSnapshot();
    });
  });

  describe("componentDidUpdate", () => {
    it("should call onOpen", () => {
      const spyOnOpen = sinon.spy();
      const wrapper = mount(<Popup isOpen={false} onOpen={spyOnOpen} />);
      wrapper.setProps({ isOpen: true });
      expect(spyOnOpen.calledOnce).to.be.true;
      wrapper.unmount();
    });

    it("should call onClose", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen={true} onClose={spyOnClose} />);
      wrapper.setProps({ isOpen: false });
      expect(spyOnClose.calledOnce).to.be.true;
      wrapper.unmount();
    });
  });

  describe("positioning", () => {
    let divWrapper: RenderResult;
    let targetElement: HTMLElement | null;

    beforeEach(() => {
      divWrapper = render(<div data-testid="test-target" />);
      targetElement = divWrapper.getByTestId("test-target");
    });

    afterEach(() => {
      divWrapper.unmount();
    });

    it("should render TopLeft", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.TopLeft} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-top-left");
      expect(popup.length).be.eq(1);
      wrapper.unmount();
    });

    it("should render TopRight", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.TopRight} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-top-right");
      expect(popup.length).be.eq(1);
      wrapper.unmount();
    });

    it("should render BottomLeft", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.BottomLeft} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-bottom-left");
      expect(popup.length).be.eq(1);
      wrapper.unmount();
    });

    it("should render BottomRight", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.BottomRight} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-bottom-right");
      expect(popup.length).be.eq(1);
      wrapper.unmount();
    });

    it("should render Top", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.Top} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-top");
      expect(popup.length).be.eq(1);
      wrapper.unmount();
    });

    it("should render Left", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.Left} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-left");
      expect(popup.length).be.eq(1);
      wrapper.unmount();
    });

    it("should render Right", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.Right} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-right");
      expect(popup.length).be.eq(1);
      wrapper.unmount();
    });

    it("should render Bottom", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.Bottom} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-bottom");
      expect(popup.length).be.eq(1);
      wrapper.unmount();
    });
  });

  describe("outside click", () => {
    it("should call onOutsideClick", () => {
      const spy = sinon.spy();
      const wrapper = mount(<Popup isOpen={true} onOutsideClick={spy} />);

      const popup = wrapper.find(".core-popup").getDOMNode();
      sinon.stub(popup, "contains").returns(false);

      const mouseDown = document.createEvent("HTMLEvents");
      mouseDown.initEvent("mousedown");
      sinon.stub(mouseDown, "target").get(() => document.createElement("div"));
      window.dispatchEvent(mouseDown);

      expect(spy.calledOnceWithExactly(mouseDown)).be.true;
      wrapper.unmount();
    });
    it("should close on click outside without onOutsideClick", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen={true} onClose={spyOnClose} />);

      const popup = wrapper.find(".core-popup").getDOMNode();
      sinon.stub(popup, "contains").returns(false);

      const mouseDown = document.createEvent("HTMLEvents");
      mouseDown.initEvent("mousedown");
      sinon.stub(mouseDown, "target").get(() => document.createElement("div"));
      window.dispatchEvent(mouseDown);

      spyOnClose.calledOnce.should.true;
      expect(wrapper.state("isOpen")).to.be.false;

      wrapper.unmount();
    });
  });

  describe("scrolling", () => {
    it("should hide when scrolling", () => {
      const wrapper = mount<Popup>(<Popup isOpen={true} />);

      const scroll = document.createEvent("HTMLEvents");
      scroll.initEvent("wheel");
      sinon.stub(scroll, "target").get(() => document.createElement("div"));
      window.dispatchEvent(scroll);

      expect(wrapper.state().isOpen).false;
      wrapper.unmount();
    });

    it("should not hide when scrolling popup content", () => {
      const wrapper = mount<Popup>(<Popup isOpen={true} />);
      const popup = wrapper.find(".core-popup").getDOMNode();

      const scroll = document.createEvent("HTMLEvents");
      scroll.initEvent("wheel");
      sinon.stub(scroll, "target").get(() => popup);
      window.dispatchEvent(scroll);

      expect(wrapper.state().isOpen).true;
      wrapper.unmount();
    });
  });
});
