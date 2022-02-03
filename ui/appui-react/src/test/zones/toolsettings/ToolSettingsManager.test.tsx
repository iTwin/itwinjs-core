/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import type {
  DialogItem, DialogItemValue, DialogPropertySyncItem, PropertyDescription, SuppressLabelEditorParams} from "@itwin/appui-abstract";
import { PropertyEditorParamTypes,
} from "@itwin/appui-abstract";
import type { SyncToolSettingsPropertiesEventArgs} from "../../../appui-react";
import { SyncUiEventDispatcher, ToolSettingsManager } from "../../../appui-react";
import TestUtils from "../../TestUtils";

// cSpell:Ignore USELENGTH

describe("ToolSettingsManager", () => {
  const testToolId = "ToolSettingsManager-TestTool";
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
    expect(ToolSettingsManager.useDefaultToolSettingsProvider).to.be.false;
    expect(ToolSettingsManager.toolSettingsProperties).to.be.empty;
  });

  it("simulate a tool starting", () => {
    const toolSettingsProperties: DialogItem[] = [];
    const useLengthValue: DialogItemValue = { value: false };
    const lengthValue: DialogItemValue = { value: 1.2345, displayValue: "1.2345" };
    const enumValue: DialogItemValue = { value: "1" };

    toolSettingsProperties.push({ value: useLengthValue, property: useLengthDescription, editorPosition: { rowPriority: 0, columnIndex: 1 } });
    toolSettingsProperties.push({ value: lengthValue, property: lengthDescription, editorPosition: { rowPriority: 0, columnIndex: 3 } });
    toolSettingsProperties.push({ value: enumValue, property: enumDescription, editorPosition: { rowPriority: 1, columnIndex: 3 } });
    ToolSettingsManager.initializeToolSettingsData(toolSettingsProperties, testToolId, testToolLabel, testToolDescription);

    // override the property getter to return the properties needed for the test
    const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(ToolSettingsManager, "toolSettingsProperties")!;
    Object.defineProperty(ToolSettingsManager, "toolSettingsProperties", {
      get: () => toolSettingsProperties,
    });

    expect(ToolSettingsManager.useDefaultToolSettingsProvider).to.be.true;
    expect(ToolSettingsManager.toolSettingsProperties.length).to.equal(toolSettingsProperties.length);
    expect(ToolSettingsManager.activeToolLabel).to.eq(testToolLabel);
    expect(ToolSettingsManager.activeToolDescription).to.eq(testToolDescription);

    // restore the overriden property getter
    Object.defineProperty(ToolSettingsManager, "toolSettingsProperties", propertyDescriptorToRestore);

    ToolSettingsManager.clearToolSettingsData();
    expect(ToolSettingsManager.useDefaultToolSettingsProvider).to.be.false;
    expect(ToolSettingsManager.toolSettingsProperties).to.be.empty;
    expect(ToolSettingsManager.activeToolLabel).to.be.empty;
    expect(ToolSettingsManager.activeToolDescription).to.be.empty;
  });

  it("should handle no tool settings", () => {
    const toolSettingsProperties: DialogItem[] = [];
    const result = ToolSettingsManager.initializeToolSettingsData(toolSettingsProperties);
    expect(result).to.be.false;
  });

  it("should support setting active tool label", () => {
    const label = "Test Label";
    ToolSettingsManager.activeToolLabel = label;
    expect(ToolSettingsManager.activeToolLabel).to.eq(label);
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

    ToolSettingsManager.onSyncToolSettingsProperties.addListener(handleSyncToolSettingsPropertiesEvent);
    expect(eventCalled).to.be.false;
    const syncArgs = { toolId: testToolId, syncProperties: [syncItem] } as SyncToolSettingsPropertiesEventArgs;
    ToolSettingsManager.onSyncToolSettingsProperties.emit(syncArgs);
    expect(eventCalled).to.be.true;
    ToolSettingsManager.onSyncToolSettingsProperties.removeListener(handleSyncToolSettingsPropertiesEvent);
    eventCalled = false;
    ToolSettingsManager.onSyncToolSettingsProperties.emit(syncArgs);
    expect(eventCalled).to.be.false;
    ToolSettingsManager.onReloadToolSettingsProperties.emit();
    expect(eventCalled).to.be.false;
  });

  it("handleSyncToolSettingsPropertiesEvent", () => {
    let eventCalled = false;

    const handleReloadToolSettingsPropertiesEvent = (): void => {
      eventCalled = true;
    };

    ToolSettingsManager.onReloadToolSettingsProperties.addListener(handleReloadToolSettingsPropertiesEvent);
    expect(eventCalled).to.be.false;
    ToolSettingsManager.onReloadToolSettingsProperties.emit();
    expect(eventCalled).to.be.true;
    ToolSettingsManager.onReloadToolSettingsProperties.removeListener(handleReloadToolSettingsPropertiesEvent);
    eventCalled = false;
    ToolSettingsManager.onReloadToolSettingsProperties.emit();
    expect(eventCalled).to.be.false;
  });

  it("handleDispatchSyncUiEvent", () => {
    ToolSettingsManager.initialize();
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
      expect(ToolSettingsManager.focusIntoToolSettings()).to.be.false;
    });

    it("should return true if focusable item in docked ToolSettings", async () => {
      render(<div className="nz-toolSettings-docked"><button /></div>);
      expect(ToolSettingsManager.focusIntoToolSettings()).to.be.true;
    });

    it("should return false if no focusable item in docked ToolSettings", async () => {
      render(<div className="nz-toolSettings-docked"></div>);
      expect(ToolSettingsManager.focusIntoToolSettings()).to.be.false;
    });

    it("should return true if focusable item in floating ToolSettings", async () => {
      render(<div className="uifw-tool-settings-grid-container"><button /></div>);
      expect(ToolSettingsManager.focusIntoToolSettings()).to.be.true;
    });

    it("should return false if no focusable item in floating ToolSettings", async () => {
      render(<div className="uifw-tool-settings-grid-container"></div>);
      expect(ToolSettingsManager.focusIntoToolSettings()).to.be.false;
    });

    // NEEDSWORK - need tests with real Tool Settings for V1 & V2
  });

});
