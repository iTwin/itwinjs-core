#!/usr/bin/env node
'use strict';

const script = process.argv[2];
const spawn = require(require.resolve('../scripts/' + script));