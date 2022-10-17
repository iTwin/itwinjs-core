/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { createNineZoneState, NineZoneDispatch, usePanelsAutoCollapse } from "../../appui-layout-react";
import { setRefValue, TestNineZoneProvider } from "../Providers";
import { updatePanelState } from "../../appui-layout-react/state/internal/PanelStateHelpers";

describe("usePanelsAutoCollapse", () => {
  it("should collapse unpinned panels", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = updatePanelState(state, "right", { pinned: false });
    const { result } = renderHook(() => usePanelsAutoCollapse(), {
      wrapper: (props: any) => <TestNineZoneProvider // eslint-disable-line react/display-name
        dispatch={dispatch}
        state={state}
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
