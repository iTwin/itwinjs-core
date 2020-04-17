/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import classnames from "classnames";
import * as React from "react";
import { CommonToolbarItem, ToolbarItemUtilities, ActionButton, ConditionalBooleanValue, ConditionalStringValue, CustomButtonDefinition, GroupButton } from "@bentley/ui-abstract";
import { CommonProps, NoChildrenProps, IconHelper, useRefs, useResizeObserver, useOnOutsideClick, BadgeUtilities } from "@bentley/ui-core";
import { ToolbarOverflowButton } from "./Overflow";
import { ToolbarOverflowPanel } from "./OverflowPanel";
import { ToolbarItems } from "./Items";
import { Direction, DirectionHelpers, OrthogonalDirectionHelpers, OrthogonalDirection } from "./utilities/Direction";
import { ItemWrapper } from "./ItemWrapper";
import { PopupItem } from "./PopupItem";
import { PopupItemsPanel } from "./PopupItemsPanel";
import { PopupItemWithDrag } from "./PopupItemWithDrag";
import { ToolbarButtonItem } from "./Item";
import "./Toolbar.scss";

/** Describes the data needed to insert a custom framework-specific button into an ToolbarWithOverflow.
 * @beta
 */
export interface CustomToolbarItem extends CustomButtonDefinition {
  buttonNode?: React.ReactNode;
  panelContentNode?: React.ReactNode;
}

/** Describes toolbar item.
 * @beta
 */
export type ToolbarItem = ActionButton | GroupButton | CustomToolbarItem;

/** CustomToolbarItem type guard. */
function isCustomToolbarItem(item: ToolbarItem): item is CustomToolbarItem {
  return !!(item as CustomToolbarItem).isCustom && (("buttonNode" in item) || ("panelContentNode" in item));
}

/** @internal */
export const getToolbarDirection = (expandsTo: Direction): OrthogonalDirection => {
  const orthogonalDirection = DirectionHelpers.getOrthogonalDirection(expandsTo);
  return OrthogonalDirectionHelpers.inverse(orthogonalDirection);
};

/** Available alignment modes of [[ToolbarWithOverflow]] panels.
 * @beta
 */
export enum ToolbarPanelAlignment {
  Start,
  End,
}

/** Helpers for [[ToolbarPanelAlignment]].
 * @internal
 */
export class ToolbarPanelAlignmentHelpers {
  /** Class name of [[ToolbarPanelAlignment.Start]] */
  public static readonly START_CLASS_NAME = "components-panel-alignment-start";
  /** Class name of [[ToolbarPanelAlignment.End]] */
  public static readonly END_CLASS_NAME = "components-panel-alignment-end";

  /** @returns Class name of specified [[ToolbarPanelAlignment]] */
  public static getCssClassName(panelAlignment: ToolbarPanelAlignment): string {
    switch (panelAlignment) {
      case ToolbarPanelAlignment.Start:
        return ToolbarPanelAlignmentHelpers.START_CLASS_NAME;
      case ToolbarPanelAlignment.End:
        return ToolbarPanelAlignmentHelpers.END_CLASS_NAME;
    }
  }
}

/** @internal */
export interface ToolbarOverflowContextProps {
  readonly expandsTo: Direction;
  readonly direction: OrthogonalDirection;
  readonly overflowExpandsTo: Direction;
  readonly overflowDirection: OrthogonalDirection;
  readonly panelAlignment: ToolbarPanelAlignment;
  readonly useDragInteraction: boolean;
  readonly useProximityOpacity: boolean;
  readonly openPopupCount: number;
  readonly onPopupPanelOpenClose: (isOpening: boolean) => void;
  readonly overflowDisplayActive: boolean;
}

/**
 * Context used by Toolbar component to provide Direction to child components.
 * @internal
 */
