/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { RelativePosition } from "@itwin/appui-abstract";
import { fireEvent, render, RenderResult } from "@testing-library/react";
import { Popup, PopupProps } from "../../core-react";

function NestedPopup() {
  const [showPopup, setShowPopup] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const togglePopup = React.useCallback(() => {
    setShowPopup(!showPopup);
  }, [showPopup]);

  const handleClose = React.useCallback(() => {
    setShowPopup(false);
  }, []);

  return (
    <div>
      <button data-testid="NestedPopup" onClick={togglePopup} ref={buttonRef}>{showPopup ? "Close" : "Open"}</button>
      <Popup isOpen={showPopup} position={RelativePosition.Bottom} target={buttonRef.current}
        onClose={handleClose} showArrow={true} showShadow={true} >
        <div>
          <button data-testid="NestedPopup-Button">Test</button>
        </div>
      </Popup>
    </div>
  );
}

function PrimaryPopup({ closeOnNestedPopupOutsideClick }: { closeOnNestedPopupOutsideClick?: boolean }) {
  const [showPopup, setShowPopup] = React.useState(false);

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const togglePopup = React.useCallback(() => {
    setShowPopup(!showPopup);
  }, [showPopup]);

  const handleClose = React.useCallback(() => {
    setShowPopup(false);
  }, []);

  return (
    <div>
      <button data-testid="PrimaryPopup" onClick={togglePopup} ref={buttonRef}>{showPopup ? "Close" : "Open"}</button>
      <Popup isOpen={showPopup} position={RelativePosition.Bottom} target={buttonRef.current}
        onClose={handleClose} showArrow={true} showShadow={true} closeOnNestedPopupOutsideClick={closeOnNestedPopupOutsideClick}>
        <NestedPopup />
      </Popup>
    </div>
  );
}

