// Run selected backend mocha tests programmatically. We do this in the mobile platform.

import * as Mocha from "mocha";
import * as path from "path";

// Instantiate a Mocha instance.
const mocha = new Mocha();

const testDir = "/imjs/imodeljs-core/source/test/lib/test";

mocha.addFile(path.join(testDir, "Category.test.js"));

// Run the tests.
mocha.run((failures: any) => {
  process.on("exit", () => {
    process.exit(failures);  // exit with non-zero status if there were failures
  });
});
