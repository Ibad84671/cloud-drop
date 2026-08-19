# CloudDrop

> **Send files. Share the link. Done.**

CloudDrop is a guest-first, privacy-focused serverless file-transfer application inspired by WeTransfer and TransferNow. It lets anyone create a time-limited transfer without an account, uploads file bytes directly from the browser to private Amazon S3 with presigned URLs, and gives recipients short-lived download access. Authentication is optional and exists for transfer management.

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
- **Time-limited transfers:** transfer metadata expires after 7 days and S3 objects are lifecycle-cleaned after 8 days.
- **Optional accounts:** Cognito protects management operations without becoming a barrier to sharing.
- **Cost conscious:** no EC2, RDS, ECS, EKS, NAT Gateway, or paid third-party monitoring is required.

## Features

### Guest transfer

- Drag-and-drop and browser file selection.
- Up to 20 files per transfer.
- Up to 2 GB total transfer size.
- Server-side filename, MIME-type, count, and size validation.
- Direct browser-to-S3 presigned uploads.
- Upload completion verifies the actual S3 object size and content type before a transfer becomes ready.
- Multi-file transfers are finalized into a ZIP using the configured Lambda archiver layer.
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
| Event-free S3 lifecycle + DynamoDB TTL | Cleanup | No extra always-on service |

No NAT Gateway, RDS, EC2, ECS, EKS, ALB, OpenSearch, Redis, or paid monitoring platform is required by the current architecture.

## Repository structure

```text
cloud-drop/
├── .github/workflows/deploy.yml     # validation + OIDC deployment
├── backend/functions/               # Lambda source mirrors
│   ├── batch-create/
│   ├── batch-complete/
│   ├── get-transfer/
│   ├── list-transfers/
│   ├── delete-transfer/
│   └── send-email/
├── docs/adr/                        # architectural decisions
├── frontend/
│   ├── index.html                   # guest upload experience
│   ├── t.html                       # recipient transfer page
│   ├── login.html                   # Cognito PKCE entry point
│   ├── auth-callback.html            # OAuth code exchange
│   ├── signup.html
│   ├── dashboard.html
│   ├── css/
│   └── js/
├── infrastructure/cfn/main.yaml    # single deployment source of truth
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

The CloudFormation template is the deployment source of truth. The files under `backend/functions/` are maintained source mirrors for readability and review; the current stack packages the handlers inline in CloudFormation.

## Deployment

### Prerequisites

- AWS CLI configured for the intended account and region.
- Node.js.
- A Lambda layer containing the `archiver` package for ZIP finalization.
- A verified SES sender only if email sharing is required.

### Validate first

```bash
npm test
python -m pip install --disable-pip-version-check cfn-lint
cfn-lint infrastructure/cfn/main.yaml
aws cloudformation validate-template --template-body file://infrastructure/cfn/main.yaml
```

### Deploy

The repository's deployment helper intentionally refuses to deploy without the archiver layer because multi-file sharing is a core feature.

```bash
export AWS_REGION=us-east-1
export STACK_NAME=clouddrop-dev
export ENVIRONMENT=dev
export ARCHIVER_LAYER_ARN='arn:aws:lambda:us-east-1:<ACCOUNT_ID>:layer:clouddrop-archiver:<VERSION>'
# Optional:
# export SES_SOURCE_EMAIL='verified@example.com'

./scripts/deploy.sh
```

The script obtains API Gateway, Cognito, CloudFront, and email-sharing configuration from CloudFormation outputs and generates `frontend/js/config.js` before syncing the frontend.

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

The destroy helper empties the two managed S3 buckets before deleting the CloudFormation stack. The current buckets do **not** use versioning, avoiding the version/delete-marker trap that previously prevented clean stack deletion.

## Testing

The repository smoke suite checks:

- JavaScript syntax across backend/frontend source files.
- HTML doctype and absence of remote script dependencies.
- Merge-conflict markers.
- Cognito configuration and the absence of the previous required-custom-attribute pattern.
- Cognito-protected API methods.
- API throttling.
- OIDC deployment configuration.
- Required archiver deployment configuration.
- Removal of known generated artifacts.

The CI workflow additionally runs `cfn-lint` and AWS `cloudformation validate-template` before deployment.

> A repository-level test is not a substitute for an actual AWS deployment test. Guest upload, ZIP finalization, Cognito login, recipient download, SES sending, and CloudFront behavior should be smoke-tested after deployment in the target AWS account.

## Documentation

- [Security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)
- [Architecture decisions](docs/adr/)

## Cost philosophy

CloudDrop deliberately chooses serverless, request-based AWS services and avoids infrastructure that introduces a fixed monthly floor. The application does not need a NAT Gateway, relational database, container cluster, or always-on compute.

The ZIP finalization Lambda is the one intentionally heavier path: it can use up to 10 GB of ephemeral storage and a configured archiver layer so multi-file transfers can be assembled without buffering the complete archive in Lambda memory.

## Known operational requirements

1. The archiver Lambda layer must contain a compatible `archiver` package for Node.js 20.
2. SES email sharing requires a verified sender and an account/region permitted to send email.
3. GitHub Actions deployment requires an AWS OIDC trust relationship for `AWS_DEPLOY_ROLE_ARN`.
4. CloudFront and Cognito are created during the first deployment, so runtime configuration must be generated from stack outputs rather than hardcoded.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
