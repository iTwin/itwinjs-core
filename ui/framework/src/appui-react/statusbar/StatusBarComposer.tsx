/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import classnames from "classnames";
import * as React from "react";
import {
  AbstractStatusBarActionItem, AbstractStatusBarLabelItem, CommonStatusBarItem, ConditionalBooleanValue, ConditionalStringValue,
  isAbstractStatusBarActionItem, isAbstractStatusBarLabelItem, StatusBarItemsManager, StatusBarLabelSide, StatusBarSection,
} from "@itwin/appui-abstract";
import { CommonProps, Icon, useRefs, useResizeObserver } from "@itwin/core-react";
import { eqlOverflown, FooterIndicator } from "@itwin/appui-layout-react";
import { SyncUiEventArgs, SyncUiEventDispatcher } from "../syncui/SyncUiEventDispatcher";
import { Indicator } from "../statusfields/Indicator";
import { StatusBarOverflow } from "./Overflow";
import { StatusBarOverflowPanel } from "./OverflowPanel";
import { StatusBarCenterSection, StatusBarContext, StatusBarLeftSection, StatusBarRightSection, StatusBarSpaceBetween } from "./StatusBar";
import { isStatusBarItem } from "./StatusBarItem";
import { useDefaultStatusBarItems } from "./useDefaultStatusBarItems";
import { useUiItemsProviderStatusBarItems } from "./useUiItemsProviderStatusBarItems";

/** Private  function to generate a value that will allow the proper order to be maintained when items are placed in overflow panel */
function getCombinedSectionItemPriority(item: CommonStatusBarItem) {
  let sectionValue = 0;
  if (item.section === StatusBarSection.Center)
    sectionValue = 100000;
  else if (item.section === StatusBarSection.Context)
    sectionValue = 200000;
  else if (item.section === StatusBarSection.Right)
    sectionValue = 300000;
  return sectionValue + item.itemPriority;
}

interface DockedStatusBarEntryContextArg {
  readonly isOverflown: boolean;
  readonly onResize: (w: number) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const DockedStatusBarEntryContext = React.createContext<DockedStatusBarEntryContextArg>(null!);
DockedStatusBarEntryContext.displayName = "nz:DockedStatusBarEntryContext";

/** @internal */
export function useStatusBarEntry() {
  return React.useContext(DockedStatusBarEntryContext);
}

/** Properties of [[DockedStatusBarItem]] component.
 * @internal future
 */
export interface StatusBarItemProps extends CommonProps {
  /** Tool setting content. */
  children?: React.ReactNode;
}

/** Used in [[StatusBarComposer]] component to display a statusbar item.
 * @internal future
 */
export function DockedStatusBarItem(props: StatusBarItemProps) {
  const { onResize } = useStatusBarEntry();
  const ref = useResizeObserver<HTMLDivElement>(onResize);
  const className = classnames(
    "uifw-statusbar-item-container",
    props.className,
  );
  return (
    <div
      data-item-id={props.itemId}
      data-item-type="status-bar-item"
      className={className}
      ref={ref}
      style={props.style}
    >
      {props.children}
    </div>
  );
}

interface DockedStatusBarEntryProps {
  children?: React.ReactNode;
  entryKey: string;
  getOnResize: (key: string) => (w: number) => void;
}

/** Wrapper for status bar entries so their size can be used to determine if the status bar container can display them or if they will need to be placed in an overflow panel. */
// eslint-disable-next-line @typescript-eslint/naming-convention, no-shadow
const DockedStatusBarEntry = React.memo<DockedStatusBarEntryProps>(function DockedStatusbarEntry({ children, entryKey, getOnResize }) {
  const onResize = React.useMemo(() => getOnResize(entryKey), [getOnResize, entryKey]);
  const entry = React.useMemo<DockedStatusBarEntryContextArg>(() => ({
    isOverflown: false,
    onResize,
  }), [onResize]);
  return (
    <DockedStatusBarEntryContext.Provider value={entry}>
      {children}
    </DockedStatusBarEntryContext.Provider>
  );
});

/** Private function to set up sync event monitoring of statusbar items */
function useStatusBarItemSyncEffect(itemsManager: StatusBarItemsManager, syncIdsOfInterest: string[]) {
  React.useEffect(() => {
    const handleSyncUiEvent = (args: SyncUiEventArgs) => {
      if (0 === syncIdsOfInterest.length)
        return;

      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value.toLowerCase()))) {
        // process each item that has interest
        itemsManager.refreshAffectedItems(args.eventIds);
      }
    };

    // Note: that items with conditions have condition run when loaded into the items manager
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
    return () => {
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
    };
  }, [itemsManager, itemsManager.items, syncIdsOfInterest]);
}

/** function to produce a StatusBarItem component from an AbstractStatusBarLabelItem */
function generateActionStatusLabelItem(item: AbstractStatusBarLabelItem, isInFooterMode: boolean): React.ReactNode {
  const iconPaddingClass = item.labelSide === StatusBarLabelSide.Left ? "nz-icon-padding-right" : "nz-icon-padding-left";
  return (<FooterIndicator
    isInFooterMode={isInFooterMode}
  >
    {item.icon && <Icon iconSpec={item.icon} />}
    {item.label && <span className={iconPaddingClass}>{ConditionalStringValue.getValue(item.label)}</span>}
  </FooterIndicator>
  );
}

