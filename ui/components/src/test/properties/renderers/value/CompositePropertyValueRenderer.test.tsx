/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { render } from "@testing-library/react";
import * as React from "react";
import * as sinon from "sinon";
import TestUtils from "../../../TestUtils";
import { CompositePropertyValueRenderer } from "../../../../ui-components/properties/renderers/value/CompositePropertyValueRenderer";
import { PrimitiveValue, Primitives, PropertyValueFormat, PropertyRecord, PropertyDescription } from "@bentley/imodeljs-frontend";
import { PropertyValueRendererContext } from "../../../../ui-components/properties/ValueRendererManager";

function createCompositeProperty() {
  const compositeValue: Primitives.Composite = {
    separator: "*",
    parts: [
      {
        displayValue: "FirstPart",
        rawValue: "FirstPart",
        typeName: "string",
      },
      {
        displayValue: "SecondPart - InnerPart",
        rawValue: {
          separator: " - ",
          parts: [
            {
              displayValue: "SecondPart",
              rawValue: "SecondPart",
              typeName: "string",
            },
            {
              displayValue: "InnerPart",
              rawValue: "InnerPart",
              typeName: "string",
            },
          ],
        },
        typeName: "composite",
      },
    ],
  };

  const primitiveValue: PrimitiveValue = {
    displayValue: "FirstPart*SecondPart - InnerPart",
    value: compositeValue,
    valueFormat: PropertyValueFormat.Primitive,
  };

  const propertyDescription: PropertyDescription = {
    name: "composite_prop",
    typename: "composite",
    displayLabel: "CompositeProp",
  };

  return new PropertyRecord(primitiveValue, propertyDescription);
}

describe("CompositePropertyValueRenderer", () => {
  describe("render", () => {
    it("renders composite property from raw value", async () => {
      const renderer = new CompositePropertyValueRenderer();
      const property = createCompositeProperty();

      const element = await renderer.render(property);
      const elementRender = render(<>{element}</>);

      elementRender.getByText("FirstPart*SecondPart - InnerPart");
    });

    it("renders composite property wrapped in an anchored tag when property record has it", async () => {
      const renderer = new CompositePropertyValueRenderer();
      const property = createCompositeProperty();
      property.links = { onClick: sinon.spy() };

      const element = await renderer.render(property);
      const renderedElement = render(<>{element}</>);

      renderedElement.getByText("FirstPart*SecondPart - InnerPart");

      expect(renderedElement.container.getElementsByClassName("core-underlined-button")).to.not.be.empty;
    });

    it("renders composite property with highlighting", async () => {
      const renderer = new CompositePropertyValueRenderer();
      const property = createCompositeProperty();

      const highlightNode = (text: string) => <span>{text + " Highlighted"}</span>;
      const renderContext: PropertyValueRendererContext = {
        textHighlighter: highlightNode,
      };

      const element = await renderer.render(property, renderContext);
      const renderedElement = render(<>{element}</>);

      renderedElement.getByText("FirstPart*SecondPart - InnerPart Highlighted");
    });

    it("throws when trying to render array property", () => {
      const renderer = new CompositePropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      expect(() => renderer.render(arrayProperty)).to.throw;
    });
  });

  describe("canRender", () => {
    it("returns true for a composite property", () => {
      const renderer = new CompositePropertyValueRenderer();
      const property = createCompositeProperty();
      expect(renderer.canRender(property)).to.be.true;
    });

    it("returns false for properties that are not composite", () => {
      const renderer = new CompositePropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      const structProperty = TestUtils.createStructProperty("NameStruct");
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Model");
      expect(renderer.canRender(arrayProperty)).to.be.false;
      expect(renderer.canRender(structProperty)).to.be.false;
      expect(renderer.canRender(stringProperty)).to.be.false;
    });
  });
});