describe("<Popup />", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("renders correctly", () => {
    const component = render(<Popup isOpen top={30} left={70} />);
    expect(component.getByTestId("core-popup")).to.exist;
  });

  it("mounts and unmounts correctly", () => {
    const wrapper = render(<Popup isOpen top={30} left={70} />);
    wrapper.unmount();
  });

  it("mounts with role correctly", () => {
    const wrapper = render(<Popup isOpen top={30} left={70} role="alert" />);
    wrapper.unmount();
  });

  it("renders correctly closed and open", () => {
    const component = render(<Popup top={30} left={70} />);
    expect(component.queryByTestId("core-popup")).not.to.exist;
    component.rerender(<Popup isOpen top={30} left={70} />);
    expect(component.getByTestId("core-popup")).to.exist;
  });

  it("button opens popup and moves focus correctly (HTMLElementRef)", async () => {
    const focusTarget = React.createRef<HTMLButtonElement>();  // button that should receive focus after popup is open
    let button: HTMLElement | null = null;
    let isOpen = false;

    const component = render(<div>
      <button ref={(el) => { button = el; }} onClick={() => isOpen = !isOpen} />
      <Popup isOpen={isOpen} top={30} left={70} focusTarget={focusTarget} moveFocus>
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
      <Popup isOpen={isOpen} top={30} left={70} focusTarget={focusTarget} moveFocus>
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
      <Popup isOpen={isOpen} top={30} left={70} focusTarget=".button-to-have-focus" moveFocus>
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
      <Popup isOpen={isOpen} top={30} left={70} focusTarget=".button-to-have-focus" moveFocus>
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
      <Popup isOpen={isOpen} top={30} left={70} moveFocus>
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
      <Popup isOpen={isOpen} top={30} left={70} moveFocus>
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
    expect(document.activeElement).to.eq(inputTwo as HTMLElement);

    // if we hit top - reset focus to bottom
    topDiv.focus();
    expect(document.activeElement).to.eq(inputTwo as HTMLElement);

    // if we hit bottom - reset focus to top
    bottomDiv.focus();
    expect(document.activeElement).to.eq(inputOne as HTMLElement);
  });

  it("popup and moves focus to first available (button)", async () => {
    const component = render(<div>
      <Popup isOpen top={30} left={70} moveFocus>
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
      <Popup isOpen top={30} left={70} moveFocus>
        <div>
          <span />
          <div>
            <div>
              <a href="test" data-testid="item-one">test1</a>
            </div>
          </div>
          <a href="test" data-testid="item-two">test2</a>
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
      <Popup isOpen top={30} left={70} moveFocus>
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

  it("popup should NOT close when click in nested popup", async () => {
    const component = render(<PrimaryPopup />);
    const primaryButton = component.getByTestId("PrimaryPopup");
    expect(primaryButton).to.exist;
    fireEvent.click(primaryButton);
    const secondaryButton = component.getByTestId("NestedPopup");
    expect(secondaryButton).to.exist;
    fireEvent.click(secondaryButton);
    let nestedButton = component.getByTestId("NestedPopup-Button");
    expect(nestedButton).to.exist;
    fireEvent.click(nestedButton);

    const mouseDown = new PointerEvent("pointerdown");
    sinon.stub(mouseDown, "target").get(() => nestedButton);
    window.dispatchEvent(mouseDown);
    // component.debug();
    nestedButton = component.getByTestId("NestedPopup-Button");
    expect(nestedButton).to.exist;
  });

  it("popup should close when click in nested popup", async () => {
    const component = render(<PrimaryPopup closeOnNestedPopupOutsideClick={true} />);
    const primaryButton = component.getByTestId("PrimaryPopup");
    expect(primaryButton).to.exist;
    fireEvent.click(primaryButton);
    const secondaryButton = component.getByTestId("NestedPopup");
    expect(secondaryButton).to.exist;
    fireEvent.click(secondaryButton);
    const nestedButton = component.getByTestId("NestedPopup-Button");
    expect(nestedButton).to.exist;
    fireEvent.click(nestedButton);

    const mouseDown = new PointerEvent("pointerdown");
    sinon.stub(mouseDown, "target").get(() => nestedButton);
    window.dispatchEvent(mouseDown);
    // component.debug();

    expect(component.queryByTestId("NestedPopup-Button")).to.be.null;
  });

  describe("renders", () => {
    it("should render with few props", () => {
      const wrapper = mount(
        <div>
          <Popup isOpen />
        </div>);
      wrapper.unmount();
    });

    it("should render with many props", () => {
      const wrapper = mount(
        <div>
          <Popup isOpen onOpen={() => { }} onClose={() => { }} showShadow showArrow position={RelativePosition.BottomRight} />
        </div>);
      wrapper.unmount();
    });

    it("renders correctly with few props", () => {
      shallow(
        <div>
          <Popup isOpen />
        </div>).should.matchSnapshot();
    });

    it("renders correctly with many props", () => {
      shallow(
        <div>
          <Popup isOpen onOpen={() => { }} onClose={() => { }} showShadow showArrow position={RelativePosition.BottomRight} />
        </div>).should.matchSnapshot();
    });

    it("renders correctly with no animation", () => {
      shallow(
        <div>
          <Popup isOpen animate={false} />
        </div>).should.matchSnapshot();
    });

  });

  describe("componentDidUpdate", () => {
    it("should call onOpen", () => {
      const spyOnOpen = sinon.spy();
      const wrapper = mount(<Popup onOpen={spyOnOpen} />);
      wrapper.setProps({ isOpen: true });
      expect(spyOnOpen.calledOnce).to.be.true;
      wrapper.unmount();
    });

    it("should call onClose", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose} />);
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
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 100, height: 50 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.TopLeft} target={target} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-top-left");
      expect(popup.length).be.eq(1);
      wrapper.state("top").should.eq(96);
      wrapper.state("position").should.eq(RelativePosition.TopLeft);
      wrapper.unmount();
    });

    it("should render TopRight", () => {
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 100, height: 50 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.TopRight} target={target} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-top-right");
      wrapper.state("top").should.eq(96);
      expect(popup.length).be.eq(1);
      wrapper.state("position").should.eq(RelativePosition.TopRight);
      wrapper.unmount();
    });

    it("should render BottomLeft", () => {
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.BottomLeft} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-bottom-left");
      expect(popup.length).be.eq(1);
      wrapper.state("position").should.eq(RelativePosition.BottomLeft);
      wrapper.unmount();
    });

    it("should render BottomRight", () => {
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.BottomRight} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-bottom-right");
      expect(popup.length).be.eq(1);
      wrapper.state("position").should.eq(RelativePosition.BottomRight);
      wrapper.unmount();
    });

    it("should render Top", () => {
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 100, height: 50 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.Top} target={target} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-top");
      expect(popup.length).be.eq(1);
      wrapper.state("top").should.eq(96);
      wrapper.state("position").should.eq(RelativePosition.Top);
      wrapper.unmount();
    });

    it("should render Left", () => {
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ x: 100, width: 50 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.Left} target={target} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-left");
      expect(popup.length).be.eq(1);
      wrapper.state("left").should.eq(96);
      wrapper.state("position").should.eq(RelativePosition.Left);
      wrapper.unmount();
    });

    it("should render Right", () => {
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.Right} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-right");
      expect(popup.length).be.eq(1);
      wrapper.state("position").should.eq(RelativePosition.Right);
      wrapper.unmount();
    });

    it("should render Bottom", () => {
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.Bottom} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-bottom");
      expect(popup.length).be.eq(1);
      wrapper.state("position").should.eq(RelativePosition.Bottom);
      wrapper.unmount();
    });

    it("should render LeftTop", () => {
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ x: 100, width: 50 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.LeftTop} target={target} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-left-top");
      expect(popup.length).be.eq(1);
      wrapper.state("position").should.eq(RelativePosition.LeftTop);
      wrapper.unmount();
    });

    it("should render RightTop", () => {
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.RightTop} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      const popup = wrapper.find("div.core-popup-right-top");
      expect(popup.length).be.eq(1);
      wrapper.state("position").should.eq(RelativePosition.RightTop);
      wrapper.unmount();
    });

    it("should render Bottom then Right", () => {
      const wrapper = mount(<Popup position={RelativePosition.Bottom} target={targetElement} />);
      wrapper.setProps({ isOpen: true });
      let popup = wrapper.find("div.core-popup-bottom");
      expect(popup.length).be.eq(1);
      wrapper.setProps({ position: RelativePosition.Right });
      wrapper.update();
      popup = wrapper.find("div.core-popup-right");
      expect(popup.length).be.eq(1);
      wrapper.unmount();
    });
  });

  describe("re-positioning", () => {
    it("should reposition Bottom to Top", () => {
      sandbox.stub(window, "innerHeight").get(() => 1000);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 100, height: 900 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.Bottom} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.Top);
      wrapper.unmount();
    });

    it("should reposition BottomLeft to TopLeft", () => {
      sandbox.stub(window, "innerHeight").get(() => 1000);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 100, height: 900 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.BottomLeft} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.TopLeft);
      wrapper.unmount();
    });

    it("should reposition BottomRight to TopRight", () => {
      sandbox.stub(window, "innerHeight").get(() => 1000);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 100, height: 900 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.BottomRight} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.TopRight);
      wrapper.unmount();
    });

    it("should reposition Top to Bottom", () => {
      sandbox.stub(window, "scrollY").get(() => 100);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 80 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.Top} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.Bottom);
      wrapper.unmount();
    });

    it("should reposition TopLeft to BottomLeft", () => {
      sandbox.stub(window, "scrollY").get(() => 100);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 80 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.TopLeft} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.BottomLeft);
      wrapper.unmount();
    });

    it("should reposition TopLeft to BottomLeft", () => {
      sandbox.stub(window, "scrollY").get(() => 100);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 80 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.TopLeft} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.BottomLeft);
      wrapper.unmount();
    });

    it("should reposition TopRight to BottomRight", () => {
      sandbox.stub(window, "scrollY").get(() => 100);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 80 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.TopRight} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.BottomRight);
      wrapper.unmount();
    });

    it("should reposition Left to Right", () => {
      sandbox.stub(window, "scrollX").get(() => 100);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ x: 80 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.Left} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.Right);
      wrapper.unmount();
    });

    it("should reposition LeftTop to RightTop", () => {
      sandbox.stub(window, "scrollX").get(() => 100);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ x: 80 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.LeftTop} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.RightTop);
      wrapper.unmount();
    });

    it("should reposition Right to Left", () => {
      sandbox.stub(window, "innerWidth").get(() => 1000);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 1010 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.Right} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.Left);
      wrapper.unmount();
    });

    it("should reposition RightTop to LeftTop", () => {
      sandbox.stub(window, "innerWidth").get(() => 1000);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 1010 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.RightTop} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.LeftTop);
      wrapper.unmount();
    });

    it("should not reposition on bottom overflow", () => {
      sandbox.stub(window, "innerHeight").get(() => 900);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 100, height: 900 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.Top} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.Top);
      wrapper.unmount();
    });

    it("should not reposition on right overflow", () => {
      sandbox.stub(window, "innerWidth").get(() => 1000);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ x: 100, width: 1000 }));
      const wrapper = mount<PopupProps>(<Popup position={RelativePosition.Left} target={target} />);
      wrapper.setProps({ isOpen: true });
      wrapper.state("position").should.eq(RelativePosition.Left);
      wrapper.unmount();
    });
  });

  describe("outside click", () => {
    it("should call onOutsideClick", () => {
      const spy = sinon.spy();
      const wrapper = mount(<Popup isOpen onOutsideClick={spy} />);

      const popup = wrapper.find(".core-popup").getDOMNode();
      sinon.stub(popup, "contains").returns(false);

      const mouseDown = new PointerEvent("pointerdown");
      sinon.stub(mouseDown, "target").get(() => document.createElement("div"));
      window.dispatchEvent(mouseDown);

      expect(spy.calledOnceWithExactly(mouseDown)).be.true;
      wrapper.unmount();
    });

    it("should close on click outside without onOutsideClick", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose} />);

      const popup = wrapper.find(".core-popup").getDOMNode();
      sinon.stub(popup, "contains").returns(false);

      const mouseDown = new PointerEvent("pointerdown");
      sinon.stub(mouseDown, "target").get(() => document.createElement("div"));
      window.dispatchEvent(mouseDown);

      spyOnClose.calledOnce.should.true;
      expect(wrapper.state("isOpen")).to.be.false;

      wrapper.unmount();
    });

    it("should not close on click outside if pinned", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose} isPinned />);

      const popup = wrapper.find(".core-popup").getDOMNode();
      sinon.stub(popup, "contains").returns(false);

      const mouseDown = new PointerEvent("pointerdown");
      sinon.stub(mouseDown, "target").get(() => document.createElement("div"));
      window.dispatchEvent(mouseDown);

      spyOnClose.calledOnce.should.false;
      expect(wrapper.state("isOpen")).to.be.true;

      wrapper.unmount();
    });

    it("should not close on popup content click", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose} />);

      const popup = wrapper.find(".core-popup").getDOMNode();
      sinon.stub(popup, "contains").returns(true);

      const mouseDown = new PointerEvent("pointerdown");
      sinon.stub(mouseDown, "target").get(() => document.createElement("div"));
      window.dispatchEvent(mouseDown);

      spyOnClose.calledOnce.should.false;
      expect(wrapper.state("isOpen")).to.be.true;

      wrapper.unmount();
    });

    it("should not close on target content click", () => {
      const target = document.createElement("div");
      sinon.stub(target, "contains").returns(true);

      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose} target={target} />);

      const mouseDown = new PointerEvent("pointerdown");
      sinon.stub(mouseDown, "target").get(() => document.createElement("div"));
      window.dispatchEvent(mouseDown);

      spyOnClose.calledOnce.should.false;
      expect(wrapper.state("isOpen")).to.be.true;

      wrapper.unmount();
    });
  });

  describe("scrolling", () => {
    it("should hide when scrolling", () => {
      const wrapper = mount<Popup>(<Popup isOpen />);

      const scroll = new WheelEvent("wheel");
      sinon.stub(scroll, "target").get(() => document.createElement("div"));
      window.dispatchEvent(scroll);

      expect(wrapper.state().isOpen).false;
      wrapper.unmount();
    });

    it("should not hide when scrolling popup content", () => {
      const wrapper = mount<Popup>(<Popup isOpen />);
      const popup = wrapper.find(".core-popup").getDOMNode();

      const scroll = new WheelEvent("wheel");
      sinon.stub(scroll, "target").get(() => popup);
      window.dispatchEvent(scroll);

      expect(wrapper.state().isOpen).true;
      wrapper.unmount();
    });

    it("should not hide when scrolling if pinned", () => {
      const wrapper = mount<Popup>(<Popup isOpen isPinned />);

      const scroll = new WheelEvent("wheel");
      sinon.stub(scroll, "target").get(() => document.createElement("div"));
      window.dispatchEvent(scroll);

      expect(wrapper.state().isOpen).true;
      wrapper.unmount();
    });

    it("should not hide when scrolling if closeOnWheel=false", () => {
      const wrapper = mount<Popup>(<Popup isOpen closeOnWheel={false} />);

      const scroll = new WheelEvent("wheel");
      sinon.stub(scroll, "target").get(() => document.createElement("div"));
      window.dispatchEvent(scroll);

      expect(wrapper.state().isOpen).true;
      wrapper.unmount();
    });

    it("should not hide when scrolling if onWheel prop is passed", () => {
      const spyWheel = sinon.spy();
      const wrapper = mount<Popup>(<Popup isOpen onWheel={spyWheel} />);

      const scroll = new WheelEvent("wheel");
      sinon.stub(scroll, "target").get(() => document.createElement("div"));
      window.dispatchEvent(scroll);

      expect(wrapper.state().isOpen).true;
      sinon.assert.called(spyWheel);
      wrapper.unmount();
    });

  });

  describe("context menu", () => {
    it("should hide when context menu used", () => {
      const wrapper = mount<Popup>(<Popup isOpen />);

      const contextMenu = new MouseEvent("contextmenu");
      sinon.stub(contextMenu, "target").get(() => document.createElement("div"));
      window.dispatchEvent(contextMenu);

      expect(wrapper.state().isOpen).false;
      wrapper.unmount();
    });

    it("should not hide when context menu used popup content", () => {
      const wrapper = mount<Popup>(<Popup isOpen />);
      const popup = wrapper.find(".core-popup").getDOMNode();

      const contextMenu = new MouseEvent("contextmenu");
      sinon.stub(contextMenu, "target").get(() => popup);
      window.dispatchEvent(contextMenu);

      expect(wrapper.state().isOpen).true;
      wrapper.unmount();
    });

    it("should not hide when context menu used if pinned", () => {
      const wrapper = mount<Popup>(<Popup isOpen isPinned />);

      const contextMenu = new MouseEvent("contextmenu");
      sinon.stub(contextMenu, "target").get(() => document.createElement("div"));
      window.dispatchEvent(contextMenu);

      expect(wrapper.state().isOpen).true;
      wrapper.unmount();
    });

    it("should not hide when context menu used if closeOnContextMenu=false", () => {
      const wrapper = mount<Popup>(<Popup isOpen closeOnContextMenu={false} />);

      const contextMenu = new MouseEvent("contextmenu");
      sinon.stub(contextMenu, "target").get(() => document.createElement("div"));
      window.dispatchEvent(contextMenu);

      expect(wrapper.state().isOpen).true;
      wrapper.unmount();
    });

    it("should not hide when context menu used if onContextMenu prop is passed", () => {
      const spyContextMenu = sinon.spy();
      const wrapper = mount<Popup>(<Popup isOpen onContextMenu={spyContextMenu} />);

      const contextMenu = new MouseEvent("contextmenu");
      sinon.stub(contextMenu, "target").get(() => document.createElement("div"));
      window.dispatchEvent(contextMenu);

      expect(wrapper.state().isOpen).true;
      sinon.assert.called(spyContextMenu);
      wrapper.unmount();
    });

  });

  describe("keyboard handling", () => {
    it("should close on Escape", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose} />);
      expect(wrapper.state("isOpen")).to.be.true;

      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Escape" }));

      spyOnClose.calledOnce.should.true;
      expect(wrapper.state("isOpen")).to.be.false;

      wrapper.unmount();
    });

    it("should close on Enter", () => {
      const spyOnClose = sinon.spy();
      const spyOnEnter = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose} onEnter={spyOnEnter} />);
      expect(wrapper.state("isOpen")).to.be.true;

      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Enter" }));

      spyOnClose.calledOnce.should.true;
      spyOnEnter.calledOnce.should.true;
      expect(wrapper.state("isOpen")).to.be.false;

      wrapper.unmount();
    });

    it("should not close on Enter if closeOnEnter=false", () => {
      const spyOnClose = sinon.spy();
      const spyOnEnter = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose} onEnter={spyOnEnter} closeOnEnter={false} />);
      expect(wrapper.state("isOpen")).to.be.true;

      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Enter" }));

      spyOnClose.calledOnce.should.false;
      spyOnEnter.calledOnce.should.true;
      expect(wrapper.state("isOpen")).to.be.true;

      wrapper.unmount();
    });

    it("should do nothing on 'a'", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose}><div>fake content</div></Popup>);
      expect(wrapper.state("isOpen")).to.be.true;

      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "a" }));

      spyOnClose.calledOnce.should.false;
      expect(wrapper.state("isOpen")).to.be.true;

      wrapper.unmount();
    });

    it("should not close if Pinned", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose} isPinned />);
      expect(wrapper.state("isOpen")).to.be.true;

      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Escape" }));

      spyOnClose.calledOnce.should.false;
      expect(wrapper.state("isOpen")).to.be.true;

      wrapper.unmount();
    });

    it("should not close if not open", () => {
      const spyOnClose = sinon.spy();
      const wrapper = mount(<Popup isOpen onClose={spyOnClose} />);
      wrapper.setState({ isOpen: false });
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Escape" }));

      spyOnClose.notCalled.should.true;

      wrapper.unmount();
    });
  });

});
