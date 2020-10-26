/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { IModelApp, NoRenderApp } from "@bentley/imodeljs-frontend";
import {
  DialogItem, DialogItemValue, DialogPropertySyncItem, PropertyDescription, PropertyEditorParamTypes, SuppressLabelEditorParams,
} from "@bentley/ui-abstract";
import { SyncToolSettingsPropertiesEventArgs, SyncUiEventDispatcher, ToolUiManager } from "../../../ui-framework";
import TestUtils from "../../TestUtils";

// cSpell:Ignore USELENGTH

describe("ToolUiManager", () => {
  const testToolId = "ToolUiManager-TestTool";
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
    expect(ToolUiManager.useDefaultToolSettingsProvider).to.be.false;
    expect(ToolUiManager.toolSettingsProperties).to.be.empty;
  });

  it("simulate a tool starting", () => {
    const toolSettingsProperties: DialogItem[] = [];
    const useLengthValue: DialogItemValue = { value: false };
    const lengthValue: DialogItemValue = { value: 1.2345, displayValue: "1.2345" };
    const enumValue: DialogItemValue = { value: "1" };

    toolSettingsProperties.push({ value: useLengthValue, property: useLengthDescription, editorPosition: { rowPriority: 0, columnIndex: 1 } });
    toolSettingsProperties.push({ value: lengthValue, property: lengthDescription, editorPosition: { rowPriority: 0, columnIndex: 3 } });
    toolSettingsProperties.push({ value: enumValue, property: enumDescription, editorPosition: { rowPriority: 1, columnIndex: 3 } });
    ToolUiManager.initializeToolSettingsData(toolSettingsProperties, testToolId, testToolLabel, testToolDescription);

    // override the property getter to return the properties needed for the test
    const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(ToolUiManager, "toolSettingsProperties")!;
    Object.defineProperty(ToolUiManager, "toolSettingsProperties", {
      get: () => toolSettingsProperties,
    });

    expect(ToolUiManager.useDefaultToolSettingsProvider).to.be.true;
    expect(ToolUiManager.toolSettingsProperties.length).to.equal(toolSettingsProperties.length);
    expect(ToolUiManager.activeToolLabel).to.eq(testToolLabel);
    expect(ToolUiManager.activeToolDescription).to.eq(testToolDescription);

    // restore the overriden property getter
    Object.defineProperty(ToolUiManager, "toolSettingsProperties", propertyDescriptorToRestore);

    ToolUiManager.clearToolSettingsData();
    expect(ToolUiManager.useDefaultToolSettingsProvider).to.be.false;
    expect(ToolUiManager.toolSettingsProperties).to.be.empty;
    expect(ToolUiManager.activeToolLabel).to.be.empty;
    expect(ToolUiManager.activeToolDescription).to.be.empty;
  });

  it("should handle no tool settings", () => {
    const toolSettingsProperties: DialogItem[] = [];
    const result = ToolUiManager.initializeToolSettingsData(toolSettingsProperties);
    expect(result).to.be.false;
  });

  it("should support setting active tool label", () => {
    const label = "Test Label";
    ToolUiManager.activeToolLabel = label;
    expect(ToolUiManager.activeToolLabel).to.eq(label);
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

    ToolUiManager.onSyncToolSettingsProperties.addListener(handleSyncToolSettingsPropertiesEvent);
    expect(eventCalled).to.be.false;
    const syncArgs = { toolId: testToolId, syncProperties: [syncItem] } as SyncToolSettingsPropertiesEventArgs;
    ToolUiManager.onSyncToolSettingsProperties.emit(syncArgs);
    expect(eventCalled).to.be.true;
    ToolUiManager.onSyncToolSettingsProperties.removeListener(handleSyncToolSettingsPropertiesEvent);
    eventCalled = false;
    ToolUiManager.onSyncToolSettingsProperties.emit(syncArgs);
    expect(eventCalled).to.be.false;
  });

  it("handleDispatchSyncUiEvent", () => {
    ToolUiManager.initialize();
    const immediateStub = sinon.stub(SyncUiEventDispatcher, "dispatchImmediateSyncUiEvent");
    const timerStub = sinon.stub(SyncUiEventDispatcher, "dispatchSyncUiEvent");
    IModelApp.toolAdmin.dispatchUiSyncEvent("test1");
    timerStub.calledOnce.should.be.true;

    IModelApp.toolAdmin.dispatchImmediateUiSyncEvent("test2");
    immediateStub.calledOnce.should.be.true;
  });
});
