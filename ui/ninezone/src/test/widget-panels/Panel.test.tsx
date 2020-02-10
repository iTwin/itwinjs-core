/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react-hooks";
import { WidgetPanel, WidgetPanelProps, useWidgetPanelApi } from "../../ui-ninezone";
import { createDOMRect } from "../Utils";

describe("WidgetPanel", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render w/o size", () => {
    const { container } = render(
      <WidgetPanel
        side="left"
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render", () => {
    const { container } = render(
      <WidgetPanel
        side="left"
        size={50}
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render vertical", () => {
    const { container } = render(
      <WidgetPanel
        side="top"
        size={50}
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render spanned", () => {
    const { container } = render(
      <WidgetPanel
        side="top"
        span
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with spanned top", () => {
    const { container } = render(
      <WidgetPanel
        side="left"
        spanTop
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with spanned bottom", () => {
    const { container } = render(
      <WidgetPanel
        side="left"
        spanBottom
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should invoke onInitialize", () => {
    sandbox.stub(Element.prototype, "getBoundingClientRect").returns(createDOMRect({ width: 100 }));
    const spy = sinon.stub<NonNullable<WidgetPanelProps["onInitialize"]>>();
    render(
      <WidgetPanel
        side="left"
        onInitialize={spy}
      />,
    );
    spy.calledOnceWithExactly(100).should.true;
  });
});

describe("useWidgetPanelApi", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should initialize", () => {
    const { result } = renderHook(() => useWidgetPanelApi());
    act(() => {
      result.current[0].initialize(450);
    });
    result.current[0].size!.should.eq(450);
  });

  it("should toggle collapse", () => {
    const { result } = renderHook(() => useWidgetPanelApi());
    act(() => {
      result.current[0].toggleCollapse();
    });
    result.current[0].collapsed.should.true;
  });

  describe("resize", () => {
    it("should resize", () => {
      const { result } = renderHook(() => useWidgetPanelApi());
      act(() => {
        result.current[0].initialize(450);
        result.current[0].resize(10);
      });
      result.current[0].size!.should.eq(460);
    });

    it("should collapse", () => {
      const { result } = renderHook(() => useWidgetPanelApi());
      act(() => {
        result.current[0].initialize(250);
        result.current[0].resize(-150);
      });
      result.current[0].collapsed!.should.true;
      result.current[0].size!.should.eq(200);
    });

    it("should not resize if size is not initialized", () => {
      const { result } = renderHook(() => useWidgetPanelApi());
      act(() => {
        result.current[0].resize(10);
      });
      (result.current[0].size === undefined).should.true;
    });

    it("should expand", () => {
      const { result } = renderHook(() => useWidgetPanelApi());
      act(() => {
        result.current[0].initialize(200);
        result.current[0].toggleCollapse();
        result.current[0].resize(100);
      });
      result.current[0].collapsed.should.false;
    });

    it("should not expand", () => {
      const { result } = renderHook(() => useWidgetPanelApi());
      act(() => {
        result.current[0].initialize(200);
        result.current[0].toggleCollapse();
        result.current[0].resize(10);
      });
      result.current[0].collapsed.should.true;
    });
  });
});
