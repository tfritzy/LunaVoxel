# Branch Protection Configuration

This document explains how to configure branch protection to require all tests to pass before a PR can be merged.

## Quick Setup

The repository has a `test.yml` workflow that runs tests on pull requests. To make these tests required for merging, follow one of the methods below.

## Method 1: Using GitHub Repository Rulesets (Recommended)

GitHub Repository Rulesets is the modern approach to branch protection. A ruleset configuration file has been provided at `.github/ruleset.json`.

### To apply the ruleset:

1. Go to your repository on GitHub
2. Click on **Settings** → **Rules** → **Rulesets**
3. Click **New ruleset** → **New branch ruleset**
4. Configure the ruleset with the following settings:
   - **Ruleset Name**: "Require Tests to Pass"
   - **Enforcement status**: Active
   - **Target branches**: `main` and `master`
   - **Branch protections**:
     - ✅ Require a pull request before merging
     - ✅ Require status checks to pass
       - Add required status checks:
         - `test-frontend`
         - `test-backend`
     - ✅ Require branches to be up to date before merging
5. Click **Create**

Alternatively, you can import the `.github/ruleset.json` file if your GitHub plan supports ruleset import.

## Method 2: Using Classic Branch Protection Rules

If you prefer the classic branch protection rules:

1. Go to your repository on GitHub
2. Click on **Settings** → **Branches**
3. Under "Branch protection rules", click **Add rule** or **Add classic branch protection rule**
4. Configure the rule:
   - **Branch name pattern**: `main` (create another rule for `master` if needed)
   - Enable the following options:
     - ✅ **Require a pull request before merging**
     - ✅ **Require status checks to pass before merging**
       - Search for and select these status checks:
         - `test-frontend`
         - `test-backend`
     - ✅ **Require branches to be up to date before merging**
5. Click **Create** or **Save changes**
6. Repeat for the `master` branch if your repository uses it

## Verifying the Configuration

After setting up branch protection:

1. Create a test PR
2. Verify that the PR shows "Required status checks" with `test-frontend` and `test-backend`
3. Verify that the merge button is disabled until both checks pass
4. Verify that tests run automatically when the PR is created or updated

## Current Test Workflows

The repository has the following test jobs defined in `.github/workflows/test.yml`:

- **test-frontend**: Runs frontend tests using Vitest
- **test-backend**: Runs backend tests using .NET

Both jobs run automatically on:
- Pull requests to `main` or `master`
- Pushes to `main` or `master`

## Troubleshooting

### Status checks not appearing
- Ensure the test workflow has run at least once on a pull request
- The status check names must exactly match the job names in the workflow file

### Cannot merge even though tests pass
- Ensure "Require branches to be up to date before merging" is configured correctly
- Check that no other branch protection rules are blocking the merge

### Need to bypass protection temporarily
- Repository administrators can use "Merge without waiting for requirements to be met" option
- Or configure bypass actors in the ruleset settings
