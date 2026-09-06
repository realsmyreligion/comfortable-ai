Torn Pulse HUD202 polish pass

Changes:
- Collapsed TP control now docks flush to the right edge.
- Horizontal dragging is removed; the HUD stays right-docked and can still move vertically.
- Collapsed rail has rounded exposed corners and a square screen-edge side.
- TP mark is now blue/cyan instead of red.
- Expanded HUD spacing is slightly tighter.
- Temporary attack alerts now expire correctly.
- LAST ATTACK now shows age.
- Red is reserved for attacks within the last 2 minutes.
- Attacks 2–60 minutes old use cyan; older attacks use muted text.
- Native HUD User-Agent updated to HUD202.

Upload app.config.js to the repository root and replace the existing file.
Commit to main; the existing GitHub Actions workflow will build the APK automatically.
