TornPulse — Mainstream App Overhaul — Build #68 Style Marker Fix

WHY BUILD #68 FAILED
• The overhaul itself reached the final UI style-insertion step.
• The patch searched for "const styles = StyleSheet.create({" but TornPulse v1.0 uses "const styles=StyleSheet.create({".
• This stopped before Android generation; no native/Gradle failure occurred.

FIX
• Corrected the one exact style marker to the current TornPulse v1.0 code shape.
• All Mainstream App Overhaul features are unchanged.

INSTALL
1. Extract this ZIP.
2. Replace ONLY root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit.
5. Tell ChatGPT: Done

VALIDATION
• node --check: PASS
• Build #68 failure log reviewed; failing marker corrected exactly.
