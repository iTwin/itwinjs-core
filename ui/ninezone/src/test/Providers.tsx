/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import {
  createNineZoneState,
  DragManager,
  DragManagerContext,
  NineZoneProvider,
  NineZoneProviderProps,
} from "../appui-layout-react";
import { Point, Rectangle, Size } from "@itwin/core-react";

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** @internal */
export interface TestNineZoneProviderProps extends PartialBy<NineZoneProviderProps, "measure" | "state" | "dispatch"> {
  dragManagerRef?: React.Ref<DragManager>;
}

/** @internal */
export function TestNineZoneProvider(props: TestNineZoneProviderProps) {
  const { children, dragManagerRef, ...otherProps } = props;
  return (
    <NineZoneProvider
      state={createNineZoneState()}
      dispatch={sinon.stub()}
      measure={() => new Rectangle()}
      {...otherProps}
    >
      <ContextConsumer
        context={DragManagerContext}
        contextRef={dragManagerRef}
      />
      {children}
    </NineZoneProvider>
  );
}

/** @internal */
export function DragManagerProvider(props: { children?: React.ReactNode }) {
  const [dragManager] = React.useState(new DragManager());
  return (
    <DragManagerContext.Provider value={dragManager}>
      {props.children}
    </DragManagerContext.Provider>
  );
}

type DragItemInfo = Parameters<DragManager["handleDragStart"]>[0]["info"];

/** @internal */
export function createDragItemInfo(args?: Partial<DragItemInfo>): DragItemInfo {
  return {
    initialPointerPosition: new Point(),
    lastPointerPosition: new Point(),
    pointerPosition: new Point(),
    widgetSize: new Size(),
    ...args,
  };
}

/** @internal */
export function createDragStartArgs(): Parameters<DragManager["handleDragStart"]>[0] {
  return {
    info: createDragItemInfo(),
    item: {
      id: "",
      type: "tab",
    },
  };
}

/** @internal */
export function setRefValue<T>(ref: React.Ref<T>, value: T) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

interface WithOnRenderProps {
  onRender?(): void;
}

/** @internal */
export const withOnRender = <P extends {}, C>(
  Component: React.JSXElementConstructor<P> & C,
) => {
  type Props = JSX.LibraryManagedAttributes<C, P & WithOnRenderProps>;
  return function WithOnRender(props: Props) {
    const { onRender, ...otherProps } = props;
    onRender && onRender();
    return (
      <Component
        {...otherProps as any}
      />
    );
  };
};

interface ContextConsumerProps<T> {
  context: React.Context<T>;
  contextRef?: React.Ref<T>;
}

/** @internal */
export function ContextConsumer<T>(props: ContextConsumerProps<T>) {
  const context = React.useContext(props.context);
  if (props.contextRef) {
    setRefValue(props.contextRef, context);
  }
  return <></>;
}
