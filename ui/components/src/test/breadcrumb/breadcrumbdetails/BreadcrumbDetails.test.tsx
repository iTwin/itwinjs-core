/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { waitForUpdate } from "../../test-helpers/misc";
import { render, cleanup, RenderResult, waitForElement } from "react-testing-library";
import { BreadcrumbDetails, BreadcrumbPath } from "../../../ui-components";
import { mockRawTreeDataProvider, mockInterfaceTreeDataProvider } from "../mockTreeDataProvider";

describe("BreadcrumbDetails", () => {
  let renderSpy: sinon.SinonSpy;
  let renderedComponent: RenderResult;
  beforeEach(() => {
    sinon.restore();
    renderSpy = sinon.spy();
  });

  afterEach(cleanup);

  describe("<BreadcrumbDetails />", () => {
    it("should render", () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      render(<BreadcrumbDetails onRender={renderSpy} path={path} />);
    });
    it("should render with interface dataProvider", () => {
      const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
      render(<BreadcrumbDetails onRender={renderSpy} path={path} />);
    });

    it("should update path to child", async () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      path.setCurrentNode(undefined);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 12);
      const node = mockRawTreeDataProvider[1];
      expect(await waitForElement(() => renderedComponent.getByText(node.label))).to.exist;
    });

    it("should change path", async () => {
      const path1 = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path1} />), renderSpy, 12);
      const path2 = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent.rerender(<BreadcrumbDetails onRender={renderSpy} path={path2} />), renderSpy, 2);
    });
    describe("Interface DataProvider", () => {
      it("should rerender from raw dataProvider to interface dataProvider", async () => {
        const nodeRaw = mockRawTreeDataProvider[1];
        const path = new BreadcrumbPath(mockRawTreeDataProvider);
        path.setCurrentNode(nodeRaw);
        renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />);
        expect(await waitForElement(() => renderedComponent.getByText(nodeRaw.label))).to.exist;
        const nodeInterface = (await mockInterfaceTreeDataProvider.getNodes())[1];
        path.setDataProvider(mockInterfaceTreeDataProvider);
        path.setCurrentNode(nodeInterface);
        renderedComponent.rerender(<BreadcrumbDetails onRender={renderSpy} path={path} />);
      });
      describe("listening to `ITreeDataProvider.onTreeNodeChanged` events", () => {
        it("rerenders when `onTreeNodeChanged` is broadcasted with node", async () => {
          const node = (await mockInterfaceTreeDataProvider.getNodes())[0];
          const path = new BreadcrumbPath(mockRawTreeDataProvider);
          path.setCurrentNode(node);
          await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 12);
          mockInterfaceTreeDataProvider.onTreeNodeChanged!.raiseEvent([node]);
        });
      });
    });
  });
});
