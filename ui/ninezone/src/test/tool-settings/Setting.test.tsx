/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { DockedToolSetting } from "../../ui-ninezone";

describe("DockedToolSetting", () => {
  it("should render", () => {
    const { container } = render(<DockedToolSetting />);
    container.firstChild!.should.matchSnapshot();
  });
});
