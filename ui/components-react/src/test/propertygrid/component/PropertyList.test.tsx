/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Orientation } from "@itwin/core-react";
import TestUtils from "../../TestUtils";
import { PropertyList } from "../../../components-react/propertygrid/component/PropertyList";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";

describe("PropertyList", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  it("should call `onPropertyClicked` when clicked on a primitive property", async () => {
    const primitiveRecord = TestUtils.createPrimitiveStringProperty("primitive", "value");
    const structRecord = TestUtils.createStructProperty("struct", { testProperty: TestUtils.createPrimitiveStringProperty("test", "value") });
    const arrayRecord = TestUtils.createArrayProperty("array", [TestUtils.createPrimitiveStringProperty("test", "value")]);

    const onPropertyClicked = sinon.spy();
    const { container } = render(
      <PropertyList
        orientation={Orientation.Horizontal}
        width={800}
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
        width={800}
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
