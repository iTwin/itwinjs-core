/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, render } from "@testing-library/react";
import { WidgetTab, WidgetTabContext, PaneContextArgs } from "../../ui-ninezone";
import { PaneContextProvider } from "../Providers";
import { fireClick, fireDoubleClick } from "../base/useSingleDoubleClick.test";
import { WidgetTabProps } from "../../ui-ninezone/widget/Tab";

describe("WidgetTab", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const { container } = render(<WidgetTab children="abc" />);
    container.firstChild!.should.matchSnapshot();
  });

  it("should render active", () => {
    const { container } = render(<WidgetTab active />);
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overflown", () => {
    const { container } = render(<WidgetTabContext.Provider
      value={{
        isOverflown: true,
      }}
    >
      <WidgetTab active />
    </WidgetTabContext.Provider>);
    container.firstChild!.should.matchSnapshot();
  });

  it("should restore minimized pane on click", () => {
    const spy = sinon.stub<PaneContextArgs["onRestore"]>();
    render(<PaneContextProvider
      minimized
      onRestore={spy}
    >
      <WidgetTab className="nztest-tab" />
    </PaneContextProvider>);

    act(() => {
      fireClick(document.getElementsByClassName("nztest-tab")[0], sandbox.useFakeTimers());
    });

    spy.calledOnceWithExactly().should.true;
  });

  it("should expand minimized pane on double click", () => {
    const spy = sinon.stub<PaneContextArgs["onExpand"]>();
    render(<PaneContextProvider
      minimized
      onExpand={spy}
    >
      <WidgetTab className="nztest-tab" />
    </PaneContextProvider>);

    act(() => {
      fireDoubleClick(document.getElementsByClassName("nztest-tab")[0], sandbox.useFakeTimers());
    });

    spy.calledOnceWithExactly().should.true;
  });

  it("should expand opened pane on active tab click", () => {
    const spy = sinon.stub<PaneContextArgs["onExpand"]>();
    render(<PaneContextProvider
      onExpand={spy}
    >
      <WidgetTab
        active
        className="nztest-tab"
      />
    </PaneContextProvider>);

    act(() => {
      fireClick(document.getElementsByClassName("nztest-tab")[0], sandbox.useFakeTimers());
    });

    spy.calledOnceWithExactly().should.true;
  });

  it("should minimize opened pane on active tab double click", () => {
    const spy = sinon.stub<PaneContextArgs["onMinimize"]>();
    render(<PaneContextProvider
      onMinimize={spy}
    >
      <WidgetTab
        active
        className="nztest-tab"
      />
    </PaneContextProvider>);

    act(() => {
      fireDoubleClick(document.getElementsByClassName("nztest-tab")[0], sandbox.useFakeTimers());
    });

    spy.calledOnceWithExactly().should.true;
  });

  it("should invoke click handler", () => {
    const spy = sinon.stub<NonNullable<WidgetTabProps["onClick"]>>();
    render(<WidgetTab
      className="nztest-tab"
      onClick={spy}
    />);

    act(() => {
      fireClick(document.getElementsByClassName("nztest-tab")[0], sandbox.useFakeTimers());
    });

    spy.calledOnceWithExactly().should.true;
  });

  it("should invoke click handler when double clicking tab in minimized pane", () => {
    const spy = sinon.stub<NonNullable<WidgetTabProps["onClick"]>>();
    render(<PaneContextProvider
      minimized
    >
      <WidgetTab
        className="nztest-tab"
        onClick={spy}
      />
    </PaneContextProvider>);

    act(() => {
      fireDoubleClick(document.getElementsByClassName("nztest-tab")[0], sandbox.useFakeTimers());
    });

    spy.calledOnceWithExactly().should.true;
  });

  it("should invoke click handler when double clicking inactive tab in opened pane", () => {
    const spy = sinon.stub<NonNullable<WidgetTabProps["onClick"]>>();
    render(<WidgetTab
      className="nztest-tab"
      onClick={spy}
    />);

    act(() => {
      fireDoubleClick(document.getElementsByClassName("nztest-tab")[0], sandbox.useFakeTimers());
    });

    spy.calledOnceWithExactly().should.true;
  });
});
