import * as Mocha from "mocha";
import * as path from "path";

// Instantiate a Mocha instance.
const mocha = new Mocha();

const testDir = "/imjs/imodeljs-core/source/test/lib/test";

debugger;
mocha.addFile(path.join(testDir, "Category.test.js"));

// Run the tests.
mocha.run((failures: any) => {
  process.on("exit", () => {
    process.exit(failures);  // exit with non-zero status if there were failures
  });
});
