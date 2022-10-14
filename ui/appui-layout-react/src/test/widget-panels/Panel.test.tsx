/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { should } from "chai";
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import { Rectangle } from "@itwin/core-react";
import { fireEvent, render } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react-hooks";
import {
  addPanelWidget, addTab, createNineZoneState, DraggedPanelSideContext, DragManager, NineZoneDispatch,
  NineZoneState, PanelSide, PanelStateContext, useAnimatePanelWidgets, WidgetPanelProvider,
} from "../../appui-layout-react";
import { createDragInfo, setRefValue, TestNineZoneProvider } from "../Providers";
import { addTabs } from "../Utils";
import { updatePanelState } from "../../appui-layout-react/state/internal/PanelStateHelpers";

describe("WidgetPanelProvider", () => {
  it("should render vertical", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (stateDraft) => {
      stateDraft.panels.left.size = 200;
    });
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetPanelProvider
          side="left"
        />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render horizontal", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "top", "w1", ["t1"]);
    state = produce(state, (stateDraft) => {
      stateDraft.panels.top.size = 200;
    });
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetPanelProvider
          side="top"
        />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render collapsed", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (stateDraft) => {
      stateDraft.panels.left.collapsed = true;
    });
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetPanelProvider
          side="left"
        />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render captured", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <DraggedPanelSideContext.Provider value="left">
          <WidgetPanelProvider
            side="left"
          />
        </DraggedPanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render spanned", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "top", "w1", ["t1"]);
    state = produce(state, (stateDraft) => {
      stateDraft.panels.top.span = true;
    });
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetPanelProvider
          side="top"
        />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with top spanned", () => {
    let state = createNineZoneState();
    state = updatePanelState(state, "top", { span: true });
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetPanelProvider
          side="left"
        />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with span bottom", () => {
    let state = createNineZoneState();
    state = updatePanelState(state, "bottom", { span: true });
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetPanelProvider
          side="left"
        />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch PANEL_INITIALIZE", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    sinon.stub(Element.prototype, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 300 }));
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <WidgetPanelProvider
          side="left"
        />
      </TestNineZoneProvider>,
    );
    dispatch.calledOnceWithExactly(sinon.match({
      type: "PANEL_INITIALIZE",
      side: "left",
      size: 300,
    })).should.true;
  });

  it("should render multiple widgets", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetPanelProvider
          side="left"
        />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should transition when collapsed", () => {
    const fakeTimers = sinon.useFakeTimers();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container, rerender } = render(
      <WidgetPanelProvider
        side="left"
      />,
      {
        wrapper: (props) => <TestNineZoneProvider state={state} {...props} />,  // eslint-disable-line react/display-name
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;
    Array.from(panel.classList.values()).should.not.contain("nz-transition");

    state = produce(state, (draft) => {
      draft.panels.left.collapsed = true;
    });

    sinon.stub(panel, "getBoundingClientRect")
      .onFirstCall().returns(DOMRect.fromRect({ width: 200 }))
      .onSecondCall().returns(DOMRect.fromRect({ width: 300 }));

    rerender(<WidgetPanelProvider
      side="left"
    />);

    // Invoke raf callbacks.
    fakeTimers.tick(1);

    Array.from(panel.classList.values()).should.contain("nz-transition");
    panel.style.width.should.eq("300px");

    fireEvent.transitionEnd(panel);
    Array.from(panel.classList.values()).should.not.contain("nz-transition");
  });

  it("should transition to panel size when opened", () => {
    const fakeTimers = sinon.useFakeTimers();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.panels.left.size = 200;
      draft.panels.left.collapsed = true;
    });
    const { container, rerender } = render(
      <WidgetPanelProvider
        side="left"
      />,
      {
        wrapper: (props) => <TestNineZoneProvider state={state} {...props} />,  // eslint-disable-line react/display-name
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;

    state = produce(state, (draft) => {
      draft.panels.left.collapsed = false;
    });

    sinon.stub(panel, "getBoundingClientRect")
      .onFirstCall().returns(DOMRect.fromRect({ width: 200 }))
      .onSecondCall().returns(DOMRect.fromRect({ width: 300 }));

    rerender(<WidgetPanelProvider
      side="left"
    />);

    // Invoke raf callbacks.
    fakeTimers.tick(1);

    Array.from(panel.classList.values()).should.contain("nz-transition");
    panel.style.width.should.eq("300px");
  });

  it("should transition when size changes", () => {
    const fakeTimers = sinon.useFakeTimers();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.panels.left.size = 200;
    });
    const { container, rerender } = render(
      <WidgetPanelProvider
        side="left"
      />,
      {
        wrapper: (props) => <TestNineZoneProvider state={state} {...props} />,  // eslint-disable-line react/display-name
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;

    state = produce(state, (draft) => {
      draft.panels.left.size = 300;
    });

    sinon.stub(panel, "getBoundingClientRect")
      .onFirstCall().returns(DOMRect.fromRect({ width: 200 }))
      .onSecondCall().returns(DOMRect.fromRect({ width: 300 }));

    rerender(<WidgetPanelProvider
      side="left"
    />);

    // Invoke raf callbacks.
    fakeTimers.tick(1);

    Array.from(panel.classList.values()).should.contain("nz-transition");
    panel.style.width.should.eq("300px");
  });

  it("should restart transition when initializing", () => {
    const fakeTimers = sinon.useFakeTimers();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.panels.left.size = 200;
    });

    const stub = sinon.stub(HTMLElement.prototype, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 100 }));
    const dispatch: NineZoneDispatch = (action) => {
      if (action.type === "PANEL_INITIALIZE") {
        state = produce(state, (draft) => {
          draft.panels.left.size = 150;
        });

        stub.reset();
        stub
          .onFirstCall().returns(DOMRect.fromRect({ width: 200 }))
          .returns(DOMRect.fromRect({ width: 400 }));

        rerender(<WidgetPanelProvider
          side="left"
        />);
      }
    };
    const { container, rerender } = render(
      <WidgetPanelProvider
        side="left"
      />,
      {
        wrapper: (props) => <TestNineZoneProvider state={state} dispatch={dispatch} {...props} />,  // eslint-disable-line react/display-name
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;

    state = produce(state, (draft) => {
      draft.panels.left.size = undefined;
    });

    rerender(<WidgetPanelProvider
      side="left"
    />);

    panel.style.width.should.eq("100px");

    // Invoke raf callbacks.
    fakeTimers.tick(1);

    Array.from(panel.classList.values()).should.contain("nz-transition");
    panel.style.width.should.eq("400px");
  });

  it("should not transition when resizing", () => {
    const dragManager = React.createRef<DragManager>();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.panels.left.size = 200;
    });

    const { container, rerender } = render(
      <WidgetPanelProvider
        side="left"
      />,
      {
        wrapper: (props) => <TestNineZoneProvider // eslint-disable-line react/display-name
          state={state}
          dragManagerRef={dragManager}
          {...props}
        />,
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;

    state = produce(state, (draft) => {
      draft.panels.left.size = 300;
    });
    dragManager.current!.handleDragStart({
      info: createDragInfo(),
      item: {
        type: "panelGrip",
        id: "left",
      },
    });

    rerender(<WidgetPanelProvider
      side="left"
    />);

    Array.from(panel.classList.values()).should.not.contain("nz-transition");
    panel.style.width.should.eq("300px");
  });

  it("should not resize when collapsing", () => {
    const fakeTimers = sinon.useFakeTimers();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.panels.left.size = 200;
    });

    const { container, rerender } = render(
      <WidgetPanelProvider
        side="left"
      />,
      {
        wrapper: (props) => <TestNineZoneProvider // eslint-disable-line react/display-name
          state={state}
          {...props}
        />,
      },
    );
    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;

    state = produce(state, (draft) => {
      draft.panels.left.collapsed = true;
    });
    const stub = sinon.stub(panel, "getBoundingClientRect");
    stub
      .onFirstCall().returns(DOMRect.fromRect({ width: 200 }))
      .onSecondCall().returns(DOMRect.fromRect({ width: 0 }));

    rerender(<WidgetPanelProvider
      side="left"
    />);

    // Invoke raf callbacks.
    fakeTimers.tick(1);

    Array.from(panel.classList.values()).should.contain("nz-transition");
    panel.style.width.should.eq("0px");

    stub.reset();
    stub.returns(DOMRect.fromRect({ width: 400 }));
    state = produce(state, (draft) => {
      draft.panels.left.size = 400;
    });
    rerender(<WidgetPanelProvider
      side="left"
    />);

    Array.from(panel.classList.values()).should.contain("nz-transition");
    panel.style.width.should.eq("0px");
  });

  it("should not transition when from === to", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.panels.left.size = 200;
    });

    const { container, rerender } = render(
      <WidgetPanelProvider
        side="left"
      />,
      {
        wrapper: (props) => <TestNineZoneProvider // eslint-disable-line react/display-name
          state={state}
          {...props}
        />,
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;
    state = produce(state, (draft) => {
      draft.panels.left.size = 300;
    });
    sinon.stub(panel, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 200 }));

    rerender(<WidgetPanelProvider
      side="left"
    />);

    Array.from(panel.classList.values()).should.not.contain("nz-transition");
    panel.style.width.should.eq("300px");
  });

  it("should persist content size when collapsing", () => {
    const fakeTimers = sinon.useFakeTimers();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "top", "w1", ["t1"]);

    const { container, rerender } = render(
      <WidgetPanelProvider
        side="top"
      />,
      {
        wrapper: (props) => <TestNineZoneProvider // eslint-disable-line react/display-name
          state={state}
          {...props}
        />,
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;
    const content = panel.getElementsByClassName("nz-content")[0] as HTMLElement;
    state = produce(state, (draft) => {
      draft.panels.top.collapsed = true;
    });
    sinon.stub(panel, "getBoundingClientRect")
      .onFirstCall().returns(DOMRect.fromRect({ height: 200 }))
      .onSecondCall().returns(DOMRect.fromRect({ height: 0 }));
    rerender(<WidgetPanelProvider
      side="top"
    />);

    // Invoke raf callbacks.
    fakeTimers.tick(1);

    Array.from(panel.classList.values()).should.contain("nz-transition");
    panel.style.height.should.eq("0px");
    content.style.minHeight.should.eq("200px");
  });

  it("should measure panel bounds when resizing", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.panels.left.size = 200;
      draft.panels.left.collapsed = true;
    });
    const { container } = render(
      <WidgetPanelProvider
        side="left"
      />,
      {
        wrapper: (props) => <TestNineZoneProvider state={state} {...props} />,  // eslint-disable-line react/display-name
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0];
    const spy = sinon.spy(panel, "getBoundingClientRect");

    const grip = container.getElementsByClassName("nz-widgetPanels-grip")[0];
    const handle = grip.getElementsByClassName("nz-handle")[0];
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(handle);

    sinon.assert.called(spy);
  });
});

