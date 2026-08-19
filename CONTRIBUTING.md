# Contributing to CloudDrop

Thanks for helping improve CloudDrop. The project intentionally favors small, understandable changes over unnecessary infrastructure or dependency growth.

## Before you change code

1. Read the relevant code and CloudFormation resources.
2. Preserve guest file sharing as a first-class flow.
3. Prefer native browser/AWS capabilities over new dependencies.
4. Do not introduce recurring AWS services without a clear technical reason.
5. Never commit credentials, tokens, private keys or environment secrets.

## Local validation

Run:

```bash
npm test
```

The smoke suite checks JavaScript syntax, merge-conflict markers, required upload/config behavior and CI security expectations.

For infrastructure changes also run:

```bash
python -m pip install cfn-lint
cfn-lint infrastructure/cfn/main.yaml
```

If you have AWS credentials for the target account, also validate the template with:

```bash
aws cloudformation validate-template --template-body file://infrastructure/cfn/main.yaml
```

## Pull requests

- Keep one logical change per PR where practical.
- Explain the security, cost and compatibility impact of infrastructure changes.
- Update documentation when behavior or architecture changes.
- Include manual verification steps for user-facing changes.
- Do not claim tests passed unless they were actually run.
- Keep the CI pipeline green.

## Backend changes

CloudFormation currently contains inline Lambda handlers while `backend/functions/` contains standalone source. If you change backend behavior, update both representations until the packaging model is intentionally migrated.

## UI changes

Check desktop, mobile, keyboard navigation, loading states, error states and `prefers-reduced-motion`. Avoid adding a framework for a problem that can be solved with the existing HTML/CSS/JavaScript architecture.

## Architecture principle

CloudDrop should remain:

> **Fast, simple, secure, serverless and inexpensive to operate.**

Please read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) and [`SECURITY.md`](SECURITY.md) before contributing.
