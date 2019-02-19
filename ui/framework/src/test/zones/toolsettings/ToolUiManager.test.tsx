/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";

import TestUtils from "../../TestUtils";
import { ToolUiManager, SyncToolSettingsPropertiesEventArgs } from "../../../ui-framework";
import {
  ToolSettingsValue, ToolSettingsPropertyRecord, PrimitiveValue, PropertyDescription, PropertyEditorParamTypes,
  SuppressLabelEditorParams, ToolSettingsPropertySyncItem,
} from "@bentley/imodeljs-frontend";

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
  });

  it("check initial values", () => {
    expect(ToolUiManager.useDefaultToolSettingsProvider).to.be.false;
    expect(ToolUiManager.toolSettingsProperties).to.be.empty;
  });

  it("simulate a tool starting", () => {
    const toolSettingsProperties: ToolSettingsPropertyRecord[] = [];
    const useLengthValue = new ToolSettingsValue(false);
    const lengthValue = new ToolSettingsValue(1.2345, "1.2345");
    const enumValue = new ToolSettingsValue("1");

    toolSettingsProperties.push(new ToolSettingsPropertyRecord(useLengthValue.clone() as PrimitiveValue, useLengthDescription, { rowPriority: 0, columnIndex: 1 }));
    toolSettingsProperties.push(new ToolSettingsPropertyRecord(lengthValue.clone() as PrimitiveValue, lengthDescription, { rowPriority: 0, columnIndex: 3 }));
    toolSettingsProperties.push(new ToolSettingsPropertyRecord(enumValue.clone() as PrimitiveValue, enumDescription, { rowPriority: 1, columnIndex: 3 }));
    ToolUiManager.cacheToolSettingsProperties(toolSettingsProperties, testToolId, testToolLabel, testToolDescription);

    expect(ToolUiManager.useDefaultToolSettingsProvider).to.be.true;
    expect(ToolUiManager.toolSettingsProperties.length).to.equal(toolSettingsProperties.length);
    expect(ToolUiManager.activeToolLabel).to.eq(testToolLabel);
    expect(ToolUiManager.activeToolDescription).to.eq(testToolDescription);

    ToolUiManager.clearCachedProperties();
    expect(ToolUiManager.useDefaultToolSettingsProvider).to.be.false;
    expect(ToolUiManager.toolSettingsProperties).to.be.empty;
    expect(ToolUiManager.activeToolLabel).to.be.empty;
    expect(ToolUiManager.activeToolDescription).to.be.empty;
  });

  it("handleSyncToolSettingsPropertiesEvent", () => {
    let eventCalled = false;
    const useLengthValue = new ToolSettingsValue(false);

    const syncItem = new ToolSettingsPropertySyncItem(useLengthValue, useLengthName, false);

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

});
