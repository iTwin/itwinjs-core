# Approved Packages Policy

Are there certain people on your team who constantly find exciting new libraries and add them to your package.json?
This can quickly get out of hand, especially in environments that require legal or security reviews for external code.
The approvedPackagesPolicy feature allows you to detect when new NPM dependencies are introduced.
This is configured in `rush.json` at the repository root.

See the [Rush docs](https://rushjs.io/pages/maintainer/setup_policies/) for more information.

> Note: `browser-approved-packages.json` is just a tracking file meant to simplify the overall review process.
Changes to these files should cause the review workflow to kick in...
