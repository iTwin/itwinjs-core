# Committing Changes

It's important to generate change files when committing changes -
steps #2 - #5 do that.

1. Commit some changes.

2. `rush change` asks several questions about the changes and creates change files.
See [versioning](#versioning) on how to answer `rush` questions.

3. Review the change files created by Rush.

4. `git add .` stages created change files for commit.

5. `git commit --amend --no-edit` amends the generated change files to the last commit.

You can make multiple local commits before pushing the changes.

## Why Is That Important

For several reasons:
1. You don't need to increase the package version after each commit
2. You don't need to remember what kind of changes (major, minor, patch)
were made in all the commits since last publish when you're updating
package versions before publishing.
3. It creates a nice *CHANGELOG.md* file which can be used as a reference
to see what changes were made in each package version.

## Versioning

Currently the library is under heavy development and its API is subject to
change. We don't want the major version of its packages to grow uncontrollably,
so we **keep the major version at 0**. This means API breaking changes should
increase minor version and non-breaking changes should increase the patch version.

Because we're using `rush change` to track package versioning, the following rules
should be followed when answering `rush change` questions:
- When you make a **breaking change**, tell `rush` you made a **minor** change.
- **Otherwise**, tell `rush` you made a **patch-level** change.

When the API becomes stable enough and we start using the major version, we can
then refactor our changelog files to reflect that all minor changes were actually
major changes and all patches were actually minor changes.
