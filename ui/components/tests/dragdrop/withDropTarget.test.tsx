/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { withDropTarget } from "../../src/dragdrop";
import { mount, shallow } from "enzyme";
import * as React from "react";
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
describe("withDropTarget", () => {
  class TestComponent extends React.Component {
    public render(): React.ReactNode {
      return <div> test </div>;
    }
  }
  const TestDropTarget = withDropTarget(TestComponent); // tslint:disable-line:variable-name
  describe("Wrapped component", () => {
    const BaseComponent = TestDropTarget.DecoratedComponent; // tslint:disable-line:variable-name
    it("mounts wrapped component", () => {
      mount(<BaseComponent dropProps={{}} connectDropTarget={(e: any) => e } />);
    });
    it("renders wrapped component correctly", () => {
      shallow(<BaseComponent dropProps={{}} connectDropTarget={(e: any) => e } />).should.matchSnapshot();
    });
  });
  describe("Drop functionality", () => {
    const ContextTestDropTarget = wrapInTestContext(TestDropTarget) as any; // tslint:disable-line:variable-name
    const wrapper = mount(<ContextTestDropTarget dropProps={{objectTypes: ["test"]}} />);
    const dropcomponent = wrapper.find(TestDropTarget);
    const droptestcomponent = dropcomponent.find(TestComponent) as any;
    it("initializes starting variables correctly", () => {
      droptestcomponent.props().isOver.should.be.false;
      droptestcomponent.props().canDrop.should.be.false;
    });
  });
});
