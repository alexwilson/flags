const crypto = require('crypto')
const core = require('@actions/core')
const github = require('@actions/github')
const { createAppAuth } = require("@octokit/auth-app");
const { Octokit } = require("@octokit/rest");

function getFlags() {
  return []
}

const branchToRef = branch => `refs/head/${branch}`

async function ensureDeployBranchExists(octokit, branch) {
  core.info(`Ensuring ${branch} exists`)
  try {
    core.debug(`Checking branch...`)
    const getBranch = await octokit.repos.getBranch({
      ...github.context.repo,
      branch
    })
    core.debug({getBranch})
  } catch (error) {
    core.debug(`Could not find branch ${branch}, please create it!`)
  }
}

async function previousFileSha(octokit, branch, path) {
  let sha = null
  try {
    const contents  = await octokit.repos.getContents({
      ...github.context.repo,
      ref: branchToRef(branch),
      path,
      mediaType: {
        format: 'raw'
      }    
    })
    core.debug(contents)
  } catch (error) {
    core.debug(error.message)
  }
  return sha
}

async function main() {
  try {
    core.info('Authenticating with Github')
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        id: core.getInput('feature-flags-github-app-id'),
        privateKey: core.getInput('feature-flags-private-key')
      }    
    })
    core.debug('Authenticated with Github!')
  
    const flags = getFlags()
    core.info('Constructed Flags!')

    // Try and upload the thing.
    const content = JSON.stringify(flags)
    const path = "/v1/flags.json"
    const branch = "gh-pages"

    // Create the branch
    await ensureDeployBranchExists(octokit, branch)

    // Get previous file SHA, if it exsts
    const pathSha = await previousFileSha(octokit, branch, path)
  
    // Git Metadata
    core.info('Constructing Github Metadata')
    core.debug('Constructing Github Metadata: Branch')
    core.debug('Constructing Github Metadata: Committer, Author')
    const committer = {
        name: "github-actions[bot]",
        email: "41898282+github-actions[bot]@users.noreply.github.com"
    }
    const author = {
      name: "Alex Wilson",
      email: "440052+alexwilson@users.noreply.github.com"
    }
    core.debug('Constructing Github Metadata: Message')
    const message = "Updating Flags!"

    core.debug('Constructing Github Metadata: Building Payload')
    const payload = {
      ...github.context.repo,
      branch,
      path,
      message,
      content,
      committer,
      author
    }

    // Sha only needed for updates. If it doesn't exist, there's nothing to update!
    if (pathSha !== null) {
      payload.sha = pathSha
    }
    core.debug('Constructed Github Metadata!')
  
    await octokit.repos.createOrUpdateFile(payload)
  
  } catch (error) {
    core.setFailed(error.message);
  }
}

main()