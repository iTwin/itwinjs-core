function readPackage(pkg) {
  if ((pkg.name == "typedoc" || pkg.name == "@microsoft/api-extractor") && pkg.dependencies && pkg.dependencies["typescript"])
    pkg.dependencies["typescript"] = "~4.4.0";
  // Hacky mess: For external packages to this monorepo that have peer dependencies on packages
  // in this repo, we need to do some magic in order to get the peerDeps to point to a correct
  // version of the packages. Update the pkg.json real dependency list to
  // Note that these dependencies are only ever allowed for testing purposes and should not be the
  // dependency of any published packages.
  else if (pkg.name == "@itwin/imodels-access-backend") {
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
    pkg.dependencies["@itwin/core-backend"] = "workspace:*";
    pkg.dependencies["@itwin/core-common"] = "workspace:*";
  } else if (pkg.name == "@itwin/imodels-access-frontend") {
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
    pkg.dependencies["@itwin/core-frontend"] = "workspace:*";
    pkg.dependencies["@itwin/core-common"] = "workspace:*";
  } else if (pkg.name == "@itwin/oidc-signin-tool") {
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
  } else if (pkg.name == "@itwin/electron-authorization") {
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage
  }
}
