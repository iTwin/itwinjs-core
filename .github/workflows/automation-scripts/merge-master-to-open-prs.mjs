#!/usr/bin/env zx

"use strict";

import 'zx/globals'

let openPrs = await $`gh pr list --json number`;
openPrs = JSON.parse(openPrs)
openPrs.forEach((pull_request) => {
  console.log(pull_request.number);
  await $`gh pr checkout ${pull_request.number}`;
  await $`git merge master`;
  let conflicts = await $`echo $0`;
  if (conflicts !== '0') {
    await $`git commit --abort`;
  } else {
    await $`git push`;
  }
});