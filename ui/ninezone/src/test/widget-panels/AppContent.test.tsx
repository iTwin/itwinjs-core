/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { renderHook } from "@testing-library/react-hooks";
import { createNineZoneState, NineZoneDispatch, usePanelsAutoCollapse } from "../../ui-ninezone";
import { NineZoneProvider, setRefValue } from "../Providers";
import { fireEvent } from "@testing-library/react";
import { createPanelsState, createVerticalPanelState } from "../../ui-ninezone/base/NineZoneState";

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
      wrapper: (props: any) => <NineZoneProvider // eslint-disable-line react/display-name
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
    })
  });
});
