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
  addPanelWidget, addTab, createHorizontalPanelState, createNineZoneState, createPanelsState, EventEmitter, HorizontalPanelSide, NineZoneState, PanelSide, PanelStateContext, PanelWidget,
  TabState, useBorders, useMode, VerticalPanelSide, WidgetContentManagerContext, WidgetContentManagerContextArgs,
} from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";

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
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget widgetId="w1" {...defaultProps} />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render minimized", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"], { minimized: true });
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget widgetId="w1" {...defaultProps} />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with fit-content", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addPanelWidget(nineZone, "left", "w2", ["t2"]);
    nineZone = addTab(nineZone, "t1", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "t2");
    const { container } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget widgetId="w1" {...defaultProps} />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render horizontal with fit-content", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", ["t1"]);
    nineZone = addPanelWidget(nineZone, "top", "w2", ["t2"]);
    nineZone = addTab(nineZone, "t1", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "t2");
    const { container } = render(
      <Provider
        state={nineZone}
        side="top"
      >
        <PanelWidget widgetId="w1" {...defaultProps} />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with nz-transition", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <Provider
        state={nineZone}
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
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <Provider
        state={nineZone}
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
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", ["t1"]);
    nineZone = addPanelWidget(nineZone, "top", "w2", ["t2"]);
    nineZone = addTab(nineZone, "t1", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "t2");

    const spy = sinon.spy();
    const { rerender } = render(
      <Provider
        state={nineZone}
        side="top"
      >
        <PanelWidget
          widgetId="w1"
          {...defaultProps}
          onBeforeTransition={spy}
        />
      </Provider>,
    );

    nineZone = produce(nineZone, (draft) => {
      draft.tabs.t1.preferredPanelWidgetSize = undefined;
    });

    rerender(
      <Provider
        state={nineZone}
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
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", ["t1"]);
    nineZone = addPanelWidget(nineZone, "top", "w2", ["t2"]);
    nineZone = addTab(nineZone, "t1", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "t2");

    const spy = sinon.spy();
    const onSaveTransientState = new EventEmitter<(tabId: TabState["id"]) => void>();
    const widgetContentManager: WidgetContentManagerContextArgs = {
      setContainer: () => { },
      onRestoreTransientState: new EventEmitter<(tabId: TabState["id"]) => void>(),
      onSaveTransientState,
    };
    render(
      <Provider
        state={nineZone}
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
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addPanelWidget(nineZone, "left", "w2", ["t2"]);
    nineZone = addPanelWidget(nineZone, "left", "w3", ["t3"], { minimized: true });
    nineZone = addTab(nineZone, "t1", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "t2", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "t3", { preferredPanelWidgetSize: "fit-content" });
    const { result } = renderHook(() => useMode("w2"), {
      wrapper: (props) => <Provider state={nineZone} {...props} />, // eslint-disable-line react/display-name
    });
    result.current.should.eq("fill");
  });

  it("should only force fill last widget", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addPanelWidget(nineZone, "left", "w2", ["t2"]);
    nineZone = addPanelWidget(nineZone, "left", "w3", ["t3"]);
    nineZone = addTab(nineZone, "t1", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "t2", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "t3", { preferredPanelWidgetSize: "fit-content" });
    const { result } = renderHook(() => useMode("w2"), {
      wrapper: (props) => <Provider state={nineZone} {...props} />, // eslint-disable-line react/display-name
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
      state = addPanelWidget(state, "top", "t1", ["t1_1"]);
      state = addTab(state, "t1_1");
      const { result } = renderHook(() => useBorders("t1"), {
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
      state = addPanelWidget(state, "bottom", "b1", ["b1_1"]);
      state = addTab(state, "b1_1");
      const { result } = renderHook(() => useBorders("b1"), {
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
        state = addPanelWidget(state, side, "w1", ["w1_1"]);
        state = addPanelWidget(state, side, "w2", ["w2_1"]);
        state = addTab(state, "w1_1");
        state = addTab(state, "w2_1");
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
        let state = createNineZoneState({
          panels: createPanelsState({
            [side]: createHorizontalPanelState(side, { span: false }),
          }),
        });
        state = addPanelWidget(state, side, "w1", ["w1_1"]);
        state = addPanelWidget(state, "left", "l1", ["l1_1"]);
        state = addTab(state, "w1_1");
        state = addTab(state, "l1_1");
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
        let state = createNineZoneState({
          panels: createPanelsState({
            [side]: createHorizontalPanelState(side, { span: false }),
          }),
        });
        state = addPanelWidget(state, side, "w1", ["w1_1"]);
        state = addPanelWidget(state, "right", "r1", ["r1_1"]);
        state = addTab(state, "w1_1");
        state = addTab(state, "r1_1");
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
        state = addPanelWidget(state, side, "w1", ["w1_1"]);
        state = addPanelWidget(state, "top", "t1", ["t1_1"]);
        state = addTab(state, "w1_1");
        state = addTab(state, "t1_1");
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
