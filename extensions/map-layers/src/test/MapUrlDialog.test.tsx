/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings, MapSubLayerProps } from "@itwin/core-common";
import { DisplayStyle3dState, IModelApp, IModelConnection, MapLayerAuthType, MapLayerSource, MapLayerSourceStatus, MockRender, NotifyMessageDetails, OutputMessagePriority, ScreenViewport, ViewState3d } from "@itwin/core-frontend";
import { Select } from "@itwin/itwinui-react";
import { assert, expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { MapLayersUI } from "../mapLayers";
import { MapUrlDialog } from "../ui/widget/MapUrlDialog";
import { TestUtils } from "./TestUtils";

describe("MapUrlDialog", () => {
  const sandbox = sinon.createSandbox();
  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();
  const displayStyleMock = moq.Mock.ofType<DisplayStyle3dState>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  const sampleWmsSubLayers: MapSubLayerProps[] = [{ name: "subLayer1" }, { name: "subLayer2" }];
  const sampleWmsLayerSettings = ImageMapLayerSettings.fromJSON({
    formatId: "WMS",
    name: "Test Map",
    visible: true,
    transparentBackground: true,
    subLayers: sampleWmsSubLayers,
    accessKey: undefined,
    transparency: 0,
    url: "https://server/wms",
  });
  const sampleWmsLayerSettingsCred = sampleWmsLayerSettings?.clone({});
  sampleWmsLayerSettingsCred?.setCredentials("testUser", "TestPassword");

  const testAddAuthLayer = async (authMethod: MapLayerAuthType) => {
    const spyMessage = sandbox.spy(IModelApp.notifications, "outputMessage");
    const validateSourceStub = sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({
        status: MapLayerSourceStatus.RequireAuth,
        authInfo: { authMethod, tokenEndpoint: undefined },
      });
    });

    const component = enzyme.mount(<MapUrlDialog isOverlay={false} activeViewport={viewportMock.object} onOkResult={mockModalUrlDialogOk} />);
    const layerTypeSelect = component.find(Select);
    await (layerTypeSelect.props() as any).onChange("WMS");

    // First, lets fill the 'Name' and 'URL' fields
    const allInputs = component.find("input");
    expect(allInputs.length).to.equals(2);
    allInputs.at(0).simulate("change", { target: { value: sampleWmsLayerSettingsCred?.name } });
    allInputs.at(1).simulate("change", { target: { value: sampleWmsLayerSettingsCred?.url } });

    // We need to click the 'Ok' button a first time to trigger the layer source
    // validation and make the credentials fields appear
    let okButton = component.find(".core-dialog-buttons").childAt(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    component.update();
    if (authMethod !== MapLayerAuthType.None) {
      const allInputs2 = component.find("input");
      expect(allInputs2.length).to.equals(4);

      // Fill the credentials fields
      allInputs2.at(2).simulate("change", { target: { value: sampleWmsLayerSettingsCred?.userName } });
      allInputs2.at(3).simulate("change", { target: { value: sampleWmsLayerSettingsCred?.password } });
    }
    // We need to fake 'valideSource' again, this time we want to simulate a successfully validation
    validateSourceStub.restore();
    sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({
        status: MapLayerSourceStatus.Valid,
        subLayers: sampleWmsSubLayers,
      });
    });

    // By cliking the 'ok' button we expect the layer to be added to the display style
    okButton = component.find(".core-dialog-buttons").childAt(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    if (!sampleWmsLayerSettings)
      assert.fail("Invalid layer settings");

    if (authMethod !== MapLayerAuthType.None) {
      displayStyleMock.verify((x) => x.attachMapLayerSettings(sampleWmsLayerSettingsCred, false, undefined), moq.Times.once());

      spyMessage.calledWithExactly(new NotifyMessageDetails(OutputMessagePriority.Info, "Messages.MapLayerAttached"));
    }
    component.unmount();
  };

  before(async () => {
    await TestUtils.initialize();
    await MockRender.App.startup({localization: new EmptyLocalization()});

  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
  });

  afterEach(() => {
    sandbox.restore();
  });

  beforeEach(() => {
    displayStyleMock.reset();
    displayStyleMock.setup((ds) => ds.attachMapLayerSettings(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()));
    imodelMock.reset();
    imodelMock.setup((iModel) => iModel.iModelId).returns(() => "fakeGuid");
    imodelMock.setup((iModel) => iModel.iTwinId).returns(() => "fakeGuid");

    viewMock.reset();
    viewMock.setup((view) => view.iModel).returns(() => imodelMock.object);
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.iModel).returns(() => viewMock.object.iModel);
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);
    viewportMock.setup((viewport) => viewport.displayStyle).returns(() => displayStyleMock.object);

  });

  const mockModalUrlDialogOk = () => {
  };

  it("renders", () => {
    const component = enzyme.mount(<MapUrlDialog activeViewport={viewportMock.object} isOverlay={false} onOkResult={mockModalUrlDialogOk} />);
    const allInputs = component.find("input");

    expect(allInputs.length).to.equals(2);

    const layerTypeSelect = component.find(Select);
    expect(layerTypeSelect.length).to.equals(1);

    const allButtons = component.find("button");
    expect(allButtons.length).to.equals(3);

    component.unmount();
  });

  it("attach a valid WMS layer (with sublayers)", async () => {

    const spyMessage = sandbox.spy(IModelApp.notifications, "outputMessage");

    sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({ status: MapLayerSourceStatus.Valid, subLayers: sampleWmsSubLayers });
    });

    const component = enzyme.mount(<MapUrlDialog isOverlay={false} activeViewport={viewportMock.object} onOkResult={mockModalUrlDialogOk} />);
    const layerTypeSelect = component.find(Select);
    await (layerTypeSelect.props() as any).onChange("WMS");

    const allInputs = component.find("input");
    expect(allInputs.length).to.equals(2);
    allInputs.at(0).simulate("change", { target: { value: sampleWmsLayerSettings?.name } });
    allInputs.at(1).simulate("change", { target: { value: sampleWmsLayerSettings?.url } });

    const okButton = component.find(".core-dialog-buttons").childAt(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    if (!sampleWmsLayerSettings)
      assert.fail("Invalid layer settings");
    displayStyleMock.verify((x) => x.attachMapLayerSettings(sampleWmsLayerSettings, false, undefined), moq.Times.once());

    spyMessage.calledWithExactly(new NotifyMessageDetails(OutputMessagePriority.Info, "Messages.MapLayerAttached"));

    component.unmount();
  });

  it("attach a WMS layer requiring basic auth to display style", async () => {
    await testAddAuthLayer(MapLayerAuthType.Basic);
  });

  it("attach a layer requiring EsriToken", async () => {
    await testAddAuthLayer(MapLayerAuthType.EsriToken);
  });

  it("should not display user preferences options if iTwinConfig is undefined ", () => {

    const component = enzyme.mount(<MapUrlDialog activeViewport={viewportMock.object} isOverlay={false} onOkResult={mockModalUrlDialogOk} />);
    const allRadios = component.find('input[type="radio"]');
    expect(allRadios.length).to.equals(0);
  });

  it("should display user preferences options if iTwinConfig is defined ", () => {
    sandbox.stub(MapLayersUI, "iTwinConfig").get(() => ({
      get: undefined,
      save: undefined,
      delete: undefined,
    }));
    const component = enzyme.mount(<MapUrlDialog activeViewport={viewportMock.object} isOverlay={false} onOkResult={mockModalUrlDialogOk} />);
    const allRadios= component.find('input[type="radio"]');
    expect(allRadios.length).to.equals(2);
  });

});