/** function to produce a StatusBarItem component from an AbstractStatusBarActionItem */
function generateActionStatusBarItem(item: AbstractStatusBarActionItem, isInFooterMode: boolean): React.ReactNode {
  return <Indicator toolTip={ConditionalStringValue.getValue(item.tooltip)} opened={false} onClick={item.execute} iconSpec={item.icon}
    isInFooterMode={isInFooterMode} />;
}

/** local function to combine items from Stage and from Extensions */
function combineItems(stageItems: ReadonlyArray<CommonStatusBarItem>, addonItems: ReadonlyArray<CommonStatusBarItem>) {
  const items: CommonStatusBarItem[] = [];
  if (stageItems.length)
    items.push(...stageItems);
  if (addonItems.length)
    items.push(...addonItems);
  return items;
}

/** local function to ensure a width value is defined for a status bar entries.  */
function verifiedMapEntries<T>(map: Map<string, T | undefined>) {
  for (const [, val] of map) {
    // istanbul ignore next
    if (val === undefined)
      return undefined;
  }
  return map as Map<string, T>;
}

/** Returns a subset of docked entry keys that exceed given width and should be placed in overflow panel. */
function getItemToPlaceInOverflow(width: number, docked: ReadonlyArray<readonly [string, number]>, overflowWidth: number) {
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

  const overflowItems = new Array<string>();
  for (i = j; i < docked.length; i++) {
    overflowItems.push(docked[i][0]);
  }
  return overflowItems;
}

function isItemInOverflow(id: string, overflowItemIds: ReadonlyArray<string> | undefined) {
  if (!overflowItemIds || 0 === overflowItemIds.length)
    return false;
  return !!overflowItemIds.find((value) => value === id);
}

/** Properties for the [[StatusBarComposer]] React components
 * @public
 */
export interface StatusBarComposerProps extends CommonProps {
  /** Status Bar items */
  items: CommonStatusBarItem[];

  /** CSS class name override for the overall Status Bar */
  mainClassName?: string;
  /** CSS class name override for the left section */
  leftClassName?: string;
  /** CSS class name override for the center section */
  centerClassName?: string;
  /** CSS class name override for the right section */
  rightClassName?: string;
}

/** Component to load components into the [[StatusBar]].
 * @public
 */