// tslint:disable-next-line: variable-name
export const ToolbarWithOverflowDirectionContext = React.createContext<ToolbarOverflowContextProps>({
  expandsTo: Direction.Bottom,
  direction: OrthogonalDirection.Horizontal,
  overflowExpandsTo: Direction.Right,
  overflowDirection: OrthogonalDirection.Vertical,
  panelAlignment: ToolbarPanelAlignment.Start,
  useDragInteraction: false,
  useProximityOpacity: true,
  openPopupCount: 0,
  onPopupPanelOpenClose: (_isOpening: boolean) => { },
  overflowDisplayActive: false,
});

function CustomItem({ item }: { item: CustomToolbarItem }) {
  const { useDragInteraction } = useToolbarWithOverflowDirectionContext();

  if (item.panelContentNode) {
    const badge = BadgeUtilities.getComponentForBadgeType(item.badgeType);
    const title = ConditionalStringValue.getValue(item.label);
    return <PopupItem
      icon={item.icon ? IconHelper.getIconReactNode(item.icon, item.internalData) : /* istanbul ignore next */ <i className="icon icon-placeholder" />}
      isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
      title={title ? title : /* istanbul ignore next */ item.id}
      panel={item.panelContentNode}
      hideIndicator={useDragInteraction}
      badge={badge}
    />;
  }

  if (item.buttonNode)
    return <>{item.buttonNode}</>;

  return null;
}

function GroupPopupItem({ item }: { item: GroupButton }) {
  const { useDragInteraction } = useToolbarWithOverflowDirectionContext();
  const title = ConditionalStringValue.getValue(item.label)!;
  const badge = BadgeUtilities.getComponentForBadgeType(item.badgeType);

  if (useDragInteraction) {
    return <PopupItemWithDrag
      icon={IconHelper.getIconReactNode(item.icon, item.internalData)}
      isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
      title={title}
      groupItem={item}
      badge={badge}
    />;
  }
  return <PopupItem
    icon={IconHelper.getIconReactNode(item.icon, item.internalData)}
    isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
    title={title}
    panel={<PopupItemsPanel groupItem={item} activateOnPointerUp={false} />}
    badge={badge}
    hideIndicator={useDragInteraction}
  />;
}

function ActionItem({ item }: { item: ActionButton }) {
  const title = ConditionalStringValue.getValue(item.label)!;
  const badge = BadgeUtilities.getComponentForBadgeType(item.badgeType);

  return <ToolbarButtonItem
    isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
    title={title}
    icon={IconHelper.getIconReactNode(item.icon, item.internalData)}
    isActive={item.isActive}
    onClick={item.execute}
    badge={badge}
  />;
}

function ToolbarItem({ item }: { item: ToolbarItem }) {
  if (ToolbarItemUtilities.isGroupButton(item)) {
    return <GroupPopupItem item={item} />;
  } else if (isCustomToolbarItem(item)) {
    return <CustomItem item={item} />;
  } else {
    // istanbul ignore else
    if (ToolbarItemUtilities.isActionButton(item)) {
      return <ActionItem item={item} />;
    }
  }
  return null;
}

/** @internal */
export function useToolbarWithOverflowDirectionContext() {
  return React.useContext(ToolbarWithOverflowDirectionContext);
}

function OverflowItemsContainer(p: { children: React.ReactNode }) {
  return <>{p.children}</>;
}

/** Properties of [[ToolbarWithOverflow]] component.
 * @beta
 */
export interface ToolbarWithOverflowProps extends CommonProps, NoChildrenProps {
  /** Describes to which direction the popup panels are expanded. Defaults to: [[Direction.Bottom]] */
  expandsTo?: Direction;
  /** Describes to which direction the overflow popup panels are expanded. Defaults to: [[Direction.Right]] */
  overflowExpandsTo?: Direction;
  /** definitions for items of the toolbar. i.e. [[CommonToolbarItem]] */
  items: CommonToolbarItem[];
  /** Describes how expanded panels are aligned. Defaults to: [[ToolbarPanelAlignment.Start]] */
  panelAlignment?: ToolbarPanelAlignment;
  /** Use Drag Interaction to open popups with nest action buttons */
  useDragInteraction?: boolean;
  /** Use mouse proximity to alter the opacity of the toolbar */
  useProximityOpacity?: boolean;
}

