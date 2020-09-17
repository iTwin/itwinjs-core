/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import { render, fireEvent } from "@testing-library/react";
import {
  addPanelWidget, addTab, createNineZoneState, DraggedPanelSideContext, NineZoneDispatch, WidgetPanel,
} from "../../ui-ninezone";
import { createDOMRect } from "../Utils";
import { NineZoneProvider } from "../Providers";

describe("WidgetPanel", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

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
    sandbox.stub(Element.prototype, "getBoundingClientRect").returns(createDOMRect({ width: 300 }));
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
    })

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
    })
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
    })
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
