/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { createNineZoneState, createPanelsState, createVerticalPanelState, NineZoneDispatch, usePanelsAutoCollapse } from "../../appui-layout-react";
import { setRefValue, TestNineZoneProvider } from "../Providers";

describe("usePanelsAutoCollapse", () => {
  it("should collapse unpinned panels", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    const nineZone = createNineZoneState({
      panels: createPanelsState({
        right: createVerticalPanelState("right", {
          pinned: false,
        }),
      }),
    });
    const { result } = renderHook(() => usePanelsAutoCollapse(), {
      wrapper: (props: any) => <TestNineZoneProvider // eslint-disable-line react/display-name
        dispatch={dispatch}
        state={nineZone}
        {...props}
      />,
    });
    const element = document.createElement("div");
    setRefValue(result.current, element);

    fireEvent.mouseDown(element);

    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "PANEL_SET_COLLAPSED",
      side: "right",
      collapsed: true,
    });
  });
});