export function StatusBarComposer(props: StatusBarComposerProps) {
  const { className, style, items, mainClassName, leftClassName, centerClassName, rightClassName } = props;
  const [defaultItemsManager, setDefaultItemsManager] = React.useState(() => new StatusBarItemsManager(items));
  const [isOverflowPanelOpen, setIsOverflowPanelOpen] = React.useState(false);
  const containerWidth = React.useRef<number | undefined>(undefined);

  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      setDefaultItemsManager(new StatusBarItemsManager(items));
    }
  }, [items]);
  const defaultItems = useDefaultStatusBarItems(defaultItemsManager);
  const syncIdsOfInterest = React.useMemo(() => StatusBarItemsManager.getSyncIdsOfInterest(defaultItems), [defaultItems]);
  useStatusBarItemSyncEffect(defaultItemsManager, syncIdsOfInterest);

  const statusBarContext = React.useContext(StatusBarContext);
  const [addonItemsManager] = React.useState(new StatusBarItemsManager());
  const addonItems = useUiItemsProviderStatusBarItems(addonItemsManager);
  const addonSyncIdsOfInterest = React.useMemo(() => StatusBarItemsManager.getSyncIdsOfInterest(addonItems), [addonItems]);
  useStatusBarItemSyncEffect(addonItemsManager, addonSyncIdsOfInterest);

  const statusBarItems = React.useMemo(() => combineItems(defaultItems, addonItems), [defaultItems, addonItems]);
  const entryWidths = React.useRef(new Map<string, number | undefined>());
  const overflowWidth = React.useRef<number | undefined>(undefined);
  const [overflown, setOverflown] = React.useState<ReadonlyArray<string>>();

  const calculateOverflow = React.useCallback(() => {
    const widths = verifiedMapEntries(entryWidths.current);
    if (containerWidth.current === undefined ||
      widths === undefined ||
      overflowWidth.current === undefined
    ) {
      setOverflown(new Array<string>());
      return;
    }

    // Calculate overflow.
    const newOverflown = getItemToPlaceInOverflow(containerWidth.current, [...widths.entries()], overflowWidth.current);
    if (!eqlOverflown(overflown, newOverflown)) {
      setOverflown(newOverflown);
      // istanbul ignore next
      if (0 === newOverflown.length && isOverflowPanelOpen)
        setIsOverflowPanelOpen(false);
    }
  }, [isOverflowPanelOpen, overflown]);

  const handleOverflowResize = React.useCallback((w: number) => {
    const calculate = overflowWidth.current !== w;
    overflowWidth.current = w;
    calculate && calculateOverflow();
  }, [calculateOverflow]);

  const handleEntryResize = React.useCallback((key: string) => (w: number) => {
    const oldW = entryWidths.current.get(key);
    if ((undefined === oldW) || Math.abs(oldW - w) > 2) {
      entryWidths.current.set(key, w);
      calculateOverflow();
    }
  }, [calculateOverflow]);

  /** generate a wrapped status bar entry that will report its size. */
  const getComponent = React.useCallback((item: CommonStatusBarItem, key: string): React.ReactNode => {
    return (
      <DockedStatusBarEntry
        key={key}
        entryKey={key}
        getOnResize={handleEntryResize}
      >
        <DockedStatusBarItem key={key} itemId={item.id} >
          {isStatusBarItem(item) && item.reactNode}
          {isAbstractStatusBarActionItem(item) && generateActionStatusBarItem(item, statusBarContext.isInFooterMode)}
          {isAbstractStatusBarLabelItem(item) && generateActionStatusLabelItem(item, statusBarContext.isInFooterMode)}
        </DockedStatusBarItem>
      </DockedStatusBarEntry>
    );
  }, [statusBarContext.isInFooterMode, handleEntryResize]);

  const getSectionItems = React.useCallback((section: StatusBarSection): React.ReactNode[] => {
    const sectionItems = statusBarItems
      .filter((item) => item.section as number === section && !isItemInOverflow(item.id, overflown) && !ConditionalBooleanValue.getValue(item.isHidden))
      .sort((a, b) => a.itemPriority - b.itemPriority);

    return sectionItems.map((sectionItem) => (
      <React.Fragment key={sectionItem.id}>
        {getComponent(sectionItem, sectionItem.id)}
      </React.Fragment>
    ));
  }, [statusBarItems, overflown, getComponent]);

  const getOverflowItems = React.useCallback((): React.ReactNode[] => {
    const itemsInOverflow = statusBarItems
      .filter((item) => isItemInOverflow(item.id, overflown) && !ConditionalBooleanValue.getValue(item.isHidden))
      .sort((a, b) => getCombinedSectionItemPriority(a) - getCombinedSectionItemPriority(b)).reverse();

    return itemsInOverflow.map((item) => (
      <React.Fragment key={item.id}>
        {getComponent(item, item.id)}
      </React.Fragment>
    ));
  }, [statusBarItems, overflown, getComponent]);

  const handleContainerResize = React.useCallback((w: number) => {
    if ((undefined === containerWidth.current) || Math.abs(containerWidth.current - w) > 2) {
      containerWidth.current = w;
      calculateOverflow();
    }
  }, [calculateOverflow]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const targetRef = React.useRef<HTMLDivElement>(null);
  const resizeObserverRef = useResizeObserver(handleContainerResize);
  // allow  both the containerRef and the resize observer function that takes a ref to be processed when the ref is set.
  const refs = useRefs(containerRef, resizeObserverRef);

  const onOverflowClick = React.useCallback(() => {
    setIsOverflowPanelOpen((prev) => !prev);
  }, []);
  // istanbul ignore next
  const handleOnClose = React.useCallback(() => {
    setIsOverflowPanelOpen(false);
  }, []);
  const leftItems = React.useMemo(() => getSectionItems(StatusBarSection.Left), [getSectionItems]);
  const centerItems = React.useMemo(() => getSectionItems(StatusBarSection.Center), [getSectionItems]);
  const rightItems = React.useMemo(() => getSectionItems(StatusBarSection.Right), [getSectionItems]);
  const contextItems = React.useMemo(() => getSectionItems(StatusBarSection.Context), [getSectionItems]);
  const overflowItems = React.useMemo(() => getOverflowItems(), [getOverflowItems]);

  const containerClassName = classnames(
    "uifw-statusbar-docked",
    className,
  );

  return (
    <div
      className={containerClassName}
      ref={refs}
      style={style}
      role="presentation"
    >
      <StatusBarSpaceBetween className={mainClassName}>
        <StatusBarLeftSection className={leftClassName}>
          {leftItems}
        </StatusBarLeftSection>
        <StatusBarCenterSection className={centerClassName}>
          {centerItems}
          {contextItems}
        </StatusBarCenterSection>
        <StatusBarRightSection className={rightClassName}>
          {rightItems}
          {(!overflown || overflown.length > 0) && (
            <>
              <StatusBarOverflow
                onClick={onOverflowClick}
                onResize={handleOverflowResize}
                ref={targetRef}
              />
              {overflowItems.length > 0 && isOverflowPanelOpen && targetRef.current &&
                <StatusBarOverflowPanel
                  onClose={handleOnClose}
                  open={true}
                  target={targetRef.current}
                >
                  <div className="uifw-statusbar-overflow-items-container" data-testid="uifw-statusbar-overflow-items-container">
                    {overflowItems.map((overflowEntry) => overflowEntry)}
                  </div>
                </StatusBarOverflowPanel>
              }
            </>
          )}

        </StatusBarRightSection>
      </StatusBarSpaceBetween>
    </div>
  );
}
