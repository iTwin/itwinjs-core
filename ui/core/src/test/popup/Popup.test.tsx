/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import { render } from "react-testing-library";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";

import { Popup, Position } from "../../ui-core";

describe("Popup />", () => {

  it("renders correctly", () => {
    const component = render(<Popup isOpen={true} top={30} left={70} />);
    expect(component.getByTestId("popup")).to.exist;
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
    });

    it("should call onClose", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen={true} onClose={spyOnClose} />);
      wrapper.setProps({ isOpen: false });
      expect(spyOnClose.calledOnce).to.be.true;
    });
  });

  describe("positioning", () => {
    it("should render TopLeft", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.TopLeft} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.popup-top-left");
      expect(popup.length).be.eq(1);
    });

    it("should render TopRight", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.TopRight} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.popup-top-right");
      expect(popup.length).be.eq(1);
    });

    it("should render BottomLeft", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.BottomLeft} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.popup-bottom-left");
      expect(popup.length).be.eq(1);
    });

    it("should render BottomRight", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.BottomRight} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.popup-bottom-right");
      expect(popup.length).be.eq(1);
    });

    it("should render Top", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.Top} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.popup-top");
      expect(popup.length).be.eq(1);
    });

    it("should render Left", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.Left} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.popup-left");
      expect(popup.length).be.eq(1);
    });

    it("should render Right", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.Right} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.popup-right");
      expect(popup.length).be.eq(1);
    });

    it("should render Bottom", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.Bottom} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.popup-bottom");
      expect(popup.length).be.eq(1);
    });
  });
});
