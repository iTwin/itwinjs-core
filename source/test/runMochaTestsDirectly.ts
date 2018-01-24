// Run selected backend mocha tests programmatically. We do this in the mobile platform.

// tslint:disable-next-line:no-var-requires
require("mocha"); // puts the symbol "mocha" in global.
// tslint:disable-next-line:no-var-requires
require("chai");  // puts 'assert', etc. into global
mocha.setup("bdd" as MochaSetupOptions); // puts 'describe', 'it', etc. into global
// tslint:disable-next-line:no-var-requires
require("./Category.test.js");
mocha.run();
