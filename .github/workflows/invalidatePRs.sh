#!/bin/bash

# GitHub workflow handles invalidating Pull Requests after 3 hours.
#
# It will only invalidate open, non-draft pull requests and mark each status
# as timed out.

if [[ "" == $token ]]; then
  echo Missing the environment variable "$token"
  exit
fi

oauth=$token
shouldDebug=false

if [[ "" != $debug ]]; then
  shouldDebug=true
  echo Initializing debug log level
fi

# Get all active PRs
# https://docs.github.com/en/rest/reference/pulls#list-pull-requests
prs=$(curl -s \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $oauth" \
  https://api.github.com/repos/imodeljs/imodeljs/pulls)

_jq() {
  echo ${pr} | base64 --decode | jq -r ${1}
}

_jq2() {
  echo ${status} | base64 --decode | jq -r ${1}
}

function log() {
  if [[ $shouldDebug == true  ]]; then
    echo "${1}"
  fi
}

for pr in $(echo "${prs}" | jq -r '.[] | @base64'); do
  #echo ${pr} | base64 --decode
  log "$(_jq '.title') (#$(_jq '.number'))"

  if [[ "open" != $(_jq '.state') ]] || [[ "true" == $(_jq '.draft') ]]; then
    log "  Skipping due to state=$(_jq '.state') and draft=$(_jq '.draft')."
    continue
  fi

  log "  Last updated at $(_jq '.updated_at')."

  ## Check if the PR is even 3 hours old. If so, no reason to check statuses.
  lastUpdatedTime=$(_jq '.updated_at')
  currentTime=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  tooOld=$(node -e "const lutPlus3=new Date('$lastUpdatedTime'); lutPlus3.setHours(lutPlus3.getHours()+3); console.log((new Date('$currentTime') - lutPlus3) > 0)")
  if [[ $tooOld == false ]]; then
    log "  Skipping since it has been updated within the past 3 hours."
    continue
  fi

  # Get all statuses of the PR
  #   e.g. https://api.github.com/repos/imodeljs/imodeljs/statuses/c29a168b6a201052098ea6743041868bfbadaa4f
  statuses=$(curl -s \
              -H "Accept: application/vnd.github.v3+json" \
              -H "Authorization: token $oauth" \
              $(_jq '.statuses_url'))

  for status in $(echo "${statuses}" | jq -r '.[] | @base64'); do
    if [[ "success" != $(_jq2 '.state') ]] || [[ "license/cla" == $(_jq2 '.context') ]]; then
      log "  Skipping $(_jq2 '.context') with state $(_jq2 '.state')."
      continue
    fi

    prUpdatedTime=$(_jq2 '.updated_at')
    tooOld=$(node -e "const lutPlus3=new Date('$prUpdatedTime'); lutPlus3.setHours(lutPlus3.getHours()+3); console.log((new Date('$currentTime') - lutPlus3) > 0)")
    if [[ $tooOld == false ]]; then
      log "  Skipping $(_jq2 '.context') it was updated within the past 3 hours."
      continue
    fi

    # echo ${status} | base64 --decode

    echo "  The PR $(_jq '.title') has build $(_jq2 '.context') that is older than 3 hours. Invalidating..."

    updateUrl=https://api.github.com/repos/imodeljs/imodeljs/statuses/$(_jq '.head.sha')
    target_url=$(_jq2 '.target_url')

    # curl \
    #   -X POST \
    #   -H "Accept: application/vnd.github.v3+json" \
    #   -H "Authorization: token $oauth" \
    #   $updateUrl \
    #   -d '{"state":"failure","target_url":"'$(_jq2 '.target_url')'","description":"The build hit the 3 hour threshold. Please re-queue the build.","context":"'$(_jq2 '.context')'"}'

  done
done
