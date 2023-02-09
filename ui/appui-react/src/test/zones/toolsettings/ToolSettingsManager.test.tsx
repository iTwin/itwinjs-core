/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import {
  DialogItem, DialogItemValue, DialogPropertySyncItem, PropertyDescription, PropertyEditorParamTypes, SuppressLabelEditorParams,
} from "@itwin/appui-abstract";
import { SyncToolSettingsPropertiesEventArgs, SyncUiEventDispatcher, ToolSettingsManager } from "../../../appui-react";
import TestUtils, { createStaticInternalPassthroughValidators } from "../../TestUtils";
import { InternalToolSettingsManager } from "../../../appui-react/zones/toolsettings/InternalToolSettingsManager";

// cSpell:Ignore USELENGTH

describe("InternalToolSettingsManager", () => {
  const testToolId = "InternalToolSettingsManager-TestTool";
  const testToolLabel = "TestTool";
  const testToolDescription = "TestToolDescription";
  const useLengthName = "use-length";

  const useLengthDescription: PropertyDescription = {
    name: useLengthName,
    displayLabel: "TEST-USELENGTH",
    typename: "boolean",
    editor: {
      params: [{ type: PropertyEditorParamTypes.SuppressEditorLabel } as SuppressLabelEditorParams],
    },
  };

  const lengthDescription: PropertyDescription = {
    name: "length",
    displayLabel: "TEST-LENGTH",
    typename: "string",
  };

  const enumDescription: PropertyDescription = {
    displayLabel: "TEST-ENUM-PICKER",
    name: "test-enum",
    typename: "enum",
    enum: {
      choices: [
        { label: "Yellow", value: 0 },
        { label: "Red", value: 1 },
        { label: "Green", value: 2 },
        { label: "Blue", value: 3 },
      ],
      isStrict: false,
    },
  };

  before(async () => {
    await TestUtils.initializeUiFramework();
    await NoRenderApp.startup();
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  it("check initial values", () => {
    expect(InternalToolSettingsManager.useDefaultToolSettingsProvider).to.be.false;
    expect(InternalToolSettingsManager.toolSettingsProperties).to.be.empty;
  });

  it("simulate a tool starting", () => {
    const toolSettingsProperties: DialogItem[] = [];
    const useLengthValue: DialogItemValue = { value: false };
    const lengthValue: DialogItemValue = { value: 1.2345, displayValue: "1.2345" };
    const enumValue: DialogItemValue = { value: "1" };

    toolSettingsProperties.push({ value: useLengthValue, property: useLengthDescription, editorPosition: { rowPriority: 0, columnIndex: 1 } });
    toolSettingsProperties.push({ value: lengthValue, property: lengthDescription, editorPosition: { rowPriority: 0, columnIndex: 3 } });
    toolSettingsProperties.push({ value: enumValue, property: enumDescription, editorPosition: { rowPriority: 1, columnIndex: 3 } });
    InternalToolSettingsManager.initializeToolSettingsData(toolSettingsProperties, testToolId, testToolLabel, testToolDescription);

    // override the property getter to return the properties needed for the test
    const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(InternalToolSettingsManager, "toolSettingsProperties")!;
    Object.defineProperty(InternalToolSettingsManager, "toolSettingsProperties", {
      get: () => toolSettingsProperties,
    });

    expect(InternalToolSettingsManager.useDefaultToolSettingsProvider).to.be.true;
    expect(InternalToolSettingsManager.toolSettingsProperties.length).to.equal(toolSettingsProperties.length);
    expect(InternalToolSettingsManager.activeToolLabel).to.eq(testToolLabel);
    expect(InternalToolSettingsManager.activeToolDescription).to.eq(testToolDescription);

    // restore the overriden property getter
    Object.defineProperty(InternalToolSettingsManager, "toolSettingsProperties", propertyDescriptorToRestore);

    InternalToolSettingsManager.clearToolSettingsData();
    expect(InternalToolSettingsManager.useDefaultToolSettingsProvider).to.be.false;
    expect(InternalToolSettingsManager.toolSettingsProperties).to.be.empty;
    expect(InternalToolSettingsManager.activeToolLabel).to.be.empty;
    expect(InternalToolSettingsManager.activeToolDescription).to.be.empty;
  });

  it("should handle no tool settings", () => {
    const toolSettingsProperties: DialogItem[] = [];
    const result = InternalToolSettingsManager.initializeToolSettingsData(toolSettingsProperties);
    expect(result).to.be.false;
  });

  it("should support setting active tool label", () => {
    const label = "Test Label";
    InternalToolSettingsManager.activeToolLabel = label;
    expect(InternalToolSettingsManager.activeToolLabel).to.eq(label);
  });

  it("handleSyncToolSettingsPropertiesEvent", () => {
    let eventCalled = false;
    const useLengthValue: DialogItemValue = { value: false };

    const syncItem: DialogPropertySyncItem = { value: useLengthValue, propertyName: useLengthName, isDisabled: false };

    const handleSyncToolSettingsPropertiesEvent = (args: SyncToolSettingsPropertiesEventArgs): void => {
      eventCalled = true;
      expect(args.toolId).to.be.equal(testToolId);
      expect(args.syncProperties.length).to.be.equal(1);
      expect(args.syncProperties[0].propertyName).to.be.equal(useLengthName);
    };

    InternalToolSettingsManager.onSyncToolSettingsProperties.addListener(handleSyncToolSettingsPropertiesEvent);
    expect(eventCalled).to.be.false;
    const syncArgs = { toolId: testToolId, syncProperties: [syncItem] } as SyncToolSettingsPropertiesEventArgs;
    InternalToolSettingsManager.onSyncToolSettingsProperties.emit(syncArgs);
    expect(eventCalled).to.be.true;
    InternalToolSettingsManager.onSyncToolSettingsProperties.removeListener(handleSyncToolSettingsPropertiesEvent);
    eventCalled = false;
    InternalToolSettingsManager.onSyncToolSettingsProperties.emit(syncArgs);
    expect(eventCalled).to.be.false;
    InternalToolSettingsManager.onReloadToolSettingsProperties.emit();
    expect(eventCalled).to.be.false;
  });

  it("handleSyncToolSettingsPropertiesEvent", () => {
    let eventCalled = false;

    const handleReloadToolSettingsPropertiesEvent = (): void => {
      eventCalled = true;
    };

    InternalToolSettingsManager.onReloadToolSettingsProperties.addListener(handleReloadToolSettingsPropertiesEvent);
    expect(eventCalled).to.be.false;
    InternalToolSettingsManager.onReloadToolSettingsProperties.emit();
    expect(eventCalled).to.be.true;
    InternalToolSettingsManager.onReloadToolSettingsProperties.removeListener(handleReloadToolSettingsPropertiesEvent);
    eventCalled = false;
    InternalToolSettingsManager.onReloadToolSettingsProperties.emit();
    expect(eventCalled).to.be.false;
  });

  it("handleDispatchSyncUiEvent", () => {
    InternalToolSettingsManager.initialize();
    const immediateStub = sinon.stub(SyncUiEventDispatcher, "dispatchImmediateSyncUiEvent");
    const timerStub = sinon.stub(SyncUiEventDispatcher, "dispatchSyncUiEvent");
    IModelApp.toolAdmin.dispatchUiSyncEvent("test1");
    timerStub.calledOnce.should.be.true;

    IModelApp.toolAdmin.dispatchImmediateUiSyncEvent("test2");
    immediateStub.calledOnce.should.be.true;
  });

  describe("focusIntoToolSettings", () => {
    it("should return false if no ToolSettings div found", async () => {
      render(<div data-testid="div"></div>);
      expect(InternalToolSettingsManager.focusIntoToolSettings()).to.be.false;
    });

    it("should return true if focusable item in docked ToolSettings", async () => {
      render(<div className="nz-toolSettings-docked"><button /></div>);
      expect(InternalToolSettingsManager.focusIntoToolSettings()).to.be.true;
    });

    it("should return false if no focusable item in docked ToolSettings", async () => {
      render(<div className="nz-toolSettings-docked"></div>);
      expect(InternalToolSettingsManager.focusIntoToolSettings()).to.be.false;
    });

    it("should return true if focusable item in floating ToolSettings", async () => {
      render(<div className="uifw-tool-settings-grid-container"><button /></div>);
      expect(InternalToolSettingsManager.focusIntoToolSettings()).to.be.true;
    });

    it("should return false if no focusable item in floating ToolSettings", async () => {
      render(<div className="uifw-tool-settings-grid-container"></div>);
      expect(InternalToolSettingsManager.focusIntoToolSettings()).to.be.false;
    });

    // NEEDSWORK - need tests with real Tool Settings for V1 & V2
  });

  it("calls Internal static for everything", () => {
    const [validateMethod, validateProp] = createStaticInternalPassthroughValidators(ToolSettingsManager, InternalToolSettingsManager); // eslint-disable-line deprecation/deprecation

    validateMethod("clearToolSettingsData");
    validateMethod("focusIntoToolSettings");
    validateMethod("initialize");
    validateMethod("initializeDataForTool", {} as any);
    validateMethod("initializeToolSettingsData", {} as any, "id", "label", "description");
    validateProp("activeToolDescription");
    validateProp("activeToolLabel", true);
    validateProp("onReloadToolSettingsProperties");
    validateProp("onSyncToolSettingsProperties");
    validateProp("toolIdForToolSettings");
    validateProp("toolSettingsProperties");
    validateProp("useDefaultToolSettingsProvider", true);
  });

});
