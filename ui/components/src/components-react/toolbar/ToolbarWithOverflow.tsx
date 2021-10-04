/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./Toolbar.scss";
import classnames from "classnames";
import * as React from "react";
import {
  ActionButton, CommonToolbarItem, ConditionalBooleanValue, ConditionalStringValue, CustomButtonDefinition,
  GroupButton, OnItemExecutedFunc, ToolbarItemUtilities,
} from "@itwin/appui-abstract";
import { BadgeUtilities, CommonProps, IconHelper, NoChildrenProps, useRefs } from "@itwin/core-react";
import { ToolbarButtonItem } from "./Item";
import { ToolbarItems } from "./Items";
import { ItemWrapper, useResizeObserverSingleDimension } from "./ItemWrapper";
import { ToolbarOverflowButton } from "./Overflow";
import { ToolbarOverflowPanel } from "./OverflowPanel";
import { PopupItem } from "./PopupItem";
import { PopupItemsPanel } from "./PopupItemsPanel";
import { PopupItemWithDrag } from "./PopupItemWithDrag";
import { Direction, DirectionHelpers, OrthogonalDirection, OrthogonalDirectionHelpers } from "./utilities/Direction";
import { UiComponents } from "../UiComponents";

/** Describes the data needed to insert a custom framework-specific button into an ToolbarWithOverflow.
 * @public
 */
export interface CustomToolbarItem extends CustomButtonDefinition {
  buttonNode?: React.ReactNode;
  panelContentNode?: React.ReactNode;
}

/** Describes toolbar item.
 * @public
 */
export type ToolbarItem = ActionButton | GroupButton | CustomToolbarItem;

/** CustomToolbarItem type guard.
 * @internal
 */
export function isCustomToolbarItem(item: ToolbarItem): item is CustomToolbarItem {
  return !!(item as CustomToolbarItem).isCustom && (("buttonNode" in item) || ("panelContentNode" in item));
}

/** @internal */
export const getToolbarDirection = (expandsTo: Direction): OrthogonalDirection => {
  const orthogonalDirection = DirectionHelpers.getOrthogonalDirection(expandsTo);
  return OrthogonalDirectionHelpers.inverse(orthogonalDirection);
};

/** Available alignment modes of [[ToolbarWithOverflow]] panels.
 * @public
 */
export enum ToolbarPanelAlignment {
  Start,
  End,
}

/** Enumeration of Toolbar Opacity setting.
 * @public
 */
