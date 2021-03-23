/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import tlr from "@testing-library/react"; const { render } = tlr;
import { Ellipsis } from "../../ui-ninezone.js";

describe("<Ellipsis />", () => {
  it("renders correctly", () => {
    const { container } = render(<Ellipsis />);
    container.firstChild!.should.matchSnapshot();
  });
});
