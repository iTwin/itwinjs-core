/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { createNineZoneState, NineZoneProvider, FloatingWidgets } from "../../ui-ninezone";
import { addFloatingWidget } from "../base/NineZoneState.test";

describe("FloatingWidgets", () => {
  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1");
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
