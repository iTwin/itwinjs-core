/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import { ResizeHandlingSelectablePropertyBlock, ResizeHandlingSelectablePropertyBlockProps } from "../../../ui-components/propertygrid/component/ResizeHandlingSelectablePropertyBlock";
import TestUtils from "../../TestUtils";

describe("SelectablePropertyBlock", () => {
  let props: ResizeHandlingSelectablePropertyBlockProps;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    props = {
      orientation: Orientation.Horizontal,
      properties: [TestUtils.createPrimitiveStringProperty("CADID", "0000 0005 00E0 02D8")],
      category: {
        name: "Category1",
        label: "Category 1",
        expand: false,
      },
      selectedPropertyKey: "",
    };
  });

  describe("ratio between label and value when width below minimum column size", () => {
    const getBoundingClientRect = Element.prototype.getBoundingClientRect;

    before(() => {
      Element.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        toJSON: () => { },
        top: 0,
        width: 100,
        x: 0,
        y: 0,
      });
    });

    after(() => {
      Element.prototype.getBoundingClientRect = getBoundingClientRect;
    });

    it("changes label-value ratio when it's modified within bounds", () => {
      props.category.expand = true;

      const propertyBlockMount = mount(<ResizeHandlingSelectablePropertyBlock {...props} />);

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 10 });
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 40 }));
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.55);
    });

    it("changes label-value ratio to 0.15 when it's modified lower than allowed", () => {
      props.category.expand = true;

      const propertyBlockMount = mount(<ResizeHandlingSelectablePropertyBlock {...props} />);

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 30 });
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 0 }));
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.15);
    });

    it("changes label-value ratio to 0.6 when it's modified higher than allowed", () => {
      props.category.expand = true;

      const propertyBlockMount = mount(<ResizeHandlingSelectablePropertyBlock {...props} />);

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 25 });
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 90 }));
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.6);
    });
  });

  describe("ratio between label and value when width above minimum column size", () => {
    const getBoundingClientRect = Element.prototype.getBoundingClientRect;

    before(() => {
      Element.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        toJSON: () => { },
        top: 0,
        width: 1000,
        x: 0,
        y: 0,
      });
    });

    after(() => {
      Element.prototype.getBoundingClientRect = getBoundingClientRect;
    });

    it("changes label-value ratio when it's modified within bounds", () => {
      props.category.expand = true;
      props.minLabelWidth = 100;
      props.minValueWidth = 100;
      props.actionButtonWidth = 100;

      const propertyBlockMount = mount(<ResizeHandlingSelectablePropertyBlock {...props} />);

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 240 });
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 490 }));
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.5);
    });

    it("changes label-value ratio to minimum label width when it's modified lower than allowed", () => {
      props.category.expand = true;
      props.minLabelWidth = 100;
      props.minValueWidth = 100;
      props.actionButtonWidth = 100;

      const propertyBlockMount = mount(<ResizeHandlingSelectablePropertyBlock {...props} />);

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 255 });
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 0 }));
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.1);
    });

    it("changes label-value ratio to maximum label width when it's modified higher than allowed", () => {
      props.category.expand = true;
      props.minLabelWidth = 100;
      props.minValueWidth = 100;
      props.actionButtonWidth = 100;

      const propertyBlockMount = mount(<ResizeHandlingSelectablePropertyBlock {...props} />);

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.25);

      const elementSeparator = propertyBlockMount.find(".core-element-separator").first();
      elementSeparator.simulate("pointerdown", { clientX: 250 });
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 950 }));
      document.dispatchEvent(new MouseEvent("pointerup"));

      expect((propertyBlockMount.state("columnRatio") as number)).to.be.eq(0.8);
    });
  });

});
