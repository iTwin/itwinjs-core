/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import {
  addPanelWidget, addTab, createNineZoneState, EventEmitter, HorizontalPanelSide, NineZoneState, PanelSide, PanelStateContext, PanelWidget,
  TabState, useBorders, useMode, VerticalPanelSide, WidgetContentManagerContext, WidgetContentManagerContextArgs,
} from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";
import { addTabs } from "../Utils";
import { updatePanelState } from "../../appui-layout-react/state/internal/PanelStateHelpers";

/* eslint-disable jsdoc/require-jsdoc */

export const defaultProps = {
  onBeforeTransition: () => { },
  onPrepareTransition: () => { },
  onTransitionEnd: () => { },
  size: undefined,
  transition: undefined,
};

interface ProviderProps {
  children?: React.ReactNode;
  state: NineZoneState;
  side?: PanelSide;
}

function Provider(props: ProviderProps) {
  const side = props.side || "left";
  return (
    <TestNineZoneProvider
      state={props.state}
    >
      <PanelStateContext.Provider value={props.state.panels[side]}>
        {props.children}
      </PanelStateContext.Provider>
    </TestNineZoneProvider>
  );
}

describe("PanelWidget", () => {
  it("should render", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <Provider
        state={state}
      >
        <PanelWidget widgetId="w1" {...defaultProps} />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render minimized", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"], { minimized: true });
    const { container } = render(
      <Provider
        state={state}
      >
        <PanelWidget widgetId="w1" {...defaultProps} />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with fit-content", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { preferredPanelWidgetSize: "fit-content" });
    state = addTab(state, "t2");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    const { container } = render(
      <Provider
        state={state}
      >
        <PanelWidget widgetId="w1" {...defaultProps} />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render horizontal with fit-content", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { preferredPanelWidgetSize: "fit-content" });
    state = addTab(state, "t2");
    state = addPanelWidget(state, "top", "w1", ["t1"]);
    state = addPanelWidget(state, "top", "w2", ["t2"]);
    const { container } = render(
      <Provider
        state={state}
        side="top"
      >
        <PanelWidget widgetId="w1" {...defaultProps} />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with nz-transition", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "top", "w1", ["t1"]);
    const { container } = render(
      <Provider
        state={state}
        side="top"
      >
        <PanelWidget
          widgetId="w1"
          {...defaultProps}
          transition="transition"
        />
      </Provider>,
    );
    const widget = container.getElementsByClassName("nz-widget-panelWidget")[0];
    Array.from(widget.classList.values()).should.contain("nz-transition");
  });

  it("should render with flexBasis", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "top", "w1", ["t1"]);
    const { container } = render(
      <Provider
        state={state}
        side="top"
      >
        <PanelWidget
          widgetId="w1"
          {...defaultProps}
          size={200}
        />
      </Provider>,
    );
    const widget = container.getElementsByClassName("nz-widget-panelWidget")[0] as HTMLElement;
    widget.style.flexBasis.should.eq("200px");
  });

  it("should invoke onBeforeTransition when mode is changing", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { preferredPanelWidgetSize: "fit-content" });
    state = addTab(state, "t2");
    state = addPanelWidget(state, "top", "w1", ["t1"]);
    state = addPanelWidget(state, "top", "w2", ["t2"]);

    const spy = sinon.spy();
    const { rerender } = render(
      <Provider
        state={state}
        side="top"
      >
        <PanelWidget
          widgetId="w1"
          {...defaultProps}
          onBeforeTransition={spy}
        />
      </Provider>,
    );

    state = produce(state, (draft) => {
      draft.tabs.t1.preferredPanelWidgetSize = undefined;
    });

    rerender(
      <Provider
        state={state}
        side="top"
      >
        <PanelWidget
          widgetId="w1"
          {...defaultProps}
          onBeforeTransition={spy}
        />
      </Provider>,
    );

    sinon.assert.calledOnce(spy);
  });

  it("should invoke onBeforeTransition when tab is changing", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { preferredPanelWidgetSize: "fit-content" });
    state = addTab(state, "t2");
    state = addPanelWidget(state, "top", "w1", ["t1"]);
    state = addPanelWidget(state, "top", "w2", ["t2"]);

    const spy = sinon.spy();
    const onSaveTransientState = new EventEmitter<(tabId: TabState["id"]) => void>();
    const widgetContentManager: WidgetContentManagerContextArgs = {
      setContainer: () => { },
      onRestoreTransientState: new EventEmitter<(tabId: TabState["id"]) => void>(),
      onSaveTransientState,
    };
    render(
      <Provider
        state={state}
        side="top"
      >
        <WidgetContentManagerContext.Provider value={widgetContentManager}>
          <PanelWidget
            widgetId="w1"
            {...defaultProps}
            onBeforeTransition={spy}
          />
        </WidgetContentManagerContext.Provider>
      </Provider>,
    );

    onSaveTransientState.emit("t1");

    sinon.assert.calledOnce(spy);
  });
});

