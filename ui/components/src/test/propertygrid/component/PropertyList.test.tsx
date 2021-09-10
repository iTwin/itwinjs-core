/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import TestUtils from "../../TestUtils";
import { PropertyList } from "../../../ui-components/propertygrid/component/PropertyList";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";

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

  it("should call `onPropertyClicked` when clicked on a primitive property", async () => {
    const primitiveRecord = TestUtils.createPrimitiveStringProperty("primitive", "value");
    const structRecord = TestUtils.createStructProperty("struct", { testProperty: TestUtils.createPrimitiveStringProperty("test", "value") });
    const arrayRecord = TestUtils.createArrayProperty("array", [TestUtils.createPrimitiveStringProperty("test", "value")]);

    const onPropertyClicked = sinon.spy();
    const { container } = render(
      <PropertyList
        orientation={Orientation.Horizontal}
        properties={[
          primitiveRecord,
          structRecord,
          arrayRecord,
        ]}
        onPropertyClicked={onPropertyClicked}
      />,
    );
    await TestUtils.flushAsyncOperations();
    expect(onPropertyClicked).to.not.be.called;

    const clickableComponents = container.querySelectorAll(".components-property-record--horizontal");
    expect(clickableComponents.length).to.eq(3);

    const primitiveProperty = clickableComponents[0];
    fireEvent.click(primitiveProperty);
    expect(onPropertyClicked).to.be.calledOnceWith(primitiveRecord);
    onPropertyClicked.resetHistory();

    const structProperty = clickableComponents[1];
    fireEvent.click(structProperty);
    expect(onPropertyClicked).to.not.be.called;

    const arrayProperty = clickableComponents[2];
    fireEvent.click(arrayProperty);
    expect(onPropertyClicked).to.not.be.called;
  });

  it("should call `onPropertyRightClicked` when right clicked on a primitive property", async () => {
    const primitiveRecord = TestUtils.createPrimitiveStringProperty("primitive", "value");
    const structRecord = TestUtils.createStructProperty("struct", { testProperty: TestUtils.createPrimitiveStringProperty("test", "value") });
    const arrayRecord = TestUtils.createArrayProperty("array", [TestUtils.createPrimitiveStringProperty("test", "value")]);

    const onPropertyRightClicked = sinon.spy();
    const { container } = render(
      <PropertyList
        orientation={Orientation.Horizontal}
        properties={[
          primitiveRecord,
          structRecord,
          arrayRecord,
        ]}
        onPropertyRightClicked={onPropertyRightClicked}
      />,
    );
    await TestUtils.flushAsyncOperations();
    expect(onPropertyRightClicked).to.not.be.called;

    const clickableComponents = container.querySelectorAll(".components-property-record--horizontal");
    expect(clickableComponents.length).to.eq(3);

    const primitiveProperty = clickableComponents[0];
    fireEvent.contextMenu(primitiveProperty);
    expect(onPropertyRightClicked).to.be.calledOnceWith(primitiveRecord);
    onPropertyRightClicked.resetHistory();

    const structProperty = clickableComponents[1];
    fireEvent.contextMenu(structProperty);
    expect(onPropertyRightClicked).to.not.be.called;

    const arrayProperty = clickableComponents[2];
    fireEvent.contextMenu(arrayProperty);
    expect(onPropertyRightClicked).to.not.be.called;
  });

});
