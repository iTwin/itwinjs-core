/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { renderHook } from "@testing-library/react-hooks";
import { addPanelWidget, addTab, createNineZoneState, NineZoneContext, TabIdContext } from "@itwin/appui-layout-react";
import { UiFramework, useWidgetDirection } from "../../appui-react";
import { FrameworkVersion } from "../../appui-react/hooks/useFrameworkVersion";
import TestUtils from "../TestUtils";
import { Provider } from "react-redux";

describe("useWidgetDirection", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should return 'vertical'", async () => {
    UiFramework.setUiVersion("1");
    await TestUtils.flushAsyncOperations();

    const nineZone = createNineZoneState();
    const { result } = renderHook(() => useWidgetDirection(), {
      wrapper: ({ children }) => ( // eslint-disable-line react/display-name
        <NineZoneContext.Provider value={nineZone}>
          {children}
        </NineZoneContext.Provider>
      ),
    });
    result.current.should.eq("vertical");
  });

  it("should return 'horizontal' for a widget in a horizontal side panel", async () => {
    UiFramework.setUiVersion("2");
    await TestUtils.flushAsyncOperations();

    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { result } = renderHook(() => useWidgetDirection(), {
      wrapper: ({ children }) => ( // eslint-disable-line react/display-name
        <Provider store={TestUtils.store} >
          <NineZoneContext.Provider value={nineZone}>
            <TabIdContext.Provider value="t1">
              <FrameworkVersion>
                {children}
              </FrameworkVersion>
            </TabIdContext.Provider>
          </NineZoneContext.Provider>
        </Provider>
      ),
    });
    result.current.should.eq("horizontal");
  });

  it("should return 'vertical' for a widget in a vertical side panel", async () => {
    UiFramework.setUiVersion("2");
    await TestUtils.flushAsyncOperations();

    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { result } = renderHook(() => useWidgetDirection(), {
      wrapper: ({ children }) => ( // eslint-disable-line react/display-name
        <Provider store={TestUtils.store} >
          <NineZoneContext.Provider value={nineZone}>
            <TabIdContext.Provider value="t1">
              <FrameworkVersion>
                {children}
              </FrameworkVersion>
            </TabIdContext.Provider>
          </NineZoneContext.Provider>
        </Provider>
      ),
    });
    result.current.should.eq("vertical");
  });
});
