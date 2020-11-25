/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import {
  addPanelWidget, addTab, createNineZoneState, DraggedPanelSideContext, NineZoneDispatch, NineZoneState, PanelSide, PanelStateContext, useAnimatePanelWidgets, WidgetPanel,
} from "../../ui-ninezone";
import { createDOMRect } from "../Utils";
import { NineZoneProvider, setRefValue } from "../Providers";
import { act, renderHook } from "@testing-library/react-hooks";
import { Size } from "@bentley/ui-core";
import { should } from "chai";

describe("WidgetPanel", () => {
  it("should render vertical", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.size = 200;
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <WidgetPanel
          panel={nineZone.panels.left}
        />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render horizontal", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.top.size = 200;
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <WidgetPanel
          panel={nineZone.panels.top}
        />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render collapsed", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.collapsed = true;
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <WidgetPanel
          panel={nineZone.panels.left}
        />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render captured", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <DraggedPanelSideContext.Provider value="left">
          <WidgetPanel
            panel={nineZone.panels.left}
          />
        </DraggedPanelSideContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render spanned", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.top.span = true;
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <WidgetPanel
          panel={nineZone.panels.top}
        />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with top spanned", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <WidgetPanel
          panel={nineZone.panels.left}
          spanTop
        />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with span bottom", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <WidgetPanel
          panel={nineZone.panels.left}
          spanBottom
        />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch PANEL_INITIALIZE", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    sinon.stub(Element.prototype, "getBoundingClientRect").returns(createDOMRect({ width: 300 }));
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <WidgetPanel
          panel={nineZone.panels.left}
        />
      </NineZoneProvider>,
    );
    dispatch.calledOnceWithExactly(sinon.match({
      type: "PANEL_INITIALIZE",
      side: "left",
      size: 300,
    })).should.true;
  });

  it("should render multiple widgets", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addPanelWidget(nineZone, "left", "w2", ["t2"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = addTab(nineZone, "t2");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <WidgetPanel
          panel={nineZone.panels.left}
        />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should transition when collapsed", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container, rerender } = render(
      <WidgetPanel
        panel={nineZone.panels.left}
      />,
      {
        wrapper: (props) => <NineZoneProvider state={nineZone} {...props} />,  // eslint-disable-line react/display-name
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;
    Array.from(panel.classList.values()).should.not.contain("nz-transition");

    nineZone = produce(nineZone, (draft) => {
      draft.panels.left.collapsed = true;
    });

    rerender(<WidgetPanel
      panel={nineZone.panels.left}
    />);

    Array.from(panel.classList.values()).should.contain("nz-transition");
    panel.style.width.should.eq("0px");

    fireEvent.transitionEnd(panel);
    Array.from(panel.classList.values()).should.not.contain("nz-transition");
  });

  it("should transition to panel size when opened", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = produce(nineZone, (draft) => {
      draft.panels.left.size = 200;
      draft.panels.left.collapsed = true;
    });
    const { container, rerender } = render(
      <WidgetPanel
        panel={nineZone.panels.left}
      />,
      {
        wrapper: (props) => <NineZoneProvider state={nineZone} {...props} />,  // eslint-disable-line react/display-name
      },
    );

    const panel = container.getElementsByClassName("nz-widgetPanels-panel")[0] as HTMLElement;

    nineZone = produce(nineZone, (draft) => {
      draft.panels.left.collapsed = false;
    });

    rerender(<WidgetPanel
      panel={nineZone.panels.left}
    />);

    Array.from(panel.classList.values()).should.contain("nz-transition");
    panel.style.width.should.eq("200px");
  });

  it("should measure panel bounds when resizing", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = produce(nineZone, (draft) => {
      draft.panels.left.size = 200;
      draft.panels.left.collapsed = true;
    });
    const { container } = render(
      <WidgetPanel
        panel={nineZone.panels.left}
      />,
      {
        wrapper: (props) => <NineZoneProvider state={nineZone} {...props} />,  // eslint-disable-line react/display-name
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
      <NineZoneProvider
        state={state}
      >
        <PanelStateContext.Provider value={state.panels[side]}>
          {children}
        </PanelStateContext.Provider>
      </NineZoneProvider>
    );
  }
  const wrapper = Wrapper;

  it("should transition when widget is added", () => {
    const fakeTimers = sinon.useFakeTimers();

    let state = createNineZoneState();
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };
    const w2 = {
      measure: () => new Size(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(new Size(0, 600))
      .onSecondCall().callsFake(() => {
        // New widget ref is only set in layout effect
        setRefValue(result.current.getRef("w2"), w2);
        return new Size(0, 400);
      });
    sinon.stub(w2, "measure").returns(new Size(0, 200));

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
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    state = addPanelWidget(state, "left", "w3", ["t3"]);
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };
    const w2 = {
      measure: () => new Size(),
    };
    const w3 = {
      measure: () => new Size(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 200));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 700));
    sinon.stub(w3, "measure").returns(new Size(0, 300));

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
    const side: PanelSide = "top";
    let state = createNineZoneState();
    state = addPanelWidget(state, side, "w1", ["t1"]);
    state = addPanelWidget(state, side, "w2", ["t2"]);
    state = addPanelWidget(state, side, "w3", ["t3"]);
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
        side,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };
    const w2 = {
      measure: () => new Size(),
    };
    const w3 = {
      measure: () => new Size(),
    };
    sinon.stub(w1, "measure").returns(new Size(300, 0));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(new Size(300, 0))
      .onSecondCall().returns(new Size(700, 0));
    sinon.stub(w3, "measure")
      .onFirstCall().returns(new Size(300, 0))
      .onSecondCall().returns(new Size(200, 0));

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
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"], { minimized: true });
    state = addPanelWidget(state, "left", "w3", ["t3"]);
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };
    const w2 = {
      measure: () => new Size(),
    };
    const w3 = {
      measure: () => new Size(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 200));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 700));
    sinon.stub(w3, "measure").returns(new Size(0, 300));

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
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"], { minimized: true });
    state = addPanelWidget(state, "left", "w3", ["t3"]);
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };
    const w2 = {
      measure: () => new Size(),
    };
    const w3 = {
      measure: () => new Size(),
    };
    sinon.stub(w1, "measure").returns(new Size(0, 300));

    sinon.stub(w2, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 700));
    sinon.stub(w3, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 200));

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
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addTab(state, "t1");
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };

    setRefValue(result.current.getRef("w1"), w1);

    state = produce(state, (draft) => {
      draft.panels.left.widgets = [];
    });

    (() => rerender({ state })).should.not.throw();
  });

  it("should not transition when from and to sizes are equal", () => {
    let state = createNineZoneState();
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    state = addPanelWidget(state, "left", "w3", ["t3"]);
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };
    const w2 = {
      measure: () => new Size(),
    };
    const w3 = {
      measure: () => new Size(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 300));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 600));
    sinon.stub(w3, "measure").returns(new Size(0, 300));

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
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    const { result } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };
    const w2 = {
      measure: () => new Size(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 200));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(new Size(0, 600))
      .onSecondCall().returns(new Size(0, 700));

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
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    const { result } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };
    const w2 = {
      measure: () => new Size(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 200));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(new Size(0, 600))
      .onSecondCall().returns(new Size(0, 700));

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
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };
    const w2 = {
      measure: () => new Size(),
    };
    sinon.stub(w1, "measure")
      .onFirstCall().returns(new Size(0, 300))
      .onSecondCall().returns(new Size(0, 200));
    sinon.stub(w2, "measure")
      .onFirstCall().returns(new Size(0, 600))
      .onSecondCall().returns(new Size(0, 700));

    setRefValue(result.current.getRef("w1"), w1);

    state = addPanelWidget(state, "left", "w2", ["t2"]);
    rerender({ state });

    should().not.exist(result.current.transition);
  });

  it("should not re-measure on same render pass if panel.widgets have changed", () => {
    let state = createNineZoneState();
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    state = addTab(state, "t1");
    state = addTab(state, "t2");

    const { result, rerender } = renderHook(() => useAnimatePanelWidgets(), {
      initialProps: {
        onAfterRender: () => { },
        state,
      },
      wrapper,
    });

    const w1 = {
      measure: () => new Size(),
    };
    const w2 = {
      measure: () => new Size(),
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
});
