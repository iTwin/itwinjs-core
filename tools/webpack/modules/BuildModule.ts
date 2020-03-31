/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs-extra";
import * as os from "os";
import * as child_process from "child_process";
import * as tar from "tar";
import * as crypto from "crypto";

import * as Utils from "./utils";
import Result = Utils.Result;

import { IModelJsModuleConfig, WebpackModuleOpts, ModuleType, SubModuleType } from "./IModelJsModuleOptions";
import { PseudoLocalizer } from "./PseudoLocalizer";

const SIGNATURE_FILENAME: string = "digitalSignature";

/** Description of each node_module.
 *
 * Used primarily to identify the external modules.
 */
class ModuleInfo {
  public destFileName: string;
  public relativePath: string;

  constructor(public isDevelopment: boolean, public moduleName: string, destFileName: string | undefined, relativePath?: string | undefined, public publicResourceDirectory?: string | undefined) {
    // if relativePath not supplied, it's one of our @bentley modules and we can figure it out.
    this.destFileName = destFileName ? destFileName : moduleName + ".js";
    if (!relativePath) {
      this.relativePath = path.join(moduleName, isDevelopment ? "lib/module/dev" : "lib/module/prod", this.destFileName);
    } else {
      this.relativePath = relativePath;
    }
  }
}

// keeps track of each dependent's information.
class DependentInfo {
  constructor(public name: string, public packageRoot: string, public parentPackageRoot: string, public externalModule: ModuleInfo, public versionRequested: string, public versionAvailable: string) {
  }
}

// class that copies (or symlinks) the external modules needed by iModel.js into the web resources directory.
class DependentTracker {
  private _dependentList: DependentInfo[] = [];
  private _externalModules: ModuleInfo[];

  // these are all modules that are listed as external in our webpack configuration, and therefore need to be copied to the web resources directory.
  constructor(private _nodeModulesDirectory: string, _isDevelopment: boolean, private _detail: number, private _alwaysCopy: boolean) {
    this._externalModules = [
      new ModuleInfo(_isDevelopment, "@bentley/bentleyjs-core", "bentleyjs-core.js", undefined),
      new ModuleInfo(_isDevelopment, "@bentley/geometry-core", "geometry-core.js", undefined),
      new ModuleInfo(_isDevelopment, "@bentley/imodeljs-i18n", "imodeljs-i18n.js", undefined),
      new ModuleInfo(_isDevelopment, "@bentley/imodeljs-clients", "imodeljs-clients.js", undefined),
      new ModuleInfo(_isDevelopment, "@bentley/imodeljs-common", "imodeljs-common.js", undefined),
      new ModuleInfo(_isDevelopment, "@bentley/imodeljs-quantity", "imodeljs-quantity.js", undefined),
      new ModuleInfo(_isDevelopment, "@bentley/imodeljs-frontend", "imodeljs-frontend.js", undefined, "lib/public"),
      new ModuleInfo(_isDevelopment, "@bentley/imodeljs-markup", "imodeljs-markup.js", undefined, "lib/public"),
      new ModuleInfo(_isDevelopment, "@bentley/frontend-devtools", "frontend-devtools.js", undefined, "lib/public"),
      new ModuleInfo(_isDevelopment, "@bentley/ui-abstract", "ui-abstract.js", undefined, "lib/public"),
      new ModuleInfo(_isDevelopment, "@bentley/ui-core", "ui-core.js", undefined, "lib/public"),
      new ModuleInfo(_isDevelopment, "@bentley/ui-components", "ui-components.js", undefined, "lib/public"),
      new ModuleInfo(_isDevelopment, "@bentley/ui-framework", "ui-framework.js", undefined, "lib/public"),
      new ModuleInfo(_isDevelopment, "@bentley/ui-ninezone", "ui-ninezone.js", undefined),
      new ModuleInfo(_isDevelopment, "@bentley/presentation-common", "presentation-common.js", undefined),
      new ModuleInfo(_isDevelopment, "@bentley/presentation-components", "presentation-components.js", undefined, "lib/public"),
      new ModuleInfo(_isDevelopment, "@bentley/presentation-frontend", "presentation-frontend.js", undefined, "lib/public"),
      new ModuleInfo(_isDevelopment, "react", undefined, path.join("react", _isDevelopment ? "umd/react.development.js" : "umd/react.production.min.js")),
      new ModuleInfo(_isDevelopment, "react-dnd", undefined, path.join("react-dnd", _isDevelopment ? "dist/ReactDnD.js" : "dist/ReactDnD.min.js")),
      new ModuleInfo(_isDevelopment, "react-dnd-html5-backend", undefined, path.join("react-dnd-html5-backend", _isDevelopment ? "dist/ReactDnDHTML5Backend.js" : "dist/ReactDnDHTML5Backend.min.js")),
      new ModuleInfo(_isDevelopment, "react-dom", undefined, path.join("react-dom", _isDevelopment ? "umd/react-dom.development.js" : "umd/react-dom.production.min.js")),
      new ModuleInfo(_isDevelopment, "react-redux", undefined, path.join("react-redux", _isDevelopment ? "dist/react-redux.js" : "dist/react-redux.min.js")),
      new ModuleInfo(_isDevelopment, "redux", undefined, path.join("redux", _isDevelopment ? "dist/redux.js" : "dist/redux.min.js")),
      new ModuleInfo(_isDevelopment, "inspire-tree", undefined, path.join("inspire-tree", _isDevelopment ? "dist/inspire-tree.js" : "dist/inspire-tree.min.js")),
      new ModuleInfo(_isDevelopment, "lodash", undefined, path.join("lodash", _isDevelopment ? "lodash.js" : "lodash.min.js")),
    ];
  }

  // symlinks the public static files from a module into the output web resources directories.
  private symlinkOrCopyPublicStaticFiles(sourcePublicDirectory: string, outputPublicDirectory: string) {
    const symlinkSource = `${sourcePublicDirectory}/**/*`;
    Utils.symlinkFiles(process.cwd(), symlinkSource, outputPublicDirectory, this._alwaysCopy, this._detail);
  }

