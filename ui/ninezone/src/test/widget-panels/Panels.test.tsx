/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { WidgetPanels, WidgetPanel, HorizontalWidgetPanel, useWidgetPanelsApi } from "../../ui-ninezone";
import * as WidgetPanelModule from "../../ui-ninezone/widget-panels/Panel";
import { StartResize, EndResize, Resize } from "./Grip.test";

const panel: WidgetPanel = {
  collapsed: false,
  initialize: () => { },
  pinned: false,
  resize: () => { },
  size: 100,
  toggleCollapse: () => { },
};

const horizontalPanel: HorizontalWidgetPanel = {
  ...panel,
  span: false,
};

const panels: WidgetPanels = {
  bottom: horizontalPanel,
  left: panel,
  right: panel,
  top: horizontalPanel,
};

describe("WidgetPanels", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const { container } = render(
      <WidgetPanels
        panels={panels}
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render collapsed panels", () => {
    sandbox.stub(panels.left, "collapsed").get(() => true);
    sandbox.stub(panels.top, "collapsed").get(() => true);
    const { container } = render(
      <WidgetPanels
        panels={panels}
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overlay", () => {
    const { container } = render(
      <WidgetPanels
        panels={panels}
      />,
    );

    act(() => {
      const grip = document.getElementsByClassName("nz-widgetPanels-grip nz-left")[0];
      StartResize(grip);
      Resize(1, 1);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should not render overlay when not resizing", () => {
    const { container } = render(
      <WidgetPanels
        panels={panels}
      />,
    );

    act(() => {
      const grip = document.getElementsByClassName("nz-widgetPanels-grip nz-left")[0];
      StartResize(grip);
      Resize(1, 1);
      EndResize();
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should toggle panel collapse", () => {
    const spy = sandbox.spy(panels.left, "toggleCollapse");
    render(
      <WidgetPanels
        panels={panels}
      />,
    );

    act(() => {
      fireEvent.dblClick(document.getElementsByClassName("nz-widgetPanels-grip nz-left")[0]);
    });

    spy.calledOnceWithExactly().should.true;
  });
});

describe("useWidgetPanelsApi", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const useWidgetPanelApiSpy = sandbox.spy(WidgetPanelModule, "useWidgetPanelApi");
    const useHorizontalPanelApiSpy = sandbox.spy(WidgetPanelModule, "useHorizontalPanelApi");

    renderHook(() => useWidgetPanelsApi());
    useWidgetPanelApiSpy.callCount.should.eq(4);
    useHorizontalPanelApiSpy.callCount.should.eq(2);
  });
});
