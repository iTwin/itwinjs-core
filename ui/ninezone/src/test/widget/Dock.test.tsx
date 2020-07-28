/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { Dock, NineZoneDispatch, NineZoneDispatchContext } from "../../ui-ninezone";

describe("Dock", () => {
  it("should render", () => {
    const { container } = render(<Dock />);
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch TOOL_SETTINGS_DOCK", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    const { container } = render(
      <NineZoneDispatchContext.Provider value={dispatch}>
        <Dock />
      </NineZoneDispatchContext.Provider>,
    );
    const button = container.getElementsByClassName("nz-widget-dock")[0];
    fireEvent.click(button);

    dispatch.calledOnceWithExactly({
      type: "TOOL_SETTINGS_DOCK",
    }).should.true;
  });
});
