/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as moq from "typemoq";
import { render } from "@testing-library/react";
import { useVisibleTreeNodes } from "../../../ui-components/tree/controlled/TreeHooks";
import { VisibleTreeNodes, TreeModel, MutableTreeModel } from "../../../ui-components/tree/controlled/TreeModel";
import { TreeModelSource } from "../../../ui-components/tree/controlled/TreeModelSource";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { TreeDataProvider } from "../../../ui-components/tree/TreeDataProvider";

interface TestHookProps {
  callback: () => void;
}

// tslint:disable-next-line: variable-name naming-convention
const TestHook: React.FC<TestHookProps> = (props: TestHookProps) => {
  props.callback();
  return null;
};

describe("useVisibleTreeNodes", () => {
  const modelSourceMock = moq.Mock.ofType<TreeModelSource<TreeDataProvider>>();
  const onModelChangeMock = moq.Mock.ofType<BeUiEvent<TreeModel>>();
  const testVisibleNodes: VisibleTreeNodes = {
    getAtIndex: () => undefined,
    getModel: () => new MutableTreeModel(),
    getNumNodes: () => 0,
    getNumRootNodes: () => 0,
    [Symbol.iterator]: () => [][Symbol.iterator](),
  };

  beforeEach(() => {
    modelSourceMock.reset();
    onModelChangeMock.reset();

    modelSourceMock.setup((x) => x.onModelChanged).returns(() => onModelChangeMock.object);
    modelSourceMock.setup((x) => x.getVisibleNodes()).returns(() => testVisibleNodes);
  });

  it("subscribes to onModelChange event and returns visible nodes", () => {
    let visibleNodes: VisibleTreeNodes;
    render(
      <TestHook callback={() => { visibleNodes = useVisibleTreeNodes(modelSourceMock.object); }} />,
    );
    expect(visibleNodes!).to.not.be.undefined;
    onModelChangeMock.verify((x) => x.addListener(moq.It.isAny()), moq.Times.once());
  });

  it("resubscribes to onModelChangeEvent when model source changes", () => {
    const { rerender } = render(
      <TestHook callback={() => useVisibleTreeNodes(modelSourceMock.object)} />,
    );
    onModelChangeMock.verify((x) => x.addListener(moq.It.isAny()), moq.Times.once());

    const newOnModelChangeMock = moq.Mock.ofType<BeUiEvent<TreeModel>>();
    const newModelSourceMock = moq.Mock.ofType<TreeModelSource<TreeDataProvider>>();
    newModelSourceMock.setup((x) => x.onModelChanged).returns(() => newOnModelChangeMock.object);

    rerender(
      <TestHook callback={() => useVisibleTreeNodes(newModelSourceMock.object)} />,
    );

    onModelChangeMock.verify((x) => x.removeListener(moq.It.isAny()), moq.Times.once());
    newOnModelChangeMock.verify((x) => x.addListener(moq.It.isAny()), moq.Times.once());
  });

});
