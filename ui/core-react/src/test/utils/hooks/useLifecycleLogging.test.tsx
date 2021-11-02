/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { renderHook } from "@testing-library/react-hooks";
import { useLifecycleLogging } from "../../../core-react/utils/hooks/useLifecycleLogging";

describe("useLifecycleLogging", () => {
  interface HookProps {
    name: string;
    props: Record<string, any>;
    context?: Record<string, any>;
  }

  it("logs when component is mounted", () => {
    const consoleSpy = sinon.spy(console, "log");
    renderHook(
      (props: HookProps) => useLifecycleLogging(props.name, props.props, props.context),
      { initialProps: { name: "TestHook", props: { id: 1 } } },
    );

    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWithExactly("[useLifecycleLogging]: 'TestHook' Component mounted.");
  });

  it("logs when component is unmounted", () => {
    const { unmount } = renderHook(
      (props: HookProps) => useLifecycleLogging(props.name, props.props, props.context),
      { initialProps: { name: "TestHook", props: { id: 1 } } },
    );

    const consoleSpy = sinon.spy(console, "log");
    unmount();
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWithExactly("[useLifecycleLogging]: 'TestHook' Component unmounted.");
  });

  it("logs when component re renders", () => {
    const { rerender } = renderHook(
      (props: HookProps) => useLifecycleLogging(props.name, props.props, props.context),
      { initialProps: { name: "TestHook", props: { id: 1 } } },
    );

    const consoleSpy = sinon.spy(console, "log");
    rerender({ name: "TestHook", props: { id: 1 } });
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWithExactly("[useLifecycleLogging]: 'TestHook' Component re-rendered.");
  });

  it("logs when component re renders with new props", () => {
    const { rerender } = renderHook(
      (props: HookProps) => useLifecycleLogging(props.name, props.props, props.context),
      { initialProps: { name: "TestHook", props: { id: 1 } } },
    );

    const consoleSpy = sinon.spy(console, "log");
    rerender({ name: "TestHook", props: { id: 2 } });
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWith("[useLifecycleLogging]: 'TestHook' Props changed: ");
  });

  it("logs when component re renders with new context", () => {
    const { rerender } = renderHook(
      (props: HookProps) => useLifecycleLogging(props.name, props.props, props.context),
      { initialProps: { name: "TestHook", props: { id: 1 }, context: { contextValue: "Old context" } } },
    );

    const consoleSpy = sinon.spy(console, "log");
    rerender({ name: "TestHook", props: { id: 1 }, context: { contextValue: "New context" } });
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWith("[useLifecycleLogging]: 'TestHook' Context changed: ");
  });

  it("logs when component re renders with new props and new context", () => {
    const { rerender } = renderHook(
      (props: HookProps) => useLifecycleLogging(props.name, props.props, props.context),
      { initialProps: { name: "TestHook", props: { id: 1 }, context: { contextValue: "Old context" } } },
    );

    const consoleSpy = sinon.spy(console, "log");
    rerender({ name: "TestHook", props: { id: 2 }, context: { contextValue: "New context" } });
    consoleSpy.restore();
    expect(consoleSpy).to.be.calledWith("[useLifecycleLogging]: 'TestHook' Props and context changed: ");
  });

});