  // this function adds the dependencies found in package.json that are external modules. Recurses, but only to depth 1.
  private findExternalModuleDependents(parentPackageRoot: string, depth: number, problemPackages: string[], includeExtraModules: boolean) {
    const packageFileContents: any = Utils.readPackageFileContents(parentPackageRoot);

    // if there are extraSystemModules specified, add them to dependencies.
    if (includeExtraModules && packageFileContents.iModelJs.buildModule.extraSystemModules) {
      for (const extraModule in packageFileContents.iModelJs.buildModule.extraSystemModules) {
        if (!packageFileContents.dependencies[extraModule])
          packageFileContents.dependencies[extraModule] = packageFileContents.iModelJs.buildModule.extraSystemModules[extraModule];
      }
    }

    // find new dependents from this packageFileContents
    const newDependents: DependentInfo[] = [];
    for (const dependent in packageFileContents.dependencies) {
      // see if we already have this dependent.
      if (undefined !== this._dependentList.find((existingDependent) => existingDependent.name === dependent)) {
        continue;
      }
      // we only care about external modules and their dependents that might be external modules.
      for (const externalModule of this._externalModules) {
        if (externalModule.moduleName !== dependent)
          continue;

        // first look for the package.json file in the "root" node_modules directory.
        let dependentPackageRoot = path.resolve(this._nodeModulesDirectory, dependent);
        if (!fs.existsSync(dependentPackageRoot)) {
          dependentPackageRoot = path.resolve(parentPackageRoot, "node_modules", dependent);
          if (!fs.existsSync(dependentPackageRoot)) {
            problemPackages.push(`Cannot find package.json for dependent ${dependent}\n`);
            continue;
          }
        }
        const dependentPackageContents: any = Utils.readPackageFileContents(dependentPackageRoot);
        if (!dependentPackageContents.version)
          problemPackages.push(`Cannot find version in package.json of dependent: ${dependent}\n`);
        newDependents.push(new DependentInfo(dependent, dependentPackageRoot, parentPackageRoot, externalModule, packageFileContents.dependencies[dependent], dependentPackageContents.version));
      }
    }

    // add the newly discovered dependents to the master list of dependents.
    for (const newDependent of newDependents) {
      this._dependentList.push(newDependent);
    }

    // we need to check the first level of dependents of our direct dependents to find the non-imodeljs dependencies like lodash, react, redux, etc.
    if (depth < 2) {
      for (const newDependent of newDependents) {
        this.findExternalModuleDependents(newDependent.packageRoot, depth + 1, problemPackages, false);
      }
    }
  }

  // finds peerDependencies and makes sure they are in the list of dependencies.
  private checkPeerDependencies(): string[] {
    const missingList: string[] = [];
    for (const thisDependent of this._dependentList) {
      const packageFileContents = Utils.readPackageFileContents(thisDependent.packageRoot);
      for (const peerDependent in packageFileContents.peerDependencies) {
        // don't bother to a peerDependent twice.
        if (-1 !== missingList.indexOf(peerDependent))
          continue;

        // we only report miss peerDependencies of our external modules.
        if (undefined === (this._externalModules.find((externalModule) => externalModule.moduleName === peerDependent)))
          continue;

        if (undefined === this._dependentList.find((dependent) => dependent.name === peerDependent)) {
          if (this._detail > 0)
            console.log(`  Dependent, ${thisDependent.name}, requires a peerDependency of, ${peerDependent}, but none found. Add, ${peerDependent}, to dependencies in package.json`);
          missingList.push(peerDependent);
        }
      }
    }
    return missingList;
  }

  // finds the source module file. It is either relative to our localNodeModules, or relative to the dependent path where we found the package file.
  private findExternalModuleFile(dependent: DependentInfo, relativePath: string) {
    const localNodeModuleFile = path.resolve(this._nodeModulesDirectory, relativePath);
    if (fs.existsSync(localNodeModuleFile))
      return localNodeModuleFile;

    const dependentNodeModuleFile = path.resolve(dependent.parentPackageRoot, "node_modules", relativePath);
    if (fs.existsSync(dependentNodeModuleFile))
      return dependentNodeModuleFile;

    return undefined;
  }

  // finds dependents, symlinks them to destination directory (when building application type only).
  public symlinkOrCopyExternalModules(outputDirectory: string): Result {
    if (this._detail > 0)
      console.log("Starting symlink or copy external modules");

    try {
      // create the output directory, if it doesn't exist.
      if (!fs.existsSync(outputDirectory))
        fs.mkdirSync(outputDirectory, { recursive: true });

      // Read the package file for the current directory, and add the dependents recursively (to depth 2) to the sub-dependencies of the iModelJs modules.
      const problemPackages: string[] = [];
      this.findExternalModuleDependents(process.cwd(), 0, problemPackages, true);
      if (problemPackages.length > 0)
        return new Result("Symlink or Copy ExternalModules", 1, undefined, undefined, "Failure to process some dependent packages: \n".concat(...problemPackages));
      const missingPeerDependencies = this.checkPeerDependencies();
      if (missingPeerDependencies.length > 0)
        return new Result("Symlink or Copy External Modules", 1, undefined, undefined, "You are missing one or more dependencies in package.json: \n".concat(...missingPeerDependencies));

      let missingModule = false;
      const missingModuleList: string[] = [];
      for (const dependent of this._dependentList) {
        const externalModule = dependent.externalModule;
        const versionString = dependent.versionAvailable;

        const moduleSourceFile = this.findExternalModuleFile(dependent, externalModule.relativePath);

        // report all the module files we can't find.
        if (!moduleSourceFile) {
          missingModuleList.push(`Unable to locate required module file ${externalModule.moduleName} - looking for relative path ${externalModule.relativePath}\n`);
          missingModule = true;
        } else {
          let outFilePath = outputDirectory;
          if (versionString) {
            outFilePath = path.resolve(outputDirectory, "v" + versionString);
            // create subdirectory if needed.
            if (!fs.existsSync(outFilePath)) {
              fs.mkdirSync(outFilePath, { recursive: true });
            }
          }
          const fullFilePath = path.resolve(outFilePath, externalModule.destFileName);
          Utils.symlinkOrCopyModuleFile(moduleSourceFile, fullFilePath, this._alwaysCopy, this._detail);

          // symlink any subModules in the build.
          const packageFileContents: any = Utils.readPackageFileContents(dependent.packageRoot);
          if (packageFileContents.iModelJs && packageFileContents.iModelJs.buildModule && packageFileContents.iModelJs.buildModule.subModules && Array.isArray(packageFileContents.iModelJs.buildModule.subModules)) {
            for (const subModule of packageFileContents.iModelJs.buildModule.subModules) {
              if (subModule.bundleName) {
                const parsedPath = path.parse(moduleSourceFile);
                const thisDirectory = parsedPath.dir;
                const subModuleFileName = subModule.bundleName + ".js";
                const subModuleSourceFile = path.resolve(thisDirectory, subModuleFileName);
                const destFullFilePath = path.resolve(outFilePath, subModuleFileName);
                Utils.symlinkOrCopyModuleFile(subModuleSourceFile, destFullFilePath, this._alwaysCopy, this._detail);
              }
            }
          }

          // symlink the external modules resource files if necessary.
          if (externalModule.publicResourceDirectory) {
            const publicPath = path.resolve(dependent.packageRoot, externalModule.publicResourceDirectory);
            this.symlinkOrCopyPublicStaticFiles(publicPath, outputDirectory);
          }
        }
      }

      if (missingModule) {
        return new Result("Symlink or Copy External Modules", 1, undefined, undefined, "Could not find one or more dependencies:\n".concat(...missingModuleList));
      }
    } catch (e) {
      return new Result("Symlink or Copy External Modules", 1, e);
    }
    return new Result("Symlink or Copy External Modules", 0);
  }

