Currently, imodel-bank always serves *one hard-wired iModel*.
Currently, you must side-load the changesets for this iModel.

# Build imodel-bank

Before you can run the demo, you must build imodel-bank.
*In a bim0200 shell:*
`bb -s imodel-bank pull`
`bb -s imodel-bank b`
`cd %SrcRoot%imodel-bank`
`npm install`
`npm run build`
`installaddon.bat`

# Run imodel-bank
`cd %SrcRoot%imodel-bank`
`npm run test`

The server will serve out *one hard-wired iModel*. The seed file for this iModel is in the `dev` subdirectory.

# Build bank-demo
Chdir to the *imodeljs-core* monorepo.
`git checkout imodel-bank`
`rush install`
`rush build`

# Side-load Changesets
`node ./bank-demo/lib/sideLoadChangeSets.js`

This reads changesets from the assets directory. See assets/changeSets.json.
*The seed file is `%SrcRoot%imodel-bank\dev`. These changesets must apply to it.*

# Run the demo
`node ./bank-demo/lib/cli.js {bank|hub}`
