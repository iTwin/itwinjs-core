/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import "./Docked.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, useRefs, useResizeObserver } from "@bentley/ui-core";
import { assert } from "@bentley/bentleyjs-core";
import { DockedToolSettingsHandle } from "./Handle";
import { DockedToolSettingsOverflow } from "./Overflow";
import { ToolSettingsOverflowPanel } from "./Panel";

/** @internal */
export function onOverflowLabelAndEditorResize() {
}

/** This component takes a DockedToolSetting "wrapper" component and extract only the label and editor components from it */
// eslint-disable-next-line @typescript-eslint/naming-convention, no-shadow
const OverflowLabelAndEditor = React.memo(function OverflowLabelAndEditor({ wrapper }: { wrapper: React.ReactNode }) {
  assert(React.isValidElement(wrapper));
  const entryValue = React.useMemo<DockedToolSettingsEntryContextArgs>(() => ({
    isOverflown: true,
    onResize: onOverflowLabelAndEditorResize,
  }), []);
  const wrapperChildren = (wrapper as React.ReactElement<any>).props.children;
  return (
    <>
      <DockedToolSettingsEntryContext.Provider
        value={entryValue}
      >
        {wrapperChildren && React.Children.map(wrapperChildren, (child: React.ReactNode) => child)}
      </DockedToolSettingsEntryContext.Provider>
    </>
  );
});

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
  const [open, setOpen] = React.useState(false);
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
    setOpen((prev) => !prev);
  }, []);
  const handleOnClose = React.useCallback(() => {
    setOpen(false);
  }, []);
  const targetRef = React.useRef<HTMLDivElement>(null);
  const refs = useRefs(ref, resizeObserverRef);
  const children = React.useMemo(() => React.Children.toArray(props.children), [props.children]);
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
  // eslint-disable-next-line @typescript-eslint/naming-convention
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
      <DockedToolSettingsHandle
        onResize={handleHandleResize}
      />
      {dockedChildren.map(([key, child]) => {
        return (
          <DockedToolSettingsEntry
            key={key}
            entryKey={key}
            getOnResize={handleEntryResize}
          >
            {child}
          </DockedToolSettingsEntry>
        );
      })}
      {(!overflown || overflown.length > 0) && (
        <>
          <DockedToolSettingsOverflow
            onClick={onOverflowClick}
            onResize={handleOverflowResize}
            ref={targetRef}
          />
          {overflownChildren.length > 0 && open && targetRef.current &&
            <ToolSettingsOverflowPanel
              onClose={handleOnClose}
              open
              target={targetRef.current}
            >
              <PanelContainer>
                {overflownChildren.map(([key, child]) => {
                  return (
                    <OverflowLabelAndEditor
                      key={key}
                      wrapper={child}
                    />
                  );
                })}
              </PanelContainer>
            </ToolSettingsOverflowPanel>
          }
        </>
      )}
    </div>
  );
}

interface DockedToolSettingsEntryProps {
  children?: React.ReactNode;
  entryKey: string;
  getOnResize: (key: string) => (w: number) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention, no-shadow
const DockedToolSettingsEntry = React.memo<DockedToolSettingsEntryProps>(function DockedToolSettingsEntry({ children, entryKey, getOnResize }) {
  const onResize = React.useMemo(() => getOnResize(entryKey), [getOnResize, entryKey]);
  const entry = React.useMemo<DockedToolSettingsEntryContextArgs>(() => ({
    isOverflown: false,
    onResize,
  }), [onResize]);
  return (
    <DockedToolSettingsEntryContext.Provider value={entry}>
      {children}
    </DockedToolSettingsEntryContext.Provider>
  );
});

/** Returns key of a child. Must be used along with React.Children.toArray to preserve the semantics of children.
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
export function getOverflown(width: number, docked: ReadonlyArray<readonly [string, number]>, overflowWidth: number, activeIndex?: number) {
  let settingsWidth = 0;
  if (activeIndex !== undefined && docked.length > activeIndex) {
    const activeWidth = docked[activeIndex];
    settingsWidth += activeWidth[1];
  }
  let i = 0;
  for (; i < docked.length; i++) {
    if (i === activeIndex)
      continue;
    const w = docked[i][1];
    const newSettingsWidth = settingsWidth + w;
    if (newSettingsWidth > width) {
      settingsWidth += overflowWidth;
      break;
    }
    settingsWidth = newSettingsWidth;
  }

  let j = i;
  // istanbul ignore else
  if (j < docked.length) {
    for (; j > 0; j--) {
      if (j === activeIndex)
        continue;
      if (settingsWidth <= width)
        break;
      const w = docked[j][1];
      settingsWidth -= w;
    }
  }

  const overflown = new Array<string>();
  for (i = j; i < docked.length; i++) {
    if (i === activeIndex)
      continue;
    overflown.push(docked[i][0]);
  }
  return overflown;
}

/** Hook that returns a list of overflown children.
 * @internal
 */
export function useOverflow(children: React.ReactNode, activeChildIndex?: number): [
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
    const widths = verifiedMapEntries(entryWidths.current);
    if (width.current === undefined ||
      widths === undefined ||
      overflowWidth.current === undefined
    ) {
      setOverflown(undefined);
      return;
    }

    // Calculate overflow.
    const newOverflown = getOverflown(width.current, [...widths.entries()], overflowWidth.current, activeChildIndex);
    setOverflown((prevOverflown) => {
      return eqlOverflown(prevOverflown, newOverflown) ? prevOverflown : newOverflown;
    });
  }, [activeChildIndex]);

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
    oldW !== w && entryWidths.current.set(key, w);
    oldW !== w && calculateOverflow();
  }, [calculateOverflow]);

  return [overflown, handleContainerResize, handleOverflowResize, handleEntryResize];
}

interface DockedToolSettingsEntryContextArgs {
  readonly isOverflown: boolean;
  readonly onResize: (w: number) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
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

function DefaultPanelContainer(props: { children: React.ReactNode }) {
  return <div className="nz-toolSettings-docked_container">{props.children}</div>;
}

/** @internal */
export function eqlOverflown(prev: readonly string[] | undefined, value: readonly string[]) {
  if (!prev)
    return false;
  if (prev.length !== value.length)
    return false;
  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    const v = value[i];
    if (p !== v)
      return false;
  }
  return true;
}