  public getExternalModuleVersionsObject(): any {
    // get the dependencies.
    const problemPackages: string[] = [];
    this.findExternalModuleDependents(process.cwd(), 0, problemPackages, false);

    const versionObject: any = new Object();

    // Fix the dependentInfos that have versions with pre-release versions in them. Change 0.191.0-dev.6, for example, to >=0.191.0-dev.0.
    for (const dependent of this._dependentList) {
      let thisVersion = dependent.versionRequested;
      const dashPosition = thisVersion.indexOf("-");
      if (-1 !== dashPosition) {
        const lastNumPosition = thisVersion.lastIndexOf(".");
        if ((-1 !== lastNumPosition) && (lastNumPosition > dashPosition)) {
          thisVersion = ">=" + thisVersion.slice(0, lastNumPosition + 1) + "0";
        }
      }
      versionObject[dependent.name] = thisVersion;
    }
    return versionObject;
  }

}

// Class that supervises the digital signature operation.
class DigitalSignatureOperation {
  private _sign: crypto.Signer;
  private constructor(private _privateKey: string) {
    this._sign = crypto.createSign("RSA-SHA256");
  }

  // Create an instance of the DigitalSignOperation class, copying the PublicKey to the build directory.
  public static createInstance(signProp: any, buildDir: string): DigitalSignatureOperation | Result | undefined {
    const op: string = "Sign Plugin";
    if (!signProp) {
      return undefined;
    }
    if (!signProp.privateKey) {
      return new Result(op, 1, undefined, undefined, 'The "sign" property must have a "privateKey" property');
    }
    if (!signProp.publicKey) {
      return new Result(op, 1, undefined, undefined, 'The "sign" property must have a "publicKey" property');
    }
    // validate the sign.privateKey property. It must be an environment variable that resolves to a .pem file.
    const privateKeyFileName = process.env[signProp.privateKey];
    if (!privateKeyFileName) {
      return new Result(op, 1, undefined, undefined, `The "sign.privateKey" property is set to "${signProp.privateKey}" but that is not an environment variable (which must point to a ".pem" file).`);
    }
    if (!fs.existsSync(privateKeyFileName)) {
      return new Result(op, 1, undefined, undefined, `"sign.privateKey" is an environment variable (${signProp.privateKey}) that evaluates to "${privateKeyFileName}", but that file does not exist`);
    }
    let privateKey: string;
    try {
      privateKey = fs.readFileSync(privateKeyFileName, { encoding: "utf8" });
    } catch (error) {
      return new Result(op, 1, undefined, undefined, `Error reading private key from "${privateKeyFileName}", ${error}`);
    }

    // validate the sign.privateKey property. It must be an environment variable that resolves to a .pem file.
    const publicKeyFileName = process.env[signProp.publicKey];
    if (!publicKeyFileName) {
      return new Result(op, 1, undefined, undefined, `The "sign.publicKey" property is set to "${signProp.publicKey}", but that is not an environment variable (which must point to a ".pem" file).`);
    }
    if (!fs.existsSync(publicKeyFileName)) {
      return new Result(op, 1, undefined, undefined, `"sign.publicKey" is an environment variable (${signProp.publicKey}) that evaluates to ${publicKeyFileName}, but that file does not exist`);
    }

    // try to read the file.
    let publicKey: string;
    try {
      publicKey = fs.readFileSync(publicKeyFileName, { encoding: "utf8" });
    } catch (error) {
      return new Result(op, 1, undefined, undefined, `Error reading public key from "${publicKeyFileName}", ${error}`);
    }

    // try to write the file to the build directory.
    const outputKeyFile = path.resolve(buildDir, "publicKey.pem");
    try {
      fs.writeFileSync(outputKeyFile, publicKey);
    } catch (error) {
      return new Result(op, 1, `Error writing public key file to "${outputKeyFile}", ${error}`);
    }

    return new DigitalSignatureOperation(privateKey);
    // validate the sign.publicKey property. It must be an environment variable that resolves to a .pem file.
  }

  // accumulate the hash for all the data that is getting put into the tar file (with the exception of the signature itself), and create the signature
  public createSignatureFile(rootDir: string, fileList: string[], signatureFile: string): Result | undefined {
    // sort the file list so they are in a known order.
    fileList.sort();

    // read contents of each file and add it to the data to be signed.
    try {
      for (const fileName of fileList) {
        // read each file into a buffer.
        const filePath = path.resolve(rootDir, fileName);
        const contents: Buffer = fs.readFileSync(filePath);
        // accumulate its data.
        this._sign.update(contents);
      }
    } catch (error) {
      return new Result("Accumulate Signed Data", 1, error);
    }

    try {
      this._sign.end();
      const signature: Buffer = this._sign.sign(this._privateKey!);
      fs.writeFileSync(signatureFile, signature);
      // success.
      return undefined;
    } catch (error) {
      return new Result("Creating Digital Signature File", 1, error);
    }
  }

