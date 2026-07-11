# Production deployment

## Release gate

1. Run the full deterministic calculation, validation, export, and release-safety suite.
2. Build the whitelist-only static artifact.
3. Verify the HTML, calculation engine, export engine, stylesheet, and security headers are present.
4. Deploy the exact commit to the `fiber-loss-calculator` Cloudflare Pages project.
5. Smoke-test the immutable deployment URL before treating the run as complete.

## Production

- GitHub repository: `CamoRageaholic1/fiber-loss-calculator`
- Cloudflare Pages project: `fiber-loss-calculator`
- Production branch: `main`
- Custom domain: `fibercalc.camozeroday.dev`

GitHub Actions reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from encrypted repository secrets.

## Pre-deploy checklist

- `npm test` passes.
- `npm run build` succeeds.
- `git diff --check` is clean.
- No credentials or generated reports are committed.
- FOA/TIA source labels and URLs remain visible.
- XLSX and PDF signatures and content tests pass.
- Calculation changes receive an independent review.

## Rollback triggers

Rollback if any of these occur:

- Length-unit equivalence changes a physical path or result.
- A valid known fixture changes unexpectedly.
- Invalid data produces a passing result.
- Exported reports omit a visible loss event, assumption, or total.
- Production does not load the calculation engine or security headers.

Revert the offending commit and push `main`; Cloudflare Pages keeps prior successful deployments available for immediate promotion.
