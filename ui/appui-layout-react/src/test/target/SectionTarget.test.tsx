/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PanelSideContext } from "../../appui-layout-react";
import { renderHook } from "@testing-library/react-hooks";
import { useTargetDirection } from "../../appui-layout-react/target/SectionTarget";

describe("useTargetDirection", () => {
  it("should return `horizontal`", () => {
    const { result } = renderHook(() => useTargetDirection(), {
      wrapper: (props) => (  // eslint-disable-line react/display-name
        <PanelSideContext.Provider value="bottom">
          {props.children}
        </PanelSideContext.Provider>
      ),
    });
    result.current.should.eq("horizontal");
  });

  it("should return `vertical`", () => {
    const { result } = renderHook(() => useTargetDirection(), {
      wrapper: (props) => (  // eslint-disable-line react/display-name
        <PanelSideContext.Provider value="left">
          {props.children}
        </PanelSideContext.Provider>
      ),
    });
    result.current.should.eq("vertical");
  });
});
