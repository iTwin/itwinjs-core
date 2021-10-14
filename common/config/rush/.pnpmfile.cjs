function readPackage(pkg) {
  if ((pkg.name == "typedoc" || pkg.name == "@microsoft/api-extractor") && pkg.dependencies && pkg.dependencies["typescript"])
    pkg.dependencies["typescript"] = "~4.4.0";
  return pkg;
}

module.exports = {
  hooks: {
    readPackage
  }
}
