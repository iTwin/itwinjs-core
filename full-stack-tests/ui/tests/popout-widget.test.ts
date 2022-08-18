/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { test, expect } from '@playwright/test';
import assert from 'assert';
import { floatingWidgetLocator, tabLocator } from './Utils';

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

  test.skip("should save/restore popout widget bounds", async ({ context, page }) => {
    const widget = floatingWidgetLocator(page, "appui-test-providers:ViewAttributesWidget");
    const popoutButton = widget.locator('[title="Pop out active widget tab"]')

    let [popoutPage] = await Promise.all([
      context.waitForEvent("page"),
      popoutButton.click(),
    ]);

    expect(popoutPage.viewportSize()).toEqual({
      height: 800,
      width: 600
    });

    await popoutPage.setViewportSize({
      height: 400,
      width: 300,
    });

    await popoutPage.close();

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
