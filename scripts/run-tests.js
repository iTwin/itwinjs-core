const fs = require("fs");
const path = require("path");
const yargs = require("yargs").argv;
const chokidar = require("chokidar");
const Mocha = require("mocha");
const tldrReporter = require('mocha-tldr-reporter');

const repeat = (yargs.repeat ? yargs.repeat : 1);
const timeoutsEnabled = !(yargs.noTimeouts || false);
const testsName = path.basename(path.resolve("./"));

let extensionsRegistered = false;
const registerExtensions = () => {
  if (!extensionsRegistered) {
    require("ts-node/register");
    require("tsconfig-paths/register");
    require("source-map-support/register");
    extensionsRegistered = true;
  }
};

const shouldRecurseIntoDirectory = (directoryPath) => {
  return fs.lstatSync(directoryPath).isDirectory()
    && directoryPath !== "lib"
    && directoryPath !== "node_modules";
}

const requireLibModules = (dir) => {
  const files = fs.readdirSync(dir);
  files.map((fileName) => path.join(dir, fileName)).filter(shouldRecurseIntoDirectory).forEach((fileName) => {
    requireLibModules(path.join(dir, fileName));
  });
  files.filter((fileName) => {
    return fileName.endsWith(".ts") && !fileName.endsWith(".test.ts");
  }).forEach((fileName) => {
    const requirePath = path.resolve(dir, path.basename(fileName, ".ts"));
    require(requirePath);
  });
};

const getTestFiles = () => {
  const testFiles = [];
  const addFilesRecursively = (dir) => {
    const files = fs.readdirSync(dir);
    files.map((fileName) => path.join(dir, fileName)).filter(shouldRecurseIntoDirectory).forEach((file) => {
      addFilesRecursively(file);
    });
    files.filter((file) => file.endsWith(".ts")).forEach((file) => {
      testFiles.push(path.join(dir, file));
    });
  };
  addFilesRecursively("./");
  addFilesRecursively("../test-helpers/");
  return testFiles;
};

const clearTestFilesCache = () => {
  getTestFiles().forEach((file) => {
    delete require.cache[require.resolve(path.resolve(file))];
  });
};

const runOnce = () => {
  let mocha = new Mocha({
    ui: "bdd",
  });
  if (!yargs.coverage)
    registerExtensions();
  if (yargs.coverage) {
    requireLibModules("./");
    mocha = mocha.reporter(tldrReporter).ignoreLeaks(true);
  } else if (yargs.watch) {
    mocha = mocha.reporter("min").ignoreLeaks(false);
  } else if (repeat > 1) {
    mocha = mocha.reporter("spec").ignoreLeaks(false);
  } else {
    const reporterOptions = {
      reporterEnabled: "mocha-junit-reporter, spec",
      mochaJunitReporterReporterOptions: {
        mochaFile: `../../out/reports/tests/results.${testsName}.xml`,
      },
    };
    mocha = mocha.reporter("mocha-multi-reporters", reporterOptions).ignoreLeaks(false).useColors(true).fullTrace();
  }
  mocha.timeout(10000);
  mocha.enableTimeouts(timeoutsEnabled);
  getTestFiles().forEach((file) => {
    mocha.addFile(file);
  });

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures)
        reject();
      else
        resolve();
    });
  });
};

const run = () => {
  let chain = Promise.resolve();
  for (let i = 0; i < repeat; ++i) {
    chain = chain.then(() => {
      clearTestFilesCache();
      if (repeat > 1)
        console.log(`Starting test iteration #${i + 1}`);
      return runOnce();
    });
  }
  chain.catch((err) => {
    if (yargs.watch)
      return;
    if (err)
      console.log(err);
    process.exit(1);
  });
};

run();

if (yargs.watch) {
  const watcher = chokidar.watch('', {
    ignored: "**/node_modules/**",
    ignoreInitial: true,
  });
  watcher.add("./**/*.ts");
  watcher.add("../test-helpers/**/*.ts");
  watcher.on("all", (evt, filePath) => {
    // wip: might want to make this part smarter to only re-run affected tests
    // un-cache the changed file
    delete require.cache[require.resolve(path.resolve("./", filePath))];
    // un-cache all test files
    clearTestFilesCache();
    // re-run the tests
    run();
  });
}
