/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Locator, Page } from '@playwright/test';

export async function runKeyin(page: Page, keyin: string) {
  await page.keyboard.press("Control+F2");
  const input = page.locator(`[placeholder="Enter key-in"]`);
  await input.fill(keyin);
  await input.press("Enter");
}

export function tabLocator(page: Page, label: string) {
  return page.locator(`[title="${label}"]`);
}

export function floatingWidgetLocator(page: Page, widgetId: string) {
  return page.locator(`[data-widget-id="${widgetId}"]`);
}

export function activeTabLocator(widget: Locator) {
  return widget.locator(".nz-active");
}
