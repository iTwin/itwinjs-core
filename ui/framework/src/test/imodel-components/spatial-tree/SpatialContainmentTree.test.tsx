/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECInstancesNodeKey, KeySet, StandardNodeTypes } from "@bentley/presentation-common";
import { PresentationTreeDataProvider } from "@bentley/presentation-components";
import { mockPresentationManager } from "@bentley/presentation-components/lib/test/_helpers/UiComponents";
import { Presentation, PresentationManager, SelectionChangeEvent, SelectionManager } from "@bentley/presentation-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import { render, waitForElement } from "@testing-library/react";
import { SpatialContainmentTree } from "../../../ui-framework";
import TestUtils from "../../TestUtils";

describe("SpatialContainmentTree", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  beforeEach(() => {
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    sinon.stub(HTMLElement.prototype, "offsetHeight").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 200);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("<SpatialContainmentTree />", () => {
    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    let presentationManagerMock: moq.IMock<PresentationManager>;

    const createKey = (id: string): ECInstancesNodeKey => {
      return {
        type: StandardNodeTypes.ECInstancesNode,
        instanceKeys: [{ className: "MyDomain:SomeElementType", id }],
        pathFromRoot: [],
      };
    };

    beforeEach(() => {
      sinon.stub(PresentationTreeDataProvider.prototype, "imodel").get(() =>imodelMock.object);
      sinon.stub(PresentationTreeDataProvider.prototype, "rulesetId").get(() => "");
      sinon.stub(PresentationTreeDataProvider.prototype, "dispose");
      sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves([]);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake((node: any) => node.__key);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(1);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").callsFake(
        async () => [{ __key: createKey("1"), label: PropertyRecord.fromString("test-node"), id: "1" }],
      );
      sinon.stub(PresentationTreeDataProvider.prototype, "loadHierarchy");

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      Presentation.setSelectionManager(selectionManagerMock.object);

      presentationManagerMock = mockPresentationManager().presentationManager;
      Presentation.setPresentationManager(presentationManagerMock.object);
    });

    after(() => {
      Presentation.terminate();
    });

    it("renders", async () => {
      const result = render(<SpatialContainmentTree iModel={imodelMock.object} />);
      await waitForElement(() => result.getByText("test-node"), { container: result.container });
      expect(result.baseElement).to.matchSnapshot();
    });
  });
});
