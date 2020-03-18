/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps, useRefs, useResizeObserver, useOnOutsideClick } from "@bentley/ui-core";
import { DockedToolSettingsOverflow } from "./Overflow";
import { ToolSettingsOverflowPanel } from "./Panel";
import { DockedToolSettingsHandle } from "./Handle";
import "./Docked.scss";

/** Properties of [[DockedToolSettings]] component.
 * @internal future
 */
export interface DockedToolSettingsProps extends CommonProps {
  /** Tool settings content. */
  children?: React.ReactNode;
  /** Container for overflown entries. */
  panelContainer?: React.ComponentType;
}

/** Component that displays tool settings as a bar across the top of the content view.
 * @internal future
 */
export function DockedToolSettings(props: DockedToolSettingsProps) {
  const [isOverflowPanelOpen, setIsOverflowPanelOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const width = React.useRef<number | undefined>(undefined);
  const handleWidth = React.useRef<number | undefined>(undefined);
  const [overflown, handleContainerResize, handleOverflowResize, handleEntryResize] = useOverflow(props.children);
  const onResize = React.useCallback(() => {
    width.current !== undefined && handleWidth.current !== undefined && handleContainerResize(width.current - handleWidth.current);
  }, [handleContainerResize]);
  const handleHandleResize = React.useCallback((w: number) => {
    handleWidth.current = w;
    onResize();
  }, [onResize]);
  const handleResize = React.useCallback((w: number) => {
    width.current = w;
    onResize();
  }, [onResize]);
  const resizeObserverRef = useResizeObserver(handleResize);

  const onOverflowClick = React.useCallback(() => {
    setIsOverflowPanelOpen((prev) => !prev);
  }, []);
  const onOutsideClick = React.useCallback(() => {
    setIsOverflowPanelOpen(false);
  }, []);
  const isOutsideEvent = React.useCallback((e: PointerEvent) => {
    return !!ref.current && (e.target instanceof Node) && !ref.current.contains(e.target);
  }, []);
  const panelRef = useOnOutsideClick<HTMLDivElement>(onOutsideClick, isOutsideEvent);

  const refs = useRefs(ref, resizeObserverRef);
  const children = React.Children.toArray(props.children);
  const dockedChildren = children.reduce<Array<[string, React.ReactNode]>>((acc, child, index) => {
    const key = getChildKey(child, index);
    if (!overflown || overflown.indexOf(key) < 0) {
      acc.push([key, child]);
    }
    return acc;
  }, []);
  const overflownChildren = overflown ? children.reduce<Array<[string, React.ReactNode]>>((acc, child, index) => {
    const key = getChildKey(child, index);
    if (overflown.indexOf(key) >= 0) {
      acc.push([key, child]);
    }
    return acc;
  }, []) : [];

  // tslint:disable-next-line: variable-name
  const PanelContainer = props.panelContainer ? props.panelContainer : DefaultPanelContainer;
  const className = classnames(
    "nz-toolSettings-docked",
    props.className,
  );
  return (
    <div
      className={className}
      ref={refs}
      style={props.style}
    >
      <DockedToolSettingsEntryContext.Provider
        value={{
          isOverflown: false,
          onResize: handleHandleResize,
        }}
      >
        <DockedToolSettingsHandle />
      </DockedToolSettingsEntryContext.Provider>
      {dockedChildren.map(([key, child]) => {
        const onEntryResize = handleEntryResize(key);
        return (
          <DockedToolSettingsEntryContext.Provider
            key={key}
            value={{
              isOverflown: false,
              onResize: onEntryResize,
            }}
          >
            {child}
          </DockedToolSettingsEntryContext.Provider>
        );
      })}
      {(!overflown || overflown.length > 0) && (
        <DockedToolSettingsEntryContext.Provider
          value={{
            isOverflown: false,
            onResize: handleOverflowResize,
          }}
        >
          <DockedToolSettingsOverflow
            onClick={onOverflowClick}
          />
        </DockedToolSettingsEntryContext.Provider>
      )}
      {overflownChildren.length > 0 && isOverflowPanelOpen &&
        <ToolSettingsOverflowPanel
          ref={panelRef}
        >
          <PanelContainer>
            {overflownChildren.map(([key, child]) => {
              return (
                <DockedToolSettingsEntryContext.Provider
                  key={key}
                  value={{
                    isOverflown: true,
                    onResize: () => { },
                  }}
                >
                  {child}
                </DockedToolSettingsEntryContext.Provider>
              );
            })}
          </PanelContainer>
        </ToolSettingsOverflowPanel>
      }
    </div>
  );
}

/** Returns key of a child. Must be used along with React.Children.toArray to preserve the semanticts of children.
 * @internal
 */
export function getChildKey(child: React.ReactNode, index: number) {
  if (React.isValidElement(child) && child.key !== null) {
    return child.key.toString();
  }
  return index.toString();
}

/** Returns a subset of docked entry keys that exceed given width and should be overflown.
 * @internal
 */
export function getOverflown(width: number, docked: ReadonlyArray<readonly [string, number]>, overflowWidth: number) {
  let settingsWidth = 0;
  let i = 0;
  for (; i < docked.length; i++) {
    const w = docked[i][1];
    const newSettingsWidth = settingsWidth + w;
    if (newSettingsWidth > width) {
      settingsWidth += overflowWidth;
      break;
    }
    settingsWidth = newSettingsWidth;
  }
  let j = i;
  for (; j > 0; j--) {
    if (settingsWidth <= width)
      break;
    const w = docked[j][1];
    settingsWidth -= w;
  }

  return docked.slice(j).map((e) => e[0]);
}

/** Hook that returns a list of overflown children.
 * @internal
 */
export function useOverflow(children: React.ReactNode): [
  ReadonlyArray<string> | undefined,
  (size: number) => void,
  (size: number) => void,
  (key: string) => (size: number) => void,
] {
  const [overflown, setOverflown] = React.useState<ReadonlyArray<string>>();
  const entryWidths = React.useRef(new Map<string, number | undefined>());
  const width = React.useRef<number | undefined>(undefined);
  const overflowWidth = React.useRef<number | undefined>(undefined);

  const calculateOverflow = React.useCallback(() => {
    setOverflown(undefined);
    const widths = verifiedMapEntries(entryWidths.current);
    if (width.current === undefined ||
      widths === undefined ||
      overflowWidth.current === undefined) {
      return;
    }

    // Calculate overflow.
    const newOverflown = getOverflown(width.current, [...widths.entries()], overflowWidth.current);
    setOverflown(newOverflown);
  }, []);

  React.useLayoutEffect(() => {
    const newEntryWidths = new Map<string, number | undefined>();
    const array = React.Children.toArray(children);
    for (let i = 0; i < array.length; i++) {
      const child = array[i];
      const key = getChildKey(child, i);
      const lastW = entryWidths.current.get(key);
      newEntryWidths.set(key, lastW);
    }
    entryWidths.current = newEntryWidths;
    calculateOverflow();
  }, [children, calculateOverflow]);

  const handleContainerResize = React.useCallback((w: number) => {
    const calculate = width.current !== w;
    width.current = w;
    calculate && calculateOverflow();
  }, [calculateOverflow]);

  const handleOverflowResize = React.useCallback((w: number) => {
    const calculate = overflowWidth.current !== w;
    overflowWidth.current = w;
    calculate && calculateOverflow();
  }, [calculateOverflow]);

  const handleEntryResize = React.useCallback((key: string) => (w: number) => {
    const oldW = entryWidths.current.get(key);
    if (oldW !== w) {
      entryWidths.current.set(key, w);
      calculateOverflow();
    }
  }, [calculateOverflow]);

  return [overflown, handleContainerResize, handleOverflowResize, handleEntryResize];
}

interface DockedToolSettingsEntryContextArgs {
  readonly isOverflown: boolean;
  readonly onResize: (w: number) => void;
}

// tslint:disable-next-line: variable-name
const DockedToolSettingsEntryContext = React.createContext<DockedToolSettingsEntryContextArgs>(null!);
DockedToolSettingsEntryContext.displayName = "nz:DockedToolSettingsEntryContext";

/** @internal */
export function useToolSettingsEntry() {
  return React.useContext(DockedToolSettingsEntryContext);
}

function verifiedMapEntries<T>(map: Map<string, T | undefined>) {
  for (const [, val] of map) {
    if (val === undefined)
      return undefined;
  }
  return map as Map<string, T>;
}

function DefaultPanelContainer(p: { children: React.ReactNode }) {
  return <>{p.children}</>;
}
