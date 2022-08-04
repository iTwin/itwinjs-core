// this wrapper is needed when compiling the package with CJS.
// In that case, Typescript will convert the dynamic import into a require and Webpack won't parse the magic comment.
module.exports = async () => {
  return import(/* webpackChunkName: "object-storage" */ "@itwin/object-storage-azure/lib/frontend");
}
