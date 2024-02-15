// Invalidate all iTwin.js build status checks when master has a change to core/backend/package.json
// This is specifically to catch changes to @bentley/imodeljs-native
// This will also invalidate PRs if there's a new nightly build, however our 3 hour rule should also invalidate the same PRs

import { Octokit, App } from "octokit"
import dotenv from 'dotenv'

dotenv.config();

const octokit = new Octokit({
  auth: `${process.env.GITHUB_TOKEN}`
});

let pull_requests = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
  owner: 'iTwin',
  repo: 'itwinjs-core',
  headers: {
    'X-GitHub-Api-Version': '2022-11-28'
  }
})

for (let i = 0; i < pull_requests.data.length; i++) {
  console.log(pull_requests.data[i].head.ref)
  let pr_sha = pull_requests.data[i].head.sha;

  if (!pull_requests.data[i].draft) {
    await octokit.request('POST /repos/{owner}/{repo}/statuses/{sha}', {
      owner: 'iTwin',
      repo: 'itwinjs-core',
      sha: `${pr_sha}`,
      state: 'failure',
      description: '@bentley/imodeljs-native may be out of date with master, please merge',
      context: 'iTwin.js',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
  }
}
