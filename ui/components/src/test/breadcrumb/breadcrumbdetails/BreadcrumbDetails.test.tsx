/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { waitForUpdate } from "../../test-helpers/misc";
import { render, cleanup, RenderResult, waitForElement, wait } from "@testing-library/react";
import TestUtils from "../../TestUtils";
import { BreadcrumbDetails, BreadcrumbPath } from "../../../ui-components";
import { mockRawTreeDataProvider, mockInterfaceTreeDataProvider } from "../mockTreeDataProvider";
import { ImmediatelyLoadedTreeNodeItem, TreeNodeItem } from "../../../ui-components/tree/TreeDataProvider";
import { TableProps, Table } from "../../../ui-components/table/component/Table";

describe("BreadcrumbDetails", () => {
  let renderSpy: sinon.SinonSpy;
  let renderedComponent: RenderResult;

  before(async () => {
    await TestUtils.initializeUiComponents(); // tslint:disable-line:no-floating-promises
  });

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

    it("should render with renderTable defined", async () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      const renderTable = (props: TableProps, _node: TreeNodeItem | undefined, _children: TreeNodeItem[]) => {
        return <Table {...props} onRender={renderSpy} />;
      };
      render(<BreadcrumbDetails path={path} renderTable={renderTable} />);

      await wait(() => renderSpy.called);
    });

    it("should update path to child", async () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      path.setCurrentNode(undefined);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 12);
      const node = mockRawTreeDataProvider[1];
      expect(await waitForElement(() => renderedComponent.getByText(node.label))).to.exist;
    });

    it("should render when node is defined", async () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      path.setCurrentNode(mockRawTreeDataProvider[1]);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 9);
      const node = mockRawTreeDataProvider[1].children![0];
      expect(await waitForElement(() => renderedComponent.getByText(node.label))).to.exist;
    });

    it("should change path", async () => {
      const path1 = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path1} />), renderSpy, 12);
      const path2 = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent.rerender(<BreadcrumbDetails onRender={renderSpy} path={path2} />), renderSpy, 2);
    });

    it("should rerender from interface dataProvider to raw dataProvider", async () => {
      const nodeInterface = (await mockInterfaceTreeDataProvider.getNodes())[1];
      const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
      renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />);
      expect(await waitForElement(() => renderedComponent.getByText(nodeInterface.label))).to.exist;
      path.setDataProvider(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent.rerender(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 9);
    });

    it("should rerender from raw dataProvider to interface dataProvider", async () => {
      const nodeRaw = mockRawTreeDataProvider[1];
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />);
      expect(await waitForElement(() => renderedComponent.getByText(nodeRaw.label))).to.exist;
      path.setDataProvider(mockInterfaceTreeDataProvider);
      await waitForUpdate(() => renderedComponent.rerender(<BreadcrumbDetails onChildrenLoaded={renderSpy} path={path} />), renderSpy, 4);
    });

    it("rerenders when currentNode is set to undefined", async () => {
      const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 7);
      renderSpy.resetHistory();
      path.setCurrentNode(undefined);
      expect(renderSpy).to.have.been.called;
    });

    it("rerenders when currentNode is set to node", async () => {
      const node = (await mockInterfaceTreeDataProvider.getNodes())[0];
      const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 7);
      renderSpy.resetHistory();
      path.setCurrentNode(node);
      expect(renderSpy).to.have.been.called;
    });

    it("pops a tree level when currentNode is set to node without children", async () => {
      const node = mockRawTreeDataProvider[1].children![1];
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 12);
      renderSpy.resetHistory();
      path.setCurrentNode(node);
      expect(renderSpy).to.have.been.called;
    });

    it("pops a tree level to a non root node when currentNode is set to a deep node without children", async () => {
      const node = (mockRawTreeDataProvider[1].children![0] as ImmediatelyLoadedTreeNodeItem).children![0];
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 12);
      renderSpy.resetHistory();
      path.setCurrentNode(node);
      expect(renderSpy).to.have.been.called;
    });

    it("calls onRowsSelected when row is clicked and sets currentNode to path", async () => {
      const node = mockRawTreeDataProvider[1];
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      const pathUpdateSpy = sinon.stub();
      path.BreadcrumbUpdateEvent.addListener(pathUpdateSpy);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 12);
      const listRow = renderedComponent.getByText(node.label);
      const event = new MouseEvent("click", { bubbles: true });
      await waitForUpdate(() => listRow.dispatchEvent(event), pathUpdateSpy, 1);
      expect(pathUpdateSpy).to.have.been.called;
    });

    describe("Interface DataProvider", () => {
      it("rerenders when `onTreeNodeChanged` is broadcasted with undefined", async () => {
        const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
        await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 7);
        renderSpy.resetHistory();
        mockInterfaceTreeDataProvider.onTreeNodeChanged!.raiseEvent([undefined]);
        expect(renderSpy).to.have.been.called;
      });

      it("rerenders when `onTreeNodeChanged` is broadcasted with node", async () => {
        const node = (await mockInterfaceTreeDataProvider.getNodes())[0];
        const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
        path.setCurrentNode(node);
        await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 7);
        renderSpy.resetHistory();
        mockInterfaceTreeDataProvider.onTreeNodeChanged!.raiseEvent([node]);
        expect(renderSpy).to.have.been.called;
      });
    });
  });
  describe("load callbacks", () => {
    it("should call onRootNodesLoaded correctly", async () => {
      const onRootNodesLoadedSpy = sinon.spy();
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} onRootNodesLoaded={onRootNodesLoadedSpy} />), renderSpy, 12);
      expect(onRootNodesLoadedSpy).to.have.been.calledOnce;
    });
    it("should call onChildrenLoaded correctly", async () => {
      const onChildrenLoadedSpy = sinon.spy();
      const node = (await mockInterfaceTreeDataProvider.getNodes())[0];
      const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
      path.setCurrentNode(node);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} onChildrenLoaded={onChildrenLoadedSpy} />), renderSpy, 7);
      expect(onChildrenLoadedSpy).to.have.have.callCount(3);
    });
  });
});