describe("useMode", () => {
  it("should force fill", () => {
    let state = createNineZoneState();
    state = updatePanelState(state, "left", { maxWidgetCount: 3 });
    state = addTabs(state, ["t1", "t2", "t3"], { preferredPanelWidgetSize: "fit-content" });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    state = addPanelWidget(state, "left", "w3", ["t3"], { minimized: true });
    const { result } = renderHook(() => useMode("w2"), {
      wrapper: (props) => <Provider state={state} {...props} />, // eslint-disable-line react/display-name
    });
    result.current.should.eq("fill");
  });

  it("should only force fill last widget", () => {
    let state = createNineZoneState();
    state = updatePanelState(state, "left", { maxWidgetCount: 3 });
    state = addTabs(state, ["t1", "t2", "t3"], { preferredPanelWidgetSize: "fit-content" });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    state = addPanelWidget(state, "left", "w3", ["t3"]);
    const { result } = renderHook(() => useMode("w2"), {
      wrapper: (props) => <Provider state={state} {...props} />, // eslint-disable-line react/display-name
    });
    result.current.should.eq("fit");
  });
});

describe("useBorders", () => {
  interface WrapperProps {
    children?: React.ReactNode;
    state?: NineZoneState;
    side?: PanelSide;
  }

  function Wrapper({ children, side = "left", state = createNineZoneState() }: WrapperProps) {
    return (
      <TestNineZoneProvider
        state={state}
      >
        <PanelStateContext.Provider value={state.panels[side]}>
          {children}
        </PanelStateContext.Provider>
      </TestNineZoneProvider>
    );
  }
  const wrapper = Wrapper;

  describe("top panel", () => {
    it("should render w/o top border in docked tool settings mode", () => {
      const side: PanelSide = "top";
      let state = createNineZoneState();
      state = addTab(state, "t1");
      state = addPanelWidget(state, "top", "w1", ["t1"]);
      const { result } = renderHook(() => useBorders("w1"), {
        initialProps: {
          state,
          side,
        },
        wrapper,
      });
      result.current["nz-border-top"].should.false;
    });
  });

  describe("bottom panel", () => {
    it("should render w/o bottom border", () => {
      const side: PanelSide = "bottom";
      let state = createNineZoneState();
      state = addTab(state, "t1");
      state = addPanelWidget(state, "bottom", "w1", ["t1"]);
      const { result } = renderHook(() => useBorders("w1"), {
        initialProps: {
          state,
          side,
        },
        wrapper,
      });
      result.current["nz-border-bottom"].should.false;
    });
  });

  for (const side of new Array<HorizontalPanelSide>("top", "bottom")) {
    describe(`horizontal panel - ${side}`, () => {
      it("should render w/o left border (except first widget)", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["t1", "t2"]);
        state = addPanelWidget(state, side, "w1", ["t1"]);
        state = addPanelWidget(state, side, "w2", ["t2"]);
        const { result } = renderHook(() => useBorders("w2"), {
          initialProps: {
            state,
            side,
          },
          wrapper,
        });
        result.current["nz-border-left"].should.false;
      });

      it("should render w/o left border if there is left panel to the left", () => {
        let state = createNineZoneState();
        state = updatePanelState(state, side, { span: false });
        state = addTabs(state, ["t1", "t2"]);
        state = addPanelWidget(state, side, "w1", ["t1"]);
        state = addPanelWidget(state, "left", "w2", ["t2"]);
        const { result } = renderHook(() => useBorders("w1"), {
          initialProps: {
            state,
            side,
          },
          wrapper,
        });
        result.current["nz-border-left"].should.false;
      });

      it("should render w/o right border if there is right panel to the right", () => {
        let state = createNineZoneState();
        state = updatePanelState(state, side, { span: false });
        state = addTabs(state, ["t1", "t2"]);
        state = addPanelWidget(state, side, "w1", ["t1"]);
        state = addPanelWidget(state, "right", "w2", ["t2"]);
        const { result } = renderHook(() => useBorders("w1"), {
          initialProps: {
            state,
            side,
          },
          wrapper,
        });
        result.current["nz-border-right"].should.false;
      });
    });
  }

  for (const side of new Array<VerticalPanelSide>("left", "right")) {
    describe(`vertical panel - ${side}`, () => {
      it("should render w/o top border if there is top panel above", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["t1", "t2"]);
        state = addPanelWidget(state, side, "w1", ["t1"]);
        state = addPanelWidget(state, "top", "w2", ["t2"]);
        const { result } = renderHook(() => useBorders("w1"), {
          initialProps: {
            state,
            side,
          },
          wrapper,
        });
        result.current["nz-border-top"].should.false;
      });
    });
  }
});
