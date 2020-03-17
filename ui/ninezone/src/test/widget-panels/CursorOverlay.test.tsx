/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { CursorOverlay, CursorTypeContext } from "../../ui-ninezone";

describe("CursorOverlay", () => {
  it("should render", () => {
    const { container } = render(
      <CursorTypeContext.Provider value="grabbing">
        <CursorOverlay />
      </CursorTypeContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
