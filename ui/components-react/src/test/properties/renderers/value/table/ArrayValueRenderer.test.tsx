/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { ArrayValue } from "@itwin/appui-abstract";
import { Orientation } from "@itwin/core-react";
import { render } from "@testing-library/react";
import { TableArrayValueRenderer } from "../../../../../components-react/properties/renderers/value/table/ArrayValueRenderer";
import TestUtils from "../../../../TestUtils";

describe("ArrayValueRenderer", () => {
  it("renders correctly", () => {
    const record = TestUtils.createArrayProperty("Pipes", [TestUtils.createPrimitiveStringProperty("Label", "Model")]);

    const renderer = render(
      <TableArrayValueRenderer
        onDialogOpen={() => { }}
        orientation={Orientation.Horizontal}
        propertyRecord={record}
      />);

    // Verify that string[1] gets rendered. Throws otherwise
    renderer.getByText("string[1]");
  });

  it("renders correctly with empty array", () => {
    const record = TestUtils.createArrayProperty("Pipes");
    (record.value as ArrayValue).itemsTypeName = "string";

    const renderer = render(
      <TableArrayValueRenderer
        onDialogOpen={() => { }}
        orientation={Orientation.Horizontal}
        propertyRecord={record}
      />);

    // Verify that string[1] gets rendered. Throws otherwise
    renderer.getByText("[]");
  });
});
