# Maintaining this collection

Keep distributed skills independent of any individual's machine, account, private project, or task system. User profiles belong outside the repository and installed skill directories. Generic examples use placeholders.

Follow [CONTRIBUTING.md](CONTRIBUTING.md) for layout, versioning, checks, and releases. Maintain each skill's documented contracts, such as its profile format, explicit invocation, and project ownership rules. A profile customizes a workflow; it does not grant additional permissions.

Run `npm run check` before committing. Review every staged file for personal information and private integration details. Use explicit staged paths.

Maintainer clones commit as `Agent Skills Maintainers <maintainers@example.invalid>`, set in the clone's local git config (`git config user.name "Agent Skills Maintainers"` and `git config user.email maintainers@example.invalid`). Never commit or tag with a personal name or email. Land a pull request by fast-forwarding `main` from such a clone (`git merge --ff-only`, then push) after CI passes; GitHub's merge buttons record the merging account's name in history. Do not change repository visibility or settings as part of a routine update.
