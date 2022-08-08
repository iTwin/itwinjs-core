/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Page } from '@playwright/test';

export async function runKeyin(page: Page, keyin: string) {
  await page.keyboard.press("Control+F2");
  const input = await page.locator(`[placeholder="Enter key-in"]`);
  await input.fill(keyin);
  await input.press("Enter");
}
