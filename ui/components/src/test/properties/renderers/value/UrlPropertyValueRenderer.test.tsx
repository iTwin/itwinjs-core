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
    it("renders URI property wrapped in an anchored tag from value", () => {
      const renderer = new UrlPropertyValueRenderer();
      const property = TestUtils.createURIProperty("Category", "Test Uri Value: pw:\\wsp-aus-pw.bentley.com:wsp-aus-pw-10\Documents\Southern Program Alliance");

      const element = renderer.render(property);
      const elementRender = render(<>{element}</>);

      expect(elementRender.container.getElementsByClassName("core-underlined-button")[0].textContent).to.be.eq("Test Uri Value: pw:\\wsp-aus-pw.bentley.com:wsp-aus-pw-10\Documents\Southern Program Alliance");
    });

    it("renders URI property wrapped in an anchored tag if custom LinkElementsInfo is specified in the PropertyRecord", () => {
      const renderer = new UrlPropertyValueRenderer();
      const property: PropertyRecord = TestUtils.createURIProperty("Category", "Test www.test.com");

      property.links = {
        onClick: sinon.spy(),
        matcher: () => [{ start: 0, end: 4 }],
      };

      const element = renderer.render(property);
      const elementRender = render(<>{element}</>);

      expect(elementRender.container.getElementsByClassName("core-underlined-button")[0].textContent).to.be.eq("Test");
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

    describe("onClick", () => {
      const locationMockRef: moq.IMock<Location> = moq.Mock.ofInstance(location);
      let spy: sinon.SinonStub<[(string | undefined)?, (string | undefined)?, (string | undefined)?, (boolean | undefined)?], Window | null>;

      before(() => {
        location = locationMockRef.object;
      });

      after(() => {
        locationMockRef.reset();
      });

      afterEach(() => {
        spy.restore();
      });

      it("opens window using the whole URI value, when link which doesn't start with pw: or mailto: is clicked", () => {
        const renderer = new UrlPropertyValueRenderer();
        const stringProperty = TestUtils.createURIProperty("Label", "Random Test property");
        spy = sinon.stub(window, "open");
        spy.returns(null);

        const element = renderer.render(stringProperty);
        const renderedElement = render(<>{element}</>);

        const linkElement = renderedElement.container.getElementsByClassName("core-underlined-button")[0];

        expect(linkElement.textContent).to.be.eq("Random Test property");

        fireEvent.click(linkElement);
        expect(spy).to.be.calledOnceWith("Random Test property", "_blank");
      });

      it("sets location.href to the whole URI value, when link starting with pw: is clicked", () => {
        const renderer = new UrlPropertyValueRenderer();
        const stringProperty = TestUtils.createURIProperty("Label", "pw:Test property");

        const element = renderer.render(stringProperty);
        const renderedElement = render(<>{element}</>);

        const linkElement = renderedElement.container.getElementsByClassName("core-underlined-button")[0];
        expect(linkElement.textContent).to.be.eq("pw:Test property");

        fireEvent.click(linkElement);
        expect(locationMockRef.object.href).to.be.equal("pw:Test property");
      });

      it("sets location.href to the whole URI value, when link starting with mailto: is clicked", () => {
        const renderer = new UrlPropertyValueRenderer();
        const stringProperty = TestUtils.createURIProperty("Label", "mailto:Test property");

        const element = renderer.render(stringProperty);
        const renderedElement = render(<>{element}</>);

        const linkElement = renderedElement.container.getElementsByClassName("core-underlined-button")[0];

        expect(linkElement.textContent).to.be.eq("mailto:Test property");

        fireEvent.click(linkElement);
        expect(locationMockRef.object.href).to.be.equal("mailto:Test property");
      });

      it("calls window.open.focus if window.open returns not null", () => {
        const renderer = new UrlPropertyValueRenderer();
        const stringProperty = TestUtils.createURIProperty("Label", "Random Test property");
        const windowMock = moq.Mock.ofType<Window>();
        windowMock.setup((x) => x.focus());

        spy = sinon.stub(window, "open");
        spy.returns(windowMock.object);

        const element = renderer.render(stringProperty);
        const renderedElement = render(<>{element}</>);

        const linkElement = renderedElement.container.getElementsByClassName("core-underlined-button")[0];

        expect(linkElement.textContent).to.be.eq("Random Test property");

        fireEvent.click(linkElement);
        expect(spy).to.be.calledOnceWith("Random Test property", "_blank");
        windowMock.verify((x) => x.focus(), moq.Times.once());
      });
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
