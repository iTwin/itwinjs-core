/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { render, cleanup } from "react-testing-library";

import TestUtils from "../../TestUtils";
import { ConfigurableUiManager, FrontstageManager, FrontstageProvider, Frontstage, Zone, Widget, FrontstageProps, CoreTools, ToolUiManager } from "../../../ui-framework";
import { ToolSettingsValue, ToolSettingsPropertyRecord, PrimitiveValue, PropertyDescription, PropertyEditorParamTypes, SuppressLabelEditorParams } from "@bentley/imodeljs-frontend";

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

  it("starting a tool with undefined tool settings", async () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;
    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises

      // do not define FrontstageManager.toolSettingsProperties to test that case.
      ToolUiManager.useDefaultToolSettingsProvider = true;

      FrontstageManager.setActiveToolId(firstToolId);
      expect(FrontstageManager.activeToolId).to.eq(firstToolId);

      const toolInformation = FrontstageManager.activeToolInformation;
      expect(toolInformation).to.not.be.undefined;

      if (toolInformation) {
        const toolUiProvider = toolInformation.toolUiProvider;
        expect(toolUiProvider).to.not.be.undefined;

        if (toolUiProvider) {
          expect(toolUiProvider.toolSettingsNode).to.be.null;
        }
      }
    }
  });

  it("starting a tool with tool settings", async () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises

      const toolSettingsProperties = ToolUiManager.toolSettingsProperties;
      const useLengthValue = new ToolSettingsValue(false);
      const lengthValue = new ToolSettingsValue(1.2345, "1.2345");
      const enumValue = new ToolSettingsValue("1");

      toolSettingsProperties.push(new ToolSettingsPropertyRecord(useLengthValue.clone() as PrimitiveValue, useLengthDescription, { rowPriority: 0, columnIndex: 1 }));
      toolSettingsProperties.push(new ToolSettingsPropertyRecord(lengthValue.clone() as PrimitiveValue, lengthDescription, { rowPriority: 0, columnIndex: 3 }));
      toolSettingsProperties.push(new ToolSettingsPropertyRecord(enumValue.clone() as PrimitiveValue, enumDescription, { rowPriority: 1, columnIndex: 3 }));
      ToolUiManager.useDefaultToolSettingsProvider = true;

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
    }
  });

});
