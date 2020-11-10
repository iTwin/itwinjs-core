/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import {
  addPanelWidget, addTab, createNineZoneState, NineZoneState, PanelSide, PanelStateContext, PanelWidget,
  WidgetContentManagerContext, WidgetContentManagerContextArgs,
} from "../../ui-ninezone";
import { ContextConsumer, NineZoneProvider } from "../Providers";
import { createDOMRect } from "../Utils";

export const defaultProps = {
  onBeforeTransition: () => { },
  onPrepareTransition: () => { },
  onTransitionEnd: () => { },
  size: undefined,
  transition: undefined,
}

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

  it("should force fill", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1", { preferredPanelWidgetSize: "fit-content" });
    const { container } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget widgetId="w1"
          {...defaultProps} />
      </Provider>,
    );
    const widget = container.getElementsByClassName("nz-widget-panelWidget")[0];
    widget.classList.contains("nz-fill").should.true;
  });

  it("should transition horizontal", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", ["t1"]);
    nineZone = addPanelWidget(nineZone, "top", "w2", ["t2"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = addTab(nineZone, "t2");

    const getBoundingClientRectStub = sinon.stub(Element.prototype, "getBoundingClientRect");
    getBoundingClientRectStub.returns(createDOMRect({ width: 200 }));

    const { container, rerender } = render(
      <Provider
        side="top"
        state={nineZone}
      >
        <PanelWidget
          widgetId="w1"
          {...defaultProps}
        />
      </Provider>,
    );
    nineZone = produce(nineZone, (draft) => {
      draft.widgets.w1.minimized = true;
    });

    getBoundingClientRectStub.reset();
    getBoundingClientRectStub.onCall(0).returns(createDOMRect({ width: 300 }));
    getBoundingClientRectStub.returns(createDOMRect({ width: 35 }));

    rerender(<Provider
      side="top"
      state={nineZone}
    >
      <PanelWidget
        widgetId="w1"
        {...defaultProps}
      />
    </Provider>);

    container.firstChild!.should.matchSnapshot();

    const widget = container.firstChild! as HTMLElement;
    fireEvent.transitionEnd(widget);

    container.firstChild!.should.matchSnapshot();
  });

  it("should transition", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addPanelWidget(nineZone, "left", "w2", ["t2"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = addTab(nineZone, "t2");

    const getBoundingClientRectStub = sinon.stub(Element.prototype, "getBoundingClientRect");
    getBoundingClientRectStub.returns(createDOMRect({ height: 200 }));

    const { container, rerender } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget
          widgetId="w1"
          {...defaultProps}
        />
      </Provider>,
    );
    nineZone = produce(nineZone, (draft) => {
      draft.widgets.w1.minimized = true;
    });

    getBoundingClientRectStub.reset();
    getBoundingClientRectStub.onCall(0).returns(createDOMRect({ height: 300 }));
    getBoundingClientRectStub.returns(createDOMRect({ height: 35 }));

    rerender(<Provider
      state={nineZone}
    >
      <PanelWidget
        widgetId="w1"
        {...defaultProps}
      />
    </Provider>);

    container.firstChild!.should.matchSnapshot();

    const widget = container.firstChild! as HTMLElement;
    fireEvent.transitionEnd(widget);

    container.firstChild!.should.matchSnapshot();
  });

  it("should not transition", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addPanelWidget(nineZone, "left", "w2", ["t2"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = addTab(nineZone, "t2");

    const getBoundingClientRectStub = sinon.stub(Element.prototype, "getBoundingClientRect");
    getBoundingClientRectStub.returns(createDOMRect({ height: 200 }));

    const { container, rerender } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget
          widgetId="w1"
          {...defaultProps}
        />
      </Provider>,
    );
    nineZone = produce(nineZone, (draft) => {
      draft.widgets.w1.minimized = true;
    });

    rerender(<Provider
      state={nineZone}
    >
      <PanelWidget
        widgetId="w1"
        {...defaultProps}
      />
    </Provider>);

    container.firstChild!.should.matchSnapshot();
  });

  it("should transition when switching tab", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1_1", "t1_2"]);
    nineZone = addPanelWidget(nineZone, "left", "w2", ["t2_1"]);
    nineZone = addTab(nineZone, "t1_1");
    nineZone = addTab(nineZone, "t1_2", { preferredPanelWidgetSize: "fit-content" });
    nineZone = addTab(nineZone, "t2_1");

    const getBoundingClientRectStub = sinon.stub(Element.prototype, "getBoundingClientRect");
    getBoundingClientRectStub.returns(createDOMRect({ height: 200 }));

    const contentManagerRef = React.createRef<WidgetContentManagerContextArgs>();
    const { container, rerender } = render(
      <Provider
        state={nineZone}
      >
        <PanelWidget
          widgetId="w1"
          {...defaultProps}
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
        {...defaultProps}
      />
    </Provider>);

    getBoundingClientRectStub.reset();
    getBoundingClientRectStub.returns(createDOMRect({ height: 35 }));
    contentManagerRef.current?.onRestoreTransientState.emit("t1_2");

    container.firstChild!.should.matchSnapshot();
  });
});
