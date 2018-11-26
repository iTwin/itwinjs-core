/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import TestUtils from "../../TestUtils";
import { PrimitivePropertyRenderer } from "../../../properties/renderers/PrimitivePropertyRenderer";
import { PrimitivePropertyLabelRenderer } from "../../../properties/renderers/label";
import { PropertyView } from "../../../properties/renderers/PropertyView";

describe("PrimitivePropertyRenderer", () => {
  it("renders properly", () => {
    const rendererMount = mount(
      <PrimitivePropertyRenderer
        orientation={Orientation.Horizontal}
        propertyRecord={TestUtils.createPrimitiveStringProperty("Label", "Model")}
      />);
    expect(rendererMount.find(PrimitivePropertyLabelRenderer).html().indexOf("Label")).to.be.greaterThan(-1);
  });

  it("renders without an offset when orientation is vertical", () => {
    const rendererMount = mount(
      <PrimitivePropertyRenderer
        orientation={Orientation.Vertical}
        propertyRecord={TestUtils.createPrimitiveStringProperty("Label", "Model")}
      />);

    expect(rendererMount.find(PropertyView).get(0).props.offset).to.be.undefined;
  });
});
