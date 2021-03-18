/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { UnitSystemKey } from "@bentley/imodeljs-frontend";
import { UnitSystemSelector } from "../../ui-framework/settings/quantityformatting/UnitSystemSelector";
import TestUtils from "../TestUtils";

describe("UnitSystemSelector", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("will render four systems", () => {
    const onChangedSpy = sinon.spy();
    const availableUnitSystems = new Set<UnitSystemKey>(["metric", "imperial", "usSurvey", "usCustomary"]);
    const wrapper = render(<UnitSystemSelector onUnitSystemSelected={onChangedSpy} selectedUnitSystemKey="metric"
      availableUnitSystems={availableUnitSystems} />);

    expect(wrapper.container.querySelectorAll("option").length).to.eq(4);
    const selectButton = wrapper.getByTestId("unitSystemSelector");
    fireEvent.change(selectButton, { target: { value: "usCustomary" } });
    onChangedSpy.calledOnce.should.true;
    wrapper.unmount();
  });

  it("will render three systems", () => {
    const onChangedSpy = sinon.spy();
    const availableUnitSystems = new Set<UnitSystemKey>(["metric", "imperial", "usSurvey"]);
    const wrapper = render(<UnitSystemSelector onUnitSystemSelected={onChangedSpy} selectedUnitSystemKey="usCustomary"
      availableUnitSystems={availableUnitSystems} />);

    expect(wrapper.container.querySelectorAll("option").length).to.eq(3);
    const selectButton = wrapper.getByTestId("unitSystemSelector");
    fireEvent.change(selectButton, { target: { value: "usSurvey" } });
    onChangedSpy.calledOnce.should.true;
    wrapper.unmount();
  });

});