export enum ToolbarOpacitySetting {
  /** Use the default background, box-shadow opacity and backdrop-filter blur */
  Defaults,
  /** Alter the opacity from transparent to the defaults based on mouse proximity */
  Proximity,
  /** Use a transparent background, box-shadow opacity and backdrop-filter blur */
  Transparent,
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
  readonly toolbarOpacitySetting: ToolbarOpacitySetting;
  readonly openPopupCount: number;
  readonly onPopupPanelOpenClose: (isOpening: boolean) => void;
  readonly overflowDisplayActive: boolean;
  readonly onItemExecuted: OnItemExecutedFunc;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Context used by Toolbar component to provide Direction to child components.
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ToolbarWithOverflowDirectionContext = React.createContext<ToolbarOverflowContextProps>({
  expandsTo: Direction.Bottom,
  direction: OrthogonalDirection.Horizontal,
  overflowExpandsTo: Direction.Right,
  overflowDirection: OrthogonalDirection.Vertical,
  panelAlignment: ToolbarPanelAlignment.Start,
  useDragInteraction: false,
  toolbarOpacitySetting: ToolbarOpacitySetting.Proximity,
  openPopupCount: 0,
  onPopupPanelOpenClose: /* istanbul ignore next */ (_isOpening: boolean) => { },
  overflowDisplayActive: false,
  onItemExecuted: /* istanbul ignore next */ (_item: any) => void {},
  onKeyDown: /* istanbul ignore next */ (_e: React.KeyboardEvent) => void {},
});

/** @internal */
export function CustomItem({ item, addGroupSeparator }: { item: CustomToolbarItem, addGroupSeparator: boolean }) {
  const { useDragInteraction } = useToolbarWithOverflowDirectionContext();

  if (item.panelContentNode) {
    const badge = BadgeUtilities.getComponentForBadgeType(item.badgeType);
    const title = ConditionalStringValue.getValue(item.label);
    return <PopupItem
      key={item.id}
      itemId={item.id}
      icon={item.icon ? IconHelper.getIconReactNode(item.icon, item.internalData) : /* istanbul ignore next */ <i className="icon icon-placeholder" />}
      isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
      title={title ? title : /* istanbul ignore next */ item.id}
      panel={item.panelContentNode}
      hideIndicator={useDragInteraction}
      badge={badge}
      addGroupSeparator={addGroupSeparator}
    />;
  }

  // istanbul ignore else
  if (item.buttonNode)
    return <>{item.buttonNode}</>;

  // istanbul ignore next
  return null;
}

/** @internal */
export function GroupPopupItem({ item, addGroupSeparator }: { item: GroupButton, addGroupSeparator: boolean }) {
  const { useDragInteraction } = useToolbarWithOverflowDirectionContext();
  const title = ConditionalStringValue.getValue(item.label)!;
  const badge = BadgeUtilities.getComponentForBadgeType(item.badgeType);

  if (useDragInteraction) {
    return <PopupItemWithDrag
      key={item.id}
      itemId={item.id}
      icon={IconHelper.getIconReactNode(item.icon, item.internalData)}
      isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
      title={title}
      groupItem={item}
      badge={badge}
      addGroupSeparator={addGroupSeparator}
    />;
  }
  return <PopupItem
    key={item.id}
    itemId={item.id}
    icon={IconHelper.getIconReactNode(item.icon, item.internalData)}
    isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
    title={title}
    panel={<PopupItemsPanel groupItem={item} activateOnPointerUp={false} />}
    badge={badge}
    hideIndicator={useDragInteraction}
    addGroupSeparator={addGroupSeparator}
  />;
}

/** @internal */
export function ActionItem({ item, addGroupSeparator }: { item: ActionButton, addGroupSeparator: boolean }) {
  const title = ConditionalStringValue.getValue(item.label)!;
  const badge = BadgeUtilities.getComponentForBadgeType(item.badgeType);
  const { onItemExecuted } = useToolbarWithOverflowDirectionContext();
  const onExecute = React.useCallback(() => {
    item.execute();
    onItemExecuted(item);
  }, [item, onItemExecuted]);

  return <ToolbarButtonItem
    itemId={item.id}
    key={item.id}
    isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
    title={title}
    icon={IconHelper.getIconReactNode(item.icon, item.internalData)}
    isActive={item.isActive}
    onClick={onExecute}
    badge={badge}
    addGroupSeparator={addGroupSeparator}
  />;
}

/** @internal */
export function ToolbarItemComponent({ item, addGroupSeparator }: { item: ToolbarItem, addGroupSeparator: boolean }) {
  if (ToolbarItemUtilities.isGroupButton(item)) {
    return <GroupPopupItem item={item} addGroupSeparator={addGroupSeparator} />;
  } else if (isCustomToolbarItem(item)) {
    return <CustomItem item={item} addGroupSeparator={addGroupSeparator} />;
  } else {
    // istanbul ignore else
    if (ToolbarItemUtilities.isActionButton(item)) {
      return <ActionItem item={item} addGroupSeparator={addGroupSeparator} />;
    }
  }
  // istanbul ignore next
  return null;
}

/** @internal */
export function useToolbarWithOverflowDirectionContext() {
  return React.useContext(ToolbarWithOverflowDirectionContext);
}

function OverflowItemsContainer(p: { children: React.ReactNode }) {
  return <>{p.children}</>;
}

function getItemWrapperClass(child: React.ReactNode) {
  // istanbul ignore else
  if (React.isValidElement(child)) {
    if (child.props && child.props.addGroupSeparator)
      return "components-toolbar-button-add-gap-before";
  }
  return undefined;
}

/** Properties of [[ToolbarWithOverflow]] component.
 * @public
 */
export interface ToolbarWithOverflowProps extends CommonProps, NoChildrenProps {
  /** Describes to which direction the popup panels are expanded. Defaults to: [[Direction.Bottom]] */
  expandsTo?: Direction;
  /** Describes to which direction the overflow popup panels are expanded. Defaults to: [[Direction.Right]] */
  overflowExpandsTo?: Direction;
  /** definitions for items of the toolbar. i.e. [[CommonToolbarItem]]. Items are expected to be already sorted by group and item. */
  items: CommonToolbarItem[];
  /** Describes how expanded panels are aligned. Defaults to: [[ToolbarPanelAlignment.Start]] */
  panelAlignment?: ToolbarPanelAlignment;
  /** Use Drag Interaction to open popups with nest action buttons */
  useDragInteraction?: boolean;
  /** Determines whether to use mouse proximity to alter the opacity of the toolbar */
  toolbarOpacitySetting?: ToolbarOpacitySetting;
  /** Optional function to call on any item execution */
  onItemExecuted?: OnItemExecutedFunc;
  /** Optional function to call on any KeyDown events processed by toolbar */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/** Component that displays tool settings as a bar across the top of the content view.
 * @public
 */
export function ToolbarWithOverflow(props: ToolbarWithOverflowProps) {
  const expandsTo = props.expandsTo ? props.expandsTo : Direction.Bottom;
  const useDragInteraction = !!props.useDragInteraction;
  const panelAlignment = props.panelAlignment ? props.panelAlignment : ToolbarPanelAlignment.Start;
  const useHeight = (expandsTo === Direction.Right || expandsTo === Direction.Left);
  const [isOverflowPanelOpen, setIsOverflowPanelOpen] = React.useState(false);
  const [popupPanelCount, setPopupPanelCount] = React.useState(0);
  const overflowTitle = React.useRef(UiComponents.translate("toolbar.overflow"));
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  });
  const handlePopupPanelOpenClose = React.useCallback((isOpening: boolean) => {
    // use setImmediate to avoid warning about setting state in ToolbarWithOverflow from render method of PopupItem/PopupItemWithDrag
    setImmediate(() => {
      // istanbul ignore next
      if (!isMounted.current)
        return;
      setPopupPanelCount((prev) => {
        const nextCount = isOpening ? (prev + 1) : (prev - 1);
        // eslint-disable-next-line no-console
        // console.log(`new popup count = ${nextCount}`);
        return nextCount < 0 ? /* istanbul ignore next */ 0 : nextCount;
      });
    });
  }, []);

