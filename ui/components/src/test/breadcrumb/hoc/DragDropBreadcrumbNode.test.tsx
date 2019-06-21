/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render, cleanup } from "@testing-library/react";
import { DragDropBreadcrumbNodeComponent } from "../../../ui-components/breadcrumb/hoc/DragDropBreadcrumbNode";

describe("DragDropBreadcrumbNode", () => {

  afterEach(cleanup);
  it("should render", () => {
    render(<DragDropBreadcrumbNodeComponent isOver={false} isDragging={false} canDrag={true} canDrop={true} />);
  });
});