describe("useAnimatePanelWidgets", () => {
  interface WrapperProps {
    children?: React.ReactNode;
    state?: NineZoneState;
    side?: PanelSide;
    onAfterRender?(): void;
  }

  function Wrapper({
    children,
    onAfterRender,
    state = createNineZoneState(),
    side = "left",
  }: WrapperProps) {
    React.useLayoutEffect(() => {
      onAfterRender && onAfterRender();
    });
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

  it("should transition when widget is added", () => {
    const fakeTimers = sinon.useFakeTimers();

    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };
    const w2 = {
      measure: () => new Rectangle(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 600 }))
      .onSecondCall().callsFake(() => {
        // New widget ref is only set in layout effect
        setRefValue(result.current.getRef("w2"), w2);
        return Rectangle.createFromSize({ width: 0, height: 400 });
      });
    sinon.stub(w2, "measure").returns(Rectangle.createFromSize({ width: 0, height: 200 }));

    setRefValue(result.current.getRef("w1"), w1);

    state = addPanelWidget(state, "left", "w2", ["t2"]);
    rerender({ state });

    "init".should.eq(result.current.transition);
    Number(600).should.eq(result.current.sizes.w1);
    Number(0).should.eq(result.current.sizes.w2);

    // Invoke raf callbacks.
    fakeTimers.tick(1);

    "transition".should.eq(result.current.transition);
    Number(400).should.eq(result.current.sizes.w1);
    Number(200).should.eq(result.current.sizes.w2);

    result.current.handleTransitionEnd();

    should().not.exist(result.current.transition);
    should().not.exist(result.current.sizes.w1);
    should().not.exist(result.current.sizes.w2);
  });

  it("should transition when widget is removed", () => {
    let state = createNineZoneState();
    state = updatePanelState(state, "left", { maxWidgetCount: 3 });
    state = addTabs(state, ["t1", "t2", "t3"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    state = addPanelWidget(state, "left", "w3", ["t3"]);
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };
    const w2 = {
      measure: () => new Rectangle(),
    };
    const w3 = {
      measure: () => new Rectangle(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 200 }));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 700 }));
    sinon.stub(w3, "measure").returns(Rectangle.createFromSize({ width: 0, height: 300 }));

    setRefValue(result.current.getRef("w1"), w1);
    setRefValue(result.current.getRef("w2"), w2);
    setRefValue(result.current.getRef("w3"), w3);

    state = produce(state, (draft) => {
      draft.panels.left.widgets = ["w1", "w2"];
    });

    rerender({ state });
    "init".should.eq(result.current.transition);
    Number(300).should.eq(result.current.sizes.w1);
    Number(600).should.eq(result.current.sizes.w2);
  });

  it("should transition when first widget is removed", () => {
    const side = "top" as const;
    let state = createNineZoneState();
    state = updatePanelState(state, side, { maxWidgetCount: 3 });
    state = addTabs(state, ["t1", "t2", "t3"]);
    state = addPanelWidget(state, side, "w1", ["t1"]);
    state = addPanelWidget(state, side, "w2", ["t2"]);
    state = addPanelWidget(state, side, "w3", ["t3"]);
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
        side,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };
    const w2 = {
      measure: () => new Rectangle(),
    };
    const w3 = {
      measure: () => new Rectangle(),
    };
    sinon.stub(w1, "measure").returns(Rectangle.createFromSize({ width: 300, height: 0 }));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 300, height: 0 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 700, height: 0 }));
    sinon.stub(w3, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 300, height: 0 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 200, height: 0 }));

    setRefValue(result.current.getRef("w1"), w1);
    setRefValue(result.current.getRef("w2"), w2);
    setRefValue(result.current.getRef("w3"), w3);

    state = produce(state, (draft) => {
      draft.panels[side].widgets = ["w2", "w3"];
    });

    rerender({
      state,
      side,
    });
    "init".should.eq(result.current.transition);
    Number(600).should.eq(result.current.sizes.w2);
    Number(300).should.eq(result.current.sizes.w3);
  });

  it("should fill upper not minimized widget when widget is removed", () => {
    let state = createNineZoneState();
    state = updatePanelState(state, "left", { maxWidgetCount: 3 });
    state = addTabs(state, ["t1", "t2", "t3"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"], { minimized: true });
    state = addPanelWidget(state, "left", "w3", ["t3"]);
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };
    const w2 = {
      measure: () => new Rectangle(),
    };
    const w3 = {
      measure: () => new Rectangle(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 200 }));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 700 }));
    sinon.stub(w3, "measure").returns(Rectangle.createFromSize({ width: 0, height: 300 }));

    setRefValue(result.current.getRef("w1"), w1);
    setRefValue(result.current.getRef("w2"), w2);
    setRefValue(result.current.getRef("w3"), w3);

    state = produce(state, (draft) => {
      draft.panels.left.widgets = ["w1", "w2"];
    });

    rerender({ state });
    "init".should.eq(result.current.transition);
    Number(600).should.eq(result.current.sizes.w1);
    Number(300).should.eq(result.current.sizes.w2);
  });

  it("should fill lower not minimized widget when widget is removed", () => {
    let state = createNineZoneState();
    state = updatePanelState(state, "left", { maxWidgetCount: 3 });
    state = addTabs(state, ["t1", "t2", "t3"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"], { minimized: true });
    state = addPanelWidget(state, "left", "w3", ["t3"]);
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };
    const w2 = {
      measure: () => new Rectangle(),
    };
    const w3 = {
      measure: () => new Rectangle(),
    };
    sinon.stub(w1, "measure").returns(Rectangle.createFromSize({ width: 0, height: 300 }));

    sinon.stub(w2, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 700 }));
    sinon.stub(w3, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 200 }));

    setRefValue(result.current.getRef("w1"), w1);
    setRefValue(result.current.getRef("w2"), w2);
    setRefValue(result.current.getRef("w3"), w3);

    state = produce(state, (draft) => {
      draft.panels.left.widgets = ["w2", "w3"];
    });

    rerender({ state });
    "init".should.eq(result.current.transition);
    Number(300).should.eq(result.current.sizes.w2);
    Number(600).should.eq(result.current.sizes.w3);
  });

  it("should not fail when last widget is removed", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };

    setRefValue(result.current.getRef("w1"), w1);

    state = produce(state, (draft) => {
      draft.panels.left.widgets = [];
    });

    (() => rerender({ state })).should.not.throw();
  });

  it("should not transition when from and to sizes are equal", () => {
    let state = createNineZoneState();
    state = updatePanelState(state, "left", { maxWidgetCount: 3 });
    state = addTabs(state, ["t1", "t2", "t3"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    state = addPanelWidget(state, "left", "w3", ["t3"]);
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };
    const w2 = {
      measure: () => new Rectangle(),
    };
    const w3 = {
      measure: () => new Rectangle(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 600 }));
    sinon.stub(w3, "measure").returns(Rectangle.createFromSize({ width: 0, height: 300 }));

    setRefValue(result.current.getRef("w1"), w1);
    setRefValue(result.current.getRef("w2"), w2);
    setRefValue(result.current.getRef("w3"), w3);

    state = produce(state, (draft) => {
      draft.panels.left.widgets = ["w1", "w2"];
    });

    rerender({
      state,
    });
    should().not.exist(result.current.transition);
    should().not.exist(result.current.sizes.w1);
    should().not.exist(result.current.sizes.w2);
  });

  it("should init transition when handleBeforeTransition and handlePrepareTransition are invoked", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    const { result } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };
    const w2 = {
      measure: () => new Rectangle(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 200 }));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 600 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 700 }));

    setRefValue(result.current.getRef("w1"), w1);
    setRefValue(result.current.getRef("w2"), w2);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    act(() => {
      result.current.handleBeforeTransition();
      result.current.handlePrepareTransition();
    });

    "init".should.eq(result.current.transition);
    Number(300).should.eq(result.current.sizes.w1);
    Number(600).should.eq(result.current.sizes.w2);
  });

  it("should not init transition with handlePrepareTransition when ref is unset", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    const { result } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };
    const w2 = {
      measure: () => new Rectangle(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 200 }));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 600 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 700 }));

    setRefValue(result.current.getRef("w1"), w1);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    act(() => {
      result.current.handleBeforeTransition();
      result.current.handlePrepareTransition();
    });

    should().not.exist(result.current.transition);
  });

  it("should not init transition when ref is unset", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };
    const w2 = {
      measure: () => new Rectangle(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 300 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 200 }));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(Rectangle.createFromSize({ width: 0, height: 600 }))
      .onSecondCall().returns(Rectangle.createFromSize({ width: 0, height: 700 }));

    setRefValue(result.current.getRef("w1"), w1);

    state = addPanelWidget(state, "left", "w2", ["t2"]);
    rerender({ state });

    should().not.exist(result.current.transition);
  });

  it("should not re-measure on same render pass if panel.widgets have changed", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);

    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        onAfterRender: () => { },
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Rectangle(),
    };
    const w2 = {
      measure: () => new Rectangle(),
    };
    setRefValue(result.current.getRef("w1"), w1);
    setRefValue(result.current.getRef("w2"), w2);

    state = produce(state, (draft) => {
      draft.panels.left.widgets = ["w1"];
    });

    const onAfterRender = () => {
      spy.resetHistory();
      result.current.handleBeforeTransition();
    };

    const spy = sinon.spy(w1, "measure");
    rerender({ state, onAfterRender });

    sinon.assert.notCalled(spy);
  });

  it("should not transition to panel collapse when already collapsed and collapseUnpinned is set", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();

    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.panels.left.size = 200;
      draft.panels.left.collapsed = true;
      draft.panels.left.pinned = false;
    });
    const { container } = render(
      <WidgetPanelProvider
        side="left"
      />,
      {
        wrapper: (props) => <TestNineZoneProvider state={state} {...props} dispatch={dispatch} autoCollapseUnpinnedPanels={true} />,  // eslint-disable-line react/display-name
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;

    sinon.stub(panel, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 0 }));
    panel.style.width.should.eq("0px");
    fireEvent(panel, new MouseEvent("mouseleave"));

    dispatch.called.should.be.false;
  });

});
