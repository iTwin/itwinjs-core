/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addFloatingWidget, addTab, createNineZoneState, FloatingWidgets } from "../../ui-ninezone";
import { NineZoneProvider } from "../Providers";

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