  // verify the signature of the untarred data.
  public async verifySignature(tarFile: string, subModule: any, detail: number): Promise<Result | undefined> {
    const tmpDirName = `${os.tmpdir}${path.sep}`;
    let verifyDir: string;
    try {
      verifyDir = fs.mkdtempSync(tmpDirName);
    } catch (error) {
      return new Result(`Build Plugin ${subModule.bundleName}`, 1, error, undefined, `Creating temporary directory ${tmpDirName} to verify signature`);
    }

    // this try is here so we can remove the temporary directory when we are done.
    try {

      try {
        await tar.extract({ cwd: verifyDir, file: tarFile });
      } catch (error) {
        return new Result(`Build Plugin ${subModule.bundleName}`, 1, error, undefined, `Extracting tar file for signature verification`);
      }

      // verify existence of and read the digSigFile
      let digitalSignature: Buffer;
      try {
        const digSigFile: string = path.resolve(verifyDir, SIGNATURE_FILENAME);
        if (!fs.existsSync(digSigFile))
          return new Result(`Build Plugin ${subModule.bundleName}`, 1, undefined, undefined, "Cannot find digital signature files while attempting to verify");

        digitalSignature = fs.readFileSync(digSigFile);
      } catch (error) {
        return new Result("Read Digital Signature File", 1, error);
      }

      // verify existence of and read the public key file.
      let publicKey: string;
      try {
        const publicKeyFile: string = path.resolve(verifyDir, "publicKey.pem");
        if (!fs.existsSync(publicKeyFile))
          return new Result(`Build Plugin ${subModule.bundleName}`, 1, undefined, undefined, 'Cannot find "publicKey.pem" file while attempting to verify');

        publicKey = fs.readFileSync(publicKeyFile, { encoding: "utf8" });
      } catch (error) {
        return new Result("Read Public Key", 1, error);
      }

      // build the list of files we untarred (except "digitalSignature").
      const verifyList: string[] = new Array<string>();
      try {
        Utils.findAllPluginFiles(verifyList, "", verifyDir, SIGNATURE_FILENAME);
        if (detail > 4)
          console.log(`Files checked in tar file:, ${verifyList}`);
      } catch (error) {
        return new Result(`Build Plugin ${subModule.bundleName}`, 1, error, undefined, "Finding files for verification");
      }

      // sort verifyList so it's in the same order as when we created the digital signature.
      verifyList.sort();
      const verify: crypto.Verify = crypto.createVerify("RSA-SHA256");
      try {
        for (const fileName of verifyList) {
          const filePath: string = path.resolve(verifyDir, fileName);
          const contents: Buffer = fs.readFileSync(filePath);
          verify.update(contents);
        }
        verify.end();
      } catch (error) {
        return new Result("Accumulate data for verification", 1, error);
      }

      if (verify.verify(publicKey, digitalSignature))
        return undefined;
      else
        return new Result("Digital Signature does not match", 1);
    } finally {
      Utils.removeAllFiles(verifyDir);
      Utils.removeDirectory(verifyDir, 0);
    }
  }
}

/** Handles the build steps for building an iModel.js Module */
class IModelJsModuleBuilder {
  private _alwaysCopy: boolean;

  constructor(private _moduleDescription: IModelJsModuleConfig, private _version: string, private _isDevelopment: boolean, private _webpackStats: boolean) {
    this._alwaysCopy = process.env.BUILDIMODEL_SYMLINKS === undefined;
  }

  /** Compiles the tsc source according to tsconfig.json.
   *
   * Generally, compiles `src\/**\/*.ts` to `lib`.
   */
  private async compileSource(): Promise<Result> {

    // The version of typescript required must be specified in package.json devDependencies.
    // In rush monorepos, it can be specified in the rush common/config/rush/common-version.json file.
    // npm (or rush) install mechanism puts tsc into the node_modules/.bin directory where npm will find it.

    // Note: I tried setting shell: true in the options (third) argument to execFile, and then just specifying
    // "tsc" (rather than tsc or tsc.cmd based on platform). Unfortunately, that wasn't reliable.
    return new Promise((resolve, _reject) => {
      if (this._moduleDescription.detail > 0)
        console.log("Starting tsc compilation");

      const tscCommand: string = process.platform === "win32" ? "tsc.cmd" : "tsc";
      const tscFullPath = path.resolve(process.cwd(), "node_modules", ".bin", tscCommand);
      const args = [];

      // Add additional typescript options to the end of the command.
      if (this._moduleDescription.tscOptions) {
        const tscArgs = this._moduleDescription.tscOptions.split(" ");
        for (const tscArg of tscArgs)
          args.push(tscArg);
      }

      args.push("1>&2"); // Always push onto the end of the args list

      child_process.execFile(tscFullPath, args, { cwd: process.cwd(), shell: true } as any, (error: Error | null, stdout: string, stderr: string) => {
        if (this._moduleDescription.detail > 0)
          console.log("Finished compilation");
        resolve(new Result("Compile .tsc files", (null !== error) || (stderr && stderr.length) ? 1 : 0, error, stdout, stderr));
      });
    });
  }

  /** Symlinks all of the web resources (like .scss and .svg files) into the lib directory for webpack to use later.
   */
  private async symlinkSourceResources(): Promise<Result> {
    // are there any files to symlink?
    if (!this._moduleDescription.sourceResources) {
      if (this._moduleDescription.detail > 2)
        console.log("Skipping Symlink Source Resource, no iModelJs.buildModule.sourceResources property");
      return new Result("Symlink Or Copy Source Resources", 0);
    }

    // otherwise this should be an array of {source, dest} objects.
    if (!Array.isArray(this._moduleDescription.sourceResources))
      return new Result("Symlink Or Copy Source Resources", 1, undefined, undefined, "iModelJs.buildModule.sourceResources must be an array of {source, dest} pairs");

    for (const resource of this._moduleDescription.sourceResources) {
      if (!resource.source || !resource.dest) {
        return new Result("Symlink Or Copy Source Resources", 1, undefined, undefined, "iModelJs.buildModule.sourceResources must be an array of {source, dest} pairs");
      }

      if (this._moduleDescription.detail > 0)
        console.log(this._alwaysCopy ? "Copying files from" : "Symlinking files from", resource.source, "to", resource.dest);

      const alwaysCopy = this._alwaysCopy || (undefined !== resource.copy && resource.copy === true);
      const result = Utils.symlinkFiles(process.cwd(), resource.source, resource.dest, alwaysCopy, this._moduleDescription.detail);
      if (0 !== result.exitCode)
        return result;
    }
    return new Result("Symlink or Copy Source Resources", 0);
  }

