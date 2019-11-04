/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";
import { render } from "@testing-library/react";
import { useLifecycleLogging } from "../../ui-core/utils/DebugHelpers";

interface TestHookProps {
  callback: () => void;
}

// tslint:disable-next-line: variable-name
const TestHook: React.FC<TestHookProps> = (props: TestHookProps) => {
  props.callback();
  return null;
};

describe("UseLifecycleLogging", () => {

  it("logs when component is mounted", () => {
    const consoleSpy = sinon.spy(console, "log");
    render(
      <TestHook
        callback={() => useLifecycleLogging("TestHook", { id: 1 })}
      />,
    );
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWithExactly("[useLifecycleLogging]: 'TestHook' Component mounted.");
  });

  it("logs when component is unmounted", () => {
    const { unmount } = render(
      <TestHook
        callback={() => useLifecycleLogging("TestHook", { id: 1 })}
      />,
    );

    const consoleSpy = sinon.spy(console, "log");
    unmount();
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWithExactly("[useLifecycleLogging]: 'TestHook' Component unmounted.");
  });

  it("logs when component re renders", () => {
    const { rerender } = render(
      <TestHook
        callback={() => useLifecycleLogging("TestHook", { id: 1 })}
      />,
    );

    const consoleSpy = sinon.spy(console, "log");
    rerender(
      <TestHook
        callback={() => useLifecycleLogging("TestHook", { id: 1 })}
      />,
    );
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWithExactly("[useLifecycleLogging]: 'TestHook' Component re-rendered.");
  });

  it("logs when component re renders with new props", () => {
    const { rerender } = render(
      <TestHook
        callback={() => useLifecycleLogging("TestHook", { id: 1 })}
      />,
    );

    const consoleSpy = sinon.spy(console, "log");
    rerender(
      <TestHook
        callback={() => useLifecycleLogging("TestHook", { id: 2 })}
      />,
    );
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWith("[useLifecycleLogging]: 'TestHook' Props changed: ");
  });

  it("logs when component re renders with new context", () => {
    const { rerender } = render(
      <TestHook
        callback={() => useLifecycleLogging("TestHook", { id: 1 }, { contextValue: "Old context" })}
      />,
    );

    const consoleSpy = sinon.spy(console, "log");
    rerender(
      <TestHook
        callback={() => useLifecycleLogging("TestHook", { id: 1 }, { contextValue: "New context" })}
      />,
    );
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWith("[useLifecycleLogging]: 'TestHook' Context changed: ");
  });

  it("logs when component re renders with new props and new context", () => {
    const { rerender } = render(
      <TestHook
        callback={() => useLifecycleLogging("TestHook", { id: 1 }, { contextValue: "Old context" })}
      />,
    );

    const consoleSpy = sinon.spy(console, "log");
    rerender(
      <TestHook
        callback={() => useLifecycleLogging("TestHook", { id: 2 }, { contextValue: "New context" })}
      />,
    );
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWith("[useLifecycleLogging]: 'TestHook' Props and context changed: ");
  });

});
