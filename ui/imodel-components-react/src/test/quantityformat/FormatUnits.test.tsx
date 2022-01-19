/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { render } from "@testing-library/react";
import { IModelApp, MockRender } from "@itwin/core-frontend";
import { FormatProps } from "@itwin/core-quantity";
import { TestUtils } from "../TestUtils";
import { handleError, selectChangeValueByText, stubScrollIntoView } from "../test-helpers/misc";
import { FormatUnits } from "../../imodel-components-react/quantityformat/FormatUnits";

describe("FormatUnits", () => {
  const rnaDescriptorToRestore = Object.getOwnPropertyDescriptor(IModelApp, "requestNextAnimation")!;
  function requestNextAnimation() { }

  before(async () => {
    // Avoid requestAnimationFrame exception during test by temporarily replacing function that calls it.
    Object.defineProperty(IModelApp, "requestNextAnimation", {
      get: () => requestNextAnimation,
    });
    await TestUtils.initializeUiIModelComponents();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiIModelComponents();
    Object.defineProperty(IModelApp, "requestNextAnimation", rnaDescriptorToRestore);
  });

  stubScrollIntoView();

  it("should render (numeric format)", async () => {
    const numericFormatProps: FormatProps = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: " ",
      decimalSeparator: ".",
    };

    const unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    const pu = await unitsProvider.findUnitByName("Units.M");
    let onChangeFuncCalled = false;
    const onChangeFunc = ((format: FormatProps) => {
      expect(format.composite).not.to.be.undefined;
      expect(format.composite?.units[0].name).to.eql("Units.IN");
      onChangeFuncCalled = true;
    });

    const renderedComponent = render(<FormatUnits initialFormat={numericFormatProps}
      persistenceUnit={pu} unitsProvider={unitsProvider} onUnitsChange={onChangeFunc} />);
    await TestUtils.flushAsyncOperations();
    // fireEvent.change(renderedComponent.getByTestId("unit-Units.M"), {target: { value: "Units.IN:in" }});
    const unitsSelector = renderedComponent.getByTestId("unit-Units.M");
    selectChangeValueByText(unitsSelector, "IN", handleError);
    await TestUtils.flushAsyncOperations();
    expect(onChangeFuncCalled).to.be.true;
  });

  it("should render (composite format without label or composite spacer)", async () => {
    const compositeFormatProps: FormatProps = {
      composite: {
        includeZero: true,
        units: [{ name: "Units.FT" }, { name: "Units.IN" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    };

    const unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    const pu = await unitsProvider.findUnitByName("Units.M");
    let onChangeFuncCalled = false;
    const onChangeFunc = ((format: FormatProps) => {
      expect(format.composite).not.to.be.undefined;
      expect(format.composite?.units[0].name).to.eql("Units.FT");
      expect(format.composite?.units.length).to.eql(1);
      onChangeFuncCalled = true;
    });

    const renderedComponent = render(<FormatUnits initialFormat={compositeFormatProps}
      persistenceUnit={pu} unitsProvider={unitsProvider} onUnitsChange={onChangeFunc} />);
    await TestUtils.flushAsyncOperations();
    // fireEvent.change(renderedComponent.getByTestId("unit-Units.IN"), { target: { value: "REMOVEUNIT" } });
    const unitsSelector = renderedComponent.getByTestId("unit-Units.IN");
    selectChangeValueByText(unitsSelector, "Remove", handleError);
    expect(onChangeFuncCalled).to.be.true;
  });

});
