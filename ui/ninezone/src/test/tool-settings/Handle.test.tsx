/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import {
  DockedToolSettingsHandle, DragManager, DragManagerContext, NineZoneDispatch, NineZoneDispatchContext,
} from "../../ui-ninezone";

describe("DockedToolSettingsHandle", () => {
  it("should dispatch TOOL_SETTINGS_DRAG_START", () => {
    const dragManager = new DragManager();
    const dispatch = sinon.stub<NineZoneDispatch>();
    const { container } = render(
      <NineZoneDispatchContext.Provider value={dispatch}>
        <DragManagerContext.Provider value={dragManager}>
          <DockedToolSettingsHandle />
        </DragManagerContext.Provider>
      </NineZoneDispatchContext.Provider>,
    );
    const handle = container.getElementsByClassName("nz-toolSettings-handle")[0];
    fireEvent.pointerDown(handle);

    dispatch.calledOnceWithExactly(sinon.match({
      type: "TOOL_SETTINGS_DRAG_START",
    })).should.true;
  });
});
