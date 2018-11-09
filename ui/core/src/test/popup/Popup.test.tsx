/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";

import { Popup, Position } from "../../index";

describe("Popup", () => {
  describe("renders", () => {
    it("should render with few props", () => {
      const wrapper = mount(
        <div>
          <Popup isShown={true} />
        </div>);
      wrapper.unmount();
    });

    it("should render with many props", () => {
      const wrapper = mount(
        <div>
          <Popup isShown={true} onOpen={() => { }} onClose={() => { }} showShadow={true} showArrow={true} showOnHover={true} showTime={2000} hideTime={2000} position={Position.BottomRight} />
        </div>);
      wrapper.unmount();
    });

    it("renders correctly with few props", () => {
      shallow(
        <div>
          <Popup isShown={true} />
        </div>).should.matchSnapshot();
    });

    it("renders correctly with many props", () => {
      shallow(
        <div>
          <Popup isShown={true} onOpen={() => { }} onClose={() => { }} showShadow={true} showArrow={true} showOnHover={true} showTime={2000} hideTime={2000} position={Position.BottomRight} />
        </div>).should.matchSnapshot();
    });
  });

  describe("componentDidUpdate", () => {
    it("should call onOpen", () => {
      const spyOnOpen = sinon.spy();
      const wrapper = mount(<Popup isShown={false} onOpen={spyOnOpen} />);
      wrapper.setProps({ isShown: true });
      expect(spyOnOpen.calledOnce).to.be.true;
    });

    it("should call onClose", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isShown={true} onClose={spyOnClose} />);
      wrapper.setProps({ isShown: false });
      expect(spyOnClose.calledOnce).to.be.true;
    });
  });

  describe("positioning", () => {
    it("should render TopLeft", () => {
      const wrapper = mount(<Popup isShown={false} position={Position.TopLeft} />);
      wrapper.setProps({ isShown: true });
      const popup = wrapper.find("div.popup-top-left");
      expect(popup.length).be.eq(1);
    });

    it("should render TopRight", () => {
      const wrapper = mount(<Popup isShown={false} position={Position.TopRight} />);
      wrapper.setProps({ isShown: true });
      const popup = wrapper.find("div.popup-top-right");
      expect(popup.length).be.eq(1);
    });

    it("should render BottomLeft", () => {
      const wrapper = mount(<Popup isShown={false} position={Position.BottomLeft} />);
      wrapper.setProps({ isShown: true });
      const popup = wrapper.find("div.popup-bottom-left");
      expect(popup.length).be.eq(1);
    });

    it("should render BottomRight", () => {
      const wrapper = mount(<Popup isShown={false} position={Position.BottomRight} />);
      wrapper.setProps({ isShown: true });
      const popup = wrapper.find("div.popup-bottom-right");
      expect(popup.length).be.eq(1);
    });

    it("should render Top", () => {
      const wrapper = mount(<Popup isShown={false} position={Position.Top} />);
      wrapper.setProps({ isShown: true });
      const popup = wrapper.find("div.popup-top");
      expect(popup.length).be.eq(1);
    });

    it("should render Left", () => {
      const wrapper = mount(<Popup isShown={false} position={Position.Left} />);
      wrapper.setProps({ isShown: true });
      const popup = wrapper.find("div.popup-left");
      expect(popup.length).be.eq(1);
    });

    it("should render Right", () => {
      const wrapper = mount(<Popup isShown={false} position={Position.Right} />);
      wrapper.setProps({ isShown: true });
      const popup = wrapper.find("div.popup-right");
      expect(popup.length).be.eq(1);
    });

    it("should render Bottom", () => {
      const wrapper = mount(<Popup isShown={false} position={Position.Bottom} />);
      wrapper.setProps({ isShown: true });
      const popup = wrapper.find("div.popup-bottom");
      expect(popup.length).be.eq(1);
    });

  });

  describe("keyboard support", () => {
    it("should close on Esc key", () => {
      const outerNode = document.createElement("div");
      document.body.appendChild(outerNode);

      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isShown={false} onClose={spyOnClose} showOnHover={true} />, { attachTo: outerNode });
      wrapper.setProps({ isShown: true });

      outerNode.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(spyOnClose.calledOnce).to.be.true;
    });
  });

  describe.skip("mouse processing", () => {
    it("should handle document click", () => {
      const outerNode = document.createElement("div");
      document.body.appendChild(outerNode);

      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isShown={false} onClose={spyOnClose} showOnHover={true} />, { attachTo: outerNode });
      wrapper.setProps({ isShown: true });

      outerNode.dispatchEvent(new MouseEvent("click"));
      expect(spyOnClose.calledOnce).to.be.true;
    });
  });

});
