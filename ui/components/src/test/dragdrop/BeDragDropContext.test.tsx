/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render, cleanup } from "@testing-library/react";
import { BeDragDropContext } from "../../ui-components";

describe("BeDragDropContext", () => {

  afterEach(cleanup);
  it("should render", () => {
    render(<BeDragDropContext> Test </BeDragDropContext>);
  });
});
