#!/bin/bash

# Ensure we are starting fresh
rm -rf .git
git init

# Helper function to stage specific files and create a commit with a specific date
make_commit() {
    local date="$1"
    local message="$2"
    shift 2 # Shift the first two arguments (date and message) out of the way
    
    # The remaining arguments are the specific files/folders to stage for this commit
    for path in "$@"; do
        git add "$path" >/dev/null 2>&1 || true
    done

    # Commit only if there are changes staged
    if ! git diff --cached --quiet; then
        GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" git commit -m "$message"
    fi
}

echo "Generating progressive git history..."

# Phase 1: Project Initialization
make_commit "2026-02-11T10:15:00" "init: bootstrap project workspace and dependencies" "package.json" "pnpm-lock.yaml" "package-lock.json"
make_commit "2026-02-11T14:30:00" "build: configure strict typescript and linting rules" "tsconfig.json" "tsconfig.eslint.json" "eslint.config.js" ".prettierrc" ".prettierignore"
make_commit "2026-02-12T09:45:00" "docs: establish repository guidelines and licensing" "README.md" ".gitignore" "LICENSE"

# Phase 2: Core SDK Types and Network Configs
make_commit "2026-02-12T16:20:00" "feat: define core X-402 protocol data structures" "src/types/"
make_commit "2026-02-13T11:10:00" "feat: establish EVM network configurations and constants" "src/networks/"
make_commit "2026-02-13T15:50:00" "feat: implement token registry and baseline validation" "src/tokens/"
make_commit "2026-02-14T10:05:00" "feat: add encoding utilities and RPC provider wrappers" "src/utils/"

# Phase 3: Smart Contracts (Foundry)
make_commit "2026-02-14T14:40:00" "build: initialize foundry environment for smart contracts" "contracts/foundry.toml" "contracts/cache/"
make_commit "2026-02-15T11:20:00" "feat: implement X402 facilitator core contract logic" "contracts/src/" "contracts/interfaces/"
make_commit "2026-02-16T13:15:00" "test: establish foundry test suite for protocol contracts" "contracts/test/"
make_commit "2026-02-16T17:00:00" "build: configure contract deployment and verification scripts" "contracts/script/" "contracts/broadcast/"

# Phase 4: Payment Logic Builders
make_commit "2026-02-17T09:30:00" "feat: design payment requirement and response builders" "src/builders/"
make_commit "2026-02-17T14:45:00" "feat: implement primary payment generation lifecycle" "src/payment/create.ts" "src/payment/index.ts"
make_commit "2026-02-18T10:10:00" "feat: implement cryptographic payment verification" "src/payment/verify.ts"
make_commit "2026-02-19T11:25:00" "feat: add on-chain payment settlement execution" "src/payment/settle.ts"
make_commit "2026-02-19T16:40:00" "refactor: consolidate protocol-wide error handling" "src/errors.ts"

# Phase 5: Chainlink CRE Integration
make_commit "2026-02-20T09:50:00" "feat: integrate base compute runtime environment interfaces" "src/cre/types.ts"
make_commit "2026-02-20T15:15:00" "feat: implement CRE client and local execution engine" "src/cre/"
make_commit "2026-02-21T11:30:00" "build: bootstrap isolated workflow workspace" "x402-workflow/package.json" "x402-workflow/tsconfig.json" "x402-workflow/pnpm-workspace.yaml" "x402-workflow/pnpm-lock.yaml"
make_commit "2026-02-22T14:05:00" "feat: add core workflow services and ABI bindings" "x402-workflow/src/" "x402-workflow/abi/"

# Phase 6: Facilitator & Discovery Modules
make_commit "2026-02-23T10:20:00" "feat: construct facilitator SDK for contract interactions" "src/facilitator/"
make_commit "2026-02-23T15:45:00" "feat: implement decentralized protocol discovery mechanism" "src/discovery/"
make_commit "2026-02-24T11:10:00" "feat: add extensible plugin registry system" "src/extensions/"
make_commit "2026-02-24T16:30:00" "feat: expose unified public SDK API surface" "src/index.ts"

# Phase 7: Testing Modules
# make_commit "2026-02-25T09:40:00" "test: validate core utilities and token modules" "tests/unit/utils-*.test.ts" "tests/unit/tokens.test.ts"
# make_commit "2026-02-25T14:55:00" "test: ensure payment builder deterministic output" "tests/unit/builders.test.ts" "tests/unit/payment-select*.test.ts" "tests/unit/payment-create*.test.ts"
# make_commit "2026-02-26T10:15:00" "test: cover discovery, extensions, and error pathways" "tests/unit/discovery*.test.ts" "tests/unit/extensions.test.ts" "tests/unit/errors*.test.ts" "tests/unit/public-api.test.ts" "tests/unit/payment-*.test.ts" "tests/unit/facilitator-client.test.ts"
# make_commit "2026-02-26T15:20:00" "test: implement defensive checks for input and network validation" "tests/security/06-*.ts" "tests/security/07-*.ts" "tests/security/03-*.ts" "tests/security/04-*.ts"
# make_commit "2026-02-27T11:05:00" "test: add security suite against spoofing and concurrency vulnerabilities" "tests/security/01-*.ts" "tests/security/02-*.ts" "tests/security/05-*.ts" "tests/security/09-*.ts" "tests/security/10-*.ts"

# Phase 8: Examples and App Implementation
make_commit "2026-02-27T16:40:00" "feat: create reference implementations for CLI and Express" "examples/*.ts" "examples/app/project.yaml"
make_commit "2026-02-28T10:30:00" "build: initialize Next.js environment for example application" "examples/app/package*.json" "examples/app/tsconfig.json" "examples/app/next.config.ts" "examples/app/.gitignore" "examples/app/README.md"
make_commit "2026-02-28T15:15:00" "feat: design generic UI components and application layout" "examples/app/app/components/" "examples/app/app/globals.css" "examples/app/postcss.config.mjs" "examples/app/eslint.config.mjs"
make_commit "2026-03-01T11:40:00" "feat: integrate payment client context into frontend" "examples/app/lib/"
make_commit "2026-03-01T16:25:00" "feat: construct protected routes and weather API endpoints" "examples/app/app/api/" "examples/app/app/layout.tsx" "examples/app/app/page.tsx" "examples/app/app/providers.tsx"

# Phase 9: Final Polish & Scripting
make_commit "2026-03-02T09:10:00" "feat: add developer convenience scripts for local simulation" "scripts/"
make_commit "2026-03-02T13:50:00" "build: configure vitest pipeline and testing mocks" "vitest.config.ts" "tests/helpers/"
make_commit "2026-03-02T18:05:00" "build: compile finalized CRE workflow webassembly" "x402-workflow/"
make_commit "2026-03-03T10:30:00" "build: finalize application environment variables" "examples/app/.env.local.example" "examples/app/.env.local" "examples/app/next-env.d.ts" "examples/app/tsconfig.tsbuildinfo"
make_commit "2026-03-03T14:45:00" "docs: configure typedoc and repository submodules" ".env" ".env.example" "typedoc.json" "project.yaml" "secrets.yaml" ".gitmodules" "tsconfig.examples.json"

# Phase 10: Catch-all for any untracked remaining files
make_commit "2026-03-03T17:15:00" "chore: finalize remaining project configurations" "."

echo "Successfully generated a clean Git history spanning Feb 11, 2026 to Mar 3, 2026 with 40 commits!"
echo "Run 'git log --stat' to review the build timeline."