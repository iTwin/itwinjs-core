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

    // Get statuses of current PR
    let statuses = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/statuses', {
      owner: 'iTwin',
      repo: 'itwinjs-core',
      ref: pull_requests.data[i].head.ref,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })

    let itwinjs_target_url = '';
    for (let j = 0; j < statuses.length; j++) {
      if (statuses[j].context === 'iTwin.js') {
        itwinjs_target_url = statuses[j].target_url
      }
    }

    await octokit.request('POST /repos/{owner}/{repo}/statuses/{sha}', {
      owner: 'iTwin',
      repo: 'itwinjs-core',
      sha: `${pr_sha}`,
      state: 'success',
      target_url: itwinjs_target_url,
      description: 'imodeljs-native version is out of date',
      context: 'iTwin.js',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
  }
}
