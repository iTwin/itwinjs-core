/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { renderHook } from "@testing-library/react-hooks";
import { addPanelWidget, addTab, createNineZoneState, NineZoneContext, TabIdContext } from "@bentley/ui-ninezone";
import { useWidgetDirection } from "../../ui-framework";

describe("useWidgetDirection", () => {
  it("should return 'vertical'", () => {
    const nineZone = createNineZoneState();
    const { result } = renderHook(() => useWidgetDirection(), {
      wrapper: ({ children }) => (
        <NineZoneContext.Provider value={nineZone}>
          {children}
        </NineZoneContext.Provider>
      ),
    });
    result.current.should.eq("vertical");
  });

  it("should return 'horizontal' for a widget in a horizontal side panel", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    const { result } = renderHook(() => useWidgetDirection(), {
      wrapper: ({ children }) => (
        <NineZoneContext.Provider value={nineZone}>
          <TabIdContext.Provider value="t1">
            {children}
          </TabIdContext.Provider>
        </NineZoneContext.Provider>
      ),
    });
    result.current.should.eq("horizontal");
  });
});
