/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Orientation } from "@itwin/core-react";
import { StructPropertyValueRenderer } from "../../../../components-react/properties/renderers/value/StructPropertyValueRenderer";
import { TableNonPrimitiveValueRenderer } from "../../../../components-react/properties/renderers/value/table/NonPrimitiveValueRenderer";
import { PropertyContainerType } from "../../../../components-react/properties/ValueRendererManager";
import TestUtils from "../../../TestUtils";

describe("StructPropertyValueRenderer", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  describe("render", () => {
    it("renders struct property", () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = renderer.render(structProperty);
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("{struct}");
    });

    it("renders default way when provided with empty context", () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = renderer.render(structProperty, {});
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("{struct}");
    });

    it("renders struct with Table renderer if container type is Table", () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = renderer.render(structProperty, { containerType: PropertyContainerType.Table, orientation: Orientation.Vertical });
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.find(TableNonPrimitiveValueRenderer).exists()).to.be.true;
    });

    it("defaults to horizontal orientation when rendering for a table without specified orientation", () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = renderer.render(structProperty, { containerType: PropertyContainerType.Table });
      const elementMount = mount(<div>{element}</div>);

      const dialogContentsMount = mount(<div>{elementMount.find(TableNonPrimitiveValueRenderer).prop("dialogContents")}</div>);

      expect(dialogContentsMount.childAt(0).prop("orientation")).to.be.eq(Orientation.Horizontal);
    });

    it("throws when trying to render primitive property", () => {
      const renderer = new StructPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");
      expect(() => renderer.render(stringProperty)).to.throw;
    });

    it("renders as empty string when container type is property pane", () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");

      const element = renderer.render(structProperty, { containerType: PropertyContainerType.PropertyPane });
      const elementMount = mount(<div>{element}</div>);

      expect(elementMount.text()).to.be.eq("");
    });
  });

  describe("canRender", () => {
    it("returns true for an struct property", () => {
      const renderer = new StructPropertyValueRenderer();
      const structProperty = TestUtils.createStructProperty("NameStruct");
      expect(renderer.canRender(structProperty)).to.be.true;
    });

    it("returns false for array and struct property", () => {
      const renderer = new StructPropertyValueRenderer();
      const stringProperty = TestUtils.createPrimitiveStringProperty("Label", "Test property");
      const arrayProperty = TestUtils.createArrayProperty("LabelArray");
      expect(renderer.canRender(stringProperty)).to.be.false;
      expect(renderer.canRender(arrayProperty)).to.be.false;
    });
  });
});
