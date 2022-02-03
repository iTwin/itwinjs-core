/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { assert, expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import type {
  BackgroundMapSettings, DisplayStyle3dSettings, TerrainSettings} from "@itwin/core-common";
import { EmptyLocalization, PlanarClipMaskMode,
  PlanarClipMaskPriority, TerrainHeightOriginMode,
} from "@itwin/core-common";
import type { DisplayStyle3dState, IModelConnection, ScreenViewport, ViewState3d } from "@itwin/core-frontend";
import { MockRender } from "@itwin/core-frontend";
import { SpecialKey } from "@itwin/appui-abstract";
import { NumberInput } from "@itwin/core-react";
import { Select, ToggleSwitch } from "@itwin/itwinui-react";
import { SourceMapContext } from "../ui/widget/MapLayerManager";
import { MapManagerSettings } from "../ui/widget/MapManagerSettings";
import { TestUtils } from "./TestUtils";
import { QuantityNumberInput } from "@itwin/imodel-components-react";

describe("MapManagerSettings", () => {
  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();
  const displayStyleMock = moq.Mock.ofType<DisplayStyle3dState>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const displayStyleSettingsMock = moq.Mock.ofType<DisplayStyle3dSettings>();
  const backgroundMapSettingsMock = moq.Mock.ofType<BackgroundMapSettings>();
  const terrainSettingsMock = moq.Mock.ofType<TerrainSettings>();

  // Utility methods that give the index of components rendered by
  // MapManagerSettings.
  // Any re-ordering inside the component render will invalidate
  // this and will need to be revisited.
  const getToggleIndex = (toggleName: string) => {
    switch (toggleName) {
      case "locatable": return 0;
      case "mask": return 1;
      case "overrideMaskTransparency": return 2;
      case "depthBuffer": return 3;
      case "terrain": return 4;
    }
    assert.fail("invalid name provided.");
    return 0;
  };

  const getQuantityNumericInputIndex = (name: string) => {
    switch (name) {
      case "groundBias": return 0;
      case "terrainOrigin": return 1;
    }
    assert.fail("invalid name provided.");
    return 0;
  };

  const changeNumericInputValue = (component: any, value: number) => {
    // For some reasons could not get 'simulate' and 'change' to work here, so calling directly the onChange prop instead.
    component.find("input").props().onChange!({ currentTarget: { value } } as any);

    // Handler is not triggered until there is a key press
    component.find("input").simulate("keydown", { key: SpecialKey.Enter });
    component.update();
  };

  before(async () => {
    await MockRender.App.startup({localization: new EmptyLocalization()});
    await TestUtils.initialize();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
  });

  beforeEach(() => {
    terrainSettingsMock.reset();
    terrainSettingsMock.setup((ts) => ts.heightOriginMode).returns(() => TerrainHeightOriginMode.Geodetic);
    terrainSettingsMock.setup((ts) => ts.heightOrigin).returns(() => 0);
    terrainSettingsMock.setup((ts) => ts.exaggeration).returns(() => 0);
    backgroundMapSettingsMock.reset();
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.groundBias).returns(() => 0);
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.transparency).returns(() => 0);
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.applyTerrain).returns(() => false);
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.terrainSettings).returns(() => terrainSettingsMock.object);
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.useDepthBuffer).returns(() => false);
    backgroundMapSettingsMock.setup((bgMapSettings) => bgMapSettings.locatable).returns(() => true);
    displayStyleSettingsMock.reset();
    displayStyleSettingsMock.setup((styleSettings) => styleSettings.backgroundMap).returns(() => backgroundMapSettingsMock.object);
    displayStyleMock.reset();
    displayStyleMock.setup((ds) => ds.attachMapLayerSettings(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()));
    displayStyleMock.setup((style) => style.attachMapLayerSettings(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()));
    displayStyleMock.setup((style) => style.settings).returns(() => displayStyleSettingsMock.object);
    viewMock.reset();
    viewMock.setup((view) => view.iModel).returns(() => imodelMock.object);
    viewMock.setup((x) => x.getDisplayStyle3d()).returns(() => displayStyleMock.object);

    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);
    viewportMock.setup((viewport) => viewport.changeBackgroundMapProps(moq.It.isAny()));
    viewportMock.setup((viewport) => viewport.invalidateRenderPlan());
  });
  const refreshFromStyle = sinon.spy();

  const mountComponent = () => {
    return enzyme.mount(
      <SourceMapContext.Provider value={{
        activeViewport: viewportMock.object,
        loadingSources: false,
        sources: [],
        bases: [],
        refreshFromStyle,
      }}>
        <MapManagerSettings />
      </SourceMapContext.Provider>);
  };

  it("renders", () => {
    const wrapper = mountComponent();
    wrapper.unmount();
  });

  it("Terrain toggle", () => {
    const component = mountComponent();

    const quantityNumericInputs = component.find(QuantityNumberInput);

    // Make sure groundBias is NOT disabled
    // Note: Ideally I would use a CSS selector instead of searching html, but could not find any that would work.
    expect(quantityNumericInputs.at(getQuantityNumericInputIndex("groundBias")).find("input").html().includes("disabled")).to.be.false;

    // terrainOrigin is disabled initially
    expect(quantityNumericInputs.at(getQuantityNumericInputIndex("terrainOrigin")).find("input").html().includes("disabled")).to.be.true;

    // exaggeration is disabled initially
    const numericInputs = component.find(NumberInput);
    expect(numericInputs.at(0).find("input").html().includes("disabled")).to.be.true;

    // Make sure the 'useDepthBuffer' toggle is NOT disabled
    let toggles = component.find(ToggleSwitch);

    // Elevation type should be disabled initially
    let select = component.find(Select);
    expect(select.props().disabled).to.be.true;

    expect(toggles.at(getToggleIndex("depthBuffer")).find(".iui-disabled").exists()).to.be.false;

    // 'changeBackgroundMapProps' should not have been called before terrain is toggled
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // Toggle 'enable' terrain
    toggles.at(getToggleIndex("terrain")).find("input").simulate("change", {target: { checked: true }});
    component.update();

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.once());

    // 'useDepthBuffer' toggle should now be disabled
    toggles = component.find(ToggleSwitch);
    expect(toggles.at(getToggleIndex("depthBuffer")).find(".iui-disabled").exists()).to.be.true;

    const quantityInputs = component.find(QuantityNumberInput);
    // Make sure groundBias is now disabled
    expect(quantityInputs.at(getQuantityNumericInputIndex("groundBias")).find("input").html().includes("disabled")).to.be.true;

    // terrainOrigin and exaggeration should be enable after terrain was toggled
    expect(quantityInputs.at(getQuantityNumericInputIndex("terrainOrigin")).find("input").html().includes("disabled")).to.be.false;

    // terrainOrigin and exaggeration should be enable after terrain was toggled
    expect(numericInputs.at(0).find("input").html().includes("disabled")).to.be.false;

    // Elevation type should be enabled
    select = component.find(Select);
    expect(select.props().disabled).to.be.false;
    component.unmount();
  });

  it("Transparency slider", () => {
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    const component = mountComponent();

    const sliders = component.find(".iui-slider-thumb");
    sliders.at(0).simulate("keydown", { key: SpecialKey.ArrowRight });
    viewportMock.verify((x) => x.changeBackgroundMapProps({ transparency: 0.01 }), moq.Times.once());
    component.unmount();
  });

  it("Mask Transparency slider", () => {
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    const component = mountComponent();

    let sliders = component.find(".iui-slider-thumb");

    // Make sure the slider is disabled by default
    expect(sliders.at(1).props()["aria-disabled"]).to.be.true;

    // Turn on the mask toggle
    const toggles = component.find(ToggleSwitch);
    toggles.at(getToggleIndex("mask")).find("input").simulate("change", {target: { checked: true }});
    toggles.at(getToggleIndex("overrideMaskTransparency")).find("input").simulate("change", {target: { checked: true }});

    component.update();

    // Make sure the slider is now enabled
    sliders = component.find(".iui-slider-thumb");
    expect(sliders.at(1).props()["aria-disabled"]).to.be.false;

    sliders.at(0).simulate("keydown", { key: SpecialKey.ArrowUp });

    viewportMock.verify((x) => x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: 0 } }), moq.Times.once());
    component.unmount();
  });

  it("Locatable toggle", () => {
    const component = mountComponent();
    const toggles = component.find(ToggleSwitch);

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    toggles.at(getToggleIndex("locatable")).find("input").simulate("change", {target: { checked: false }});
    component.update();

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify((x) => x.changeBackgroundMapProps({ nonLocatable: true }), moq.Times.once());
    component.unmount();
  });

  it("Mask toggle", () => {

    const component = mountComponent();

    const toggles = component.find(ToggleSwitch);

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    toggles.at(getToggleIndex("mask")).find("input").simulate("change", {target: { checked: true }});
    component.update();

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify((x) => x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: undefined } }), moq.Times.once());

    toggles.at(getToggleIndex("mask")).find("input").simulate("change", {target: { checked: false }});
    component.update();

    viewportMock.verify((x) => x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.None } }), moq.Times.once());
    component.unmount();
  });

  it("Override Mask Transparency Toggle", () => {
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    const component = mountComponent();

    let toggles = component.find(ToggleSwitch);

    // By default, the toggle should be disabled
    expect(toggles.at(getToggleIndex("overrideMaskTransparency")).find(".iui-disabled").exists()).to.be.true;

    // First turn ON the masking toggle
    toggles.at(getToggleIndex("mask")).find("input").simulate("change", {target: { checked: true }});
    component.update();

    toggles = component.find(ToggleSwitch);

    // Toggle should be enabled now
    expect(toggles.at(getToggleIndex("overrideMaskTransparency")).find(".iui-disabled").exists()).to.be.false;

    // .. then we can turn ON the override mask transparency
    toggles.at(getToggleIndex("overrideMaskTransparency")).find("input").simulate("change", {target: { checked: true }});
    component.update();

    // 'changeBackgroundMapProps' should have been called once now
    viewportMock.verify((x) => x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: 0 } }), moq.Times.once());

    // turn if OFF again
    toggles.at(getToggleIndex("overrideMaskTransparency")).find("input").simulate("change", {target: { checked: false }});
    component.update();

    viewportMock.verify((x) => x.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: undefined } }), moq.Times.exactly(2));
    component.unmount();
  });

  it("ground bias", () => {
    const component = mountComponent();
    const numericInputs = component.find(QuantityNumberInput);

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());
    const oneStepIncrementValue = 1; // 1 foot
    const oneStepFiredValue = oneStepIncrementValue*0.3048; // .. in meters

    changeNumericInputValue(numericInputs.at(getQuantityNumericInputIndex("groundBias")), oneStepIncrementValue);
    viewportMock.verify((x) => x.changeBackgroundMapProps({ groundBias: oneStepFiredValue }), moq.Times.once());
    component.unmount();
  });

  it("terrainOrigin", () => {
    const component = mountComponent();
    const numericInputs = component.find(QuantityNumberInput);
    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn on the 'terrain' toggle then change the input value
    const toggles = component.find(ToggleSwitch);
    toggles.at(getToggleIndex("terrain")).find("input").simulate("change", {target: { checked: true }});

    const oneStepIncrementValue = 1; // 1 foot
    const oneStepFiredValue = oneStepIncrementValue*0.3048; // .. in meters

    changeNumericInputValue(numericInputs.at(getQuantityNumericInputIndex("terrainOrigin")), oneStepIncrementValue);

    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { heightOrigin: oneStepFiredValue } }), moq.Times.once());
    component.unmount();
  });

  it("exaggeration", () => {
    const component = mountComponent();
    const numericInputs = component.find(NumberInput);

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn ON the 'terrain' toggle then change the input value
    const toggles = component.find(ToggleSwitch);
    toggles.at(getToggleIndex("terrain")).find("input").simulate("change", {target: { checked: true }});
    changeNumericInputValue(numericInputs.at(0), 1);

    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { exaggeration: 1 } }), moq.Times.once());
    component.unmount();
  });

  it("heightOriginMode geoid", () => {
    const component = mountComponent();

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn ON the 'terrain' toggle then change the combo box value
    const toggles = component.find(ToggleSwitch);
    toggles.at(getToggleIndex("terrain")).find("input").simulate("change", {target: { checked: true }});

    const select = component.find(Select);
    select.props().onChange!("geoid");
    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geoid } }), moq.Times.once());
    component.unmount();
  });

  it("heightOriginMode geodetic", () => {
    const component = mountComponent();

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn ON the 'terrain' toggle then change the combo box value
    const toggles = component.find(ToggleSwitch);
    toggles.at(getToggleIndex("terrain")).find("input").simulate("change", {target: { checked: true }});

    const select = component.find(Select);
    select.props().onChange!("geodetic");
    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geodetic } }), moq.Times.once());
    component.unmount();
  });

  it("heightOriginMode ground", () => {
    const component = mountComponent();

    viewportMock.verify((x) => x.changeBackgroundMapProps(moq.It.isAny()), moq.Times.never());

    // turn ON the 'terrain' toggle then change the combo box value
    const toggles = component.find(ToggleSwitch);
    toggles.at(getToggleIndex("terrain")).find("input").simulate("change", {target: { checked: true }});

    const select = component.find(Select);
    select.props().onChange!("ground");
    viewportMock.verify((x) => x.changeBackgroundMapProps({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Ground } }), moq.Times.once());
    component.unmount();
  });
});

