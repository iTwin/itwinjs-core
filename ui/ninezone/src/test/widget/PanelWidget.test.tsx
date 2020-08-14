/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import { should } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { addPanelWidget, addTab, createNineZoneState, NineZoneState, PanelSide, PanelStateContext, PanelWidget, usePreferredPanelWidgetSize, WidgetContentManagerContext } from "../../ui-ninezone";
import { ContextConsumer, NineZoneProvider } from "../Providers";
import { createDOMRect } from "../Utils";
import { WidgetContentManagerContextArgs } from "../../ui-ninezone/widget/ContentManager";

describe("PanelWidget", () => {
  interface ProviderProps {
    children: React.ReactNode;
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

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    const { container } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget widgetId="w1" />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render minimized", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { minimized: true });
    const { container } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget widgetId="w1" />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with fit-content", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
    nineZone = addPanelWidget(nineZone, "left", "w2", { activeTabId: "t2" });
    nineZone = addTab(nineZone, "w1", "t1", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "w2", "t2");
    const { container } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget widgetId="w1" />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render horizontal with fit-content", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", { activeTabId: "t1" });
    nineZone = addPanelWidget(nineZone, "top", "w2", { activeTabId: "t2" });
    nineZone = addTab(nineZone, "w1", "t1", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "w2", "t2");
    const { container } = render(
      <Provider
        state={nineZone}
        side="top"
      >
        <PanelWidget widgetId="w1" />
      </Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should force fill", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
    nineZone = addTab(nineZone, "w1", "t1", { preferredPanelWidgetSize: "fit-content" });
    const { container } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget widgetId="w1" />
      </Provider>,
    );
    const widget = container.getElementsByClassName("nz-widget-panelWidget")[0];
    widget.classList.contains("nz-fill").should.true;
  });

  it("should transition", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addPanelWidget(nineZone, "left", "w2");

    const getBoundingClientRectStub = sandbox.stub(Element.prototype, "getBoundingClientRect");
    getBoundingClientRectStub.returns(createDOMRect({ height: 200 }));

    const { container, rerender } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget
          widgetId="w1"
        />
      </Provider>,
    );
    nineZone = produce(nineZone, (draft) => {
      draft.widgets.w1.minimized = true;
    });

    getBoundingClientRectStub.reset();
    getBoundingClientRectStub.onCall(0).returns(createDOMRect({ height: 300 }));
    getBoundingClientRectStub.onCall(1).returns(createDOMRect({ height: 35 }));

    rerender(<Provider
      state={nineZone}
    >
      <PanelWidget
        widgetId="w1"
      />
    </Provider>);

    container.firstChild!.should.matchSnapshot();

    const widget = container.firstChild! as HTMLElement;
    fireEvent.transitionEnd(widget);

    container.firstChild!.should.matchSnapshot();
  });

  it("should transition when switching tab", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1_1" });
    nineZone = addPanelWidget(nineZone, "left", "w2");
    nineZone = addTab(nineZone, "w1", "t1_1");
    nineZone = addTab(nineZone, "w1", "t1_2", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "w2", "t2_1");

    const getBoundingClientRectStub = sandbox.stub(Element.prototype, "getBoundingClientRect");
    getBoundingClientRectStub.returns(createDOMRect({ height: 200 }));

    const contentManagerRef = React.createRef<WidgetContentManagerContextArgs>();
    const { container, rerender } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget
          widgetId="w1"
        />
        <ContextConsumer
          context={WidgetContentManagerContext}
          contextRef={contentManagerRef}
        />
      </Provider>,
    );
    nineZone = produce(nineZone, (draft) => {
      draft.widgets.w1.activeTabId = "t1_2";
    });
    contentManagerRef.current?.onSaveTransientState.emit("t1_1");

    rerender(<Provider
      state={nineZone}
    >
      <PanelWidget
        widgetId="w1"
      />
    </Provider>);

    getBoundingClientRectStub.reset();
    getBoundingClientRectStub.returns(createDOMRect({ height: 35 }));
    contentManagerRef.current?.onRestoreTransientState.emit("t1_2");

    container.firstChild!.should.matchSnapshot();
  });
});

describe("usePreferredPanelWidgetSize", () => {
  it("should return undefined for widget w/o active tab", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    // eslint-disable-next-line react/display-name
    const { result } = renderHook(() => usePreferredPanelWidgetSize("w1"), { wrapper: (props) => <NineZoneProvider state={nineZone} {...props} /> });
    should().not.exist(result.current);
  });
});
