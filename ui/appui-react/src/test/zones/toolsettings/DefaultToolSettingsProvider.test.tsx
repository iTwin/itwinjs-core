/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import {
  ButtonGroupEditorParams, DialogItem, DialogItemValue, DialogPropertySyncItem, PropertyDescription, PropertyEditorParamTypes,
  SuppressLabelEditorParams,
} from "@itwin/appui-abstract";
import { render } from "@testing-library/react";
import {
  ConfigurableUiManager, CoreTools, DefaultToolSettingsProvider, Frontstage, FrontstageManager, FrontstageProps, FrontstageProvider,
  SyncToolSettingsPropertiesEventArgs, ToolSettingsManager, Widget, Zone,
} from "../../../appui-react";
import TestUtils from "../../TestUtils";

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
            { iconSpec: "testIconOne" },
            { iconSpec: "testIconTwo" },
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
        { label: "Choice 1", value: 10 },
        { label: "Choice 2", value: 20 },
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
            { iconSpec: "plusOne" },
            { iconSpec: "plusTwo" },
            { iconSpec: "plusThree" },
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
        { label: "Plus 1", value: 100 },
        { label: "Plus 2", value: 200 },
        { label: "Plus 3", value: 300 },
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

  before(async () => {
    await TestUtils.initializeUiFramework();

    class Frontstage1 extends FrontstageProvider {
      public static stageId = "ToolUiProvider-TestFrontstage";
      public get id(): string {
        return Frontstage1.stageId;
      }

      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id={this.id}
            defaultTool={CoreTools.selectElementCommand}
            contentGroup={TestUtils.TestContentGroup1}
            topCenter={
              <Zone
                widgets={[
                  <Widget isToolSettings={true} />, // eslint-disable-line react/jsx-key
                ]}
              />
            }
          />
        );
      }
    }

    const frontstageProvider = new Frontstage1();
    ConfigurableUiManager.addFrontstageProvider(frontstageProvider);
    ToolSettingsManager.useDefaultToolSettingsProvider = false;
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("starting a tool with undefined tool settings", async () => {
    const frontstageDef = await FrontstageManager.getFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;
    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);

      FrontstageManager.ensureToolInformationIsSet(firstToolId);

      // If a tool does not define toolSettingsProperties then useDefaultToolSettingsProvider should be false, but make sure we can gracefully handle
      // case where useDefaultToolSettingsProvider is true but toolSettingsProperties are not defined.
      ToolSettingsManager.useDefaultToolSettingsProvider = true;

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
    const frontstageDef = await FrontstageManager.getFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);

      const toolSettingsProperties: DialogItem[] = [];
      const useLengthValue: DialogItemValue = { value: false };
      const lengthValue: DialogItemValue = { value: 1.2345, displayValue: "1.2345" };
      const enumValue: DialogItemValue = { value: "1" };
      const methodsValue: DialogItemValue = { value: 0 };
      const groupOneValue: DialogItemValue = { value: 10 };
      const groupTwoValue: DialogItemValue = { value: 100 };

      toolSettingsProperties.push({ value: useLengthValue, property: useLengthDescription, editorPosition: { rowPriority: 0, columnIndex: 1 } });
      toolSettingsProperties.push({ value: lengthValue, property: lengthDescription, editorPosition: { rowPriority: 0, columnIndex: 3 } });
      toolSettingsProperties.push({ value: enumValue, property: enumDescription, editorPosition: { rowPriority: 1, columnIndex: 3 } });
      toolSettingsProperties.push({ value: methodsValue, property: methodsDescription, editorPosition: { rowPriority: 2, columnIndex: 1 } });
      toolSettingsProperties.push({ value: groupOneValue, property: testEnumDescription1, editorPosition: { rowPriority: 3, columnIndex: 1 } });
      toolSettingsProperties.push({ value: groupTwoValue, property: testEnumDescription2, editorPosition: { rowPriority: 3, columnIndex: 2 }, isDisabled: true });
      ToolSettingsManager.initializeToolSettingsData(toolSettingsProperties, testToolId, "testToolLabel", "testToolDescription");

      // override the property getter to return the properties needed for the test
      const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(ToolSettingsManager, "toolSettingsProperties")!;
      Object.defineProperty(ToolSettingsManager, "toolSettingsProperties", {
        get: () => toolSettingsProperties,
      });

      expect(ToolSettingsManager.useDefaultToolSettingsProvider).to.be.true;
      expect(ToolSettingsManager.toolSettingsProperties.length).to.equal(toolSettingsProperties.length);
      FrontstageManager.ensureToolInformationIsSet(testToolId);
      FrontstageManager.setActiveToolId(testToolId);
      expect(FrontstageManager.activeToolId).to.eq(testToolId);

      const toolInformation = FrontstageManager.activeToolInformation;
      expect(toolInformation).to.not.be.undefined;

      if (toolInformation) {
        const toolSettingsProvider = toolInformation.toolUiProvider as DefaultToolSettingsProvider;
        expect(toolSettingsProvider).to.not.be.undefined;

        if (toolSettingsProvider) {
          const tsNode = toolSettingsProvider.toolSettingsNode;
          expect(tsNode).to.not.be.undefined;
        }
      }

      const toolSettingsNode = FrontstageManager.activeToolSettingsProvider?.toolSettingsNode;
      expect(toolSettingsNode).to.not.be.undefined;

      const renderedComponent = render(toolSettingsNode as React.ReactElement<any>);
      expect(renderedComponent).not.to.be.undefined;

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
      const newUseLengthValue: DialogItemValue = { value: false };
      const syncItem: DialogPropertySyncItem = { value: newUseLengthValue, propertyName: useLengthDescription.name, isDisabled: false };
      const syncArgs = { toolId: testToolId, syncProperties: [syncItem] } as SyncToolSettingsPropertiesEventArgs;
      // ToolSettingsManager.onSyncToolSettingsProperties.emit(syncArgs);
      FrontstageManager.activeToolSettingsProvider?.syncToolSettingsProperties(syncArgs);
      FrontstageManager.activeToolSettingsProvider?.reloadPropertiesFromTool();
      FrontstageManager.onToolSettingsReloadEvent.emit();
      // restore the overriden property getter
      Object.defineProperty(ToolSettingsManager, "toolSettingsProperties", propertyDescriptorToRestore);
    }
  });

  it("starting a tool with nested lock toggle in tool settings", async () => {
    const frontstageDef = await FrontstageManager.getFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);

      const toolSettingsProperties: DialogItem[] = [];
      const useLengthValue: DialogItemValue = { value: false };
      const lengthValue: DialogItemValue = { value: 1.2345, displayValue: "1.2345" };

      const lockToggle: DialogItem = { value: useLengthValue, property: useLengthDescription, editorPosition: { rowPriority: 0, columnIndex: 1 } };
      toolSettingsProperties.push({ value: lengthValue, property: lengthDescription, editorPosition: { rowPriority: 0, columnIndex: 3 }, isDisabled: false, lockProperty: lockToggle });
      ToolSettingsManager.initializeToolSettingsData(toolSettingsProperties, testToolId, "testToolLabel", "testToolDescription");

      // override the property getter to return the properties needed for the test
      const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(ToolSettingsManager, "toolSettingsProperties")!;
      Object.defineProperty(ToolSettingsManager, "toolSettingsProperties", {
        get: () => toolSettingsProperties,
      });

      expect(ToolSettingsManager.useDefaultToolSettingsProvider).to.be.true;
      expect(ToolSettingsManager.toolSettingsProperties.length).to.equal(toolSettingsProperties.length);
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
          // simulate property update

          const newlengthValue: DialogItemValue = { value: 7.5 };
          const lengthSyncItem: DialogPropertySyncItem = { value: newlengthValue, propertyName: lengthDescription.name };
          const newUselengthValue: DialogItemValue = { value: false };
          const useLengthSyncItem: DialogPropertySyncItem = { value: newUselengthValue, propertyName: useLengthDescription.name };
          const defaultProvider = toolUiProvider as DefaultToolSettingsProvider;
          if (defaultProvider) {
            defaultProvider.uiDataProvider.applyUiPropertyChange(lengthSyncItem);
            defaultProvider.uiDataProvider.applyUiPropertyChange(useLengthSyncItem);
          }
        }
      }

      const toolSettingsNode = FrontstageManager.activeToolSettingsProvider?.toolSettingsNode;
      expect(toolSettingsNode).to.not.be.undefined;

      const renderedComponent = render(toolSettingsNode as React.ReactElement<any>);
      expect(renderedComponent).not.to.be.undefined;

      expect(renderedComponent.queryByText("TEST-USELENGTH:")).to.be.null;

      const toggleEditor = renderedComponent.getByTestId("components-checkbox-editor");
      expect(toggleEditor).not.to.be.undefined;

      const textLabel = renderedComponent.getByText("TEST-LENGTH:");
      expect(textLabel).not.to.be.undefined;

      const textEditor = renderedComponent.getByTestId("components-text-editor");
      expect(textEditor).not.to.be.undefined;

      // simulate sync from tool
      const newUseLengthValue: DialogItemValue = { value: false };
      const syncItem: DialogPropertySyncItem = { value: newUseLengthValue, propertyName: useLengthDescription.name, isDisabled: false };
      const syncArgs = { toolId: testToolId, syncProperties: [syncItem] } as SyncToolSettingsPropertiesEventArgs;
      FrontstageManager.activeToolSettingsProvider?.syncToolSettingsProperties(syncArgs);
      FrontstageManager.activeToolSettingsProvider?.reloadPropertiesFromTool();
      FrontstageManager.onToolSettingsReloadEvent.emit();

      // restore the overriden property getter
      Object.defineProperty(ToolSettingsManager, "toolSettingsProperties", propertyDescriptorToRestore);
    }
  });

});
