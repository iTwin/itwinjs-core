/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PropertyDescription } from "@itwin/appui-abstract";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { Content, LabelDefinition, NavigationPropertyInfo } from "@itwin/presentation-common";
import { createTestContentDescriptor, createTestContentItem } from "@itwin/presentation-common/lib/cjs/test";
import { Presentation } from "@itwin/presentation-frontend";
import { renderHook } from "@testing-library/react-hooks";
import {
  NAVIGATION_PROPERTY_TARGETS_BATCH_SIZE, NavigationPropertyTarget, useNavigationPropertyTargetsLoader, useNavigationPropertyTargetsRuleset,
} from "../../presentation-components/properties/UseNavigationPropertyTargetsLoader";

describe("UseNavigationPropertyTargetsLoader", () => {
  const testImodel = {} as IModelConnection;

  beforeEach(async () => {
    await NoRenderApp.startup({
      localization: new EmptyLocalization(),
    });
    await Presentation.initialize();
  });

  afterEach(async () => {
    Presentation.terminate();
    await IModelApp.shutdown();
    sinon.restore();
  });

  it("returns empty targets array if ruleset is undefined", async () => {
    const getContentStub = sinon.stub(Presentation.presentation, "getContent");

    const { result } = renderHook(
      useNavigationPropertyTargetsLoader,
      { initialProps: { imodel: testImodel } }
    );

    const { options, hasMore } = await result.current("", []);
    expect(getContentStub).to.not.be.called;
    expect(options).to.be.empty;
    expect(hasMore).to.be.false;
  });

  it("loads targets", async () => {
    const contentItem = createTestContentItem({
      label: LabelDefinition.fromLabelString("testLabel"),
      primaryKeys: [{ className: "class", id: "1" }],
      displayValues: {},
      values: {},
    });
    sinon.stub(Presentation.presentation, "getContent").resolves(new Content(
      createTestContentDescriptor({ fields: [] }),
      [contentItem]
    ));

    const { result } = renderHook(
      useNavigationPropertyTargetsLoader,
      { initialProps: { imodel: testImodel, ruleset: { id: "testRuleset", rules: [] } } }
    );

    const { options, hasMore } = await result.current("", []);
    expect(options).to.have.lengthOf(1);
    expect(options[0]).to.contain({ label: contentItem.label, key: contentItem.primaryKeys[0] });
    expect(hasMore).to.be.false;
  });

  it("loads targets with offset", async () => {
    const getContentStub = sinon.stub(Presentation.presentation, "getContent");

    const { result } = renderHook(
      useNavigationPropertyTargetsLoader,
      { initialProps: { imodel: testImodel, ruleset: { id: "testRuleset", rules: [] } } }
    );

    const loadedTargets: NavigationPropertyTarget[] = [
      { label: LabelDefinition.fromLabelString("test1"), key: { className: "class", id: "1" } },
      { label: LabelDefinition.fromLabelString("test2"), key: { className: "class", id: "2" } },
    ];
    await result.current("", loadedTargets);
    expect(getContentStub).to.be.calledOnce;
    expect(getContentStub.getCall(0).args[0]).to.containSubset({ paging: { start: loadedTargets.length } });
  });

  it("loads full batch of targets and sets 'hasMore' flag to true", async () => {
    const contentItems = Array.from({ length: NAVIGATION_PROPERTY_TARGETS_BATCH_SIZE }, () => createTestContentItem({ displayValues: {}, values: {} }));
    sinon.stub(Presentation.presentation, "getContent")
      .resolves(new Content(createTestContentDescriptor({ fields: [], categories: [] }), contentItems));

    const { result } = renderHook(
      useNavigationPropertyTargetsLoader,
      { initialProps: { imodel: testImodel, ruleset: { id: "testRuleset", rules: [] } } }
    );

    const { options, hasMore } = await result.current("", []);
    expect(options).to.have.lengthOf(NAVIGATION_PROPERTY_TARGETS_BATCH_SIZE);
    expect(hasMore).to.be.true;
  });

  it("loads targets using provided filter string", async () => {
    const getContentStub = sinon.stub(Presentation.presentation, "getContent")
      .resolves(new Content(createTestContentDescriptor({ fields: [], categories: [] }), []));

    const { result } = renderHook(
      useNavigationPropertyTargetsLoader,
      { initialProps: { imodel: testImodel, ruleset: { id: "testRuleset", rules: [] } } }
    );

    await result.current("testFilter", []);
    expect(getContentStub).to.be.calledOnce;
    const descriptor = getContentStub.getCall(0).args[0].descriptor;
    expect(descriptor.filterExpression).to.contain("testFilter");
  });
});

describe("useNavigationPropertyTargetsRuleset", () => {
  interface Props {
    getNavigationPropertyInfo: (property: PropertyDescription) => Promise<NavigationPropertyInfo | undefined>;
    property: PropertyDescription;
  }

  it("creates ruleset for target class", async () => {
    const testInfo: NavigationPropertyInfo = {
      classInfo: { id: "1", label: "Relationship Class", name: "TestSchema:RelationshipClass" },
      isForwardRelationship: true,
      isTargetPolymorphic: true,
      targetClassInfo: { id: "2", label: "Target Class", name: "TestSchema:TargetClass" },
    };
    const propertyDescription: PropertyDescription = { displayLabel: "TestProp", name: "test_prop", typename: "navigation" };
    const { result, waitForNextUpdate } = renderHook(
      ({ getNavigationPropertyInfo, property }: Props) => useNavigationPropertyTargetsRuleset(getNavigationPropertyInfo, property),
      { initialProps: { getNavigationPropertyInfo: async () => testInfo, property: propertyDescription } });

    await waitForNextUpdate();
    const ruleset = result.current;
    expect(ruleset).to.containSubset({
      rules: [{
        specifications: [{
          classes: { schemaName: "TestSchema", classNames: ["TargetClass"], arePolymorphic: true },
        }],
      }],
    });
  });

  it("returns undefined if navigation property info is undefined", () => {
    const propertyDescription: PropertyDescription = { displayLabel: "TestProp", name: "test_prop", typename: "navigation" };
    const { result } = renderHook(
      ({ getNavigationPropertyInfo, property }: Props) => useNavigationPropertyTargetsRuleset(getNavigationPropertyInfo, property),
      { initialProps: { getNavigationPropertyInfo: async () => undefined, property: propertyDescription } });

    const ruleset = result.current;
    expect(ruleset).to.be.undefined;
  });
});
