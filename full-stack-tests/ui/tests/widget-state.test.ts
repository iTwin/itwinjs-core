/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { test, expect, Page } from '@playwright/test';
import assert from 'assert';
import { runKeyin } from './Utils';

enum WidgetState {
  Open = 0,
  Hidden = 2,
}

async function setWidgetState(page: Page, widgetId: string, widgetState: WidgetState) {
  await runKeyin(page, `widget setstate ${widgetId} ${widgetState}`);
}

test.describe("widget state", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    assert(baseURL);
    await page.goto(`${baseURL}?frontstage=appui-test-providers:WidgetApi`);
  });

  test("should hide a floating widget", async ({ page }) => {
    const tab = await page.locator(`[title="View Attributes"]`);
    await expect(tab).toBeVisible();

    const widgetId = "appui-test-providers:ViewAttributesWidget";
    await setWidgetState(page, widgetId, WidgetState.Hidden);
    await expect(tab).not.toBeVisible();

    await setWidgetState(page, widgetId, WidgetState.Open);
    await expect(tab).toBeVisible();
  });
});
