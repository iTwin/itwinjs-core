/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import * as React from "react";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { Ruleset } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { HierarchyBuilder, HierarchyCacheMode, initialize, terminate } from "@bentley/presentation-testing";
import { render } from "@testing-library/react";
import { ConfigurableUiControlType, ModelSelectorWidget, ModelSelectorWidgetControl, WidgetDef, WidgetProps } from "../../ui-framework";
import { ModelSelectorDataProvider } from "../../ui-framework/pickers/ModelSelector/ModelSelectorDefinitions";
import TestUtils from "../TestUtils";

describe("ModelSelector", () => {

  const testIModelPath = "src/test/test-data/Properties_60InstancesWithUrl2.ibim";
  let imodel: IModelConnection;
  let hierarchyBuilder: HierarchyBuilder;

  beforeEach(async () => {
    await TestUtils.initializeUiFramework();
    await initialize({
      backendProps: {
        cacheConfig: { mode: HierarchyCacheMode.Disk, directory: path.join("lib", "test", "cache") },
      },
    });
    imodel = await SnapshotConnection.openFile(testIModelPath);
    hierarchyBuilder = new HierarchyBuilder({ imodel });
  });

  afterEach(async () => {
    await imodel.close();
    await terminate();
    TestUtils.terminateUiFramework();
  });

  describe("Model", () => {

    let ruleset: Ruleset;

    beforeEach(() => {
      ruleset = require("../../../rulesets/Models");
    });

    it("generates correct models' hierarchy", async () => {
      const builder = new HierarchyBuilder({ imodel });
      const hierarchy = await builder.createHierarchy(ruleset);
      expect(hierarchy).to.matchSnapshot();
    });

  });

  describe("Category", () => {

    let ruleset: Ruleset;

    beforeEach(() => {
      ruleset = require("../../../rulesets/Categories");
    });

    it("generates empty hierarchy when 'ViewType' ruleset variable is not set", async () => {
      const hierarchy = await hierarchyBuilder.createHierarchy(ruleset);
      expect(hierarchy.length).to.eq(0);
    });

    it("generates correct spatial categories' hierarchy", async () => {
      await Presentation.presentation.vars(ruleset.id).setString("ViewType", "3d");
      const hierarchy = await hierarchyBuilder.createHierarchy(ruleset);
      expect(hierarchy).to.matchSnapshot();
    });

    it("generates correct drawing categories' hierarchy", async () => {
      await Presentation.presentation.vars(ruleset.id).setString("ViewType", "2d");
      const hierarchy = await hierarchyBuilder.createHierarchy(ruleset);
      expect(hierarchy).to.matchSnapshot();
    });

  });

  describe("ModelSelectorWidget", () => {
    it("should render", async () => {
      const component = render(<ModelSelectorWidget iModelConnection={imodel} />); // eslint-disable-line deprecation/deprecation
      const widget = component.getByTestId("model-selector-widget");
      expect(widget).to.exist;
    });
  });

  describe("ModelSelectorWidgetControl", () => {
    const widgetProps: WidgetProps = {
      id: "test-widget",
      classId: ModelSelectorWidgetControl,
      applicationData: { iModelConnection: imodel },
    };

    it("widgetDef and getWidgetControl", () => {
      const widgetDef: WidgetDef = new WidgetDef(widgetProps);
      const widgetControl = widgetDef.getWidgetControl(ConfigurableUiControlType.Widget);
      expect(widgetControl).to.not.be.undefined;
    });
  });

  describe("ModelSelectorDataProvider", () => {
    it("API should return correct values", async () => {
      const rulesetId = "Models";
      const dataProvider = new ModelSelectorDataProvider(imodel, rulesetId);
      expect(dataProvider.rulesetId).to.eq(rulesetId);
      expect(dataProvider.imodel).to.eq(imodel);

      await dataProvider.getFilteredNodePaths("");

      await dataProvider.getNodes();
    });
  });

});
