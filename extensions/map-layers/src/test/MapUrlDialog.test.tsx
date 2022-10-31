/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings, MapSubLayerProps } from "@itwin/core-common";
import { DisplayStyle3dState, IModelApp, IModelConnection, MapLayerSource, MapLayerSourceStatus, MapLayerTokenEndpoint, MockRender, NotifyMessageDetails, OutputMessagePriority, ScreenViewport, ViewState3d } from "@itwin/core-frontend";
import { Select } from "@itwin/itwinui-react";
import { assert, expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { MapLayersUI } from "../mapLayers";
import { MapUrlDialog } from "../ui/widget/MapUrlDialog";
import { AccessClientMock, TokenEndpointMock } from "./AccessClientMock";
import { TestUtils } from "./TestUtils";

describe("MapUrlDialog", () => {
  const sandbox = sinon.createSandbox();
  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();
  const displayStyleMock = moq.Mock.ofType<DisplayStyle3dState>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  const getSampleLayerSettings = (formatId: string, fakeCredentials: boolean) => {
    const sampleWmsSubLayers: MapSubLayerProps[] = [{ name: "subLayer1" }, { name: "subLayer2" }];
    const sampleWmsLayerSettings = ImageMapLayerSettings.fromJSON({
      formatId,
      name: "Test Map",
      visible: true,
      transparentBackground: true,
      subLayers: sampleWmsSubLayers,
      accessKey: undefined,
      transparency: 0,
      url: "https://server/wms",
    });

    if (fakeCredentials) {
      const sampleWmsLayerSettingsCred = sampleWmsLayerSettings?.clone({});
      sampleWmsLayerSettingsCred?.setCredentials("testUser", "TestPassword");
      return sampleWmsLayerSettingsCred;
    }

    return sampleWmsLayerSettings;
  };

  const testAddAuthLayer = async (isOAuth: boolean, format: string) => {

    const sampleLayerSettings = getSampleLayerSettings(format, true);
    const spyMessage = sandbox.spy(IModelApp.notifications, "outputMessage");
    let endPoint: MapLayerTokenEndpoint | undefined;
    if (isOAuth) {
      endPoint = new TokenEndpointMock();
    }
    const validateSourceStub = sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({
        status: MapLayerSourceStatus.RequireAuth,
        authInfo: { tokenEndpoint: endPoint },
      });
    });

    const component = enzyme.mount(<MapUrlDialog isOverlay={false} activeViewport={viewportMock.object} onOkResult={mockModalUrlDialogOk} />);
    const layerTypeSelect = component.find(Select);
    await (layerTypeSelect.props() as any).onChange(format);

    // First, lets fill the 'Name' and 'URL' fields
    const allInputs = component.find("input");
    expect(allInputs.length).to.equals(2);
    allInputs.at(0).simulate("change", { target: { value: sampleLayerSettings?.name } });
    allInputs.at(1).simulate("change", { target: { value: sampleLayerSettings?.url } });

    // We need to click the 'Ok' button a first time to trigger the layer source
    // validation and make the credentials fields appear
    let okButton = component.find(".core-dialog-buttons").childAt(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    component.update();
    if (!isOAuth) {
      const allInputs2 = component.find("input");
      expect(allInputs2.length).to.equals(4);

      // Fill the credentials fields
      allInputs2.at(2).simulate("change", { target: { value: sampleLayerSettings?.userName } });
      allInputs2.at(3).simulate("change", { target: { value: sampleLayerSettings?.password } });
    }
    // We need to fake 'valideSource' again, this time we want to simulate a successfully validation
    validateSourceStub.restore();
    sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({
        status: MapLayerSourceStatus.Valid,
        subLayers: sampleLayerSettings.subLayers,
      });
    });

    // By cliking the 'ok' button we expect the layer to be added to the display style
    okButton = component.find(".core-dialog-buttons").childAt(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    if (!sampleLayerSettings)
      assert.fail("Invalid layer settings");

    if (!isOAuth) {
      displayStyleMock.verify((x) => x.attachMapLayer({settings:sampleLayerSettings, isOverlay:false}), moq.Times.once());

      spyMessage.calledWithExactly(new NotifyMessageDetails(OutputMessagePriority.Info, "Messages.MapLayerAttached"));
    }
    component.unmount();
  };

  before(async () => {
    await MockRender.App.startup({localization: new EmptyLocalization()});
    await TestUtils.initialize();

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
    displayStyleMock.setup((ds) => ds.attachMapLayer(moq.It.isAny()));
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
    const sampleWmsLayerSettings = getSampleLayerSettings("WMS", false);

    const spyMessage = sandbox.spy(IModelApp.notifications, "outputMessage");

    sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({ status: MapLayerSourceStatus.Valid, subLayers: sampleWmsLayerSettings.subLayers });
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
    displayStyleMock.verify((x) => x.attachMapLayer({settings:sampleWmsLayerSettings, isOverlay:false}), moq.Times.once());

    spyMessage.calledWithExactly(new NotifyMessageDetails(OutputMessagePriority.Info, "Messages.MapLayerAttached"));

    component.unmount();
  });

  it("test credentials fields are displayed, and proper warning message", async () => {
    const sampleLayerSettings = getSampleLayerSettings("WMS", true);
    sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({
        status: MapLayerSourceStatus.RequireAuth,
      });
    });

    const component = enzyme.mount(<MapUrlDialog mapTypesOptions={{supportTileUrl: false, supportWmsAuthentication:true}}isOverlay={false} activeViewport={viewportMock.object} onOkResult={mockModalUrlDialogOk} />);
    const layerTypeSelect = component.find(Select);
    await (layerTypeSelect.props() as any).onChange(sampleLayerSettings.formatId);

    // First, lets fill the 'Name' and 'URL' fields
    const allInputs = component.find("input");
    expect(allInputs.length).to.equals(2);
    allInputs.at(0).simulate("change", { target: { value: sampleLayerSettings?.name } });
    allInputs.at(1).simulate("change", { target: { value: sampleLayerSettings?.url } });

    // We need to click the 'Ok' button a first time to trigger the layer source
    // validation and make the credentials fields appear
    const okButton = component.find(".core-dialog-buttons").childAt(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    component.update();
    const spans = component.find("span");
    expect(spans.containsAllMatchingElements([
      <span key={0}>mapLayers:CustomAttach.MissingCredentials</span>,
      <span key={1}>mapLayers:AuthenticationInputs.Username</span>,
      <span key={2}>mapLayers:AuthenticationInputs.Password</span>,
    ])).to.equal(true);

  });

  it.only("test credentials fields are displayed, and proper warning message", async () => {
    const sampleLayerSettings = getSampleLayerSettings("WMS", true);
    sandbox.stub(MapLayerSource.prototype, "validateSource").callsFake(async function (_ignoreCache?: boolean) {
      return Promise.resolve({
        status: MapLayerSourceStatus.RequireAuth,
      });
    });

    const component = enzyme.mount(<MapUrlDialog mapTypesOptions={{supportTileUrl: false, supportWmsAuthentication:false}}isOverlay={false} activeViewport={viewportMock.object} onOkResult={mockModalUrlDialogOk} />);
    const layerTypeSelect = component.find(Select);
    await (layerTypeSelect.props() as any).onChange(sampleLayerSettings.formatId);

    // First, lets fill the 'Name' and 'URL' fields
    const allInputs = component.find("input");
    expect(allInputs.length).to.equals(2);
    allInputs.at(0).simulate("change", { target: { value: sampleLayerSettings?.name } });
    allInputs.at(1).simulate("change", { target: { value: sampleLayerSettings?.url } });

    // We need to click the 'Ok' button a first time to trigger the layer source
    // validation and make the credentials fields appear
    const okButton = component.find(".core-dialog-buttons").childAt(0);
    expect(okButton.length).to.equals(1);
    okButton.simulate("click");

    await TestUtils.flushAsyncOperations();

    component.update();

    const spans = component.find("span");
    expect(spans.containsAllMatchingElements([
      <span key={0}>mapLayers:CustomAttach.NoCredentialsSupportLabel</span>,
    ])).to.equal(true);
  });

  it("attach a WMS layer requiring basic auth to display style", async () => {
    await testAddAuthLayer(false, "WMS");
  });

  it("attach a layer requiring EsriToken", async () => {
    await testAddAuthLayer(false, "ArcGIS");
  });

  it("attach a layer requiring Oauth and check popup opens with right URL", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", new AccessClientMock());
    const openStub = sinon.stub((global as any).window, "open");
    await testAddAuthLayer(true, "ArcGIS");
    expect(openStub.called).to.true;
    const firstCall = openStub.getCall(0);
    expect(firstCall.firstArg).to.equals(TokenEndpointMock.loginUrl);
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
