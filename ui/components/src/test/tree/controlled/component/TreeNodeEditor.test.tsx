/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { render, fireEvent, act, wait } from "@testing-library/react";
import { TreeNodeEditor } from "../../../../ui-components/tree/controlled/component/TreeNodeEditor";
import { MutableTreeModelNode } from "../../../../ui-components/tree/controlled/TreeModel";
import { createRandomMutableTreeModelNode } from "../RandomTreeNodesHelpers";

describe("TreeNodeEditor", () => {
  let testNode: MutableTreeModelNode;

  beforeEach(() => {
    testNode = createRandomMutableTreeModelNode();
  });

  it("renders editor", () => {
    const { getByTestId } = render(
      <TreeNodeEditor
        node={testNode}
        onCommit={() => { }}
        onCancel={() => { }}
      />,
    );

    getByTestId("editor-container");
  });

  it("calls onCommit callback when change is committed", async () => {
    const spy = sinon.spy();
    const { getByTestId } = render(
      <TreeNodeEditor
        node={testNode}
        onCommit={spy}
        onCancel={() => { }}
      />,
    );

    const editorContainer = getByTestId("editor-container");
    act(() => { fireEvent.keyDown(editorContainer, { key: "Enter", code: 13 }); });
    await wait(() => { expect(spy).to.be.calledOnce; });
  });

  it("calls onCancel callback when editing is canceled", async () => {
    const spy = sinon.spy();
    const { getByTestId } = render(
      <TreeNodeEditor
        node={testNode}
        onCommit={() => { }}
        onCancel={spy}
      />,
    );

    const editorContainer = getByTestId("editor-container");
    act(() => { fireEvent.keyDown(editorContainer, { key: "Esc", code: 27 }); });
    await wait(() => { expect(spy).to.be.calledOnce; });
  });

});
