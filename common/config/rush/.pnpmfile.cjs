function overrideToWorkspace(pkg, dependencies) {
  for (const dep of dependencies) {
    pkg.dependencies[dep] = "workspace:*";
    pkg.peerDependencies[dep] = "workspace:*";
  }
}

function readPackage(pkg) {
  // Hacky mess: For external packages to this monorepo that have peer dependencies on packages
  // in this repo, we need to do some magic in order to get the peerDeps to point to a correct
  // version of the packages. Update the pkg.json real dependency list to
  // Note that these dependencies are only ever allowed for testing purposes and should not be the
  // dependency of any published packages.

  // https://github.com/iTwin/imodels-clients
  if (pkg.name == "@itwin/imodels-access-backend") {
    overrideToWorkspace(pkg, [
      "@itwin/core-bentley",
      "@itwin/core-backend",
      "@itwin/core-common",
    ]);
  } else if (pkg.name == "@itwin/imodels-access-frontend") {
    overrideToWorkspace(pkg, [
      "@itwin/core-bentley",
      "@itwin/core-frontend",
      "@itwin/core-common",
    ]);
  } else if (pkg.name == "@itwin/imodels-access-common") {
    overrideToWorkspace(pkg, [
      "@itwin/core-bentley",
      "@itwin/core-common",
    ]);
  }

  // https://github.com/iTwin/auth-clients
  else if (
    [
      "@itwin/browser-authorization",
      "@itwin/electron-authorization",
      "@itwin/oidc-signin-tool",
      "@itwin/node-cli-authorization",
      "@itwin/service-authorization",
    ].includes(pkg.name)
  ) {
    overrideToWorkspace(pkg, [
      "@itwin/core-bentley",
      "@itwin/core-common"
    ]);
    if (pkg.name == "@itwin/oidc-signin-tool") {
      overrideToWorkspace(pkg, ["@itwin/certa"]);
    }
  }

  // https://github.com/iTwin/reality-data-client
  else if (pkg.name == "@itwin/reality-data-client") {
    overrideToWorkspace(pkg, [
      "@itwin/core-bentley",
      "@itwin/core-common",
      "@itwin/core-geometry",
    ]);
  }

  // https://github.com/iTwin/imodel-transformer/blob/main/packages/transformer/package.json
  else if (pkg.name == "@itwin/imodel-transformer") {
    overrideToWorkspace(pkg, [
      "@itwin/core-backend",
      "@itwin/core-bentley",
      "@itwin/core-common",
      "@itwin/core-geometry",
      "@itwin/core-quantity",
      "@itwin/ecschema-metadata",
    ]);
  }

  else if (pkg.name == "@microsoft/api-extractor") {
    pkg.dependencies["typescript"] = "~5.6.2";
  }

  // Workaround for https://github.com/electron/get/issues/304
  else if (pkg.name == "electron") {
    pkg.dependencies["@electron/get"] = "^3.1.0";
  }
  else if (pkg.name == "@electron/get") {
    pkg.optionalDependencies = {};
  }

  // Security fix for https://github.com/advisories/GHSA-3ppc-4f35-3m26: Force all packages to use minimatch >= 10.2.1
  // if (pkg.dependencies?.minimatch) {
  //   pkg.dependencies.minimatch = "^10.2.1";
  // }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
