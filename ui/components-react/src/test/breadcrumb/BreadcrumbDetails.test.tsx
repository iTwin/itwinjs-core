/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import type { RenderResult} from "@testing-library/react";
import { render, waitFor } from "@testing-library/react";
import { BreadcrumbDetails, BreadcrumbPath } from "../../components-react";
import type { TableProps } from "../../components-react/table/component/Table";
import { Table } from "../../components-react/table/component/Table";
import type { ImmediatelyLoadedTreeNodeItem, TreeNodeItem } from "../../components-react/tree/TreeDataProvider";
import { waitForUpdate } from "../test-helpers/misc";
import TestUtils from "../TestUtils";
import { mockInterfaceTreeDataProvider, mockRawTreeDataProvider } from "./mockTreeDataProvider";

/* eslint-disable deprecation/deprecation */

describe("BreadcrumbDetails", () => {
  let renderSpy: sinon.SinonSpy;
  let renderedComponent: RenderResult;
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  before(async () => {
    sinon.restore();
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  beforeEach(() => {
    renderSpy = sinon.spy();
    sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("react-grid-Container")) {
        return DOMRect.fromRect({ width: 400, height: 500 });
      }
      return new DOMRect();
    });
  });

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

      await waitFor(() => renderSpy.called);
    });

    it("should update path to child", async () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      path.setCurrentNode(undefined);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 13);
      expect(await waitFor(() => renderedComponent.getByText("Raw Node 2"))).to.exist;
    });

    it("should render when node is defined", async () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      path.setCurrentNode(mockRawTreeDataProvider[1]);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 10);
      expect(await waitFor(() => renderedComponent.getByText("Raw Node 2.1"))).to.exist;
    });

    it("should change path", async () => {
      const path1 = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path1} />), renderSpy, 13);
      const path2 = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent.rerender(<BreadcrumbDetails onRender={renderSpy} path={path2} />), renderSpy, 2);
    });

    it("should rerender from interface dataProvider to raw dataProvider", async () => {
      const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
      renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />);
      expect(await waitFor(() => renderedComponent.getByText("Interface Node 2"))).to.exist;
      path.setDataProvider(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent.rerender(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 9);
    });

    it("should rerender from raw dataProvider to interface dataProvider", async () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />);
      expect(await waitFor(() => renderedComponent.getByText("Raw Node 2"))).to.exist;
      path.setDataProvider(mockInterfaceTreeDataProvider);
      await waitForUpdate(() => renderedComponent.rerender(<BreadcrumbDetails onChildrenLoaded={renderSpy} path={path} />), renderSpy, 4);
    });

    it("rerenders when currentNode is set to undefined", async () => {
      const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 8);
      renderSpy.resetHistory();
      path.setCurrentNode(undefined);
      expect(renderSpy).to.have.been.called;
    });

    it("rerenders when currentNode is set to node", async () => {
      const node = (await mockInterfaceTreeDataProvider.getNodes())[0];
      const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 8);
      renderSpy.resetHistory();
      path.setCurrentNode(node);
      expect(renderSpy).to.have.been.called;
    });

    it("pops a tree level when currentNode is set to node without children", async () => {
      const node = mockRawTreeDataProvider[1].children![1];
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 13);
      renderSpy.resetHistory();
      path.setCurrentNode(node);
      expect(renderSpy).to.have.been.called;
    });

    it("pops a tree level to a non root node when currentNode is set to a deep node without children", async () => {
      const node = (mockRawTreeDataProvider[1].children![0] as ImmediatelyLoadedTreeNodeItem).children![0];
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 13);
      renderSpy.resetHistory();
      path.setCurrentNode(node);
      expect(renderSpy).to.have.been.called;
    });

    it("calls onRowsSelected when row is clicked and sets currentNode to path", async () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      const pathUpdateSpy = sinon.stub();
      path.BreadcrumbUpdateEvent.addListener(pathUpdateSpy);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 13);
      const listRow = renderedComponent.getByText("Raw Node 2");
      const event = new MouseEvent("click", { bubbles: true });
      await waitForUpdate(() => listRow.dispatchEvent(event), pathUpdateSpy, 1);
      expect(pathUpdateSpy).to.have.been.called;
    });

    describe("Interface DataProvider", () => {
      it("rerenders when `onTreeNodeChanged` is broadcasted with undefined", async () => {
        const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
        await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 8);
        renderSpy.resetHistory();
        mockInterfaceTreeDataProvider.onTreeNodeChanged.raiseEvent([undefined]);
        expect(renderSpy).to.have.been.called;
      });

      it("rerenders when `onTreeNodeChanged` is broadcasted with node", async () => {
        const node = (await mockInterfaceTreeDataProvider.getNodes())[0];
        const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
        path.setCurrentNode(node);
        await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} />), renderSpy, 8);
        renderSpy.resetHistory();
        mockInterfaceTreeDataProvider.onTreeNodeChanged.raiseEvent([node]);
        expect(renderSpy).to.have.been.called;
      });
    });
  });
  describe("load callbacks", () => {
    it("should call onRootNodesLoaded correctly", async () => {
      const onRootNodesLoadedSpy = sinon.spy();
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} onRootNodesLoaded={onRootNodesLoadedSpy} />), renderSpy, 13);
      expect(onRootNodesLoadedSpy).to.have.been.calledOnce;
    });
    it("should call onChildrenLoaded correctly", async () => {
      const onChildrenLoadedSpy = sinon.spy();
      const node = (await mockInterfaceTreeDataProvider.getNodes())[0];
      const path = new BreadcrumbPath(mockInterfaceTreeDataProvider);
      path.setCurrentNode(node);
      await waitForUpdate(() => renderedComponent = render(<BreadcrumbDetails onRender={renderSpy} path={path} onChildrenLoaded={onChildrenLoadedSpy} />), renderSpy, 8);
      expect(onChildrenLoadedSpy).to.have.have.callCount(3);
    });
  });
});
