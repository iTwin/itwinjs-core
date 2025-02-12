#!/usr/bin/env zx
import { $ } from 'zx'

try {
  await $`echo '{"type": "module"}' > ./lib/esm/package.json`

  await $`echo '{"type": "commonjs"}' > ./lib/cjs/package.json`

  console.log('Successfully inserted package.json files')
} catch (error) {
  console.error('Failed while inserting package.json files', error.message)
}