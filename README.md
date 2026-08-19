# CloudDrop

> **Send files. Share the link. Done.**

CloudDrop is a guest-first, privacy-focused serverless file-transfer application inspired by WeTransfer and TransferNow. It lets anyone create a time-limited transfer without an account, uploads file bytes directly from the browser to private Amazon S3 with presigned URLs, and gives recipients short-lived download access. Authentication is optional and exists for transfer management.

**Live demo:** https://d31ipw1qs2uo7j.cloudfront.net/

**GitHub:** https://github.com/Ibad84671/cloud-drop

[![License](https://img.shields.io/badge/license-MIT-111827.svg)](LICENSE.txt)
[![AWS](https://img.shields.io/badge/AWS-serverless-FF9900.svg)](https://aws.amazon.com/serverless/)
[![Frontend](https://img.shields.io/badge/frontend-Vanilla%20JavaScript-F7DF1E.svg)](frontend/)
[![IaC](https://img.shields.io/badge/IaC-CloudFormation-FF9900.svg)](infrastructure/cfn/main.yaml)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF.svg)](.github/workflows/deploy.yml)

## Product principles

- **Guest first:** basic file sharing does not require registration.
- **Private by default:** upload storage is not public.
- **Direct transfer:** browsers upload directly to S3 instead of sending file bytes through Lambda.
- **Short-lived access:** upload URLs expire after 15 minutes; download URLs expire after 5 minutes.
- **Time-limited transfers:** transfer metadata expires after 7 days and S3 objects lifecycle-clean after 8 days.
- **Optional accounts:** Cognito protects management operations without becoming a barrier to sharing.
- **Cost conscious:** no EC2, RDS, ECS, EKS, NAT Gateway, or paid third-party monitoring platform is required.

## Features

### Guest transfer

- Drag-and-drop and browser file selection.
- Up to 20 files per transfer.
- Up to 2 GB total transfer size.
- Server-side filename, MIME-type, count, and size validation.
- Direct browser-to-S3 presigned uploads.
- Upload completion verifies the actual S3 object size and content type before a transfer becomes ready.
- Multi-file transfers are finalized into a ZIP using the configured Lambda `archiver` dependency/layer path.
- Shareable `/t/{transferId}` links.

### Recipient

- No account required.
- Transfer state and expiry are checked server-side.
- Download is performed directly from private S3 with a five-minute presigned URL.
- Expired, missing, malformed, and incomplete transfers receive clear user-facing errors.

### Optional account

- Cognito email/password sign-up.
- Cognito Hosted UI authorization-code + PKCE login.
- Session-scoped browser tokens.
- Authenticated transfer listing.
- Server-side ownership enforcement for deletion.
- Pagination for the dashboard.

### Optional email sharing

If a verified SES sender is supplied at deployment time, `/send-email` can send a transfer link. The backend accepts a transfer ID rather than trusting a browser-supplied URL and constructs the canonical CloudFront link server-side.

## Architecture

```mermaid
flowchart LR
    B[Browser]
    CF[CloudFront]
    FE[(Private S3 Frontend)]
    API[API Gateway REST]
    L1[Lambda: create/complete]
    L2[Lambda: transfer access]
    L3[Lambda: account management]
    D[(DynamoDB)]
    S[(Private S3 Uploads)]
    C[Cognito]
    SES[SES optional]

    B -->|HTTPS| CF
    CF --> FE
    B -->|REST JSON| API
    API --> L1
    API --> L2
    API --> L3
    L1 --> D
    L1 -->|presigned PUT| S
    L2 --> D
    L2 -->|presigned GET| S
    L3 --> D
    L3 --> S
    C -->|JWT| API
    L1 -->|optional email| SES
```

### Why this architecture?

CloudDrop keeps the expensive path—the file bytes—out of Lambda. Lambda handles metadata, authorization, validation, presigned URL generation, and transfer state. S3 handles the actual file storage and delivery. DynamoDB provides low-cost metadata storage with TTL cleanup. CloudFront serves the static frontend and rewrites transfer routes to `t.html`.

## Verified end-to-end smoke test

The deployed AWS stack has been manually verified through the real API path, not only through local code inspection.

The successful test sequence was:

1. `POST /batch` created a transfer and returned a presigned S3 upload URL.
2. A six-byte `test.txt` file was uploaded directly to the private S3 object URL.
3. `POST /batch/{id}/complete` returned `200 OK` with `status: ready`.
4. `GET /transfer/{id}` returned a five-minute presigned ZIP download URL.
5. The ZIP was downloaded successfully and extracted successfully.
6. The extracted archive contained the original six-byte `test.txt` file.

The test also caught and fixed two real deployment issues: the batch-complete Lambda initially lacked its `archiver` runtime dependency, and the upload test initially used an eight-byte Windows `echo` file while declaring six bytes. The deployed Lambda was subsequently repackaged with `archiver`, updated successfully, and the exact-size upload path passed.

## Request flow

### Upload

```text
Browser
  ↓ POST /batch
API Gateway
  ↓
BatchCreate Lambda
  ↓ validate metadata + create transfer record
DynamoDB
  ↓
Browser receives presigned PUT URLs
  ↓
Private S3
  ↓
POST /batch/{id}/complete
  ↓
BatchComplete Lambda
  ↓ verify every expected object
  ↓ create ZIP when needed
DynamoDB → status=ready
```

### Download

```text
Recipient opens /t/{id}
  ↓
CloudFront → t.html
  ↓ GET /transfer/{id}
API Gateway → Lambda
  ↓
DynamoDB state/expiry check
  ↓
5-minute S3 presigned GET URL
  ↓
Recipient downloads directly from private S3
```

### Authenticated management

```text
Cognito authorization-code + PKCE
  ↓
sessionStorage token
  ↓
GET /user/transfers   → OwnerIndex query
DELETE /transfer/{id} → server-side owner check
```

## API contract

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `POST` | `/batch` | Guest / optional auth | Create a transfer and presigned upload URLs |
| `POST` | `/batch/{id}/complete` | Public | Verify uploads and finalize the transfer |
| `GET` | `/transfer/{id}` | Public | Resolve a ready transfer and create a short-lived download URL |
| `DELETE` | `/transfer/{id}` | Cognito | Delete an owned transfer |
| `GET` | `/user/transfers` | Cognito | List transfers owned by the signed-in user |
| `POST` | `/send-email` | Public, SES required | Send a canonical transfer link by email |

All application errors use a stable shape:

```json
{
  "success": false,
  "error": {
    "code": "TRANSFER_NOT_FOUND",
    "message": "Transfer not found."
  }
}
```

## Security model

CloudDrop treats the browser as untrusted.

- S3 Block Public Access is enabled for both buckets.
- Frontend S3 is readable only through the CloudFront Origin Access Identity.
- Upload storage is private.
- Upload and download URLs are temporary capabilities, not permanent credentials.
- Random transfer IDs and object keys reduce accidental enumeration.
- Uploaded object size and content type are verified again during completion.
- Download access checks transfer existence, readiness, and expiry on the server.
- Dashboard and delete endpoints require Cognito authorization.
- Delete operations enforce ownership server-side and use a DynamoDB conditional delete.
- API Gateway has stage throttling to provide lightweight abuse resistance.
- Lambda responses do not expose raw AWS exception messages to clients.
- Logs record error names rather than tokens, credentials, or presigned URLs.
- Security headers include HSTS, frame protection, MIME sniffing protection, Referrer-Policy, Permissions-Policy, and a CloudFront CSP.

## AWS services

| Service | Responsibility | Cost philosophy |
|---|---|---|
| Amazon S3 | Frontend and private transfer objects | Pay for stored/used data |
| Amazon CloudFront | HTTPS frontend delivery and transfer-route rewrite | Managed CDN, Price Class 100 |
| API Gateway REST | Public API boundary | Pay per request |
| AWS Lambda | Validation, metadata, ZIP finalization, authorization | Pay per execution |
| DynamoDB | Transfer metadata, ownership index, TTL | On-demand |
| Cognito | Optional user authentication | Managed authentication |
| SES | Optional email sharing | Only used when configured |
| S3 lifecycle + DynamoDB TTL | Cleanup | No extra always-on service |

## Repository structure

```text
cloud-drop/
├── .github/workflows/deploy.yml
├── backend/functions/
│   ├── batch-create/
│   ├── batch-complete/
│   ├── get-transfer/
│   ├── list-transfers/
│   ├── delete-transfer/
│   └── send-email/
├── docs/adr/
├── frontend/
│   ├── index.html
│   ├── t.html
│   ├── login.html
│   ├── auth-callback.html
│   ├── signup.html
│   ├── dashboard.html
│   ├── css/
│   └── js/
├── infrastructure/cfn/main.yaml
├── scripts/
│   ├── deploy.sh
│   └── destroy.sh
├── tests/smoke.test.js
├── package.json
├── SECURITY.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE.txt
└── README.md
```

The CloudFormation template is the deployment source of truth. Backend function directories are maintained source mirrors for readability and review. Generated Lambda ZIP packages and local dependency directories are intentionally not committed.

## Deployment

### Prerequisites

- AWS CLI configured for the intended account and region.
- Node.js.
- A compatible `archiver` Lambda dependency/layer for ZIP finalization.
- A verified SES sender only if email sharing is required.

### Validate first

```bash
npm test
python -m pip install --disable-pip-version-check cfn-lint
cfn-lint infrastructure/cfn/main.yaml
aws cloudformation validate-template --template-body file://infrastructure/cfn/main.yaml
```

### Deploy

```bash
export AWS_REGION=us-east-1
export STACK_NAME=clouddrop-dev
export ENVIRONMENT=dev
export ARCHIVER_LAYER_ARN='arn:aws:lambda:us-east-1:<ACCOUNT_ID>:layer:clouddrop-archiver:<VERSION>'
# Optional:
# export SES_SOURCE_EMAIL='verified@example.com'

./scripts/deploy.sh
```

The deployment helper obtains API Gateway, Cognito, CloudFront, and email-sharing configuration from CloudFormation outputs and generates `frontend/js/config.js` before syncing the frontend. The checked-in `frontend/js/config.js` remains a safe empty configuration rather than containing environment-specific credentials or generated deployment state.

### GitHub Actions

Pushes to `main` run validation first. Deployment uses GitHub OIDC and requires these repository secrets:

- `AWS_DEPLOY_ROLE_ARN`
- `ARCHIVER_LAYER_ARN`
- `SES_SOURCE_EMAIL` (optional)

Long-lived AWS access keys are intentionally not used by the workflow.

## Destruction / cost control

For a clean development teardown:

```bash
./scripts/destroy.sh
```

The destroy helper empties the two managed S3 buckets before deleting the CloudFormation stack. The current buckets do not use versioning, avoiding the version/delete-marker trap that can prevent clean stack deletion.

## Testing

The repository smoke suite checks:

- JavaScript syntax across backend/frontend source files.
- HTML doctype and absence of remote script dependencies.
- Merge-conflict markers.
- Cognito configuration and absence of the previous required-custom-attribute pattern.
- Cognito-protected API methods.
- API throttling.
- OIDC deployment configuration.
- Required archiver deployment configuration.
- Removal of known generated artifacts.

CI additionally runs `cfn-lint` and AWS `cloudformation validate-template` before deployment.

> A repository-level test is not a substitute for an actual AWS deployment test. Guest upload, ZIP finalization, Cognito login, recipient download, SES sending, and CloudFront behavior should be smoke-tested after deployment in the target AWS account.

## Documentation

- [Security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)
- [Architecture decisions](docs/adr/)

## Cost philosophy

CloudDrop deliberately chooses serverless, request-based AWS services and avoids infrastructure that introduces a fixed monthly floor. The application does not need a NAT Gateway, relational database, container cluster, or always-on compute.

The ZIP finalization Lambda is the intentionally heavier path: it can use up to 10 GB of ephemeral storage and uses the configured `archiver` dependency/layer so multi-file transfers can be assembled without buffering the complete archive in Lambda memory.

## Known operational requirements

1. The batch-complete Lambda must have a compatible `archiver` dependency available at runtime.
2. SES email sharing requires a verified sender and an account/region permitted to send email.
3. GitHub Actions deployment requires an AWS OIDC trust relationship for `AWS_DEPLOY_ROLE_ARN`.
4. CloudFront and Cognito are created during deployment, so runtime configuration should be generated from stack outputs rather than hardcoded.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
