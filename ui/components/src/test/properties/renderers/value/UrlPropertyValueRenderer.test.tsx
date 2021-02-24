/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Id64 } from "@bentley/bentleyjs-core";
import { fireEvent, render } from "@testing-library/react";
import { PropertyValueRendererContext } from "../../../../ui-components/properties/ValueRendererManager";
import TestUtils from "../../../TestUtils";
import { UrlPropertyValueRenderer } from "../../../../ui-components/properties/renderers/value/UrlPropertyValueRenderer";
import { PropertyRecord } from "@bentley/ui-abstract";
import sinon from "sinon";
import * as moq from "typemoq";

describe("UrlPropertyValueRenderer", () => {

  describe("render", () => {
    it("renders URI property wrapped in an anchored tag from display value", () => {
      const renderer = new UrlPropertyValueRenderer();
      const property = TestUtils.createURIProperty("Category", "Value", "Test Uri Value: pw:\\wsp-aus-pw.bentley.com:wsp-aus-pw-10\Documents\Southern Program Alliance");

      const element = renderer.render(property);
      const elementRender = render(<>{element}</>);

      expect(elementRender.container.getElementsByClassName("core-underlined-button")[0].textContent).to.be.eq("Test Uri Value: pw:\\wsp-aus-pw.bentley.com:wsp-aus-pw-10\Documents\Southern Program Alliance");
    });

    it("renders URI property wrapped in an anchored tag if custom LinkElementsInfo is specified in the PropertyRecord", () => {
      const renderer = new UrlPropertyValueRenderer();
      const property: PropertyRecord = TestUtils.createURIProperty("Category", "Value", "Test www.test.com");

      property.links = {
        onClick: sinon.spy(),
        matcher: () => [{ start: 0, end: 4 }],
      };

      const element = renderer.render(property);
      const elementRender = render(<>{element}</>);

      expect(elementRender.container.getElementsByClassName("core-underlined-button")[0].textContent).to.be.eq("Test");
    });

    it("renders URI property wrapped in an anchored tag from raw value", () => {
      const renderer = new UrlPropertyValueRenderer();
      const property = TestUtils.createURIProperty("Category", "Value");

      const element = renderer.render(property);
      const elementRender = render(<>{element}</>);

      elementRender.getByText("Value");

      expect(elementRender.container.getElementsByClassName("core-underlined-button")[0].textContent).to.be.eq("Value");
    });

    it("doesn't render URI property from name", () => {
      const renderer = new UrlPropertyValueRenderer();
      const property = TestUtils.createURIProperty("Category", "", "");

      const element = renderer.render(property);
      const elementRender = render(<>{element}</>);

      expect(() => elementRender.getByText("Category")).to.throw("Unable to find an element with the text: Category");
    });

    it("renders URI property with highlighting and in anchored tag", () => {
      const renderer = new UrlPropertyValueRenderer();
      const stringProperty = TestUtils.createURIProperty("Label", "Test property");

      const highlightNode = (text: string) => <span>{`${text} Highlighted`}</span>;
      const renderContext: PropertyValueRendererContext = {
        textHighlighter: highlightNode,
      };

      const element = renderer.render(stringProperty, renderContext);
      const renderedElement = render(<>{element}</>);

      renderedElement.getByText("Test property Highlighted");
      expect(renderedElement.container.getElementsByClassName("core-underlined-button")).to.not.be.empty;
    });

    it("throws when trying to render array property", () => {
      const renderer = new UrlPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      expect(() => renderer.render(arrayProperty)).to.throw;
    });

    it("handles whole URI value, when clicked", () => {
      const renderer = new UrlPropertyValueRenderer();
      const stringProperty = TestUtils.createURIProperty("Label", "Test property");
      const locationMockRef: moq.IMock<Location> = moq.Mock.ofInstance(location);
      location = locationMockRef.object;

      const element = renderer.render(stringProperty);
      const renderedElement = render(<>{element}</>);

      const linkElement = renderedElement.container.getElementsByClassName("core-underlined-button")[0];

      expect(linkElement.textContent).to.be.eq("Test property");

      fireEvent.click(linkElement);
      expect(locationMockRef.object.href).to.be.equal("Test property");
    });
  });

  describe("canRender", () => {
    it("returns true for a URI property", () => {
      const renderer = new UrlPropertyValueRenderer();
      const property = TestUtils.createURIProperty("Category", "Value");
      expect(renderer.canRender(property)).to.be.true;
    });

    it("returns false for properties that are not URI", () => {
      const renderer = new UrlPropertyValueRenderer();
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      const structProperty = TestUtils.createStructProperty("NameStruct");
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Model");
      const navigationProperty = TestUtils.createNavigationProperty("Category", { className: "", id: Id64.fromUint32Pair(1, 0) });
      expect(renderer.canRender(arrayProperty)).to.be.false;
      expect(renderer.canRender(structProperty)).to.be.false;
      expect(renderer.canRender(stringProperty)).to.be.false;
      expect(renderer.canRender(navigationProperty)).to.be.false;
    });
  });
});