  // Symlink the external modules that the application uses into the web server's directory (when building application type only).
  private async symlinkRequiredExternalModules(): Promise<Result> {
    if (this._moduleDescription.type !== "application")
      return Promise.resolve(new Result("Symlink or Copy External Modules", 0));
    if (!this._moduleDescription.webpack || !this._moduleDescription.webpack.dest)
      return Promise.resolve(new Result("Symlink Or Copy External Modules", 0));

    const nodeModulesDir: string = path.resolve(process.cwd(), "node_modules");
    const dependentTracker = new DependentTracker(nodeModulesDir, this._isDevelopment, this._moduleDescription.detail, this._alwaysCopy);
    const outputDirectory: string = path.resolve(process.cwd(), this._moduleDescription.webpack.dest);
    return Promise.resolve(dependentTracker.symlinkOrCopyExternalModules(outputDirectory));
  }

  // makes a config file
  private async makeConfig(): Promise<Result> {
    let useCreateConfig: boolean = false;
    if (!this._moduleDescription.makeConfig)
      return Promise.resolve(new Result("makeConfig", 0));
    if (!this._moduleDescription.makeConfig.dest)
      return Promise.resolve(new Result("makeConfig", 1, undefined, undefined, "The iModelJs.buildModule.makeConfig must have a 'dest' property"));
    if (this._moduleDescription.makeConfig.sources) {
      useCreateConfig = true;
      if (!Array.isArray(this._moduleDescription.makeConfig.sources)) {
        return Promise.resolve(new Result("makeConfig", 1, undefined, undefined, "iModelJs.buildModule.makeConfig.sources must be an array of {file, filter} pairs"));
      }
      for (const thisSource of this._moduleDescription.makeConfig.sources) {
        if (!thisSource.file || (undefined === thisSource.filter))
          return Promise.resolve(new Result("makeConfig", 1, undefined, undefined, "iModelJs.buildModule.makeConfig.sources must be an array of {file, filter} pairs"));
      }
    }
    const scriptName = useCreateConfig ? "createConfigFile.js" : "write.js";

    try {
      // get the path to config-loader/scripts/write.js module
      let makeConfigFullPath;
      const nestedConfigLoaderPath = `node_modules/@bentley/webpack-tools/node_modules/@bentley/config-loader/scripts/${scriptName}`;
      if (fs.existsSync(nestedConfigLoaderPath)) {
        // use the nested config-loader dependency
        makeConfigFullPath = path.resolve(process.cwd(), nestedConfigLoaderPath);
      } else {
        // attempt to use the sibling config-loader dependency. Would need to be explicitly declared as a dependency in a consumer's package.json
        const siblingConfigLoaderPath = `node_modules/@bentley/config-loader/scripts/${scriptName}`;
        makeConfigFullPath = path.resolve(process.cwd(), siblingConfigLoaderPath);
      }

      // figure out the arguments.
      const args: string[] = [makeConfigFullPath, this._moduleDescription.makeConfig.dest];
      if (useCreateConfig) {
        // The makeConfig.sources must exist if `useCreateConfig` is true.  Typescript is missing that type inference.
        for (const thisSource of this._moduleDescription.makeConfig.sources!) {
          const filter: string = thisSource.filter;
          if (0 === filter.length)
            args.push(`${thisSource.file}`);
          else
            args.push(`${thisSource.file}|${filter}`);
        }
      } else {
        if (this._moduleDescription.makeConfig.filter)
          args.push(this._moduleDescription.makeConfig.filter);
      }

      if (this._moduleDescription.detail > 0)
        console.log("Starting makeConfig with arguments", args);

      return new Promise((resolve, _reject) => {
        child_process.execFile("node", args, { cwd: process.cwd() }, (error: Error | null, stdout: string, stderr: string) => {
          if (this._moduleDescription.detail > 0)
            console.log("Finished makeConfig");
          resolve(new Result("makeConfig", (null !== error) || (stderr && stderr.length) ? 1 : 0, error, stdout, stderr));
        });
      });
    } catch (e) {
      return new Promise((resolve, _reject) => {
        resolve(new Result("Make Config", 1, e));
      });
    }
  }

  private async installPlugin(): Promise<Result> {
    if (this._moduleDescription.detail > 0)
      console.log("Install plugins to specified applications");

    // only attempt if this is a plugin, with an installTo key, and we can symlink.
    if ((this._moduleDescription.type !== ModuleType.Plugin) || !this._moduleDescription.installTo || this._alwaysCopy)
      return Promise.resolve(new Result("installPlugin", 0));
    if (!Array.isArray(this._moduleDescription.installTo))
      return Promise.resolve(new Result("installPlugin", 1, undefined, undefined, "iModelJs.buildModule.installTo must be an array of strings containing test applications to install the plugin to."));
    try {
      for (const installDest of this._moduleDescription.installTo) {
        // the string must be a path relative to the directory of package.json
        if (typeof installDest !== "string") {
          return Promise.resolve(new Result("installPlugin", 1, undefined, undefined, "iModelJs.buildModule.installTo must be an array of strings containing test applications to install the plugin to."));
        }

        if (this._moduleDescription.detail > 2)
          console.log(`  Install plugin ${this._moduleDescription.webpack!.bundleName} to specified ${installDest}`);

        // see if we can find the path.
        const destRoot: string = path.resolve(process.cwd(), installDest);
        if (!fs.existsSync(destRoot)) {
          return Promise.resolve(new Result("installPlugin", 1, undefined, undefined, `cannot find the root directory of the destination: ${destRoot}`));
        }

        const destWebResources = path.join(destRoot, "lib/webresources");
        if (!fs.existsSync(destWebResources)) {
          return Promise.resolve(new Result("installPlugin", 1, undefined, undefined, `cannot find the output webresources directory of the destination: ${destWebResources}`));
        }

        const pluginDirectory = path.join(destWebResources, "imjs_plugins");
        if (!fs.existsSync(pluginDirectory)) {
          fs.mkdirSync(pluginDirectory);
        }

        const buildDir = path.resolve(process.cwd(), this._moduleDescription.webpack!.build!);
        if (!fs.existsSync(buildDir)) {
          return Promise.resolve(new Result("installPlugin", 1, undefined, undefined, `cannot find the build directory of the plugin: ${destWebResources}`));
        }

        const outDir = path.resolve(pluginDirectory, this._moduleDescription.webpack!.bundleName);
        if (fs.existsSync(outDir)) {
          if (this._moduleDescription.detail > 3) {
            console.log(`  Plugin ${this._moduleDescription.webpack!.bundleName} is already installed to ${pluginDirectory}`);
          }
          continue;
        }
        fs.symlinkSync(buildDir, outDir);
      }
    } catch (e) {
      return Promise.resolve(new Result("installPlugin", 1, e));
    }
    return Promise.resolve(new Result("installPlugin", 0));
  }

