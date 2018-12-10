/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import ReactTestUtils from "react-dom/test-utils";
import * as sinon from "sinon";
import { withDragSource, DragSourceArguments } from "../../ui-components";
import TestBackend from "react-dnd-test-backend";
import { DragDropContext } from "react-dnd";
import { render, cleanup } from "react-testing-library";

describe("withDragSource", () => {

  /**
   * Wraps a component into a DragDropContext that uses the TestBackend.
   */
  function wrapInTestContext(DecoratedComponent: React.ComponentType<any>) {// tslint:disable-line:variable-name
    class TestContextContainer extends React.Component {
      public render() {
        return <DecoratedComponent {...this.props} />;
      }
    }

    return DragDropContext(TestBackend)(TestContextContainer);
  }

  class TestComponent extends React.Component<any> {
    public render(): React.ReactNode {
      return <div> test </div>;
    }
  }
  afterEach(cleanup);

  describe("Wrapped component", () => {
    const testDragSource = withDragSource(TestComponent);
    const BaseComponent = testDragSource.DecoratedComponent; // tslint:disable-line:variable-name
    it("mounts wrapped component", () => {
      render(<BaseComponent dragProps={{}} connectDragSource={(e: any) => e} />);
    });
  });
  describe("Drag functionality", () => {
    const TestDragSource = withDragSource(TestComponent); // tslint:disable-line:variable-name
    const ContextTestDragSource = wrapInTestContext(TestDragSource) as any; // tslint:disable-line:variable-name
    const onDragSourceBegin = (args: DragSourceArguments) => {
      args.dataObject = { test: true };
      return args;
    };
    const beginSpy = sinon.spy(onDragSourceBegin);
    const onDragSourceEnd = sinon.fake();
    const root = ReactTestUtils.renderIntoDocument(<ContextTestDragSource dragProps={{ onDragSourceBegin: beginSpy, onDragSourceEnd, objectType: "test" }} />);

    // Obtain a reference to the backend
    const backend = (root as any).getManager().getBackend();
    const box = ReactTestUtils.findRenderedComponentWithType(root as any, TestDragSource) as any;
    it("calls onDragSourceBegin correctly", () => {
      backend.simulateBeginDrag([box.getHandlerId()]);
      expect(beginSpy).to.have.been.calledOnce;
      expect(beginSpy).to.have.been.calledWith(sinon.match({ dataObject: { test: true } }));

    });
    it("calls onDragSourceEnd correctly", () => {
      backend.simulateEndDrag();
      expect(onDragSourceEnd).to.have.been.calledOnce;
      expect(onDragSourceEnd).to.have.been.calledWith(sinon.match({ dataObject: { test: true } }));
    });
  });
});
