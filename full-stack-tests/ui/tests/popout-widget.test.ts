/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';
import assert from 'assert';
import { expectSavedFrontstageState, floatingWidgetLocator, tabLocator, widgetLocator } from './Utils';

test.describe("popout widget", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    assert(baseURL);
    await page.goto(`${baseURL}?frontstage=appui-test-providers:WidgetApi`);
  });

  test("should popout a widget", async ({ context, page }) => {
    const widget = floatingWidgetLocator(page, "appui-test-providers:ViewAttributesWidget");
    const tab = tabLocator(page, "View Attributes");
    const popoutButton = widget.locator('[title="Pop out active widget tab"]')
    await expect(tab).toBeVisible();

    const [popoutPage] = await Promise.all([
      context.waitForEvent("page"),
      popoutButton.click(),
    ]);

    await expect(tab).not.toBeVisible();
    expect(await popoutPage.title()).toEqual("View Attributes");
  });

  test("should maintain popout widget bounds", async ({ context, page }) => {
    const tab = tabLocator(page, "View Attributes");
    const widget = widgetLocator({ tab });
    const popoutButton = widget.locator('[title="Pop out active widget tab"]');

    // Popout the widget w/ default size.
    let [popoutPage] = await Promise.all([
      context.waitForEvent("page"),
      popoutButton.click(),
    ]);
    expect(popoutPage.viewportSize()).toEqual({
      height: 800,
      width: 600
    });

    // Update widget size and close the popout.
    await popoutPage.setViewportSize({
      height: 400,
      width: 300,
    });
    await popoutPage.close({ runBeforeUnload: true });

    // TODO: ATM need to activate the tab, since the widget is not floating after window is closed
    await tab.click();
    await expect(tab).toHaveClass(/nz-active/);

    // Popout the widget.
    [popoutPage] = await Promise.all([
      context.waitForEvent("page"),
      popoutButton.click(),
    ]);
    expect(popoutPage.viewportSize()).toEqual({
      height: 400,
      width: 300,
    });
  });

  test.only("should maintain popout widget bounds (after reload)", async ({ context, page }) => {
    const tab = tabLocator(page, "View Attributes");
    const widget = widgetLocator({ tab });
    const popoutButton = widget.locator('[title="Pop out active widget tab"]');

    // Popout the widget w/ default size.
    let [popoutPage] = await Promise.all([
      context.waitForEvent("page"),
      popoutButton.click(),
    ]);

    // Update widget size and close the popout.
    await popoutPage.setViewportSize({
      height: 400,
      width: 300,
    });
    await popoutPage.close({ runBeforeUnload: true });

    // TODO: ATM need to activate the tab, since the widget is not floating after window is closed
    await tab.click();
    await expect(tab).toHaveClass(/nz-active/);

    await expectSavedFrontstageState(context, (state) => {
      return state.nineZone.widgets["leftStart"].activeTabId === "WL-A";
    });

    await page.reload();

    // Popout the widget.
    [popoutPage] = await Promise.all([
      context.waitForEvent("page"),
      popoutButton.click(),
    ]);
    expect(popoutPage.viewportSize()).toEqual({
      height: 400,
      width: 300,
    });
  });
});
