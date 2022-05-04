/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { renderHook } from "@testing-library/react-hooks";
import { expect } from "chai";
import { useCrossOriginPopup } from "../../../core-react";

describe("useCrossOriginPopup", () => {
  const sandbox = sinon.createSandbox();
  const fakeUrl = "https://test.com";
  const fakeTitle = "test";
  const fakeWidth = 100;
  const fakeHeight = 100;

  afterEach(() => {
    sandbox.restore();
  });

  it("should open popup if initial visibility is 'ON'", () => {
    window.open = sandbox.stub(window, "open");
    const onClosePopup = sinon.spy();
    const result = renderHook(() => useCrossOriginPopup(true, fakeUrl, fakeTitle, fakeWidth,fakeHeight, onClosePopup));
    result.result.current;

    expect(window.open).to.have.been.called.with.calledOnceWithExactly(fakeUrl, fakeTitle, `width=${fakeWidth},height=${fakeHeight}`);
  });

  it("should not open popup if initial visibility is 'OFF'", () => {
    window.open = sandbox.stub(window, "open");
    const onClosePopup = sinon.spy();
    renderHook(() => useCrossOriginPopup(false, fakeUrl, fakeTitle, fakeWidth,fakeHeight, onClosePopup));

    // Popup has never been opened, so close callback should not have been called.
    expect(onClosePopup).to.have.not.been.calledOnce;

    expect(window.open).to.have.been.not.called;
  });

  it("should open the popup after visibility change (OFF->ON)", () => {

    window.open = sandbox.stub(window, "open");
    const onClosePopup = sinon.spy();
    let visible = false;
    const { rerender }  = renderHook(() => useCrossOriginPopup(visible, fakeUrl, fakeTitle, fakeWidth,fakeHeight, onClosePopup));

    expect(window.open).to.have.been.not.called;
    visible = true;
    rerender();

    // Popup should be still opened, and 'OnClose'' callback should not have been called.
    expect(onClosePopup).to.have.not.been.calledOnce;

    expect(window.open).to.have.been.called.with.calledOnceWithExactly(fakeUrl, fakeTitle, `width=${fakeWidth},height=${fakeHeight}`);
  });

  it("should close popup when visibility change (ON->OFF)", () => {
    const fakeWindow: any = {
      focus: () => {},
      close: sinon.spy(),
      closed: false,
    };

    window.open = sandbox.stub(window, "open").callsFake(() => { return fakeWindow;} );
    const onClosePopup = sinon.spy();
    let visible = true;
    const { rerender }  = renderHook(() => useCrossOriginPopup(visible, fakeUrl, fakeTitle, fakeWidth,fakeHeight, onClosePopup));

    visible = false;
    rerender();

    // Popup should be now closed and 'OnClose' been called.
    expect(onClosePopup).to.have.been.calledOnce;
    expect(fakeWindow.close).to.have.been.calledOnce;
  });

  it("should close popup when hook is unmounted", () => {
    const fakeWindow: any = {
      focus: () => {},
      close: sinon.spy(),
      closed: false,
    };

    window.open = sandbox.stub(window, "open").callsFake(() => { return fakeWindow;} );
    const onClosePopup = sinon.spy();
    const visible = true;
    const result  = renderHook(() => useCrossOriginPopup(visible, fakeUrl, fakeTitle, fakeWidth,fakeHeight, onClosePopup));

    result.unmount();

    // Popup should be still open, so close callback should not have been called.
    expect(onClosePopup).to.have.been.calledOnce;
    expect(fakeWindow.close).to.have.been.calledOnce;

  });

  it("should call the 'onClose' callback when the popup is closed by the end-user", () => {

    const clock = sinon.useFakeTimers();

    const fakeWindow: any = {
      focus: () => {},
      close: sinon.spy(),
      closed: true,   // Mark it as already 'closed' to simulate user-user closing immediately the popup window
    };

    const windowOpenStub = sandbox.stub(window, "open").callsFake(() => { return fakeWindow;} );
    window.open = windowOpenStub;
    const onClosePopup = sinon.spy();
    const visible = true;
    renderHook(() => useCrossOriginPopup(visible, fakeUrl, fakeTitle, fakeWidth,fakeHeight, onClosePopup));

    // Advance clocks, so popup's internal timer has time to check for popup closure
    clock.tick(2000);

    // Popup was closed by end-user, the 'onClose' callback should have been called.
    expect(onClosePopup).to.have.been.calledOnce;

    clock.restore();
  });

  it("should call the 'onClose' callback when the parent's browser window get closed", () => {

    const fakeWindow: any = {
      focus: () => {},
      close: sinon.spy(),
      closed: true,   // Mark it as already 'closed' to simulate user-user closing immediately the popup window
    };

    const windowOpenStub = sandbox.stub(window, "open").callsFake(() => { return fakeWindow;} );
    window.open = windowOpenStub;

    const onClosePopup = sinon.spy();
    const visible = true;
    renderHook(() => useCrossOriginPopup(visible, fakeUrl, fakeTitle, fakeWidth,fakeHeight, onClosePopup));

    window.dispatchEvent(new Event("beforeunload"));

    // We simulated that parent window has been closed, the 'onClose' callback should have been called.
    expect(onClosePopup).to.have.been.calledOnce;
  });

});
