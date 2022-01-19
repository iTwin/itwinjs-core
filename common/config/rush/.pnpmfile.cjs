function readPackage(pkg) {
  if ((pkg.name == "typedoc" || pkg.name == "@microsoft/api-extractor") && pkg.dependencies && pkg.dependencies["typescript"])
    pkg.dependencies["typescript"] = "~4.4.0";
  else if (pkg.name == "@itwin/imodels-access-backend") {
    // Hacky mess: Both @itwin/imodels-access-* packages have peer dependencies on the packages
    // in this repo so need to do some magic in order to get the peerDeps to point to a correct
    // version of the packages. Update the pkg.json real dependency list to
    // Note that these dependencies are only ever allowed for testing purposes and should not be the
    // dependency of any published packages.
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
    pkg.dependencies["@itwin/core-backend"] = "workspace:*";
    pkg.dependencies["@itwin/core-common"] = "workspace:*";
  }
  else if (pkg.name == "@itwin/imodels-access-frontend") {
    pkg.dependencies["@itwin/core-bentley"] = "workspace:*";
    pkg.dependencies["@itwin/core-frontend"] = "workspace:*";
    pkg.dependencies["@itwin/core-common"] = "workspace:*";
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage
  }
}
