/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { TableWrapper } from "../../../ui-components/table/hocs/TableWrapper";

describe("TableWrapper", () => {

  it("should render", () => {
    render(<TableWrapper isOver={false} canDrop={true} />);
  });
});