/** Component that displays tool settings as a bar across the top of the content view.
 * @beta
 */
export function ToolbarWithOverflow(props: ToolbarWithOverflowProps) {
  const expandsTo = props.expandsTo ? props.expandsTo : Direction.Bottom;
  const useDragInteraction = !!props.useDragInteraction;
  const useProximityOpacity = !!props.useProximityOpacity;
  const panelAlignment = props.panelAlignment ? props.panelAlignment : ToolbarPanelAlignment.Start;
  const useHeight = (expandsTo === Direction.Right || expandsTo === Direction.Left);
  const [isOverflowPanelOpen, setIsOverflowPanelOpen] = React.useState(false);
  const [popupPanelCount, setPopupPanelCount] = React.useState(0);

  const handlePopupPanelOpenClose = React.useCallback((isOpening: boolean) => {
    // use setImmediate to avoid warning about setting state in ToolbarWithOverflow from render method of PopupItem/PopupItemWithDrag
    setImmediate(() => {
      setPopupPanelCount((prev) => {
        const nextCount = isOpening ? (prev + 1) : (prev - 1);
        // tslint:disable-next-line: no-console
        console.log(`new popup count = ${nextCount}`);
        return nextCount < 0 ? 0 : nextCount;
      });
    });
  }, []);

  const ref = React.useRef<HTMLDivElement>(null);
  const width = React.useRef<number | undefined>(undefined);
  const availableNodes = React.useMemo<React.ReactNode>(() => {
    return props.items.map((item) => {
      return (
        <ToolbarItem
          key={item.id}
          item={item}
        />
      );
    });
  }, [props.items]);
  /* overflowItemKeys - keys of items to show in overflow panel
   * handleContainerResize - handler called when container <div> is resized.
   * handleOverflowResize - handler called when determining size of overflow indicator/button.
   * handleEntryResize - handler called when determining size of each item/button.  */
  const [overflowItemKeys, handleContainerResize, handleOverflowResize, handleEntryResize] = useOverflow(availableNodes, panelAlignment === ToolbarPanelAlignment.End);
  // handler called by ResizeObserver
  const handleResize = React.useCallback((w: number) => {
    width.current = w;
    width.current !== undefined && handleContainerResize(width.current);
  }, [handleContainerResize]);
  const resizeObserverRef = useResizeObserver(handleResize, useHeight);
  // handle open and closing overflow panel
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
  const availableItems = React.Children.toArray(availableNodes);
  const displayedItems = availableItems.reduce<Array<[string, React.ReactNode]>>((acc, child, index) => {
    const key = getChildKey(child, index);
    if (!overflowItemKeys || overflowItemKeys.indexOf(key) < 0) {
      acc.push([key, child]);
    }
    return acc;
  }, []);
  const overflowPanelItems = overflowItemKeys ? availableItems.reduce<Array<[string, React.ReactNode]>>((acc, child, index) => {
    const key = getChildKey(child, index);
    if (overflowItemKeys.indexOf(key) >= 0) {
      acc.push([key, child]);
    }
    return acc;
  }, []) : [];

  const direction = getToolbarDirection(expandsTo);
  const overflowExpandsTo = undefined !== props.overflowExpandsTo ? props.overflowExpandsTo : Direction.Right;
  const addOverflowButton = React.useCallback((atStart: boolean) => {
    const overflowItems = !!atStart ? overflowPanelItems.reverse() : overflowPanelItems;
    return (<ToolbarItemContext.Provider
      value={{
        hasOverflow: false,
        useHeight,
        onResize: handleOverflowResize,
      }}
    >
      <ToolbarOverflowButton
        onClick={onOverflowClick}
        panelNode={overflowItems.length > 0 && isOverflowPanelOpen &&
          <ToolbarOverflowPanel ref={panelRef} >
            <OverflowItemsContainer>
              {overflowItems.map(([key, child]) => {
                return (
                  <ToolbarItemContext.Provider
                    key={key}
                    value={{
                      hasOverflow: true,
                      useHeight,
                      onResize: () => { },
                    }}
                  >
                    {<ItemWrapper>{child}</ItemWrapper>}
                  </ToolbarItemContext.Provider>
                );
              })}
            </OverflowItemsContainer>
          </ToolbarOverflowPanel>
        }
      />
    </ToolbarItemContext.Provider>);
  }, [useHeight, overflowPanelItems, handleOverflowResize, isOverflowPanelOpen, onOverflowClick, panelRef]);

  const className = classnames(
    "components-toolbar-overflow-sizer",
    OrthogonalDirectionHelpers.getCssClassName(direction),
    props.className);

  const showOverflowAtStart = (direction === OrthogonalDirection.Horizontal) && (panelAlignment === ToolbarPanelAlignment.End);
  /* The ItemWrapper is used to wrap the <Item> <ExpandableItem> with a <div> that specifies a ref that the sizing logic uses to determine the
     size of the item. */
  return (
    <ToolbarWithOverflowDirectionContext.Provider value={
      {
        expandsTo, direction, overflowExpandsTo, panelAlignment, useDragInteraction, useProximityOpacity,
        overflowDirection: direction === OrthogonalDirection.Horizontal ? OrthogonalDirection.Vertical : OrthogonalDirection.Horizontal,
        openPopupCount: popupPanelCount, onPopupPanelOpenClose: handlePopupPanelOpenClose, overflowDisplayActive: overflowPanelItems.length > 0 && isOverflowPanelOpen,
      }
    }>
      {(availableItems.length > 0) &&
        <div
          className={className}
          ref={refs}
          style={props.style}
        >
          <ToolbarItems
            className="components-items"
            direction={direction}
          >
            {(!overflowItemKeys || overflowItemKeys.length > 0) && showOverflowAtStart && addOverflowButton(true)}
            {displayedItems.map(([key, child]) => {
              const onEntryResize = handleEntryResize(key);
              return (
                <ToolbarItemContext.Provider
                  key={key}
                  value={{
                    hasOverflow: false,
                    useHeight,
                    onResize: onEntryResize,
                  }}
                >
                  {<ItemWrapper >{child}</ItemWrapper>}
                </ToolbarItemContext.Provider>
              );
            })}
            {(!overflowItemKeys || overflowItemKeys.length > 0) && !showOverflowAtStart && addOverflowButton(false)}

          </ToolbarItems>
        </div>
      }
    </ToolbarWithOverflowDirectionContext.Provider >
  );
}

