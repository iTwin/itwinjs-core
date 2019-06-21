/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
