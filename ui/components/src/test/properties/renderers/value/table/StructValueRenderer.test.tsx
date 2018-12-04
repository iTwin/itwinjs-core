/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { TableStructValueRenderer } from "../../../../../properties/renderers/value/table/StructValueRenderer";
import { Orientation } from "@bentley/ui-core";
import TestUtils from "../../../../TestUtils";

describe("StructValueRenderer", () => {
  it("renders correctly", () => {
    const record = TestUtils.createStructProperty("Pipe");
    record.property.typename = "map";

    const rendererMount = mount(
      <TableStructValueRenderer
        onDialogOpen={() => { }}
        onPopupHide={() => { }}
        onPopupShow={() => { }}
        orientation={Orientation.Horizontal}
        propertyRecord={record}
      />);

    expect(rendererMount.find("button").html().indexOf("{map}")).to.be.greaterThan(-1);
  });
});
