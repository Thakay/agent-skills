# Validation

Run `node --test` to exercise profile discovery, validation, non-execution, error handling, and CLI behavior. Run `node tools/verify-distribution.mjs` to check the intended package and obvious secret/path hazards.

The checks do not prove that an agent will make every handoff decision correctly. Validate behavior in a disposable project before adopting changes to the workflow.

Release installation and loader results will be recorded here after verification. Local paths, private profiles, account details, and raw logs stay outside this repository.
