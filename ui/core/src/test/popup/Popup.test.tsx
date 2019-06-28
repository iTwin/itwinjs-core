/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import { render, RenderResult, fireEvent } from "@testing-library/react";
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
  it("renders correctly closed and open", () => {
    const component = render(<Popup isOpen={false} top={30} left={70} />);
    expect(component.queryByTestId("core-popup")).not.to.exist;
    component.rerender(<Popup isOpen={true} top={30} left={70} />);
    expect(component.getByTestId("core-popup")).to.exist;
  });

  it("button opens popup and moves focus correctly (HTMLElementRef)", async () => {
    const focusTarget = React.createRef<HTMLButtonElement>();  // button that should receive focus after popup is open
    let button: HTMLElement | null = null;
    let isOpen = false;

    const component = render(<div>
      <button ref={(el) => { button = el; }} onClick={() => isOpen = !isOpen} />
      <Popup isOpen={isOpen} top={30} left={70} focusTarget={focusTarget} moveFocus={true}>
        <div>
          <button data-testid="button-not-to-have-focus" />
          <button data-testid="button-to-have-focus" ref={focusTarget} />
        </div>
      </Popup>
    </div>);
    expect(component).not.to.be.null;
    expect(button).not.to.be.null;
    expect(isOpen).to.be.false;
    fireEvent.click(button!);
    expect(isOpen).to.be.true;
    component.rerender(<div>
      <button ref={(el) => { button = el; }} onClick={() => isOpen = !isOpen} />
      <Popup isOpen={isOpen} top={30} left={70} focusTarget={focusTarget} moveFocus={true}>
        <div>
          <button data-testid="button-not-to-have-focus" />
          <button data-testid="button-to-have-focus" ref={focusTarget} />
        </div>
      </Popup>
    </div>);
    // component.debug();
    const popup = component.getByTestId("core-popup");
    expect(popup).to.exist;

    // wait for button to receive focus
    await new Promise((r) => { setTimeout(r, 80); });

    const buttonWithFocus = component.getByTestId("button-to-have-focus") as HTMLButtonElement;
    const focusedElement = document.activeElement;
    expect(focusedElement).to.eq(buttonWithFocus);
  });

  it("button opens popup and moves focus correctly (CSS Selector)", async () => {
    let button: HTMLElement | null = null;
    let isOpen = false;

    const component = render(<div>
      <button ref={(el) => { button = el; }} onClick={() => isOpen = !isOpen} />
      <Popup isOpen={isOpen} top={30} left={70} focusTarget=".button-to-have-focus" moveFocus={true}>
        <div>
          <button className="button-not-to-have-focus" data-testid="button-not-to-have-focus" />
          <button className="button-to-have-focus" data-testid="button-to-have-focus" />
        </div>
      </Popup>
    </div>);
    expect(component).not.to.be.null;
    expect(button).not.to.be.null;
    expect(isOpen).to.be.false;
    fireEvent.click(button!);
    expect(isOpen).to.be.true;
    component.rerender(<div>
      <button ref={(el) => { button = el; }} onClick={() => isOpen = !isOpen} />
      <Popup isOpen={isOpen} top={30} left={70} focusTarget=".button-to-have-focus" moveFocus={true}>
        <div>
          <button className="button-not-to-have-focus" data-testid="button-not-to-have-focus" />
          <button className="button-to-have-focus" data-testid="button-to-have-focus" />
        </div>
      </Popup>
    </div>);
    // component.debug();
    const popup = component.getByTestId("core-popup");
    expect(popup).to.exist;

    // wait for button to receive focus
    await new Promise((r) => { setTimeout(r, 80); });

    const buttonWithFocus = component.getByTestId("button-to-have-focus") as HTMLButtonElement;
    const focusedElement = document.activeElement;
    expect(focusedElement).to.eq(buttonWithFocus);
  });

  it("button opens popup and moves focus to first available", async () => {
    let button: HTMLElement | null = null;
    let isOpen = false;

    const component = render(<div>
      <button ref={(el) => { button = el; }} onClick={() => isOpen = !isOpen} />
      <Popup isOpen={isOpen} top={30} left={70} moveFocus={true}>
        <div>
          <span />
          <input data-testid="input-one" />
          <input data-testid="input-two" />
        </div>
      </Popup>
    </div>);
    expect(component).not.to.be.null;
    expect(button).not.to.be.null;
    expect(isOpen).to.be.false;
    fireEvent.click(button!);
    expect(isOpen).to.be.true;
    component.rerender(<div>
      <button ref={(el) => { button = el; }} onClick={() => isOpen = !isOpen} />
      <Popup isOpen={isOpen} top={30} left={70} moveFocus={true}>
        <div>
          <span />
          <input data-testid="input-one" />
          <input data-testid="input-two" />
        </div>
      </Popup>
    </div>);
    // component.debug();
    const popup = component.getByTestId("core-popup");
    expect(popup).to.exist;

    // wait for button to receive focus
    await new Promise((r) => { setTimeout(r, 80); });

    const topDiv = component.getByTestId("focus-trap-div") as HTMLDivElement;
    const bottomDiv = component.getByTestId("focus-trap-limit-div") as HTMLDivElement;
    const inputOne = component.getByTestId("input-one") as HTMLInputElement;
    expect(document.activeElement).to.eq(inputOne);
    const inputTwo = component.getByTestId("input-two") as HTMLInputElement;
    inputTwo.focus();
    expect(document.activeElement).to.eq(inputTwo);

    // if we hit top - reset focus to bottom
    topDiv.focus();
    expect(document.activeElement).to.eq(inputTwo);

    // if we hit bottom - reset focus to top
    bottomDiv.focus();
    expect(document.activeElement).to.eq(inputOne);
  });

  it("popup and moves focus to first available (button)", async () => {
    const component = render(<div>
      <Popup isOpen={true} top={30} left={70} moveFocus={true}>
        <div>
          <span />
          <button data-testid="item-one" />
          <button data-testid="item-two" />
        </div>
      </Popup>
    </div>);
    expect(component.getByTestId("core-popup")).to.exist;

    // wait for button to receive focus
    await new Promise((r) => { setTimeout(r, 80); });
    const activeFocusElement = document.activeElement;
    expect(activeFocusElement).to.eq(component.getByTestId("item-one"));
  });

  it("popup and moves focus to first available (a)", async () => {
    const component = render(<div>
      <Popup isOpen={true} top={30} left={70} moveFocus={true}>
        <div>
          <span />
          <div>
            <div>
              <a href="#" data-testid="item-one">test1</a>
            </div>
          </div>
          <a href="#" data-testid="item-two">test2</a>
        </div>
      </Popup>
    </div>);
    expect(component.getByTestId("core-popup")).to.exist;

    // component.debug();
    // wait for button to receive focus
    await new Promise((r) => { setTimeout(r, 80); });
    const activeFocusElement = document.activeElement;
    expect(activeFocusElement).to.eq(component.getByTestId("item-one"));
  });

  it("popup and moves focus to first available (textarea)", async () => {
    const component = render(<div>
      <Popup isOpen={true} top={30} left={70} moveFocus={true}>
        <div>
          <span />
          <textarea data-testid="item-one" />
          <textarea data-testid="item-two" />
        </div>
      </Popup>
    </div>);
    expect(component.getByTestId("core-popup")).to.exist;

    // wait for button to receive focus
    await new Promise((r) => { setTimeout(r, 80); });
    const activeFocusElement = document.activeElement;
    expect(activeFocusElement).to.eq(component.getByTestId("item-one"));
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

    it("should render Bottom then Right", () => {
      const wrapper = mount(<Popup isOpen={false} position={Position.Bottom} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      let popup = wrapper.find("div.core-popup-bottom");
      expect(popup.length).be.eq(1);

      wrapper.setProps({ position: Position.Right });
      wrapper.update();
      popup = wrapper.find("div.core-popup-right");
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

  describe("keyboard handling", () => {
    it("should close on Escape", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen={true} onClose={spyOnClose} />);
      expect(wrapper.state("isOpen")).to.be.true;

      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Escape" }));

      spyOnClose.calledOnce.should.true;
      expect(wrapper.state("isOpen")).to.be.false;

      wrapper.unmount();
    });
    it("should close on Enter", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen={true} onClose={spyOnClose} />);
      expect(wrapper.state("isOpen")).to.be.true;

      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Enter" }));

      spyOnClose.calledOnce.should.true;
      expect(wrapper.state("isOpen")).to.be.false;

      wrapper.unmount();
    });
    it("should do nothing on 'a'", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen={true} onClose={spyOnClose}><div>fake content</div></Popup>);
      expect(wrapper.state("isOpen")).to.be.true;

      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "a" }));

      spyOnClose.calledOnce.should.false;
      expect(wrapper.state("isOpen")).to.be.true;

      wrapper.unmount();
    });
  });

});
