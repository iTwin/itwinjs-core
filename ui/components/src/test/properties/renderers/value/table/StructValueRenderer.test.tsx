/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { render } from "@testing-library/react";
import * as React from "react";
import { TableStructValueRenderer } from "../../../../../ui-components/properties/renderers/value/table/StructValueRenderer";
import { Orientation } from "@bentley/ui-core";
import TestUtils from "../../../../TestUtils";

describe("StructValueRenderer", () => {
  it("renders correctly", () => {
    const record = TestUtils.createStructProperty("Pipe");
    record.property.typename = "map";

    const renderer = render(
      <TableStructValueRenderer
        onDialogOpen={() => { }}
        orientation={Orientation.Horizontal}
        propertyRecord={record}
      />);

    // Verify that text "{map}" gets rendered. Throws otherwise
    renderer.getByText("{map}");
  });
});
