/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Orientation } from "@itwin/ui-core-react";
import { PrimitivePropertyLabelRenderer } from "../../../ui-components-react";
import { PrimitivePropertyRenderer } from "../../../ui-components-react/properties/renderers/PrimitivePropertyRenderer";
import { PropertyView } from "../../../ui-components-react/properties/renderers/PropertyView";
import TestUtils from "../../TestUtils";

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
