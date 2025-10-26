/**
 * GitHub Service
 *
 * Handles GitHub API operations for prompt optimization workflow:
 * - Create branches
 * - Commit files
 * - Create pull requests
 * - Auto-merge PRs
 */

import { Octokit } from '@octokit/rest';

export interface PRDetails {
  url: string;
  number: number;
  branch: string;
}

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    this.octokit = new Octokit({ auth: token });
    this.owner = process.env.GITHUB_OWNER || 'operait';
    this.repo = process.env.GITHUB_REPO || 'ERA';
  }

  /**
   * Create a new branch from prompt-tuning
   */
  async createBranch(branchName: string, baseBranch: string = 'prompt-tuning'): Promise<void> {
    try {
      // Get the latest commit SHA from base branch
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${baseBranch}`
      });

      const baseSha = ref.object.sha;

      // Create new branch
      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha
      });

      console.log(`✅ Created branch: ${branchName}`);
    } catch (error: any) {
      if (error.status === 422 && error.message.includes('Reference already exists')) {
        console.log(`⚠️ Branch ${branchName} already exists, using existing branch`);
      } else {
        throw new Error(`Failed to create branch: ${error.message}`);
      }
    }
  }

  /**
   * Commit a file to a branch
   */
  async commitFile(
    branchName: string,
    filePath: string,
    content: string,
    commitMessage: string
  ): Promise<void> {
    try {
      // Get current file to get its SHA (needed for update)
      let currentFileSha: string | undefined;
      try {
        const { data: currentFile } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: filePath,
          ref: branchName
        });

        if ('sha' in currentFile) {
          currentFileSha = currentFile.sha;
        }
      } catch (error: any) {
        // File doesn't exist, that's okay for new files
        if (error.status !== 404) {
          throw error;
        }
      }

      // Create or update file
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        branch: branchName,
        sha: currentFileSha
      });

      console.log(`✅ Committed ${filePath} to ${branchName}`);
    } catch (error: any) {
      throw new Error(`Failed to commit file: ${error.message}`);
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    branchName: string,
    title: string,
    body: string,
    baseBranch: string = 'prompt-tuning'
  ): Promise<PRDetails> {
    try {
      const { data: pr } = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        head: branchName,
        base: baseBranch
      });

      console.log(`✅ Created PR #${pr.number}: ${pr.html_url}`);

      return {
        url: pr.html_url,
        number: pr.number,
        branch: branchName
      };
    } catch (error: any) {
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }

  /**
   * Add reviewers to a pull request
   */
  async requestReviewers(prNumber: number, reviewers: string[]): Promise<void> {
    try {
      await this.octokit.pulls.requestReviewers({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        reviewers
      });

      console.log(`✅ Added reviewers to PR #${prNumber}: ${reviewers.join(', ')}`);
    } catch (error: any) {
      console.warn(`⚠️ Failed to add reviewers to PR #${prNumber}: ${error.message}`);
      // Don't throw - PR is still created successfully
    }
  }

  /**
   * Auto-merge a pull request
   */
  async mergePullRequest(prNumber: number): Promise<boolean> {
    try {
      await this.octokit.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        merge_method: 'squash'
      });

      console.log(`✅ Auto-merged PR #${prNumber}`);
      return true;
    } catch (error: any) {
      console.warn(`⚠️ Failed to auto-merge PR #${prNumber}: ${error.message}`);
      return false;
    }
  }

  /**
   * Complete workflow: create branch, commit file, create PR
   */
  async createOptimizationPR(
    updatedMasterPrompt: string,
    prTitle: string,
    prBody: string,
    autoMerge: boolean = false
  ): Promise<PRDetails> {
    // Generate timestamped branch name
    const timestamp = new Date().toISOString()
      .replace(/T/, '-')
      .replace(/:/g, '')
      .replace(/\..+/, '')
      .slice(0, 15); // YYYY-MM-DD-HHMM
    const branchName = `prompt-opt-${timestamp}`;

    // Create branch
    await this.createBranch(branchName);

    // Commit updated MASTER_PROMPT.md
    await this.commitFile(
      branchName,
      'MASTER_PROMPT.md',
      updatedMasterPrompt,
      `Optimize MASTER_PROMPT.md based on testing feedback\n\n${prBody.split('\n').slice(0, 5).join('\n')}`
    );

    // Create PR
    const pr = await this.createPullRequest(branchName, prTitle, prBody);

    // Add Megan as reviewer
    await this.requestReviewers(pr.number, ['megan-operaithr']);

    // Auto-merge if requested
    if (autoMerge) {
      const merged = await this.mergePullRequest(pr.number);
      if (!merged) {
        console.log('⚠️ PR created but auto-merge failed (likely conflicts). Manual review needed.');
      }
    }

    return pr;
  }
}
