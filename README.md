# R2 Large File Upload

A Cloudflare Worker that allows you to upload large files to an R2 bucket using the multipart upload API. It includes a simple frontend for uploading files with progress tracking and support for resuming interrupted uploads.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/anomalyco/cfr2upload)

## Features

- **Large File Support**: Uses R2 multipart upload API to bypass Worker request body limits.
- **Resumable Uploads**: Tracks progress in `localStorage` to resume uploads after interruption.
- **Progress Tracking**: Displays real-time progress for both individual parts and the overall file.
- **Basic Authentication**: Authentication using Cloudflare KV to protect upload endpoints.
- **Optional Read Protection**: Can extend authentication to pass-through read requests.
- **Pass-through Reads**: Requests without upload actions are passed directly to the R2 bucket.

## Setup

1. **R2 Bucket**: Create an R2 bucket and bind it to your worker as `BUCKET`. 
   - **Important**: For pass-through reads to work, you must enable public access on the bucket via a custom domain matching the worker route.
2. **KV Namespace**: Create a KV namespace and bind it to your worker as `AUTH_KV`.
3. **Authentication**: Add users to your `AUTH_KV` namespace using the format:
   - Key: `user:username`
   - Value: `password`

## Configuration

You can control authentication behavior by adding a key to your `AUTH_KV` namespace:

- Key: `config:auth_read_only`
- Value: `true` (to require authentication for pass-through read requests. Defaults to `false` if key is missing).

## Deployment

You can deploy this project using the "Deploy to Cloudflare" button above or manually using Wrangler:

```bash
npx wrangler deploy
```

