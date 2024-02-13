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
  if (pull_requests.data[i].head.ref === 'dan/automate-addon') {
    console.log(pull_requests.data[i].head.ref)
    console.log(pull_requests.data[i].head.sha)
    let pr_sha = pull_requests.data[i].head.sha;

    await octokit.request('POST /repos/{owner}/{repo}/statuses/{sha}', {
      owner: 'iTwin',
      repo: 'itwinjs-core',
      sha: `${pr_sha}`,
      state: 'failure',
      description: 'imodeljs-native version is out of date',
      context: 'iTwin.js',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
  }
}
