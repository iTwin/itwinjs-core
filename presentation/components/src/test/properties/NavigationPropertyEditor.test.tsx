/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { EditorContainer } from "@itwin/components-react";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { Content, KeySet, LabelDefinition, NavigationPropertyInfo } from "@itwin/presentation-common";
import {
  createTestContentDescriptor, createTestContentItem, createTestPropertiesContentField, createTestSimpleContentField,
} from "@itwin/presentation-common/lib/cjs/test";
import { Presentation } from "@itwin/presentation-frontend";
import { fireEvent, render as renderRTL, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { IContentDataProvider } from "../../presentation-components/common/ContentDataProvider";
import {
  NavigationPropertyEditorContext, NavigationPropertyEditorContextProps, NavigationPropertyTargetEditor, useNavigationPropertyEditingContextProps,
} from "../../presentation-components/properties/NavigationPropertyEditor";
import { createRandomPropertyRecord } from "../_helpers/UiComponents";

function render(ui: React.ReactElement, context?: Partial<NavigationPropertyEditorContextProps>) {
  const contextValue: NavigationPropertyEditorContextProps = {
    getNavigationPropertyInfo: context?.getNavigationPropertyInfo ?? sinon.spy(),
    imodel: context?.imodel ?? {} as IModelConnection,
  };

  return renderRTL(
    <NavigationPropertyEditorContext.Provider value={contextValue}>
      {ui}
    </NavigationPropertyEditorContext.Provider>
  );
}

describe("<NavigationPropertyEditor />", () => {
  function createRecord() {
    const record = createRandomPropertyRecord();
    record.property.typename = "navigation";
    return record;
  }

  beforeEach(async () => {
    await NoRenderApp.startup({
      localization: new EmptyLocalization(),
    });
    await Presentation.initialize();
  });

  afterEach(async () => {
    sinon.restore();
    Presentation.terminate();
    await IModelApp.shutdown();
  });

  it("renders editor for 'navigation' type", () => {
    const record = createRecord();
    const { container } = render(<EditorContainer propertyRecord={record} onCancel={() => { }} onCommit={() => { }} />);
    expect(container.querySelector<HTMLDivElement>(".iui-select-button")).to.not.be.null;
  });

  it("invokes 'onCommit' when new target is selected changes", async () => {
    const contentItem = createTestContentItem({
      label: LabelDefinition.fromLabelString("TestLabel"),
      primaryKeys: [{ id: "1", className: "TestSchema:TestClass" }],
      values: {},
      displayValues: {},
    });
    sinon.stub(Presentation.presentation, "getContent").resolves(new Content(createTestContentDescriptor({ fields: [], categories: [] }), [contentItem]));
    const record = createRecord();
    const spy = sinon.spy();
    const { container, getByText, queryByText } = render(
      <EditorContainer propertyRecord={record} onCancel={() => { }} onCommit={spy} />,
      {
        getNavigationPropertyInfo: async () => ({
          classInfo: { id: "1", label: "Class Label", name: "TestSchema:TestClass" },
          targetClassInfo: { id: "1", label: "Target Label", name: "TestSchema:TargetClass" },
          isForwardRelationship: true,
          isTargetPolymorphic: true,
        }),
      }
    );

    // open dropdown
    const select = await waitFor(() => container.querySelector<HTMLDivElement>(".iui-select-button"));
    expect(select).to.not.be.null;
    fireEvent.mouseDown(select!);

    // select option from dropdown
    const target = await waitFor(() => getByText(contentItem.label.displayValue));
    fireEvent.click(target);

    const selectedTarget = await waitFor(() => queryByText(contentItem.label.displayValue));
    expect(selectedTarget).to.not.be.null;

    expect(spy).to.be.calledOnce;
  });
});

describe("<NavigationPropertyTargetEditor />", () => {
  beforeEach(async () => {
    await NoRenderApp.startup({
      localization: new EmptyLocalization(),
    });
    await Presentation.initialize();
  });

  afterEach(async () => {
    sinon.restore();
    Presentation.terminate();
    await IModelApp.shutdown();
  });

  it("renders selector when rendered inside context", async () => {
    const { container } = render(<NavigationPropertyTargetEditor />, {});
    expect(container.querySelector<HTMLDivElement>(".iui-select-button")).to.not.be.null;
  });

  it("does not render selector when rendered without context", async () => {
    const { container } = renderRTL(<NavigationPropertyTargetEditor />);
    expect(container.querySelector<HTMLDivElement>(".iui-select-button")).to.be.null;
  });
});

describe("useNavigationPropertyEditingContextProps", () => {
  interface Props {
    imodel: IModelConnection;
    dataProvider: IContentDataProvider;
  }
  const testImodel = {} as IModelConnection;
  let testDataProvider: IContentDataProvider;

  beforeEach(() => {
    testDataProvider = {
      imodel: testImodel,
      rulesetId: "",
      displayType: "",
      dispose: () => { },
      getContent: async () => undefined,
      getContentDescriptor: async () => undefined,
      getContentSetSize: async () => 0,
      getFieldByPropertyRecord: async () => undefined,
      keys: new KeySet(),
      selectionInfo: undefined,
    };
  });

  it("returns navigation property info", async () => {
    const record = createRandomPropertyRecord();
    const navigationPropertyInfo: NavigationPropertyInfo = {
      classInfo: { id: "1", label: "Class Label", name: "TestSchema:TestClass" },
      targetClassInfo: { id: "2", label: "Target Label", name: "TestSchema:TargetClass" },
      isForwardRelationship: true,
      isTargetPolymorphic: true,
    };

    testDataProvider.getFieldByPropertyRecord = async () => createTestPropertiesContentField({
      properties: [{
        property: {
          classInfo: { id: "3", label: "Field Class", name: "TestSchema:FieldClass" },
          name: "Field Name",
          type: "navigation",
          navigationPropertyInfo,
        },
      }],
    });

    const { result } = renderHook(
      ({ imodel, dataProvider }: Props) => useNavigationPropertyEditingContextProps(imodel, dataProvider),
      { initialProps: { imodel: testImodel, dataProvider: testDataProvider } }
    );

    const info = await result.current.getNavigationPropertyInfo(record);
    expect(info).to.be.eq(navigationPropertyInfo);
  });

  it("returns undefined if non properties field is returned", async () => {
    const record = createRandomPropertyRecord();
    testDataProvider.getFieldByPropertyRecord = async () => createTestSimpleContentField();

    const { result } = renderHook(
      ({ imodel, dataProvider }: Props) => useNavigationPropertyEditingContextProps(imodel, dataProvider),
      { initialProps: { imodel: testImodel, dataProvider: testDataProvider } }
    );

    const info = await result.current.getNavigationPropertyInfo(record);
    expect(info).to.be.undefined;
  });
});
