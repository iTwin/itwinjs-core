/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import enzyme from "enzyme"; const { mount } = enzyme;
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import TestUtils from "../../TestUtils.js";
import { PropertyList } from "../../../ui-components/propertygrid/component/PropertyList.js";
import * as sinon from "sinon";

describe("PropertyList", () => {
  const getBoundingClientRect = Element.prototype.getBoundingClientRect;

  function setBoundingClientWidth(width: number) {
    Element.prototype.getBoundingClientRect = () => ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      toJSON: () => { },
      top: 0,
      width,
      x: 0,
      y: 0,
    });
  }

  before(async () => {
    await TestUtils.initializeUiComponents();
    setBoundingClientWidth(100);
  });

  after(() => {
    Element.prototype.getBoundingClientRect = getBoundingClientRect;
  });

  it("should call onListWidthChanged on mount", () => {
    const onListWidthChanged = sinon.spy();

    mount(
      <PropertyList
        orientation={Orientation.Horizontal}
        properties={[]}
        onListWidthChanged={onListWidthChanged}
      />);

    expect(onListWidthChanged.calledOnceWith(100)).to.be.true;
  });

  it("should call onListWidthChanged on update", () => {
    const onListWidthChanged = sinon.spy();

    const propertyList = mount(
      <PropertyList
        orientation={Orientation.Horizontal}
        properties={[]}
        onListWidthChanged={onListWidthChanged}
      />);

    expect(onListWidthChanged.calledWith(100)).to.be.true;

    setBoundingClientWidth(200);
    propertyList.mount();
    propertyList.update();

    expect(onListWidthChanged.calledWith(200)).to.be.true;
  });
});
