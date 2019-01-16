/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { TableArrayValueRenderer } from "../../../../../ui-components/properties/renderers/value/table/ArrayValueRenderer";
import { Orientation } from "@bentley/ui-core";
import TestUtils from "../../../../TestUtils";
import { ArrayValue } from "../../../../../ui-components/properties/Value";

describe("ArrayValueRenderer", () => {
  it("renders correctly", () => {
    const record = TestUtils.createArrayProperty("Pipes", [TestUtils.createPrimitiveStringProperty("Label", "Model")]);

    const rendererMount = mount(
      <TableArrayValueRenderer
        onDialogOpen={() => { }}
        orientation={Orientation.Horizontal}
        propertyRecord={record}
      />);

    expect(rendererMount.find("button").html().indexOf("string[1]")).to.be.greaterThan(-1);
  });

  it("renders correctly with empty array", () => {
    const record = TestUtils.createArrayProperty("Pipes");
    (record.value as ArrayValue).itemsTypeName = "string";

    const rendererMount = mount(
      <TableArrayValueRenderer
        onDialogOpen={() => { }}
        orientation={Orientation.Horizontal}
        propertyRecord={record}
      />);

    expect(rendererMount.find("button").html().indexOf("[]")).to.be.greaterThan(-1);
  });
});
