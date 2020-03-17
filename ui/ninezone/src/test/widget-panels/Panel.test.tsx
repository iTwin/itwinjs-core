/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import produce from "immer";
import { render } from "@testing-library/react";
import {
  addPanelWidget, createNineZoneState, WidgetPanel, PANEL_INITIALIZE, NineZoneDispatch, NineZoneProvider, DraggedPanelSideContext,
} from "../../ui-ninezone";
import { createDOMRect } from "../Utils";

describe("WidgetPanel", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render vertical", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.size = 200;
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
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
    nineZone = addPanelWidget(nineZone, "top", "w1", {});
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.top.size = 200;
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
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
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.collapsed = true;
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
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
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
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
    nineZone = addPanelWidget(nineZone, "top", "w1", {});
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.top.span = true;
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
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
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
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
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
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
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
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
      type: PANEL_INITIALIZE,
      side: "left",
      size: 300,
    })).should.true;
  });

  it("should render multiple widgets", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    nineZone = addPanelWidget(nineZone, "left", "w2", {});
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <WidgetPanel
          panel={nineZone.panels.left}
        />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
