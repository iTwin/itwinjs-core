/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { Ellipsis } from "../../appui-layout-react";

describe("<Ellipsis />", () => {
  it("renders correctly", () => {
    const { container } = render(<Ellipsis />);
    container.firstChild!.should.matchSnapshot();
  });
});