  const ref = React.useRef<HTMLDivElement>(null);
  const width = React.useRef<number | undefined>(undefined);
  const availableNodes = React.useMemo<React.ReactNode>(() => {
    return props.items.map((item, index) => {
      let addGroupSeparator = false;
      if (index > 0)
        addGroupSeparator = item.groupPriority !== props.items[index - 1].groupPriority;
      return (
        <ToolbarItemComponent
          key={item.id}
          item={item}
          addGroupSeparator={!!addGroupSeparator}
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
  const resizeObserverRef = useResizeObserverSingleDimension(handleResize, useHeight);
  const handleClick = React.useCallback(() => {
    setIsOverflowPanelOpen((prev) => !prev);
  }, []);
  // istanbul ignore next - NEEDSWORK add complete tests
  const handleClose = React.useCallback(() => {
    setIsOverflowPanelOpen(false);
  }, []);

  const refs = useRefs(ref, resizeObserverRef);
  const availableItems = React.Children.toArray(availableNodes);
  const displayedItems = availableItems.reduce<Array<[string, React.ReactNode]>>((acc, child, index) => {
    const key = getChildKey(child, index);
    if (!overflowItemKeys || overflowItemKeys.indexOf(key) < 0) {
      acc.push([key, child]);
    }
    return acc;
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        expandsTo={expandsTo}
        onClick={handleClick}
        onClose={handleClose}
        open={overflowItems.length > 0 && isOverflowPanelOpen}
        panelNode={
          <ToolbarOverflowPanel>
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
                    {<ItemWrapper className={getItemWrapperClass(child)}>{child}</ItemWrapper>}
                  </ToolbarItemContext.Provider>
                );
              })}
            </OverflowItemsContainer>
          </ToolbarOverflowPanel>
        }
        title={overflowTitle.current}
      />
    </ToolbarItemContext.Provider>);
  }, [handleClick, handleClose, handleOverflowResize, isOverflowPanelOpen, expandsTo, overflowPanelItems, useHeight]);

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
        expandsTo, direction, overflowExpandsTo, panelAlignment, useDragInteraction,
        toolbarOpacitySetting: undefined !== props.toolbarOpacitySetting ? props.toolbarOpacitySetting : ToolbarOpacitySetting.Proximity,
        overflowDirection: direction === OrthogonalDirection.Horizontal ? OrthogonalDirection.Vertical : OrthogonalDirection.Horizontal,
        openPopupCount: popupPanelCount,
        onPopupPanelOpenClose: handlePopupPanelOpenClose,
        overflowDisplayActive: overflowPanelItems.length > 0 && isOverflowPanelOpen,
        onItemExecuted: props.onItemExecuted ? props.onItemExecuted : () => { },
        onKeyDown: props.onKeyDown ? props.onKeyDown : /* istanbul ignore next */ (_e: React.KeyboardEvent) => { },
      }
    }>
      {(availableItems.length > 0) &&
        <div
          className={className}
          ref={refs}
          style={props.style}
          onKeyDown={props.onKeyDown}
          role="presentation"
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
                  {<ItemWrapper className={getItemWrapperClass(child)}>{child}</ItemWrapper>}
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
  // istanbul ignore next
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
// eslint-disable-next-line @typescript-eslint/naming-convention
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
  // istanbul ignore next
  if (prev.length !== value.length)
    return false;
  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    const v = value[i];
    // istanbul ignore next
    if (p !== v)
      return false;
  }
  return true;
}
