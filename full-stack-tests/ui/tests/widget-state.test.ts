/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { test, expect, Page } from '@playwright/test';
import assert from 'assert';
import { activeTabLocator, expectSavedFrontstageState, floatingWidgetLocator, panelLocator, runKeyin, tabLocator, widgetLocator } from './Utils';

enum WidgetState {
  Open = 0,
  Closed = 1,
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
    const widget = floatingWidgetLocator(page, "appui-test-providers:ViewAttributesWidget");
    const tab = tabLocator(page, "View Attributes");
    await expect(tab).toBeVisible();
    await expect(widget).toBeVisible();

    await setWidgetState(page, "appui-test-providers:ViewAttributesWidget", WidgetState.Hidden);
    await expect(tab).not.toBeVisible();
    await expect(widget).not.toBeVisible();

    await setWidgetState(page, "appui-test-providers:ViewAttributesWidget", WidgetState.Open);
    await expect(tab).toBeVisible();
    await expect(widget).toBeVisible();
  });

  test("should hide a floating widget (multiple tabs)", async ({ page }) => {
    const widget = floatingWidgetLocator(page, "appui-test-providers:floating-widget");
    const tab1 = tabLocator(page, "FW-1");
    const tab2 = tabLocator(page, "FW-2");
    const tab3 = tabLocator(page, "FW-3");
    await expect(tab1).toBeVisible();
    await expect(tab2).toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(widget).toBeVisible();

    await setWidgetState(page, "FW-1", WidgetState.Hidden);
    await expect(tab1).not.toBeVisible();
    await expect(tab2).toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(widget).toBeVisible();

    await setWidgetState(page, "FW-2", WidgetState.Hidden);
    await expect(tab1).not.toBeVisible();
    await expect(tab2).not.toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(widget).toBeVisible();

    await setWidgetState(page, "FW-3", WidgetState.Hidden);
    await expect(tab1).not.toBeVisible();
    await expect(tab2).not.toBeVisible();
    await expect(tab3).not.toBeVisible();
    await expect(widget).not.toBeVisible();

    await setWidgetState(page, "FW-1", WidgetState.Open);
    await expect(tab1).toBeVisible();
    await expect(tab2).not.toBeVisible();
    await expect(tab3).not.toBeVisible();
    await expect(widget).toBeVisible();
  });

  test("should maintain active tab when widgets are hidden", async ({ page }) => {
    const widget = floatingWidgetLocator(page, "appui-test-providers:floating-widget");
    const activeTab = activeTabLocator(widget);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-1");

    await setWidgetState(page, "FW-1", WidgetState.Hidden);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-2");

    await setWidgetState(page, "FW-2", WidgetState.Hidden);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-3");

    await setWidgetState(page, "FW-3", WidgetState.Hidden);
    await expect(activeTab).not.toBeVisible();

    await setWidgetState(page, "FW-2", WidgetState.Open);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-2");

    await setWidgetState(page, "FW-1", WidgetState.Closed);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-2");

    await setWidgetState(page, "FW-3", WidgetState.Open);
    await expect(activeTab).toHaveAttribute("data-item-id", "FW-3");
  });

  test("should maintain bounds of a hidden floating widget", async ({ page }) => {
    await setWidgetState(page, "FW-2", WidgetState.Hidden);
    await setWidgetState(page, "FW-3", WidgetState.Hidden);

    const widget = floatingWidgetLocator(page, "appui-test-providers:floating-widget");
    const widgetBounds = await widget.boundingBox();
    expect(widgetBounds).toBeDefined();

    await setWidgetState(page, "FW-1", WidgetState.Hidden);
    await expect(widget).not.toBeVisible();

    await setWidgetState(page, "FW-1", WidgetState.Open);
    const newWidgetBounds = await widget.boundingBox();
    expect(newWidgetBounds).toEqual(widgetBounds);
  });

  test("should maintain bounds of a hidden floating widget (after reload)", async ({ context, page }) => {
    await setWidgetState(page, "FW-2", WidgetState.Hidden);
    await setWidgetState(page, "FW-3", WidgetState.Hidden);

    const widget = floatingWidgetLocator(page, "appui-test-providers:floating-widget");
    const widgetBounds = await widget.boundingBox();
    expect(widgetBounds).toBeDefined();

    await setWidgetState(page, "FW-1", WidgetState.Hidden);
    await expect(widget).not.toBeVisible();

    // Wait for "FW-1" state to be saved before reloading.
    await expectSavedFrontstageState(context, (state) => {
      return state.widgets.allIds.includes("FW-1");
    });

    await page.reload();

    await setWidgetState(page, "FW-1", WidgetState.Open);
    const newWidgetBounds = await widget.boundingBox();
    expect(newWidgetBounds).toEqual(widgetBounds);
  });

  test("should maintain location of a panel widget (after reload)", async ({ context, page }) => {
    const tab1 = tabLocator(page, "WT-A");
    const tab2 = tabLocator(page, "WT-2");
    const widget = widgetLocator(page, { tab: tab1 });
    const body = page.locator("body");

    await expect(widget).toHaveClass(/nz-panel-section-0/);

    // Move from top start widget to top end widget.
    const bounds2 = (await tab2.boundingBox())!;
    await tab1.dispatchEvent("mousedown", { clientX: 0, clientY: 0 });
    await tab1.dispatchEvent("mousemove", { clientX: 20, clientY: 20 });
    await body.dispatchEvent("mousemove", { clientX: bounds2.x, clientY: bounds2.y });
    await body.dispatchEvent("mouseup");

    await setWidgetState(page, "WT-A", WidgetState.Hidden);

    await expectSavedFrontstageState(context, (state) => {
      return state.widgets.allIds.includes("WT-A");
    });
    await page.reload();

    await setWidgetState(page, "WT-A", WidgetState.Open);
    await expect(widget).toHaveClass(/nz-panel-section-1/);
  });

  test("should hide a panel section", async ({ page }) => {
    const panel = panelLocator(page, "left");
    const widget = widgetLocator(page, { panel });
    const tab = tabLocator(page, "WL-A");
    await expect(tab).toBeVisible();
    await expect(widget).toHaveCount(2);

    await setWidgetState(page, "WL-A", WidgetState.Hidden);
    await expect(tab).not.toBeVisible();
    await expect(widget).toHaveCount(1);
  });

  test("should hide a panel section (multiple tabs)", async ({ page }) => {
    const panel = panelLocator(page, "left");
    const widget = widgetLocator(page, { panel });
    const tab1 = tabLocator(page, "WL-1");
    const tab2 = tabLocator(page, "WL-2");
    const tab3 = tabLocator(page, "WL-3");
    await expect(tab1).toBeVisible();
    await expect(tab2).toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(widget).toHaveCount(2);

    await setWidgetState(page, "WL-1", WidgetState.Hidden);
    await expect(tab1).not.toBeVisible();
    await expect(tab2).toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(widget).toHaveCount(2);

    await setWidgetState(page, "WL-2", WidgetState.Hidden);
    await expect(tab1).not.toBeVisible();
    await expect(tab2).not.toBeVisible();
    await expect(tab3).toBeVisible();
    await expect(widget).toHaveCount(2);

    await setWidgetState(page, "WL-3", WidgetState.Hidden);
    await expect(tab1).not.toBeVisible();
    await expect(tab2).not.toBeVisible();
    await expect(tab3).not.toBeVisible();
    await expect(widget).toHaveCount(1);

    await setWidgetState(page, "WL-1", WidgetState.Open);
    await expect(tab1).toBeVisible();
    await expect(tab2).not.toBeVisible();
    await expect(tab3).not.toBeVisible();
    await expect(widget).toHaveCount(2);
  });

  test("should hide a panel", async ({ page }) => {
    const panel = panelLocator(page, "left");
    const widget = widgetLocator(page, { panel });
    await expect(panel).toBeVisible();
    await expect(widget).toHaveCount(2);

    await setWidgetState(page, "WL-A", WidgetState.Hidden);
    await expect(panel).toBeVisible();
    await expect(widget).toHaveCount(1);

    await setWidgetState(page, "WL-1", WidgetState.Hidden);
    await setWidgetState(page, "WL-2", WidgetState.Hidden);
    await setWidgetState(page, "WL-3", WidgetState.Hidden);
    await expect(panel).not.toBeVisible();
    await expect(widget).toHaveCount(0);

    await setWidgetState(page, "WL-1", WidgetState.Open);
    await expect(panel).toBeVisible();
    await expect(widget).toHaveCount(1);

    await setWidgetState(page, "WL-A", WidgetState.Open);
    await expect(panel).toBeVisible();
    await expect(widget).toHaveCount(2);
  });
});
