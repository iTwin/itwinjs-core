/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { RelativePosition } from "@itwin/appui-abstract";
import { fireEvent, render, RenderResult, screen } from "@testing-library/react";
import { Popup } from "../../core-react";
import { classesFromElement } from "../TestUtils";
import userEvent from "@testing-library/user-event";

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
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render popup if closed and keepContentsMounted", () => {
    const component = render(<Popup keepContentsMounted top={30} left={70} />);
    expect(component.getByTestId("core-popup")).to.exist;
  });

  it("renders correctly", () => {
    const component = render(<Popup isOpen top={30} left={70} />);
    expect(component.getByTestId("core-popup")).to.exist;
  });

  it("mounts with role correctly", () => {
    render(<Popup isOpen top={30} left={70} role="alert" />);
    expect(screen.getByRole("alert")).to.exist;
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

  it("should remove animation", async () => {
    render(<Popup isOpen><div>Content</div></Popup>);
    expect(classesFromElement(screen.getByRole("dialog"))).not.to.include("core-animation-ended");

    // Handles bubbling
    fireEvent.animationEnd(screen.getByText("Content"));
    expect(classesFromElement(screen.getByRole("dialog"))).not.to.include("core-animation-ended");

    fireEvent.animationEnd(screen.getByRole("dialog"));
    expect(classesFromElement(screen.getByRole("dialog"))).to.include("core-animation-ended");
  });

  describe("renders", () => {
    it("renders correctly with no animation", () => {
      render(<Popup isOpen animate={false} />);

      expect(classesFromElement(screen.getByRole("dialog"))).to.include("core-popup-animation-none");
    });

  });

  describe("componentDidUpdate", () => {
    it("should call onOpen", () => {
      const spyOnOpen = sinon.spy();
      const {rerender} = render(<Popup onOpen={spyOnOpen} />);
      rerender(<Popup onOpen={spyOnOpen} isOpen={true} />);
      expect(spyOnOpen.calledOnce).to.be.true;
    });

    it("should call onClose", () => {
      const spyOnClose = sinon.spy();
      const {rerender} = render(<Popup isOpen onClose={spyOnClose} />);
      rerender(<Popup isOpen={false} onClose={spyOnClose} />);
      expect(spyOnClose.calledOnce).to.be.true;
    });
  });

  describe("positioning", () => {
    let divWrapper: RenderResult;
    let targetElement: HTMLElement;

    beforeEach(() => {
      divWrapper = render(<div data-testid="test-target" />);
      targetElement = divWrapper.getByTestId("test-target");
      sinon.stub(targetElement, "getBoundingClientRect").returns(DOMRect.fromRect({ x: 100, y: 100, height: 50, width: 50 }));
    });

    afterEach(() => {
      divWrapper.unmount();
    });

    ([
      ["TopLeft", "core-popup-top-left", {top: "96px"}],
      ["TopRight", "core-popup-top-right", {top: "96px"}],
      ["BottomLeft", "core-popup-bottom-left", {}],
      ["BottomRight", "core-popup-bottom-right", {}],
      ["Top", "core-popup-top", {top: "96px"}],
      ["Left", "core-popup-left", {left: "96px"}],
      ["Right", "core-popup-right", {}],
      ["Bottom", "core-popup-bottom", {}],
      ["LeftTop", "core-popup-left-top", {}],
      ["RightTop", "core-popup-right-top", {}],
    ] as [keyof typeof RelativePosition, string, {top?: string}][]).map(([position, className, style])=>{
      it(`should render ${position}`, () => {
        const {rerender} = render(<Popup position={RelativePosition[position]} target={targetElement} />);
        rerender(<Popup position={RelativePosition[position]} target={targetElement} isOpen={true} />);

        const tested = screen.getByRole("dialog");
        expect(classesFromElement(tested)).to.include(className);

        expect(tested.style).to.include(style);
      });
    });

    it("should render Bottom then Right", () => {
      const {rerender} = render(<Popup position={RelativePosition.Bottom} target={targetElement} />);

      rerender(<Popup isOpen={true} position={RelativePosition.Bottom} target={targetElement} />);
      expect(classesFromElement(screen.getByRole("dialog"))).to.include("core-popup-bottom");

      rerender(<Popup isOpen={true} position={RelativePosition.Right} target={targetElement} />);
      expect(classesFromElement(screen.getByRole("dialog"))).to.include("core-popup-right");
    });
  });

  describe("re-positioning", () => {
    const whenCloseToBottomRepositionTo = ["innerHeight", 1000, { y: 100, height: 900}];
    const whenCloseToTopRepositionTo = ["scrollY", 100, { y: 80 }];
    const whenCloseToLeftRepositionTo = ["scrollX", 100, { x: 80 }];
    const whenCloseToRightRepositionTo = ["innerWidth", 1000, { width: 1010 }];
    ([
      ["Bottom", ...whenCloseToBottomRepositionTo, "top"],
      ["BottomLeft", ...whenCloseToBottomRepositionTo, "top-left"],
      ["BottomRight", ...whenCloseToBottomRepositionTo, "top-right"],
      ["Top", ...whenCloseToTopRepositionTo, "bottom"],
      ["TopLeft", ...whenCloseToTopRepositionTo, "bottom-left"],
      ["TopRight", ...whenCloseToTopRepositionTo, "bottom-right"],
      ["Left", ...whenCloseToLeftRepositionTo, "right"],
      ["LeftTop", ...whenCloseToLeftRepositionTo, "right-top"],
      ["Right", ...whenCloseToRightRepositionTo, "left"],
      ["RightTop", ...whenCloseToRightRepositionTo, "left-top"],
    ] as [keyof typeof RelativePosition, keyof typeof window, number, DOMRectInit, RelativePosition, string][])
      .map(([testedPosition, windowMethod, windowMethodReturn, rect, expectedClass]) => {
        it(`should reposition ${testedPosition} to ${expectedClass}`, () => {
          sandbox.stub(window, windowMethod).get(() => windowMethodReturn);
          const target = document.createElement("div");
          sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect(rect));

          const {rerender} = render(<Popup position={RelativePosition[testedPosition]} target={target} />);
          rerender(<Popup position={RelativePosition[testedPosition]} target={target} isOpen={true}/>);
          expect(classesFromElement(screen.getByRole("dialog"))).to.include(`core-popup-${expectedClass}`);
        });
      });

    it("should not reposition on bottom overflow", () => {
      sandbox.stub(window, "innerHeight").get(() => 900);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ y: 100, height: 900 }));

      const {rerender} = render(<Popup position={RelativePosition.Top} target={target} />);
      rerender(<Popup position={RelativePosition.Top} target={target} isOpen={true} />);
      expect(classesFromElement(screen.getByRole("dialog"))).to.include(`core-popup-top`);
    });

    it("should not reposition on right overflow", () => {
      sandbox.stub(window, "innerWidth").get(() => 1000);
      const target = document.createElement("div");
      sinon.stub(target, "getBoundingClientRect").returns(DOMRect.fromRect({ x: 100, width: 1000 }));

      const {rerender} = render(<Popup position={RelativePosition.Left} target={target} />);
      rerender(<Popup position={RelativePosition.Left} target={target} isOpen={true} />);
      expect(classesFromElement(screen.getByRole("dialog"))).to.include(`core-popup-left`);
    });
  });

  describe("outside click", () => {
    it("should call onOutsideClick", async () => {
      const spy = sinon.spy();
      render(<><button /><Popup isOpen onOutsideClick={spy} /></>);

      await theUserTo.click(screen.getByRole("button"));

      expect(spy).to.be.calledOnce;
    });

    it("should close on click outside without onOutsideClick", async () => {
      const spyOnClose = sinon.spy();
      render(<><button/><Popup isOpen onClose={spyOnClose} /></>);

      await theUserTo.click(screen.getByRole("button"));

      spyOnClose.calledOnce.should.true;
    });

    it("should not close on click outside if pinned", async () => {
      const spyOnClose = sinon.spy();
      render(<><button /><Popup isOpen onClose={spyOnClose} isPinned /></>);

      await theUserTo.click(screen.getByRole("button"));

      spyOnClose.calledOnce.should.false;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");
    });

    it("should not close on popup content click", async () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen onClose={spyOnClose}><button /></Popup>);

      await theUserTo.click(screen.getByRole("button"));

      spyOnClose.calledOnce.should.false;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");
    });

    it("should not close on target content click", async () => {
      render(<button/>);
      const target = screen.getByRole("button");

      const spyOnClose = sinon.spy();
      render(<><input/><Popup isOpen onClose={spyOnClose} target={target} /></>);

      await theUserTo.click(target);

      spyOnClose.calledOnce.should.false;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");

      // Sanity check that it would indeed close...
      await theUserTo.click(screen.getByRole("textbox"));
      spyOnClose.calledOnce.should.true;
    });
  });

  describe("scrolling", () => {
    it("should hide when scrolling", () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen onClose={spyOnClose}/>);

      // Using this as user-event do not support scrolling: https://github.com/testing-library/user-event/issues/475
      const scroll = new WheelEvent("wheel");
      sinon.stub(scroll, "target").get(() => document.createElement("div"));
      window.dispatchEvent(scroll);

      expect(spyOnClose).to.be.calledOnce;
    });

    it("should not hide when scrolling popup content", () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen onClose={spyOnClose}/>);

      const scroll = new WheelEvent("wheel");
      sinon.stub(scroll, "target").get(() => screen.getByRole("dialog"));
      window.dispatchEvent(scroll);

      expect(spyOnClose).to.not.be.called;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");
    });

    it("should not hide when scrolling if pinned", () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen isPinned onClose={spyOnClose}/>);

      const scroll = new WheelEvent("wheel");
      sinon.stub(scroll, "target").get(() => document.createElement("div"));
      window.dispatchEvent(scroll);

      expect(spyOnClose).to.not.be.called;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");
    });

    it("should not hide when scrolling if closeOnWheel=false", () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen closeOnWheel={false} onClose={spyOnClose} />);

      const scroll = new WheelEvent("wheel");
      sinon.stub(scroll, "target").get(() => document.createElement("div"));
      window.dispatchEvent(scroll);

      expect(spyOnClose).to.not.be.called;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");
    });

    it("should not hide when scrolling if onWheel prop is passed", () => {
      const spyWheel = sinon.spy();
      const spyOnClose = sinon.spy();
      render(<Popup isOpen onWheel={spyWheel} onClose={spyOnClose} />);

      const scroll = new WheelEvent("wheel");
      sinon.stub(scroll, "target").get(() => document.createElement("div"));
      window.dispatchEvent(scroll);

      expect(spyOnClose).to.not.be.called;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");
      expect(spyWheel).to.be.called;
    });

  });

  describe("context menu", () => {
    it("should hide when context menu used", () => {
      const spyOnClose = sinon.spy();
      render(<><div data-testid={"outside"} /><Popup isOpen onClose={spyOnClose} /></>);

      const contextMenu = new MouseEvent("contextmenu");
      sinon.stub(contextMenu, "target").get(() => document.createElement("div"));
      window.dispatchEvent(contextMenu);

      expect(spyOnClose).to.be.calledOnce;
    });

    it("should not hide when context menu used popup content", () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen onClose={spyOnClose}/>);
      const popup = screen.getByRole("dialog");

      const contextMenu = new MouseEvent("contextmenu");
      sinon.stub(contextMenu, "target").get(() => popup);
      window.dispatchEvent(contextMenu);

      expect(spyOnClose).to.not.be.called;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");
    });

    it("should not hide when context menu used if pinned", () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen isPinned onClose={spyOnClose} />);

      const contextMenu = new MouseEvent("contextmenu");
      sinon.stub(contextMenu, "target").get(() => document.createElement("div"));
      window.dispatchEvent(contextMenu);

      expect(spyOnClose).to.not.be.called;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");
    });

    it("should not hide when context menu used if closeOnContextMenu=false", () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen closeOnContextMenu={false} onClose={spyOnClose} />);

      const contextMenu = new MouseEvent("contextmenu");
      sinon.stub(contextMenu, "target").get(() => document.createElement("div"));
      window.dispatchEvent(contextMenu);

      expect(spyOnClose).to.not.be.called;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");
    });

    it("should not hide when context menu used if onContextMenu prop is passed", () => {
      const spyOnClose = sinon.spy();
      const spyContextMenu = sinon.spy();
      render(<Popup isOpen onContextMenu={spyContextMenu} onClose={spyOnClose} />);

      const contextMenu = new MouseEvent("contextmenu");
      sinon.stub(contextMenu, "target").get(() => document.createElement("div"));
      window.dispatchEvent(contextMenu);

      expect(spyOnClose).to.not.be.called;
      expect(classesFromElement(screen.getByRole("dialog"))).to.not.include("core-popup-hidden");
      expect(spyContextMenu).to.be.called;
    });

  });

  describe("keyboard handling", () => {
    it("should call onClose on Escape", async () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen onClose={spyOnClose} />);

      await theUserTo.keyboard("[Escape]");

      spyOnClose.calledOnce.should.true;
    });

    it("should call onClose on Enter", async () => {
      const spyOnClose = sinon.spy();
      const spyOnEnter = sinon.spy();
      render(<Popup isOpen onClose={spyOnClose} onEnter={spyOnEnter} />);

      await theUserTo.keyboard("[Enter]");

      spyOnClose.calledOnce.should.true;
      spyOnEnter.calledOnce.should.true;
    });

    it("should call onEnter on Enter", async () => {
      const spyOnEnter = sinon.spy();
      render(<Popup isOpen onEnter={spyOnEnter} />);

      await theUserTo.keyboard("[Enter]");

      spyOnEnter.calledOnce.should.true;
    });

    it("should not call onClose on Enter if closeOnEnter=false", async () => {
      const spyOnClose = sinon.spy();
      const spyOnEnter = sinon.spy();
      render(<Popup isOpen onClose={spyOnClose} onEnter={spyOnEnter} closeOnEnter={false} />);

      await theUserTo.keyboard("[Enter]");

      spyOnClose.calledOnce.should.false;
      spyOnEnter.calledOnce.should.true;
    });

    it("should not call onClose on 'a'", async () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen onClose={spyOnClose}><div>fake content</div></Popup>);

      await theUserTo.keyboard("a");

      spyOnClose.calledOnce.should.false;
    });

    it("should not call onClose if Pinned", async () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen onClose={spyOnClose} isPinned />);

      await theUserTo.keyboard("[Escape]");

      spyOnClose.calledOnce.should.false;
    });

    it("should not call onClose if not open", async () => {
      const spyOnClose = sinon.spy();
      const {rerender} = render(<Popup isOpen onClose={spyOnClose} />);
      rerender(<Popup isOpen={false} onClose={spyOnClose} />);
      spyOnClose.resetHistory();

      await theUserTo.keyboard("[Escape]");

      spyOnClose.notCalled.should.true;
    });

    it("should call onClose on resize event (default behavior)", () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen onClose={spyOnClose} />);

      window.dispatchEvent(new UIEvent("resize"));

      spyOnClose.calledOnce.should.true;
    });

    it("should not call onClose on resize event (reposition switch)", () => {
      const spyOnClose = sinon.spy();
      render(<Popup isOpen repositionOnResize={true} onClose={spyOnClose} />);

      window.dispatchEvent(new UIEvent("resize"));

      spyOnClose.calledOnce.should.false;
    });

  });

});
