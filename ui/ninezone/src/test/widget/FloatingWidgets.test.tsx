/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import produce from "immer";
import { render } from "@testing-library/react";
import { createNineZoneState, NineZoneProvider, addPanelWidget, FloatingWidgets } from "../../ui-ninezone";
import { Rectangle } from "@bentley/ui-core";

describe("FloatingWidgets", () => {
  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.widgets = [];
      stateDraft.floatingWidgets.w1 = {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
        id: "w1",
      };
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <FloatingWidgets />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
