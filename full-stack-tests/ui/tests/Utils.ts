/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BrowserContext, expect, Locator, Page } from '@playwright/test';

export async function runKeyin(page: Page, keyin: string) {
  const ui = page.locator("#uifw-configurableui-wrapper");
  await ui.waitFor();
  await page.keyboard.press("Control+F2");
  const input = page.locator(`[placeholder="Enter key-in"]`);
  await input.fill(keyin);
  await input.press("Enter");
}

type PanelSide = "left" | "right" | "top" | "bottom";

type FloatingWidgetLocatorArgs = { page: Page, id: string } | { tab: Locator };

export function floatingWidgetLocator(args: FloatingWidgetLocatorArgs) {
  if ("tab" in args) {
    return args.tab.page().locator(".nz-widget-floatingWidget", { has: args.tab });
  }
  return args.page.locator(`[data-widget-id="${args.id}"]`);
}

type WidgetLocatorArgs = { tab: Locator } | { panel: Locator };

export function widgetLocator(args: WidgetLocatorArgs) {
  if ("tab" in args)
    return args.tab.page().locator(".nz-widget-widget", { has: args.tab });
  return args.panel.locator(".nz-widget-widget");
}

export function tabLocator(page: Page, label: string) {
  return page.locator(`[title="${label}"]`);
}

export function activeTabLocator(widget: Locator) {
  return widget.locator(".nz-active");
}

type PanelLocatorArgs = { page: Page, side: PanelSide } | { tab: Locator };

export function panelLocator(args: PanelLocatorArgs) {
  if ("tab" in args) {
    return args.tab.page().locator(".nz-widgetPanels-panel", { has: args.tab });
  }
  return args.page.locator(`.nz-widgetPanels-panel.nz-${args.side}`);
}

export function titleBarHandleLocator(widget: Locator) {
  return widget.locator(".nz-handle");
}

export function frontstageLocator(page: Page) {
  return page.locator(".uifw-widgetPanels-frontstage");
}

export interface SavedFrontstageState {
  nineZone: {
    floatingWidgets: {
      allIds: string[];
    };
    popoutWidgets: {
      allIds: string[];
    };
    widgets: {
      [id in string]: {
        id: string;
        activeTabId: string;
        tabs: string[];
      };
    }
  };
  widgets: { id: string }[];
}

/** Assertion helper that polls saved frontstage state from local storage until `conditionFn` is satisfied. */
export async function expectSavedFrontstageState<T extends SavedFrontstageState>(context: BrowserContext, conditionFn: (state: T) => boolean) {
  await expect.poll(async () => {
    const storage = await context.storageState();
    const origin = storage.origins[0];
    const localStorage = origin.localStorage;
    const setting = localStorage.find(({ name }) => {
      return name.startsWith("uifw-frontstageSettings.frontstageState[");
    });
    if (!setting)
      return undefined;
    const state = JSON.parse(setting.value);
    return conditionFn(state);
  }, {}).toBeTruthy();
}

/** Asserts that a tab is in a specified panel section. */
export async function expectTabInPanelSection(tab: Locator, side: PanelSide, sectionId: 0 | 1) {
  const page = tab.page();
  const panel = panelLocator({ tab });
  const section = page.locator(`.nz-panel-section-${sectionId}`, { has: tab });
  await expect(panel).toHaveClass(new RegExp(`nz-${side}`));
  await expect(section, `expected tab to be in section '${sectionId}'`).toBeVisible();
}
