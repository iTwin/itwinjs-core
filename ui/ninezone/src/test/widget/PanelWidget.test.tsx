/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import produce from "immer";
import { render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import {
  addPanelWidget, addTab, createNineZoneState, EventEmitter, NineZoneState, PanelSide, PanelStateContext, PanelWidget, TabState, useMode, WidgetContentManagerContext, WidgetContentManagerContextArgs,
} from "../../ui-ninezone";
import { NineZoneProvider } from "../Providers";

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
    <NineZoneProvider
      state={props.state}
    >
      <PanelStateContext.Provider value={props.state.panels[side]}>
        {props.children}
      </PanelStateContext.Provider>
    </NineZoneProvider>
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
