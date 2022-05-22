/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { cleanup, render } from "@testing-library/react";
import { BeDragDropContext } from "../../../components-react/table/component/dragdrop/BeDragDropContext";

describe("BeDragDropContext", () => {

  afterEach(cleanup);
  it("should render", () => {
    // eslint-disable-next-line deprecation/deprecation
    render(<BeDragDropContext> Test </BeDragDropContext>);
  });
});
