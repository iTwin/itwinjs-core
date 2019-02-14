/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { render } from "react-testing-library";
import * as React from "react";
import { TableArrayValueRenderer } from "../../../../../ui-components/properties/renderers/value/table/ArrayValueRenderer";
import { Orientation } from "@bentley/ui-core";
import TestUtils from "../../../../TestUtils";
import { ArrayValue } from "@bentley/imodeljs-frontend";

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
