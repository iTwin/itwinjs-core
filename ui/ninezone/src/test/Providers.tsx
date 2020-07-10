/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import {
  createNineZoneState,
  DragManagerContext,
  NineZoneProvider as RealNineZoneProvider,
  NineZoneProviderProps as RealNineZoneProviderProps,
} from "../ui-ninezone";
import { Point, Rectangle, Size } from "@bentley/ui-core";
import { DragManager } from "../ui-ninezone/base/DragManager";

// tslint:disable: completed-docs

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type NineZoneProviderProps = PartialBy<RealNineZoneProviderProps, "measure" | "state" | "dispatch"> &
  Pick<DragManagerConsumerProps, "dragManagerRef">;

export function NineZoneProvider(props: NineZoneProviderProps) {
  const { children, dragManagerRef, ...otherProps } = props;
  return (
    <RealNineZoneProvider
      state={createNineZoneState()}
      dispatch={sinon.stub()}
      measure={() => new Rectangle()}
      {...otherProps}
    >
      <DragManagerConsumer dragManagerRef={dragManagerRef}>
        {children}
      </DragManagerConsumer>
    </RealNineZoneProvider>
  );
}

export function DragManagerProvider(props: { children?: React.ReactNode }) {
  const dragManager = React.useRef(new DragManager());
  return (
    <DragManagerContext.Provider value={dragManager.current}>
      {props.children}
    </DragManagerContext.Provider>
  );
}

interface DragManagerConsumerProps {
  children?: React.ReactNode;
  dragManagerRef?: React.RefObject<DragManager>;
}

function DragManagerConsumer(props: DragManagerConsumerProps) {
  const dragManager = React.useContext(DragManagerContext);
  if (props.dragManagerRef) {
    (props.dragManagerRef as React.MutableRefObject<DragManager>).current = dragManager;
  }
  return (
    <>
      {props.children}
    </>
  );
}

type DragItemInfo = Parameters<DragManager["handleDragStart"]>[0]["info"];

export function createDragItemInfo(args?: Partial<DragItemInfo>): DragItemInfo {
  return {
    initialPointerPosition: new Point(),
    lastPointerPosition: new Point(),
    pointerPosition: new Point(),
    widgetSize: new Size(),
    ...args,
  };
}

export function createDragStartArgs(): Parameters<DragManager["handleDragStart"]>[0] {
  return {
    info: createDragItemInfo(),
    item: {
      id: "",
      type: "tab",
    },
  };
}

export function setRefValue<T>(ref: React.Ref<T>, value: T) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}
