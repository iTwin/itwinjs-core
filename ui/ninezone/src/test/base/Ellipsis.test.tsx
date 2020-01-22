/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { Ellipsis } from "../../ui-ninezone";

describe("<Ellipsis />", () => {
  it("renders correctly", () => {
    const { container } = render(<Ellipsis />);
    container.firstChild!.should.matchSnapshot();
  });
});
