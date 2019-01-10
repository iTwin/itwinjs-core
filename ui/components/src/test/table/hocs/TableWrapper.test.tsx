/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render, cleanup } from "react-testing-library";
import { TableWrapper } from "../../../ui-components/table/hocs/TableWrapper";

describe("TableWrapper", () => {

  afterEach(cleanup);
  it("should render", () => {
    render(<TableWrapper isOver={false} canDrop={true} />);
  });
});
