// Invalidate all iTwin.js build status checks when master has a change to core/backend/package.json
// This is specifically to catch changes to @bentley/imodeljs-native and should only invalidate PRs that target master branch
// This will also invalidate PRs if there's a new nightly build, however our 3 hour rule should also invalidate the same PRs

const owner = "iTwin";
const repo = "itwinjs-core";
// Captured once, then removed from process.env so no spawned child process can read it.
const token = process.env.GITHUB_TOKEN;
delete process.env.GITHUB_TOKEN;

const headers = {
  "Authorization": `token ${token}`,
  "Accept": "application/vnd.github.v3+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "itwinjs-core-invalidate-open-prs",
};

async function githubRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok)
    throw new Error(`GitHub API request to ${url} failed with ${response.status} ${response.statusText}: ${await response.text()}`);
  return response;
}

const pullRequestsResponse = await githubRequest(`https://api.github.com/repos/${owner}/${repo}/pulls`);
const pullRequests = await pullRequestsResponse.json();

for (const pullRequest of pullRequests) {
  if (!pullRequest.draft && pullRequest.base.ref === "master") {
    await githubRequest(`https://api.github.com/repos/${owner}/${repo}/statuses/${pullRequest.head.sha}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        state: "failure",
        description: "@bentley/imodeljs-native may be out of date with master, please merge",
        context: "iTwin.js",
      }),
    });
  }
}
