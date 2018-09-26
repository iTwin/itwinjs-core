module.exports = function loader(source) {
  source = source.replace(/bentleyjs_core_\d+\.assert/g, "/*@__PURE__*/(function(){})");
  return source;
}