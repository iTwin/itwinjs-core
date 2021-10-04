/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render } from "@testing-library/react";
import * as React from "react";
import { addFloatingWidget, addTab, createNineZoneState, FloatingWidgets } from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";

describe("FloatingWidgets", () => {
  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <FloatingWidgets />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
