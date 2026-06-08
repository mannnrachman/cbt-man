# Contributing to CBT-MAN Upgrade

Thank you for your interest in contributing to CBT-MAN Upgrade.

This project welcomes thoughtful improvements, bug fixes, documentation work, and architectural refinement. At the same time, contributors are expected to respect the purpose of the repository: it is shared for learning, evaluation, internal use, and collaborative improvement — **not for commercial resale**.

## Before You Contribute

Please make sure you understand the following:

- This repository is licensed under **NCU-1.0**.
- Commercial resale or commercialization of the application is not allowed without prior written permission.
- Contributions should improve the project in a technically responsible and maintainable way.
- Large behavioral or architectural shifts should be discussed first.

## Good Contributions

Examples of contributions that are welcome:

- bug fixes
- type-safety improvements
- test improvements
- documentation improvements
- performance improvements
- accessibility improvements
- UI consistency improvements
- realistic domain modeling improvements
- better error handling and recovery
- safer persistence and data-flow improvements

## Contributions That Need Discussion First

Please open an issue before working on changes that:

- significantly alter the CBT domain model
- replace major architectural layers
- change the intended educational/school-oriented use of the application
- remove source-context acknowledgment or usage restrictions
- introduce licensing or distribution changes

## Contributions That Are Not Accepted

The following are outside the intended scope of this repository:

- changes whose purpose is commercial resale
- changes intended to repackage the repository as a paid product
- changes that remove or weaken the non-commercial restriction
- changes that conceal the origin/context of the project
- low-quality drive-by edits that increase maintenance burden

## Development Workflow

1. Fork the repository.
2. Create a focused branch.
3. Keep changes small and reviewable.
4. Run verification before submitting.
5. Open a pull request with a clear description.

## Recommended Verification

Before opening a pull request, run:

```bash
npm run prisma:validate
npm run prisma:seed
npx tsc --noEmit
node scripts/check-admin-routes.mjs
npm run build
```

If your change affects formatting or style-sensitive files, also run:

```bash
npm run lint
npm run format
```

## Pull Request Expectations

A good pull request should:

- explain what changed
- explain why it changed
- identify affected areas
- mention any follow-up work or limitations
- stay focused on one concern where possible

## Style Expectations

Please aim for:

- clear naming
- small, coherent commits
- minimal unnecessary refactors mixed into feature work
- defensive handling around runtime data assumptions
- consistency with the existing school/CBT domain language

## Respect the Project Context

This repository was created as an upgraded continuation of source material that helped the author significantly. Contributions are welcome when they honor that context and improve the project in good faith.

Please do not use contribution activity as a basis for selling the project or converting it into a commercial distribution.

## Questions

If a proposed contribution is large, unclear, or potentially sensitive in scope, open an issue first and discuss it before implementation.
