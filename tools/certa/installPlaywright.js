/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const { exec } = require('child_process');

const INSTALL_SCRIPT = 'npx playwright install chromium';

exec(INSTALL_SCRIPT, {}, (error, stdout, stderr) => {
  if (error) throw error;
  console.log(stdout);
  console.log(stderr);
});
