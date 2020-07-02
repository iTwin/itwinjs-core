/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { render } from "@testing-library/react";
import * as sinon from "sinon";
import * as React from "react";

import { Logger } from "@bentley/bentleyjs-core";
import { FocusTrap } from "../../ui-core/focustrap/FocusTrap";

// cspell:ignore focustrap

describe("<FocusTrap />", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("renders correctly", () => {
    const component = render(<FocusTrap active={true} returnFocusOnDeactivate={false}>
      <div />
    </FocusTrap>);
    expect(component.getByTestId("focus-trap-div")).to.exist;
  });

  it("sets focus to first element correctly", async () => {
    const clock = sandbox.useFakeTimers();

    render(<FocusTrap active={true} returnFocusOnDeactivate={false}>
      <div id="test" tabIndex={0} />
    </FocusTrap>);

    clock.tick(1000);
    await Promise.resolve();

    const activeElement = document.activeElement as HTMLElement;
    expect(activeElement.id).to.eq("test");
  });

  it("logs error when initialFocusElement incorrectly specifies element", async () => {
    const clock = sandbox.useFakeTimers();
    const spyLogger = sinon.spy(Logger, "logError");

    render(<FocusTrap initialFocusElement=".test" active={true} returnFocusOnDeactivate={false}>
      <div id="test" tabIndex={0} />
    </FocusTrap>);

    clock.tick(1000);
    await Promise.resolve();

    spyLogger.called.should.true;
    (Logger.logError as any).restore();
  });

  it("cycles to first item correctly", async () => {
    const clock = sandbox.useFakeTimers();

    const component = render(<FocusTrap active={true} returnFocusOnDeactivate={false}>
      <div id="test1" tabIndex={0} />
      <div id="test2" tabIndex={0} />
      <div id="test3" tabIndex={0} />
    </FocusTrap>);

    clock.tick(1000);
    await Promise.resolve();

    const limitDiv = component.getByTestId("focus-trap-limit-div");
    expect(limitDiv).to.exist;
    limitDiv.focus();

    const activeElement = document.activeElement as HTMLElement;
    expect(activeElement.id).to.eq("test1");
  });

  it("cycles to last item correctly", async () => {
    const clock = sandbox.useFakeTimers();

    const component = render(<FocusTrap active={true} returnFocusOnDeactivate={false}>
      <div id="test1" tabIndex={0} />
      <div id="test2" tabIndex={0} />
      <div id="test3" tabIndex={0} />
    </FocusTrap>);

    clock.tick(1000);
    await Promise.resolve();

    const firstDiv = component.getByTestId("focus-trap-div");
    expect(firstDiv).to.exist;
    firstDiv.focus();

    const activeElement = document.activeElement as HTMLElement;
    expect(activeElement.id).to.eq("test3");
  });

});
