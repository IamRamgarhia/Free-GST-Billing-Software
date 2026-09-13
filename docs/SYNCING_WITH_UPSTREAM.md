# Syncing with Upstream (CLI Guide)

This guide documents how to keep your local repository and GitHub fork in sync with the original upstream repository (`IamRamgarhia/Free-GST-Billing-Software`) entirely via the command line (without relying on GitHub UI buttons).

---

## 1. Remote Setup Verification

Make sure you have both `origin` (your repo) and `upstream` (the original repo) configured:

```bash
git remote -v
```

You should see:
```text
origin    https://github.com/Yashparmar1125/gst_billing_agcl.git (fetch & push)
upstream  https://github.com/IamRamgarhia/Free-GST-Billing-Software.git (fetch & push)
```

If `upstream` is missing, add it once:
```bash
git remote add upstream https://github.com/IamRamgarhia/Free-GST-Billing-Software.git
```

---

## 2. Syncing Your Working Feature Branch

When upstream releases new commits, updates, or bug fixes, you can incorporate them into your active feature branch using `rebase`. This places your custom commits neatly on top of the latest upstream code:

```bash
# 1. Fetch latest changes from upstream
git fetch upstream

# 2. Switch to your feature branch
git checkout feature/docker-jpy-igst-support

# 3. Rebase your changes on top of upstream/main
git rebase upstream/main

# 4. Push the updated branch to your GitHub repository
git push --force-with-lease origin feature/docker-jpy-igst-support
```

> **Why `--force-with-lease`?**
> Rebase rewrites the commit base to match upstream. `--force-with-lease` safely updates your remote branch on GitHub while preventing accidental overwrites if someone else pushed changes.

---

## 3. Syncing Your `main` Branch

To keep your local and remote `main` branch identical to `upstream/main`:

```bash
# 1. Switch to main
git checkout main

# 2. Fetch latest commits from upstream
git fetch upstream

# 3. Fast-forward or merge upstream into your local main
git merge upstream/main

# 4. Push to your GitHub origin
git push origin main
```

---

## 4. Handling Conflicts (If Any)

If an upstream change touches the exact same lines of code as your changes during a `rebase`:

1. Git will pause and tell you which files have conflicts (`git status`).
2. Open the conflicting files, locate the `<<<<<<<`, `=======`, and `>>>>>>>` markers, and resolve them.
3. Stage the resolved files:
   ```bash
   git add <resolved-file>
   ```
4. Continue the rebase:
   ```bash
   git rebase --continue
   ```
5. If you ever want to cancel and return to safety:
   ```bash
   git rebase --abort
   ```

---

## 5. Quick Reference Cheat Sheet

| Action | Commands |
|---|---|
| **Check remotes** | `git remote -v` |
| **Fetch upstream updates** | `git fetch upstream` |
| **Check diff against upstream** | `git diff upstream/main` |
| **Sync feature branch** | `git checkout <branch>`<br>`git rebase upstream/main`<br>`git push --force-with-lease origin <branch>` |
| **Sync main branch** | `git checkout main`<br>`git merge upstream/main`<br>`git push origin main` |
