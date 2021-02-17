#!/bin/bash

# GitHub workflow handles invalidating Pull Requests after 3 hours.
#
# It will only invalidate open non-draft pull requests and mark each statuses
#

oauth=''

# Get all active PRs
# https://docs.github.com/en/rest/reference/pulls#list-pull-requests
prs=$(curl -s \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $oauth" \
  https://api.github.com/repos/imodeljs/imodeljs/pulls)

_jq() {
  echo ${row} | base64 --decode | jq -r ${1}
}

_jq2() {
  echo ${status} | base64 --decode | jq -r ${1}
}

for row in $(echo "${prs}" | jq -r '.[] | @base64'); do
  if [[ "open" != $(_jq '.state') ]] || [[ "true" == $(_jq '.draft') ]]; then
    # echo Skipping $(_jq '.title') with state $(_jq '.state') and draft $(_jq '.draft')
    continue
  fi

  if [[ "d13ea94c5dc0f0f35492de5ebe12981eb0e83372" != $(_jq '.head.sha') ]]; then
    continue
  fi

  echo Checking $(_jq '.title') updated last at $(_jq '.updated_at')

  ## TODO Need to use to test for how long ago it expired
  # ['updated_at']
  # now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  # echo Current time $(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Get all statuses of the PR
  #   e.g. https://api.github.com/repos/imodeljs/imodeljs/statuses/c29a168b6a201052098ea6743041868bfbadaa4f
  statuses=$(curl -s \
              -H "Accept: application/vnd.github.v3+json" \
              -H "Authorization: token $oauth" \
              $(_jq '.statuses_url'))

  for status in $(echo "${statuses}" | jq -r '.[] | @base64'); do
    if [[ "success" != $(_jq2 '.state') ]] || [[ "license/cla" == $(_jq2 '.context') ]]; then
      continue
    fi

    #echo $(_jq '.head.sha')

    target_url=$(_jq2 '.target_url')
    body=

    #echo $body

    # testing
    if [[ "d13ea94c5dc0f0f35492de5ebe12981eb0e83372" != $(_jq '.head.sha') ]]; then
      continue
    fi

    updateUrl=https://api.github.com/repos/imodeljs/imodeljs/statuses/$(_jq '.head.sha')
    echo $updateUrl

    curl \
      -X POST \
      -H "Accept: application/vnd.github.v3+json" \
      -H "Authorization: token $oauth" \
      $updateUrl \
      -d '{"state":"failed","target_url":"'$(_jq2 '.target_url')'","description":"The build hit the 3 hour threshold. Please re-queue the build.","context":"'$(_jq2 '.context')'"}'
  done
done

# Get the sha of the pr ['head']['sha']
# curl \
#   -X POST \
#   -H "Accept: application/vnd.github.v3+json" \
#   https://api.github.com/repos/imodeljs/imodeljs/statuses/SHA \
#   -d '{"state":"state"}'
