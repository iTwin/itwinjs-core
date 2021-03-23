/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import tlr from "@testing-library/react"; const { cleanup, render } = tlr;
import { DragDropBreadcrumbNodeComponent } from "../../../ui-components/breadcrumb/hoc/DragDropBreadcrumbNode.js";

describe("DragDropBreadcrumbNode", () => {

  afterEach(cleanup);
  it("should render", () => {
    render(<DragDropBreadcrumbNodeComponent isOver={false} isDragging={false} canDrag={true} canDrop={true} />);
  });
});
