/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { withDragSource, DragSourceArguments } from "../../src/dragdrop";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import TestBackend from "react-dnd-test-backend";
import { DragDropContext } from "react-dnd";
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
describe("withDragSource", () => {
  describe("Wrapped component", () => {
    class TestComponent extends React.Component {
      public render(): React.ReactNode {
        return <div> test </div>;
      }
    }
    const TestDragSource = withDragSource(TestComponent); // tslint:disable-line:variable-name
    const BaseComponent = TestDragSource.DecoratedComponent; // tslint:disable-line:variable-name
    it("mounts wrapped component", () => {
      mount(<BaseComponent dragProps={{}} connectDragSource={(e: any) => e } />);
    });
    it("renders wrapped component correctly", () => {
      shallow(<BaseComponent dragProps={{}} connectDragSource={(e: any) => e } />).should.matchSnapshot();
    });
    it("detects ctrl and alt keypresses correctly", () => {
      const wrapper = mount(<BaseComponent dragProps={{}} connectDragSource={(e: any) => e } />) as any;
      const instance = wrapper.instance();
      instance.state.ctrlKey.should.be.false;
      instance.state.altKey.should.be.false;
      instance.handleKeyChange({ctrlKey: true, altKey: false});
      instance.state.ctrlKey.should.be.true;
      instance.state.altKey.should.be.false;
      instance.handleKeyChange({ctrlKey: false, altKey: true});
      instance.state.ctrlKey.should.be.false;
      instance.state.altKey.should.be.true;
      instance.handleKeyChange({ctrlKey: true, altKey: true});
      instance.state.ctrlKey.should.be.true;
      instance.state.altKey.should.be.true;
    });
  });
  describe("Drag functionality", () => {
    class TestComponent extends React.Component<any> {
      public render(): React.ReactNode {
        return <div> test </div>;
      }
    }
    const TestDragSource = withDragSource(TestComponent); // tslint:disable-line:variable-name
    const ContextTestDragSource = wrapInTestContext(TestDragSource) as any; // tslint:disable-line:variable-name
    const onDragSourceBegin = (args: DragSourceArguments) => {
      args.dataObject = {test: true};
      return args;
    };
    const beginSpy = sinon.spy(onDragSourceBegin);
    const onDragSourceEnd = sinon.fake();
    const wrapper = mount(<ContextTestDragSource dragProps={{onDragSourceBegin: beginSpy, onDragSourceEnd, objectType: "test"}} />);
    const component = wrapper.find(TestComponent);
    it("initializes starting variables correctly", () => {
      component.props().isDragging.should.be.false;
      component.props().canDrag.should.be.true;
    });
    const dragsource = wrapper.find(TestDragSource).instance();
    const instance = wrapper.instance() as any;
    const backend = instance.getManager().getBackend();
    const id = (dragsource as any).getHandlerId();
    it("calls onDragSourceBegin correctly", () => {
      backend.simulateBeginDrag([id]);
      beginSpy.should.have.been.calledOnce;
      beginSpy.should.have.been.calledWith(sinon.match({dataObject: {test: true}}));

    });
    it("calls onDragSourceEnd correctly", () => {
      backend.simulateEndDrag();
      onDragSourceEnd.should.have.been.calledOnce;
      onDragSourceEnd.should.have.been.calledWith(sinon.match({dataObject: {test: true}}));
    });
  });
});