  // spawns a webpack process
  private async startWebpack(operation: string, outputPath: string, entry: string, bundleName: string, styleSheets: boolean, buildType: string, version: string | undefined, isDevelopment: boolean, doStats: boolean, moduleNum: number, htmlTemplate?: string): Promise<Result> {
    const webpackFullPath = Utils.findWebpack();
    if (!webpackFullPath)
      return new Result(operation, 1, undefined, undefined, "Unable to locate webpack.  Ensure it is installed as a devDependency.");

    const args: string[] = [];
    const configPath = path.resolve(process.cwd(), "node_modules/@bentley/webpack-tools/modules/webpackModule.config.js");
    args.push(`--config=${configPath}`);
    args.push(`--env.outdir=${outputPath}`);
    args.push(`--env.entry=${entry}`);
    args.push(`--env.bundlename=${bundleName}`);
    if (styleSheets)
      args.push("--env.stylesheets");

    if (buildType === "plugin")
      args.push("--env.plugin");
    else if (buildType === "webworker")
      args.push("--env.webworker");

    // if the buildType is application, or there's a version, then the output is going into a subdirectory. That changes urls needed for resources loaded by file-loader.
    if (buildType === "application" || (version !== undefined))
      args.push("--env.subFolder");

    if (!isDevelopment)
      args.push("--env.prod");
    if (htmlTemplate)
      args.push(`--env.htmltemplate=${htmlTemplate}`);
    if (doStats) {
      // make sure the output directory exists.
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }
      const outFileName = `webpackStats${moduleNum}.json`;
      const jsonFile: string = path.resolve(outputPath, outFileName);
      args.push("--json");
      args.push(">" + jsonFile);
    }

