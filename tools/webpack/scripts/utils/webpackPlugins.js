/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const chalk = require("chalk");
const path = require("path");
const fs = require("fs-extra");
const glob = require("glob");
const paths = require("../../config/paths");

class BanImportsPlugin {
  constructor(bundleName, bannedName, bannedDir, bannedRegex) {
    this.bundleName = bundleName;
    this.bannedName = bannedName;
    this.bannedDir = bannedDir;
    this.bannedRegex = bannedRegex;
  }

  apply(resolver) {
    resolver.hooks.file.tapAsync(this.constructor.name, (request, contextResolver, callback) => {
      if (!request.context.issuer || !request.__innerRequest_request)
        return callback();

      if (this.bannedRegex.test(request.path) || request.path.startsWith(this.bannedDir)) {
        const actualRequest = request.__innerRequest_request.replace(/^\.[\/\\]/, ""); // not sure why __innerRequest_request always starts with ./
        const errorMessage = chalk.red("You are importing ") + chalk.yellow(actualRequest) + chalk.red(".  ")
        + chalk.red.bold(this.bannedName) + chalk.red(" code should not be included in the ") 
        + chalk.red.bold(this.bundleName) + chalk.red(" bundle.");
        return callback(new Error(errorMessage), request);
      }
      
      return callback();
    });
  }
}

function pathToPackageName(p) {
  const parts = p.replace(/^.*node_modules[\\\/]/, "").split(/[\\\/]/);
  return (parts[0].startsWith("@")) ? parts[0] + "/" + parts[1] : parts[0];
}

function findPackageJson(pkgName, parentPath) {
  const searchPaths = [];
  if (parentPath) {
    const parentNodeModules = path.resolve(parentPath, "node_modules");
    const parentContainingDir = parentPath.replace(/^(.*node_modules).*$/, "$1");
    searchPaths.push(parentNodeModules, parentContainingDir);
  }
  searchPaths.push(paths.appNodeModules);

  try {
    return require.resolve(pkgName + "/package.json", { paths: searchPaths });
  } catch (error) {
    return undefined;
  }
}

function copyPackage(pkgName, parentPath) {
  const packageJsonPath = findPackageJson(pkgName, parentPath);
  if (!packageJsonPath)
    return;

  if (!parentPath || !packageJsonPath.startsWith(parentPath)) {
    // console.log(chalk.gray(`Copying ${path.dirname(packageJsonPath)} to lib/node_modules`));
    fs.copySync(path.dirname(packageJsonPath), path.resolve(paths.appLib, "node_modules", pkgName), { dereference: true });
  }
  return packageJsonPath;
}

class CopyNativeAddonsPlugin {
  constructor(options) {}

  apply(compiler) {
    compiler.hooks.environment.tap("CopyNativeAddonsPlugin", () => {
      const appPackageJson = require(paths.appPackageJson);
      let packagesToCopy = [];
      
      // Copy any modules excluded from the bundle via the "externals" webpack config option
      const externals = compiler.options.externals;
      if (typeof(externals) === "object") {
        if (Array.isArray(externals))
          packagesToCopy = externals.filter((ext) => typeof(ext) === "string");
        else
          packagesToCopy = Object.keys(externals);
      }

      const copiedPackages = new Set();
      for (const pkg of packagesToCopy) {
        const pkgName = pathToPackageName(pkg);
        if (copiedPackages.has(pkgName) || undefined === appPackageJson.dependencies[pkgName])
          continue;
          
        const packageJsonPath = copyPackage(pkgName);
        copiedPackages.add(pkgName);

        const packageJson = require(packageJsonPath);
        if (!packageJson.dependencies)
          continue;

        for (const dep of Object.keys(packageJson.dependencies)) {
          if (!copiedPackages.has(dep)) {
            copyPackage(dep, path.dirname(packageJsonPath));
            copiedPackages.add(dep);
          }
        }
      }
    });
  }
}

class CopyAssetsPlugin {
  apply(compiler) {
    compiler.hooks.environment.tap("CopyAssetsPlugin", () => {
      if (fs.existsSync(paths.appAssets))
        fs.copySync(paths.appAssets, path.resolve(paths.appLib, "assets"));
    });
  }
}

// Merges the contents of the @bentley packages we depend on with the public folder.
function isDirectory (directoryName) {
  return (fs.statSync(path.resolve (this.bentleyDir, directoryName)).isDirectory());
}
class CopyBentleyDependencyPublicFoldersPlugin {

