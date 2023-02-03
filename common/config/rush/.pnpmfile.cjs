function readPackage(pkg) {
  if (
    (pkg.name == "typedoc" || pkg.name == "@microsoft/api-extractor") &&
    pkg.dependencies &&
    pkg.dependencies["typescript"]
  ) {
    pkg.dependencies["typescript"] = "~4.4.0";
  }

  // Hacky mess: For external packages to this monorepo that have peer dependencies on packages
  // in this repo, we need to do some magic in order to get the peerDeps to point to a correct
  // version of the packages. Update the pkg.json real dependency list to
  // Note that these dependencies are only ever allowed for testing purposes and should not be the
  // dependency of any published packages.

  // https://github.com/iTwin/imodels-clients
  else if (pkg.name == "@itwin/imodels-access-backend") {
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
    pkg.dependencies["@itwin/core-backend"] = "workspace:*";
    pkg.dependencies["@itwin/core-common"] = "workspace:*";
  } else if (pkg.name == "@itwin/imodels-access-frontend") {
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
    pkg.dependencies["@itwin/core-frontend"] = "workspace:*";
    pkg.dependencies["@itwin/core-common"] = "workspace:*";
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
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
  }

  // https://github.com/iTwin/reality-data-client
  else if (pkg.name == "@itwin/reality-data-client") {
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
    pkg.dependencies["@itwin/core-common"] = "workspace:*";
    pkg.dependencies["@itwin/core-geometry"] = "workspace:*";
  }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
