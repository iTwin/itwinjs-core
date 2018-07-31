# Approved Packages Policy

Are there certain people on your team who constantly find exciting new libraries and add them to your package.json?
This can quickly get out of hand, especially in environments that require legal or security reviews for external code.
The approvedPackagesPolicy feature allows you to detect when new NPM dependencies are introduced.
This is configured in `rush.json` at the repository root.

See the [Rush docs](https://rushjs.io/pages/maintainer/setup_policies/) for more information.

| File Name | Actual Purpose |
|-----------|----------------|
| **browser-approved-packages.json** | Tracks approved direct **dependencies**|
| **nonbrowser-approved-packages.json** | Tracks approved **devDependencies** |

By default, `rush install` or `rush update` will add new dependencies to **browser-approved-packages.json**.
If they are valid direct **dependencies**, leave it there.
If they are valid **devDependencies**, move the section to **nonbrowser-approved-packages.json**.
If it is not valid, investigate where the dependency is coming from.
You may have to use an editor other than VS Code to prevent auto-reformatting.

> Note: this is just a tracking file meant to simplify the overall review process.
Changes to these files should cause the review workflow to kick in...