  apply(compiler) {
    compiler.hooks.environment.tap("CopyBentleyDependencyPublicFoldersPlugin", () => {
      const bentleyDir = paths.appBentleyNodeModules;
      // go through all node_modules/@bentley directories. If there's a "public" folder, copy its contents
      const subDirectoryNames = fs.readdirSync(bentleyDir).filter(isDirectory, { bentleyDir: paths.appBentleyNodeModules });
      for (const thisSubDir of subDirectoryNames) {
        const fullDirName = path.resolve (bentleyDir, thisSubDir );
        const testDir = path.resolve (fullDirName, "public");
        try {
          if (fs.statSync(testDir).isDirectory()) {
            fs.copySync (testDir, paths.appLibPublic, { dereference: true, preserveTimestamps: true, overwrite: false, errorOnExist: true});
    
          }
        } catch (_err) {
          // do nothing.
        }
      }
    });
  }
}

class BanFrontendImportsPlugin extends BanImportsPlugin {
  constructor() {
    super("BACKEND", "FRONTEND", paths.appSrcFrontend, /imodeljs-frontend/);
  }
}

class BanBackendImportsPlugin extends BanImportsPlugin {
  constructor() {
    super("FRONTEND", "BACKEND", paths.appSrcBackend, /imodeljs-backend/);
  }
}

// Extend LicenseWebpackPlugin to add better error formatting and some custom handling for @bentley packages.
const LicenseWebpackPlugin = require("license-webpack-plugin").LicenseWebpackPlugin;
class PrettyLicenseWebpackPlugin extends LicenseWebpackPlugin {
  constructor(options) {
    options.suppressErrors = true;
    super(options);
  }

  apply(compiler) {
    super.apply(compiler);

    compiler.hooks.afterEmit.tap("PrettyLicenseWebpackPlugin", (compilation) => {
      const formattedErrors = [];
      for (const e of this.errors) {
        const regex = /license-webpack-plugin: Could not find a license file for (.*?)(, defaulting to license name found in package.json: (.*))?$/
        const groups = e.message.match(regex);
        if (groups) {
          if (groups[1].startsWith("@bentley"))
            continue;
          
          let formatted = "   " + chalk.bold.magenta(groups[1]);
          if (groups[3]) {
            formatted += chalk.gray(` (should have a notice for `) + chalk.bold(chalk.gray(groups[3])) + chalk.gray(` license according to its package.json)`);
          } else {
            formatted += chalk.gray(` (no license is specified in its package.json)`);
          }

          formattedErrors.push(formatted)
        } else {
          e.message = e.message.replace("license-webpack-plugin:", chalk.underline.red("LicenseWarning:"));
          compilation.warnings.push(e);
        }
      }

      if (formattedErrors.length > 0) {
        console.log();
        console.log(`${chalk.bold.yellow("WARNING:")} ${chalk.yellow("License notices for the following packages could not be found:")}`);
        formattedErrors.sort().forEach((e) => console.log(e));
        console.log(chalk.yellow("Don't worry, this warning will not be treated as an error in CI builds (yet)."));
        console.log(chalk.yellow("We're still looking for a good way to pull and manage these notices.\n"));
      }
    });
  }
}

// By default, LicenseWebpackPlugin does not even attempt to find LICENSE files for packages with package.json license undefined.
// This monkey patch should make sure that we're looking for notices for ALL dependencies, not just those with known licenses.
const LicenseExtractor = require("license-webpack-plugin/dist/LicenseExtractor").LicenseExtractor;
const baseGetLicenseText = LicenseExtractor.prototype.getLicenseText;
LicenseExtractor.prototype.getLicenseText = function(packageJson, licenseName,  modulePrefix) {
  if (licenseName === LicenseExtractor.UNKNOWN_LICENSE) {
    const licenseFilename = this.getLicenseFilename(packageJson, licenseName, modulePrefix);
    if (!licenseFilename) {
      this.errors.push(
        new Error(`license-webpack-plugin: Could not find a license file for ${packageJson.name}`)
      );
      return '';
    }

    return fs
      .readFileSync(licenseFilename, 'utf8')
      .trim()
      .replace(/\r\n/g, '\n');
  }

  baseGetLicenseText.call(this, packageJson, licenseName,  modulePrefix);
}

module.exports = {
  BanFrontendImportsPlugin,
  BanBackendImportsPlugin,
  CopyNativeAddonsPlugin,
  CopyAssetsPlugin,
  CopyBentleyDependencyPublicFoldersPlugin,
  PrettyLicenseWebpackPlugin
};
