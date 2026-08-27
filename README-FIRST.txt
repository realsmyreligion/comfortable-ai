TORNPULSE v0.8.2 — CORRECTED BUILD FILES

IMPORTANT: the original v0.8.2 bundle omitted patch-v081.cjs. Use this corrected bundle.

GitHub repository: realsmyreligion/comfortable-ai

1) Put BOTH patch files in the repository ROOT:
   - patch-v081.cjs
   - patch-v082.cjs

2) Replace the existing workflow at EXACTLY:
   .github/workflows/main.yml
   with the main.yml included in this ZIP.

3) Commit to main.

The workflow should show these two steps in order:
   Apply v0.8.1 refinement
   Apply v0.8.2 Health + Status HUD

Then it will build and upload artifact:
   tornpulse-v0.8.2-apk

Do not use the artifact from run #28; that run still used the old v0.8.0 workflow.
