# AGENTS.md — CBT-MAN

Jika Anda agen AI atau alat otomatis, baca **seluruh** [`CLAUDE.md`](./CLAUDE.md) sebelum membaca, mengubah, atau mengusulkan kode.

Dokumen tersebut adalah sumber aturan implementasi, keamanan, migrasi, validasi, dan pull request untuk CBT-MAN. [`CONTRIBUTING.md`](./CONTRIBUTING.md) berlaku untuk semua kontributor, termasuk agen AI.

## Ringkasan aturan yang tidak boleh dilanggar

1. Mulai dari `main` terbaru dan kerjakan **satu masalah atau fitur per branch/PR**.
2. Jangan membuka PR aggregate, membawa kembali commit/branch yang sudah ditolak, atau mencampur UI, refactor, dependency, dan fitur yang tidak berkaitan.
3. Jangan mengandalkan pembatasan UI untuk otorisasi. Semua read/mutation sensitif harus memverifikasi caller, role, ownership, dan scope di server.
4. Jangan mengubah Prisma schema tanpa migration additive yang dapat dideploy dan rencana preservasi data.
5. Jangan mengedit `src/routeTree.gen.ts` secara manual.
6. Jangan menambahkan artifact, file scratch, data upload, error dump, atau branding lama.
7. Jalankan seluruh gate lokal, termasuk `npm run check:prisma` saat gate database relevan, lalu tunggu `CI` serta review yang relevan sebelum menyatakan PR siap merge.
8. Jangan force-push, menghapus branch kontributor, menonaktifkan branch protection, atau meminta maintainer mengabaikan CI/review.

Sebelum membuka PR, baca seluruh [template PR](./.github/PULL_REQUEST_TEMPLATE.md) dan isi dengan bukti spesifik. Jika tidak dapat menjawab template dengan fakta, jangan buka PR.

## Git Workflow & Anti-Stale Base Branching Protocol

You MUST strictly enforce the "Anti-Stale Base Branching Protocol" whenever you create a new Git branch or start working on a new feature/bugfix task.

### Mandatory Pre-Branching Execution Steps
Before creating any new branch or making code changes, execute the following sequence:

1. **Fetch Latest Remote State:**
   Always sync the local repository with remote tracking branches first.
   `git fetch origin`

2. **Verify Base Freshness:**
   Check if the base branch (e.g., `main` or `develop`) is up to date with `origin`.
   - Never branch directly off an unverified local branch.
   - Always derive new branches explicitly from updated remote tracking refs, e.g.:
     `git checkout -b <feature-branch-name> origin/main`
     OR checkout the base, pull, then create:
     `git checkout main && git pull origin main && git checkout -b <feature-branch-name>`

3. **Validation Rule (Hard Stop):**
   - If the local base branch is behind `origin/<base-branch>` by 1 or more commits, DO NOT create the feature branch until `git pull` or `git fetch` is completed.
   - NEVER create a feature branch off a temporary or outdated local topic branch unless explicitly requested by the user.