    return new Promise((resolve, _reject) => {
      child_process.execFile(webpackFullPath, args, { cwd: process.cwd(), maxBuffer: 1024 * 500 }, (error: Error | null, stdout: string, stderr: string) => {
        if (this._moduleDescription.detail > 0)
          console.log("Finished", operation);
        if ((null == error) || (!stderr || (0 === stderr.length))) {
          // if we are building an application, move the main.js to the version directory.
          if (buildType === "application" && version) {
            try {
              const destPath = path.resolve(outputPath, "v" + version);

              fs.mkdirSync(destPath, { recursive: true });
              Utils.moveFile(outputPath, destPath, "main.js", true);
              Utils.moveFile(outputPath, destPath, "main.js.map", true);
              Utils.moveFile(outputPath, destPath, "main.css", false);
              Utils.moveFile(outputPath, destPath, "runtime.js", true);
              Utils.moveFile(outputPath, destPath, "runtime.js.map", true);
            } catch (moveError) {
              resolve(new Result(operation.concat(" (move file)"), 1, moveError));
            }
          }
        }

        resolve(new Result(operation, (null !== error) || (stderr && stderr.length) ? 1 : 0, error, stdout, stderr));
      });
    });
  }

  /** Webpacks any ModuleType.
   *
   * The output of `System` Modules goes into a "dev" or "prod" folder below the specific `buildModule.webpack.dest` path.
   */
  private async webpackModule(): Promise<Result> {
    // if no webpack property, skip it.
    if (!this._moduleDescription.webpack) {
      if (this._moduleDescription.detail > 2)
        console.log("Skipping Webpack, no iModelJs.buildModule.webpack property");
      return Promise.resolve(new Result("Webpack", 0));
    }

    // make sure the required keys are there.
    const webpack: any = this._moduleDescription.webpack;
    if (!webpack.dest || !webpack.entry || !webpack.bundleName) {
      return Promise.resolve(new Result("Webpack", 1, undefined, undefined, 'IModelJs.buildModule.webpack must have "dest", "entry", and "bundleName" properties'));
    }

    const styleSheets: boolean = webpack.styleSheets ? true : false;
    let outputPath = path.resolve(process.cwd(), webpack.dest);

    if (this._moduleDescription.type === ModuleType.Plugin) {
      return this.buildPlugin(webpack, outputPath, styleSheets, 0);
    } else {
      if (this._moduleDescription.type === ModuleType.System) {
        outputPath = path.resolve(outputPath, this._isDevelopment ? "dev" : "prod");
      }

      // start the webpack process according to the arguments.
      if (this._moduleDescription.detail > 0)
        console.log("Starting Webpack Module");
      return this.startWebpack("Webpack Module", outputPath, webpack.entry, webpack.bundleName, styleSheets, this._moduleDescription.type, this._version, this._isDevelopment, this._webpackStats, 0, webpack.htmlTemplate);
    }
  }

  // build the array of subModules.
  private async buildSubModules(): Promise<Result[]> {
    if (!this._moduleDescription.subModules) {
      if (this._moduleDescription.detail > 2)
        console.log("Skipping Build SubModules - No iModelJs.buildModule.subModules property");
      return Promise.resolve([new Result("Build SubModules", 0)]);
    }

    if (!Array.isArray(this._moduleDescription.subModules)) {
      return Promise.resolve([new Result("Build SubModules", 1, undefined, undefined, "iModelJs.buildModule.subModules must be an array of {dest, entry, bundleName} objects")]);
    }

    let results: Result[] = [];
    let moduleNum: number = 1;
    for (const subModule of this._moduleDescription.subModules) {
      if (!subModule.dest || !subModule.entry || !subModule.bundleName) {
        results.push(new Result("Build SubModules", 1, undefined, undefined, 'Each subModule must have a "dest", "entry", and "bundleName" property'));
        return Promise.resolve(results);
      }

      const styleSheets: boolean = subModule.styleSheets ? true : false;
      // this is a special case for the IModelJsLoader - set plugin.type to "system" or "webworker" to avoid plugin treatment.
      const subType: SubModuleType = subModule.type || SubModuleType.Plugin;
      if (subType !== SubModuleType.System && subType !== SubModuleType.Plugin && subType !== SubModuleType.WebWorker) {
        results.push(new Result("Build SubModules", 1, undefined, undefined, 'the "type" property for a subModule must be one of "system", "plugin", or "webworker"'));
        return Promise.resolve(results);
      }

      let outputPath = path.resolve(process.cwd(), subModule.dest);
      if ((subType === SubModuleType.System) || (subType === SubModuleType.WebWorker))
        outputPath = path.resolve(outputPath, this._isDevelopment ? "dev" : "prod");

      const subModuleResult: Result[] = [];
      if (subType === "plugin") {
        // building a plugin is more complicated. We build a tar file for it.
        subModuleResult.push(await this.buildPlugin(subModule, outputPath, styleSheets, moduleNum));
      } else {
        if (this._moduleDescription.detail > 0)
          console.log("Starting webpack of", subModule.entry);
        subModuleResult.push(await this.startWebpack(`Webpack SubModule ${subModule.entry}`, outputPath, subModule.entry, subModule.bundleName, styleSheets, subType, undefined, this._isDevelopment, this._webpackStats, moduleNum++));
      }
      results = results.concat(subModuleResult);
    }
    return Promise.resolve(results);
  }

  /**
   * Webpacks the Plugin module, both dev and prod version, by performing a sequence of events:
   *
   * 1. Webpacking a dev and production versions of the plugin
   * 1. Performing PseudoLocalization
   * 1. Creating the manifest.json file
   * 1. Signing the Plugin by creating a signature file.
   * 1. Bundling the Plugin into a {bundleName}.tar file.
   * @param subModule
   * @param tarDirectory
   * @param styleSheets
   * @param moduleNum
   */
  private async buildPlugin(subModule: WebpackModuleOpts, tarDirectory: string, styleSheets: boolean, moduleNum: number): Promise<Result> {

    if (!subModule.build)
      return new Result("Build SubModules", 1, undefined, undefined, 'A Plugin Module must provide a "iModelJs.buildModule.webpack.build" property in addition to "dest", "entry", and "bundleName" properties');

    const buildDir = path.resolve(process.cwd(), subModule.build);
    if (this._moduleDescription.detail > 3)
      console.log(`Starting build of plugin ${subModule.bundleName} with buildDir ${buildDir} `);

    // make sure directory exists.
    fs.mkdirSync(buildDir, { recursive: true });

    // make the manifest object.
    const manifest: any = {};
    // save the bundleName in the manifest.
    manifest.bundleName = subModule.bundleName;

    // Build the development version to `{ buildDir } /dev`
    if (this._moduleDescription.detail > 3)
      console.log("Webpacking development version of plugin", subModule.bundleName);
    const devCompileOutput = path.resolve(buildDir, "dev");
    manifest.devPlugin = subModule.bundleName.concat(".js");

    const devCompileResult: Result = await this.startWebpack(`Webpack Plugin Dev version${subModule.entry}`, devCompileOutput, subModule.entry, subModule.bundleName, styleSheets, "plugin", undefined, true, this._webpackStats, moduleNum);
    if (devCompileResult.error || devCompileResult.stderr) {
      return devCompileResult;
    }

    // Build the production version to `{buildDir}/prod`
    if (this._moduleDescription.detail > 3)
      console.log("Webpacking production version of plugin", subModule.bundleName);
    const prodCompileOutput = path.resolve(buildDir, "prod");
    const prodCompileResult = await this.startWebpack(`Webpack Plugin Prod version ${subModule.entry}`, prodCompileOutput, subModule.entry, subModule.bundleName, styleSheets, "plugin", undefined, false, false, moduleNum);
    if (prodCompileResult.error || prodCompileResult.stderr) {
      return Promise.resolve(prodCompileResult);
    }

    // we need to pseudolocalize here, rather than after the webpack step - otherwise our pseudolocalized files won't be in the tar file.
    const pseudoLocalizeResult = this.pseudoLocalize();
    if (0 !== pseudoLocalizeResult.exitCode)
      return pseudoLocalizeResult;

    // Create the dependency graph needed to determine the external module versions required.
    const dependentTracker: DependentTracker = new DependentTracker(process.cwd(), true, this._moduleDescription.detail, this._alwaysCopy);
    manifest.versionsRequired = dependentTracker.getExternalModuleVersionsObject();

    // Make a JSON file called manifest.json with keys versionsRequired, prodVersion, devVersion. We will tar that in.
    const manifestFileName: string = path.resolve(buildDir, "manifest.json");
    if (this._moduleDescription.detail > 3)
      console.log(`Creating manifest file ${manifestFileName} for plugin ${subModule.bundleName}`);
    fs.writeFileSync(manifestFileName, JSON.stringify(manifest, null, 2));

    // Gather all plugin files for signing
    const fileList: string[] = new Array<string>();
    try {
      Utils.findAllPluginFiles(fileList, "", buildDir, SIGNATURE_FILENAME);
      if (this._moduleDescription.detail > 4)
        console.log(`Files to go in tar file ${fileList}`);
    } catch (error) {
      return new Result(`Building Plugin ${subModule.bundleName}`, 1, error, undefined, "Error finding files");
    }

    const signer: DigitalSignatureOperation | Result | undefined = DigitalSignatureOperation.createInstance(subModule.sign, buildDir);
    if (signer instanceof Result)
      return signer;

    // prepare the digital signature operation
    if (signer) {
      if (this._moduleDescription.detail > 3)
        console.log("Calculating signature of plugin resources");
      const signatureFile = path.resolve(buildDir, SIGNATURE_FILENAME);
      const signResult: Result | undefined = signer.createSignatureFile(buildDir, fileList, signatureFile);

      if (signResult instanceof Result)
        return signResult;

      fileList.push(SIGNATURE_FILENAME);
    }

    // tar manifest.json, development, and production versions, along with whatever files got moved using the sourceResources directive.
    if (this._moduleDescription.detail > 3)
      console.log("Creating tar file for plugin", subModule.bundleName);
    fs.mkdirSync(tarDirectory, { recursive: true });
    const tarFile = path.resolve(tarDirectory, subModule.bundleName.concat(".plugin.tar"));
    try {
      await tar.create({ cwd: buildDir, gzip: false, file: tarFile, follow: true }, fileList);
    } catch (error) {
      return new Result(`Build Plugin ${subModule.bundleName}`, 1, error, "Creating tar file");
    }

    if (signer) {
      if (this._moduleDescription.detail > 3)
        console.log("Verifying signature of plugin tar file");

      // create an output directory, into which we will untar the tar file we just created.
      const verifyResult: Result | undefined = await signer.verifySignature(tarFile, subModule, this._moduleDescription.detail);
      if (verifyResult)
        return verifyResult;
    }

    return new Result("Build Plugin", 0);
  }

  /** Creates the pseudo-localized files and puts them into the specified directory */
  private pseudoLocalize(): Result {
    if (!this._moduleDescription.pseudoLocalize) {
      if (this._moduleDescription.detail > 2)
        console.log("Skipping Symlink Source Resource, no iModelJs.buildModule.sourceResources property");
      return new Result("Pseudo localize", 0);
    }
    if (!this._moduleDescription.pseudoLocalize.source || !this._moduleDescription.pseudoLocalize.dest) {
      return new Result("Pseudo localize", 1, undefined, undefined, 'IModelJs.buildModule.pseudoLocalize must have "source" and "dest" properties');
    }

    const sourceDirectory = path.resolve(process.cwd(), this._moduleDescription.pseudoLocalize.source);
    const destDirectory = path.resolve(process.cwd(), this._moduleDescription.pseudoLocalize.dest);
    if (this._moduleDescription.detail > 0)
      console.log("Starting pseudoLocalize");

    const pseudoLocalizer = new PseudoLocalizer(sourceDirectory, destDirectory, this._moduleDescription.detail);
    const result: Result = pseudoLocalizer.convertAll();
    if (this._moduleDescription.detail > 0)
      console.log("Finished PseudoLocalize");
    return result;
  }

  // If there's an error in the Result, report it and set the exitCode.
  private reportError(result: Result): number {
    let exitCode = result.exitCode;
    if (result.error && !result.stderr) {
      console.error(`\n-------- Operation:, ${result.operation}, --------`);
      console.error(result.error.toString());
      console.error(result.error);
      if (result.stdout) {
        console.error("Output:");
        console.error(result.stdout);
      }
    }
    if (result.stderr) {
      console.error(`\n-------- Operation:, ${result.operation}, --------`);
      console.error("Errors:");
      console.error(result.stderr);
      if (result.stdout) {
        console.error("Output:");
        console.error(result.stdout);
      }
      exitCode = 1;
    }
    if (result.stdout && (this._moduleDescription.detail > 1)) {
      console.log(`\n-------- Operation:, ${result.operation}, --------`);
      console.log("Output:");
      console.log(result.stdout);
    }
    return exitCode;
  }

  // report results for a list of steps.
  private reportResults(results: Result[]) {
    // check all results
    let exitCode = 0;
    for (const result of results) {
      const thisExitCode = this.reportError(result);
      if (0 !== thisExitCode)
        exitCode = thisExitCode;
    }
    return exitCode;
  }

  // step two - parallel webpack and symlink of external modules needed for applications
  private async webpackAndSymlinkExternalModules(): Promise<Result[]> {
    // webpack the module.
    const webpackResults = this.webpackModule();

    // If this is an application, symlink the required external modules to the webresources directory.
    const symlinkExternalModulesResult = this.symlinkRequiredExternalModules();

    // wait for the webpack and external modules operations to finish.
    return Promise.all([webpackResults, symlinkExternalModulesResult]);
  }

  /** Handles all of the build steps in a appropriate sequence. */
  public async sequenceBuild(): Promise<number> {

    const symlinkResults = await this.symlinkSourceResources();
    let exitCode = this.reportResults([symlinkResults]);
    if (0 !== exitCode)
      return exitCode;

    const compileResults = await this.compileSource();
    exitCode = this.reportResults([compileResults]);
    if (0 !== exitCode)
      return exitCode;

    const stepTwoResults: Result[] = await this.webpackAndSymlinkExternalModules();
    exitCode = this.reportResults(stepTwoResults);
    if (0 !== exitCode)
      return exitCode;

    // pseudoLocalize has to be done after symlinking external modules, except for plugins, which have to do it before making the tarfile.
    if (this._moduleDescription.type !== "plugin") {
      const pseudoLocalizeResult = this.pseudoLocalize();
      exitCode = this.reportResults([pseudoLocalizeResult]);
      if (0 !== exitCode)
        return exitCode;
    }

    const subModuleResults: Result[] = await this.buildSubModules();
    exitCode = this.reportResults(subModuleResults);
    if (0 !== exitCode)
      return exitCode;

    const makeConfigResult: Result = await this.makeConfig();
    exitCode = this.reportResults([makeConfigResult]);
    if (0 !== exitCode)
      return exitCode;

    // TODO: Remove this configuration.  It's a special case for the iModel.js repo and for dev of a plugin, however a good debug configuration should make it unneeded
    const installPluginResult: Result = await this.installPlugin();
    exitCode = this.reportResults([installPluginResult]);

    return exitCode;
  }

}

export async function main(config: IModelJsModuleConfig, isDevelopment: boolean, performStats: boolean): Promise<number> {
  const packageContents: any = Utils.readPackageFileContents(process.cwd());

  const builder = new IModelJsModuleBuilder(config, packageContents.version, isDevelopment, performStats);

  return builder.sequenceBuild();
}
