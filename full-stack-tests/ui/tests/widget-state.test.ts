/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { test, expect, Page } from '@playwright/test';
import assert from 'assert';
import { activeTabLocator, floatingWidgetLocator, runKeyin, tabLocator } from './Utils';

enum WidgetState {
  Open = 0,
  Closed = 1,
  Hidden = 2,
}

// Known widget ids.
enum Widget {
  ViewAttributes = "appui-test-providers:ViewAttributesWidget",
  FW1 = "FW-1",
  FW2 = "FW-2",
  FW3 = "FW-3",
}

// Known floating widget container ids.
enum FloatingWidget {
  ViewAttributes = "appui-test-providers:ViewAttributesWidget",
  Floating = "appui-test-providers:floating-widget",
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
    const widget = floatingWidgetLocator(page, FloatingWidget.ViewAttributes);
    const tab = tabLocator(page, "View Attributes");
    await expect(tab).toBeVisible();
    await expect(widget).toBeVisible();

    await setWidgetState(page, Widget.ViewAttributes, WidgetState.Hidden);
    await expect(tab).not.toBeVisible();
    await expect(widget).not.toBeVisible();

    await setWidgetState(page, Widget.ViewAttributes, WidgetState.Open);
    await expect(tab).toBeVisible();
    await expect(widget).toBeVisible();
  });

  test("should hide a floating widget (multiple tabs)", async ({ page }) => {
    const widget = floatingWidgetLocator(page, "appui-test-providers:floating-widget");
    const tab1 = tabLocator(page, Widget.FW1);
    const tab2 = tabLocator(page, Widget.FW2);
    const tab3 = tabLocator(page, Widget.FW3);
    await expect(tab1).toBeVisible();
    await expect(tab2).toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(widget).toBeVisible();

    await setWidgetState(page, Widget.FW1, WidgetState.Hidden);
    await expect(tab1).not.toBeVisible();
    await expect(tab2).toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(widget).toBeVisible();

    await setWidgetState(page, Widget.FW2, WidgetState.Hidden);
    await expect(tab1).not.toBeVisible();
    await expect(tab2).not.toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(widget).toBeVisible();

    await setWidgetState(page, Widget.FW3, WidgetState.Hidden);
    await expect(tab1).not.toBeVisible();
    await expect(tab2).not.toBeVisible();
    await expect(tab3).not.toBeVisible();
    await expect(widget).not.toBeVisible();

    await setWidgetState(page, Widget.FW1, WidgetState.Open);
    await expect(tab1).toBeVisible();
    await expect(tab2).not.toBeVisible();
    await expect(tab3).not.toBeVisible();
    await expect(widget).toBeVisible();
  });

  test("should maintain active tab when widgets are hidden", async ({ page }) => {
    const widget = floatingWidgetLocator(page, "appui-test-providers:floating-widget");
    const activeTab = activeTabLocator(widget);
    const tab1 = tabLocator(page, Widget.FW1);
    const tab2 = tabLocator(page, Widget.FW2);
    const tab3 = tabLocator(page, Widget.FW3);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-1");

    await setWidgetState(page, Widget.FW1, WidgetState.Hidden);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-2");

    await setWidgetState(page, Widget.FW2, WidgetState.Hidden);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-3");

    await setWidgetState(page, Widget.FW3, WidgetState.Hidden);
    await expect(activeTab).not.toBeVisible();

    await setWidgetState(page, Widget.FW2, WidgetState.Open);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-2");

    await setWidgetState(page, Widget.FW1, WidgetState.Closed);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-2");

    await setWidgetState(page, Widget.FW3, WidgetState.Open);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-3");
  });
});
