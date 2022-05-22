/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { IModelConnection } from "@itwin/core-frontend";
import { ECInstancesNodeKey, KeySet, StandardNodeTypes } from "@itwin/presentation-common";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { mockPresentationManager } from "@itwin/presentation-components/lib/cjs/test";
import { Presentation, PresentationManager, SelectionChangeEvent, SelectionManager } from "@itwin/presentation-frontend";
import { PropertyRecord } from "@itwin/appui-abstract";
import { render, waitFor } from "@testing-library/react";
import { SpatialContainmentTree } from "../../../appui-react";
import TestUtils from "../../TestUtils";

describe("SpatialContainmentTree", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("<SpatialContainmentTree />", () => {
    const sizeProps = { width: 200, height: 200 };
    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    let presentationManagerMock: moq.IMock<PresentationManager>;

    const createKey = (id: string): ECInstancesNodeKey => {
      return {
        type: StandardNodeTypes.ECInstancesNode,
        version: 0,
        instanceKeys: [{ className: "MyDomain:SomeElementType", id }],
        pathFromRoot: [],
      };
    };

    beforeEach(() => {
      sinon.stub(PresentationTreeDataProvider.prototype, "imodel").get(() => imodelMock.object);
      sinon.stub(PresentationTreeDataProvider.prototype, "rulesetId").get(() => "");
      sinon.stub(PresentationTreeDataProvider.prototype, "dispose");
      sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves([]);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake((node: any) => node.__key);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(1);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").callsFake(
        async () => [{ __key: createKey("1"), label: PropertyRecord.fromString("test-node"), id: "1" }],
      );

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
      const result = render(<SpatialContainmentTree {...sizeProps} iModel={imodelMock.object} />);
      await waitFor(() => result.getByText("test-node"), { container: result.container });
      expect(result.baseElement).to.matchSnapshot();
    });
  });
});
