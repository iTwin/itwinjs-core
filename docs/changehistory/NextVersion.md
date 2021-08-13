---
publish: false
---
# NextVersion

### @bentley/bentleyjs-core

`Config` is being deprecated in favor of accessing environment variables directly.
For example, instead of using `Config.app.query("imjs_url_prefix")`, use `process.env.imjs_url_prefix` to access the strings already stored in environment variables.
Note: Using `process.env` in frontend code will lead webpack to transform it into an object literal with build-time constants.
