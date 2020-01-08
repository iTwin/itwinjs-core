/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as sinon from "sinon";
import RealityDataPicker from "../../ui-framework/widgets/realitydata/RealityDataPicker";
import { IModelConnection, ScreenViewport, IModelApp } from "@bentley/imodeljs-frontend";
import * as moq from "typemoq";
import TestUtils from "../TestUtils";
import { Cartographic, EcefLocation } from "@bentley/imodeljs-common";

describe.skip("RealityDataPicker", () => {
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const viewportMock = moq.Mock.ofType<ScreenViewport>();

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render correctly ", () => {
    enzyme.shallow(
      <RealityDataPicker iModelConnection={imodelMock.object} />,
    ).should.matchSnapshot();
  });

  it("should load data when viewport is set", () => {
    IModelApp.viewManager.setSelectedView(viewportMock.object);
    const realityDataPicker = enzyme.shallow(
      <RealityDataPicker iModelConnection={imodelMock.object} />,
    );

    const picker = realityDataPicker.instance() as RealityDataPicker;
    const spy = sinon.spy(picker, "_onViewOpen" as any);
    expect(spy.called);
  });

  it("should contain limited models when cartographic range is defined", () => {
    const realityDataPicker = enzyme.shallow(
      <RealityDataPicker iModelConnection={imodelMock.object} />,
    );

    const cartoCenter = new Cartographic(0, 0, 0);
    const ecefLocation = EcefLocation.createFromCartographicOrigin(cartoCenter!);
    imodelMock.object.setEcefLocation(ecefLocation);
    IModelApp.viewManager.setSelectedView(viewportMock.object);
    const cartoRealityDataPicker = enzyme.shallow(
      <RealityDataPicker iModelConnection={imodelMock.object} />,
    );

    const picker = realityDataPicker.instance() as RealityDataPicker;
    const cartoPicker = cartoRealityDataPicker.instance() as RealityDataPicker;
    expect(picker.attachedModels.length >= cartoPicker.attachedModels.length);
  });

  it("should unmount correctly", () => {
    const component = enzyme.mount(<RealityDataPicker
      iModelConnection={imodelMock.object}
    />);
    component.unmount();
  });

});
