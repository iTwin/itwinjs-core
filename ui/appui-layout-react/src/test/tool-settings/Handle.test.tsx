/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import {
  DockedToolSettingsHandle, DragManager, DragManagerContext, NineZoneDispatch, NineZoneDispatchContext,
} from "../../appui-layout-react";

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
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document);

    dispatch.calledOnceWithExactly(sinon.match({
      type: "TOOL_SETTINGS_DRAG_START",
    })).should.true;
  });
});
