# Install and Build Instructions

## Prerequisites

- [Git](https://git-scm.com/)
- [Node](https://nodejs.org/en/): an installation of the latest security
patch of Node 8.9.x. The Node installation also includes the **npm** package manager.
- [Rush](https://github.com/Microsoft/web-build-tools/wiki/Rush): to
install `npm install -g @microsoft/rush`

## (Bentley Developers only) Authentication

Configure npm and log in to the Bentley npm registry with the following commands:

```cmd
npm config set @bentley:registry https://npm.bentley.com/npm/npm/
```

## Build Instructions

1. Get/update the source code:
    - `git clone` for the first time
    - `git pull` for subsequent times
2. Install dependencies: `rush install`
3. Clean: `rush clean`
4. Rebuild source: `rush rebuild -v`
5. Run tests: `rush test -v`
6. Run sample app: `npm start` at the repository root.

*Note:* `-v` option stands for 'verbose'.

## Other Rush Commands

All available Rush commands can be viewed by running `rush help`. Below are
some of the most commonly used:
- `rush clean` deletes all build output
- `rush lint` runs linter on all packages
- `rush test` rush all tests
- `rush cover` runs all tests and generates coverage reports
- `rush extract` extracts code samples from tests and sample app
- `rush docs` generates API documentation