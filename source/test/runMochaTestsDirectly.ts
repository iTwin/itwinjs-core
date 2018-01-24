// Run selected backend mocha tests programmatically. We do this in the mobile platform.

import * as path from "path";
import * as useless from "mocha";
import { Category } from "../backend/Category";

useless;
Category;

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
