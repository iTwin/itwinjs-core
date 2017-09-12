#!/usr/bin/env node
'use strict';

const spawn = require('react-dev-utils/crossSpawn');
const script = process.argv[2];
process.exit(spawn.sync('node', [require.resolve('../scripts/' + script)]).status);
