function readPackage(pkg) {
  // Hacky mess: For external packages to this monorepo that have peer dependencies on packages
  // in this repo, we need to do some magic in order to get the peerDeps to point to a correct
  // version of the packages. Update the pkg.json real dependency list to
  // Note that these dependencies are only ever allowed for testing purposes and should not be the
  // dependency of any published packages.

  // https://github.com/iTwin/imodels-clients
  if (pkg.name == "@itwin/imodels-access-backend") {
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
    if (
      pkg.name === "@itwin/browser-authorization" ||
      pkg.name === "@itwin/electron-authorization"
    ) {
      pkg.dependencies["@itwin/core-common"] = "workspace:*";
    }
    if (pkg.name == "@itwin/oidc-signin-tool") {
      pkg.dependencies["@itwin/certa"] = "workspace:*";
    }
  }

  // https://github.com/iTwin/reality-data-client
  else if (pkg.name == "@itwin/reality-data-client") {
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
    pkg.dependencies["@itwin/core-common"] = "workspace:*";
    pkg.dependencies["@itwin/core-geometry"] = "workspace:*";
  }

  // https://github.com/iTwin/imodel-transformer/blob/main/packages/transformer/package.json
  else if (pkg.name == "@itwin/imodel-transformer") {
    pkg.dependencies["@itwin/core-backend"] = "workspace:*";
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
    pkg.dependencies["@itwin/core-common"] = "workspace:*";
    pkg.dependencies["@itwin/core-geometry"] = "workspace:*";
    pkg.dependencies["@itwin/core-quantity"] = "workspace:*";
    pkg.dependencies["@itwin/ecschema-metadata"] = "workspace:*";
  }

  else if (pkg.name == "@microsoft/api-extractor") {
    pkg.dependencies["typescript"] = "~5.6.2";
  }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
