/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Locator, Page } from '@playwright/test';

export async function runKeyin(page: Page, keyin: string) {
  const ui = page.locator("#uifw-configurableui-wrapper");
  await ui.waitFor();
  await page.keyboard.press("Control+F2");
  const input = page.locator(`[placeholder="Enter key-in"]`);
  await input.fill(keyin);
  await input.press("Enter");
}

type PanelSide = "left" | "right" | "top" | "bottom";

export function floatingWidgetLocator(page: Page, widgetId: string) {
  return page.locator(`[data-widget-id="${widgetId}"]`);
}

type WidgetLocatorArgs = { tab: Locator } | { panel: Locator };

export function widgetLocator(page: Page, args: WidgetLocatorArgs) {
  if ("tab" in args)
    return page.locator(".nz-widget-widget", { has: args.tab });
  return args.panel.locator(".nz-widget-widget");
}

export function tabLocator(page: Page, label: string) {
  return page.locator(`[title="${label}"]`);
}

export function activeTabLocator(widget: Locator) {
  return widget.locator(".nz-active");
}

export function panelLocator(page: Page, side: PanelSide) {
  return page.locator(`.nz-widgetPanels-panel.nz-${side}`);
}
