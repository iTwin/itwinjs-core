/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import type { PrimitiveValue, PropertyConverterInfo } from "@itwin/appui-abstract";
import { render } from "@testing-library/react";
import { DoublePropertyValueRenderer } from "../../../../components-react/properties/renderers/value/DoublePropertyValueRenderer";
import type { PropertyValueRendererContext } from "../../../../components-react/properties/ValueRendererManager";
import TestUtils from "../../../TestUtils";

function createDoubleProperty(value: number, displayValue?: string) {
  const property = TestUtils.createPrimitiveStringProperty("Length", "", displayValue);
  property.property.typename = "double";
  (property.value as PrimitiveValue).value = value;
  return property;
}

describe("DoublePropertyValueRenderer", () => {
  describe("render", () => {
    it("renders double property from display value", () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty(0.45, "zero point forty five meters");

      const element = renderer.render(property);
      const elementRender = render(<>{element}</>);

      elementRender.getByText("zero point forty five meters");
    });

    it("renders double property from raw value", () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty(0.45, "");

      const element = renderer.render(property);
      const elementRender = render(<>{element}</>);

      elementRender.getByText("0.45");
    });

    it("supports PropertyConverterInfo", () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty(0.45, undefined);
      const convertInfo: PropertyConverterInfo = { name: "" };
      property.property.converter = convertInfo;

      const element = renderer.render(property);
      const elementRender = render(<>{element}</>);

      elementRender.getByText("0.45");
    });

    it("renders double property wrapped in an anchored tag when property record has it", () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty(0.45, "zero point forty five meters");
      property.links = {
        onClick: sinon.spy(),
      };

      const element = renderer.render(property);
      const renderedElement = render(<>{element}</>);

      renderedElement.getByText("zero point forty five meters");

      expect(renderedElement.container.getElementsByClassName("core-underlined-button")).to.not.be.empty;
    });

    it("renders double property with highlighting", () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty(0.45, "zero point forty five meters");

      const highlightNode = (text: string) => <span>{`${text} Highlighted`}</span>;
      const renderContext: PropertyValueRendererContext = {
        textHighlighter: highlightNode,
      };

      const element = renderer.render(property, renderContext);
      const renderedElement = render(<>{element}</>);

      renderedElement.getByText("zero point forty five meters Highlighted");
    });

    it("throws when trying to render array property", () => {
      const renderer = new DoublePropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      expect(() => renderer.render(arrayProperty)).to.throw;
    });
  });

  describe("canRender", () => {
    it("returns true for a double property", () => {
      const renderer = new DoublePropertyValueRenderer();
      const property = createDoubleProperty(0.45);
      expect(renderer.canRender(property)).to.be.true;
    });

    it("returns false for properties that are not double", () => {
      const renderer = new DoublePropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      const structProperty = TestUtils.createStructProperty("NameStruct");
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Model");
      expect(renderer.canRender(arrayProperty)).to.be.false;
      expect(renderer.canRender(structProperty)).to.be.false;
      expect(renderer.canRender(stringProperty)).to.be.false;
    });
  });
});
