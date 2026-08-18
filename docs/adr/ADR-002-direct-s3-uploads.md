# ADR-002: Direct-to-S3 Uploads

**Context**: Need to handle large file uploads efficiently.

**Decision**: Upload directly to S3 using presigned URLs.

**Alternatives**: Upload via Lambda, upload via API Gateway.

**Trade-offs**: Direct upload avoids Lambda timeout (15 min limit), reduces data transfer costs, and improves scalability.