/** Returns key of a child. Must be used along with React.Children.toArray to preserve the semantics of availableItems.
 * @internal
 */
function getChildKey(child: React.ReactNode, index: number) {
  // istanbul ignore else
  if (React.isValidElement(child) && child.key !== null) {
    return child.key.toString();
  }
  return index.toString();
}

/** Returns a subset of toolbar item entry keys that exceed given width and should be overflowItemKeys.
 * @internal
 */
function determineOverflowItems(size: number, entries: ReadonlyArray<readonly [string, number]>, overflowButtonSize: number, overflowButtonAtStart: boolean): string[] {
  let toolbarSize = 0;
  const buttonPadding = 2;
  if (overflowButtonAtStart && entries.length > 0) {
    let i = entries.length - 1;
    for (; i >= 0; i--) {
      const w = entries[i][1] + buttonPadding;
      const newSettingsWidth = toolbarSize + w;
      if (newSettingsWidth > size) {
        toolbarSize += (overflowButtonSize + buttonPadding);
        break;
      }
      toolbarSize = newSettingsWidth;
    }
    if (i >= 0) {
      let j = i + 1;
      for (; j < entries.length; j++) {
        if (toolbarSize <= size)
          break;
        const w = entries[j][1] + buttonPadding;
        toolbarSize -= w;
      }

      return entries.slice(0, j).map((e) => e[0]);
    } else {
      return [];
    }
  } else {
    let i = 0;
    for (; i < entries.length; i++) {
      const w = entries[i][1] + buttonPadding;
      const newSettingsWidth = toolbarSize + w;
      if (newSettingsWidth > size) {
        toolbarSize += (overflowButtonSize + buttonPadding);
        break;
      }
      toolbarSize = newSettingsWidth;
    }
    let j = i;
    for (; j > 0; j--) {
      if (toolbarSize <= size)
        break;
      const w = entries[j][1] + buttonPadding;
      toolbarSize -= w;
    }

    return entries.slice(j).map((e) => e[0]);
  }
}

