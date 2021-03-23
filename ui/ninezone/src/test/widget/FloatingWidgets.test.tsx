/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import tlr from "@testing-library/react"; const { render } = tlr;
import { addFloatingWidget, addTab, createNineZoneState, FloatingWidgets } from "../../ui-ninezone.js";
import { NineZoneProvider } from "../Providers.js";

describe("FloatingWidgets", () => {
  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <FloatingWidgets />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
