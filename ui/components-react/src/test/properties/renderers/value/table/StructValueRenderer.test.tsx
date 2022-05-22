/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Orientation } from "@itwin/core-react";
import { render } from "@testing-library/react";
import { TableStructValueRenderer } from "../../../../../components-react/properties/renderers/value/table/StructValueRenderer";
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