/** Hook that returns a list of overflowItemKeys availableItems.
 * @internal
 */
function useOverflow(availableItems: React.ReactNode, overflowButtonAtStart: boolean): [
  ReadonlyArray<string> | undefined,
  (size: number) => void,
  (size: number) => void,
  (key: string) => (size: number) => void,
] {
  const [overflowItemKeys, setOverflown] = React.useState<ReadonlyArray<string>>();
  const itemSizes = React.useRef(new Map<string, number | undefined>());
  const size = React.useRef<number | undefined>(undefined);
  const overflowButtonSize = React.useRef<number | undefined>(undefined);

  const calculateOverflow = React.useCallback(() => {
    const sizes = verifiedMapEntries(itemSizes.current);
    if (size.current === undefined ||
      sizes === undefined ||
      overflowButtonSize.current === undefined) {
      setOverflown(undefined);
      return;
    }

    // Calculate overflow.
    const newOverflown = determineOverflowItems(size.current, [...sizes.entries()], overflowButtonSize.current, overflowButtonAtStart);
    setOverflown((prevOverflown) => {
      return eql(prevOverflown, newOverflown) ? prevOverflown : newOverflown;
    });
  }, [overflowButtonAtStart]);

  React.useLayoutEffect(() => {
    const newEntryWidths = new Map<string, number | undefined>();
    const array = React.Children.toArray(availableItems);
    for (let i = 0; i < array.length; i++) {
      const child = array[i];
      const key = getChildKey(child, i);
      const lastW = itemSizes.current.get(key);
      newEntryWidths.set(key, lastW);
    }
    itemSizes.current = newEntryWidths;
    calculateOverflow();
  }, [availableItems, calculateOverflow]);

  const handleContainerResize = React.useCallback((w: number) => {
    const calculate = size.current !== w;
    size.current = w;
    calculate && calculateOverflow();
  }, [calculateOverflow]);

  const handleOverflowResize = React.useCallback((w: number) => {
    const calculate = overflowButtonSize.current !== w;
    overflowButtonSize.current = w;
    calculate && calculateOverflow();
  }, [calculateOverflow]);

  const handleEntryResize = React.useCallback((key: string) => (w: number) => {
    const oldW = itemSizes.current.get(key);
    if (oldW !== w) {
      itemSizes.current.set(key, w);
      calculateOverflow();
    }
  }, [calculateOverflow]);

  return [overflowItemKeys, handleContainerResize, handleOverflowResize, handleEntryResize];
}

/** Interface toolbars use to define context for its items.
 * @internal
 */
export interface ToolbarItemContextArgs {
  readonly hasOverflow: boolean;
  readonly useHeight: boolean;
  readonly onResize: (w: number) => void;
}

/** Interface toolbars use to define context for its items.
 * @internal
 */
// tslint:disable-next-line: variable-name
export const ToolbarItemContext = React.createContext<ToolbarItemContextArgs>(null!);

/** @internal */
export function useToolItemEntryContext() {
  return React.useContext(ToolbarItemContext);
}

function verifiedMapEntries<T>(map: Map<string, T | undefined>) {
  for (const [, val] of map) {
    // istanbul ignore next  during unit testing
    if (val === undefined)
      return undefined;
  }
  return map as Map<string, T>;
}

function eql(prev: readonly string[] | undefined, value: readonly string[]) {
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
