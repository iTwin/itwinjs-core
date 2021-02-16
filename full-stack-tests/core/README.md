# iTwin.js Core Integration Tests
This package contains tests of standard iTwin.js RPC interfaces.
Every test in this directory should test frontend APIs with an actual backend.

These test run in both electron and chrome, and should only include one test RPC interface.

webpack sometimes runs out of memory, particularly on Linux, when TypeScript sourcemaps are generated for this package. If you need them for debugging purposes, uncomment the block marked "UNCOMMENT THIS BLOCK FOR SOURCE MAPS" in webpack.config.js. Make sure to revert that change before committing.
