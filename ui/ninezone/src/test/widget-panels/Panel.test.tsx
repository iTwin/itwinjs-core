/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import produce from "immer";
import { render } from "@testing-library/react";
import { addPanelWidget, createNineZoneState, WidgetPanel, NineZoneContext } from "../../ui-ninezone";
import { NineZoneDispatchContext, NineZoneDispatch, INITIALIZE_PANEL } from "../../ui-ninezone/base/NineZone";
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
      <NineZoneContext.Provider value={nineZone}>
        <WidgetPanel
          side="left"
        />
      </NineZoneContext.Provider>,
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
      <NineZoneContext.Provider value={nineZone}>
        <WidgetPanel
          side="top"
        />
      </NineZoneContext.Provider>,
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
      <NineZoneContext.Provider value={nineZone}>
        <WidgetPanel
          side="left"
        />
      </NineZoneContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch INITIALIZE_PANEL", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.collapsed = true;
    });
    sandbox.stub(Element.prototype, "getBoundingClientRect").returns(createDOMRect({ width: 300 }));
    render(
      <NineZoneDispatchContext.Provider value={dispatch}>
        <NineZoneContext.Provider value={nineZone}>
          <WidgetPanel
            side="left"
          />
        </NineZoneContext.Provider>
      </NineZoneDispatchContext.Provider>,
    );
    dispatch.calledOnceWithExactly(sinon.match({
      type: INITIALIZE_PANEL,
      side: "left",
      size: 300,
    })).should.true;
  });
});
