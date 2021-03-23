/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import tlr from "@testing-library/react"; const { cleanup, render } = tlr;
import { BeDragDropContext } from "../../ui-components.js";

describe("BeDragDropContext", () => {

  afterEach(cleanup);
  it("should render", () => {
    render(<BeDragDropContext> Test </BeDragDropContext>);
  });
});
