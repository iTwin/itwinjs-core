/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { render, cleanup } from "@testing-library/react";

import TestUtils from "../../TestUtils";
import { ConfigurableUiManager, FrontstageManager, FrontstageProvider, Frontstage, Zone, Widget, FrontstageProps, CoreTools, ToolUiManager, SyncToolSettingsPropertiesEventArgs } from "../../../ui-framework";
import { ToolSettingsValue, ToolSettingsPropertyRecord, PrimitiveValue, PropertyDescription, PropertyEditorParamTypes, SuppressLabelEditorParams, ToolSettingsPropertySyncItem, ButtonGroupEditorParams } from "@bentley/imodeljs-frontend";

describe("DefaultToolUiSettingsProvider", () => {

  const firstToolId = "DefaultToolUiSettingsProvider-FirstTestTool";
  const testToolId = "DefaultToolUiSettingsProvider-TestTool";
  const useLengthDescription: PropertyDescription = {
    name: "use-length",
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
  const testEnumDescription1: PropertyDescription = {
    name: "buttongroup1",
    displayLabel: "",
    typename: "enum",
    editor: {
      name: "enum-buttongroup",
      params: [
        {
          type: PropertyEditorParamTypes.ButtonGroupData,
          buttons: [
            { iconSpec: "testIconOne"},
            { iconSpec: "testIconTwo"},
          ],
        } as ButtonGroupEditorParams,
        {
          type: PropertyEditorParamTypes.SuppressEditorLabel,
          suppressLabelPlaceholder: true,
        } as SuppressLabelEditorParams,
      ],
    },
    enum: {
      choices: [
        { label: "Choice 1", value: 10},
        { label: "Choice 2", value: 20},
      ],
    },
  };

  const testEnumDescription2: PropertyDescription = {
    name: "buttongroup2",
    displayLabel: "",
    typename: "enum",
    editor: {
      name: "enum-buttongroup",
      params: [
        {
          type: PropertyEditorParamTypes.ButtonGroupData,
          buttons: [
            { iconSpec: "plusOne"},
            { iconSpec: "plusTwo"},
            { iconSpec: "plusThree"},
          ],
        } as ButtonGroupEditorParams,
        {
          type: PropertyEditorParamTypes.SuppressEditorLabel,
          suppressLabelPlaceholder: true,
        } as SuppressLabelEditorParams,
      ],
    },
    enum: {
      choices: [
        { label: "Plus 1", value: 100},
        { label: "Plus 2", value: 200},
        { label: "Plus 3", value: 300},
      ],
    },
  };

  const methodsDescription: PropertyDescription = {
      name: "methods",
      displayLabel: "",
      typename: "enum",
      editor: {
        name: "enum-buttongroup",
        params: [
          {
            type: PropertyEditorParamTypes.ButtonGroupData,
            buttons: [
              { iconSpec: "icon-select-single" },
              { iconSpec: "icon-select-line" },
              { iconSpec: "icon-select-box" },
            ],
          } as ButtonGroupEditorParams,
          {
            type: PropertyEditorParamTypes.SuppressEditorLabel,
            suppressLabelPlaceholder: true,
          } as SuppressLabelEditorParams,
        ],
      },
      enum: {
        choices: [
          { label: "Pick", value: 0 },
          { label: "Line", value: 1 },
          { label: "Box", value: 2 },
        ],
      },
    };

  afterEach(cleanup);

  before(async () => {
    await TestUtils.initializeUiFramework();

    class Frontstage1 extends FrontstageProvider {
      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id="ToolUiProvider-TestFrontstage"
            defaultTool={CoreTools.selectElementCommand}
            defaultLayout="FourQuadrants"
            contentGroup="TestContentGroup1"
            topCenter={
              <Zone
                widgets={[
                  <Widget isToolSettings={true} />,
                ]}
              />
            }
          />
        );
      }
    }

    const frontstageProvider = new Frontstage1();
    ConfigurableUiManager.addFrontstageProvider(frontstageProvider);
    ToolUiManager.useDefaultToolSettingsProvider = false;
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("starting a tool with undefined tool settings", async () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;
    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises

      FrontstageManager.ensureToolInformationIsSet(firstToolId);

      // If a tool does not define toolSettingsProperties then useDefaultToolSettingsProvider should be false, but make sure we can gracefully handle
      // case where useDefaultToolSettingsProvider is true but toolSettingsProperties are not defined.
      ToolUiManager.useDefaultToolSettingsProvider = true;

      FrontstageManager.setActiveToolId(firstToolId);
      expect(FrontstageManager.activeToolId).to.eq(firstToolId);

      const toolInformation = FrontstageManager.activeToolInformation;
      expect(toolInformation).to.not.be.undefined;

      if (toolInformation) {
        const toolUiProvider = toolInformation.toolUiProvider;
        expect(toolUiProvider).to.be.undefined;
      }
    }
  });

  it("starting a tool with tool settings", async () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises

      const toolSettingsProperties: ToolSettingsPropertyRecord[] = [];
      const useLengthValue = new ToolSettingsValue(false);
      const lengthValue = new ToolSettingsValue(1.2345, "1.2345");
      const enumValue = new ToolSettingsValue("1");
      const methodsValue = new ToolSettingsValue (0);
      const groupOneValue = new ToolSettingsValue (10);
      const groupTwoValue = new ToolSettingsValue (100);

      toolSettingsProperties.push(new ToolSettingsPropertyRecord(useLengthValue.clone() as PrimitiveValue, useLengthDescription, { rowPriority: 0, columnIndex: 1 }));
      toolSettingsProperties.push(new ToolSettingsPropertyRecord(lengthValue.clone() as PrimitiveValue, lengthDescription, { rowPriority: 0, columnIndex: 3 }));
      toolSettingsProperties.push(new ToolSettingsPropertyRecord(enumValue.clone() as PrimitiveValue, enumDescription, { rowPriority: 1, columnIndex: 3 }));
      toolSettingsProperties.push(new ToolSettingsPropertyRecord(methodsValue.clone() as PrimitiveValue, methodsDescription, { rowPriority: 2, columnIndex: 1 }));
      toolSettingsProperties.push(new ToolSettingsPropertyRecord(groupOneValue.clone() as PrimitiveValue, testEnumDescription1, { rowPriority: 3, columnIndex: 1 }));
      toolSettingsProperties.push(new ToolSettingsPropertyRecord(groupTwoValue.clone() as PrimitiveValue, testEnumDescription2, { rowPriority: 3, columnIndex: 2 }));
      ToolUiManager.initializeToolSettingsData(toolSettingsProperties, testToolId, "testToolLabel", "testToolDescription");

      // override the property getter to return the properties needed for the test
      const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(ToolUiManager, "toolSettingsProperties")!;
      Object.defineProperty(ToolUiManager, "toolSettingsProperties", {
        get: () => toolSettingsProperties,
      });

      expect(ToolUiManager.useDefaultToolSettingsProvider).to.be.true;
      expect(ToolUiManager.toolSettingsProperties.length).to.equal(toolSettingsProperties.length);
      FrontstageManager.ensureToolInformationIsSet(testToolId);
      FrontstageManager.setActiveToolId(testToolId);
      expect(FrontstageManager.activeToolId).to.eq(testToolId);

      const toolInformation = FrontstageManager.activeToolInformation;
      expect(toolInformation).to.not.be.undefined;

      if (toolInformation) {
        const toolUiProvider = toolInformation.toolUiProvider;
        expect(toolUiProvider).to.not.be.undefined;

        if (toolUiProvider) {
          expect(toolUiProvider.toolSettingsNode).to.not.be.undefined;
        }
      }

      const toolSettingsNode = FrontstageManager.activeToolSettingsNode;
      expect(toolSettingsNode).to.not.be.undefined;

      const renderedComponent = render(toolSettingsNode as React.ReactElement<any>);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();

      expect(renderedComponent.queryByText("TEST-USELENGTH:")).to.be.null;

      const toggleEditor = renderedComponent.getByTestId("components-checkbox-editor");
      expect(toggleEditor).not.to.be.undefined;

      const textLabel = renderedComponent.getByText("TEST-LENGTH:");
      expect(textLabel).not.to.be.undefined;

      const textEditor = renderedComponent.getByTestId("components-text-editor");
      expect(textEditor).not.to.be.undefined;

      const enumLabel = renderedComponent.getByText("TEST-ENUM-PICKER:");
      expect(enumLabel).not.to.be.undefined;

      const enumEditor = renderedComponent.getByTestId("components-select-editor");
      expect(enumEditor).not.to.be.undefined;

      const buttonGroupEnumButton = renderedComponent.getByTestId("Pick");
      expect(buttonGroupEnumButton).not.to.be.undefined;

      const buttonGroup1EnumButton = renderedComponent.getByTestId("Choice 1");
      expect(buttonGroup1EnumButton).not.to.be.undefined;

      const buttonGroup2EnumButton = renderedComponent.getByTestId("Plus 1");
      expect(buttonGroup2EnumButton).not.to.be.undefined;

      // simulate sync from tool
      const newUseLengthValue = new ToolSettingsValue(false);
      const syncItem = new ToolSettingsPropertySyncItem(newUseLengthValue, useLengthDescription.name, false);
      const syncArgs = { toolId: testToolId, syncProperties: [syncItem] } as SyncToolSettingsPropertiesEventArgs;
      ToolUiManager.onSyncToolSettingsProperties.emit(syncArgs);

      // restore the overriden property getter
      Object.defineProperty(ToolUiManager, "toolSettingsProperties", propertyDescriptorToRestore);
    }
  });

  it("starting a tool with nested lock toggle in tool settings", async () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises

      const toolSettingsProperties: ToolSettingsPropertyRecord[] = [];
      const useLengthValue = new ToolSettingsValue(false);
      const lengthValue = new ToolSettingsValue(1.2345, "1.2345");

      const lockToggle = new ToolSettingsPropertyRecord(useLengthValue.clone() as PrimitiveValue, useLengthDescription, { rowPriority: 0, columnIndex: 1 });
      toolSettingsProperties.push(new ToolSettingsPropertyRecord(lengthValue.clone() as PrimitiveValue, lengthDescription, { rowPriority: 0, columnIndex: 3 }, false, lockToggle));
      ToolUiManager.initializeToolSettingsData(toolSettingsProperties, testToolId, "testToolLabel", "testToolDescription");

      // override the property getter to return the properties needed for the test
      const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(ToolUiManager, "toolSettingsProperties")!;
      Object.defineProperty(ToolUiManager, "toolSettingsProperties", {
        get: () => toolSettingsProperties,
      });

      expect(ToolUiManager.useDefaultToolSettingsProvider).to.be.true;
      expect(ToolUiManager.toolSettingsProperties.length).to.equal(toolSettingsProperties.length);
      FrontstageManager.ensureToolInformationIsSet(testToolId);
      FrontstageManager.setActiveToolId(testToolId);
      expect(FrontstageManager.activeToolId).to.eq(testToolId);

      const toolInformation = FrontstageManager.activeToolInformation;
      expect(toolInformation).to.not.be.undefined;

      if (toolInformation) {
        const toolUiProvider = toolInformation.toolUiProvider;
        expect(toolUiProvider).to.not.be.undefined;

        if (toolUiProvider) {
          expect(toolUiProvider.toolSettingsNode).to.not.be.undefined;
        }
      }

      const toolSettingsNode = FrontstageManager.activeToolSettingsNode;
      expect(toolSettingsNode).to.not.be.undefined;

      const renderedComponent = render(toolSettingsNode as React.ReactElement<any>);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();

      expect(renderedComponent.queryByText("TEST-USELENGTH:")).to.be.null;

      const toggleEditor = renderedComponent.getByTestId("components-checkbox-editor");
      expect(toggleEditor).not.to.be.undefined;

      const textLabel = renderedComponent.getByText("TEST-LENGTH:");
      expect(textLabel).not.to.be.undefined;

      const textEditor = renderedComponent.getByTestId("components-text-editor");
      expect(textEditor).not.to.be.undefined;

      // simulate sync from tool
      const newUseLengthValue = new ToolSettingsValue(false);
      const syncItem = new ToolSettingsPropertySyncItem(newUseLengthValue, useLengthDescription.name, false);
      const syncArgs = { toolId: testToolId, syncProperties: [syncItem] } as SyncToolSettingsPropertiesEventArgs;
      ToolUiManager.onSyncToolSettingsProperties.emit(syncArgs);

      // restore the overriden property getter
      Object.defineProperty(ToolUiManager, "toolSettingsProperties", propertyDescriptorToRestore);
    }
  });

});
