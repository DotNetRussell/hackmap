# HackMap 🗺️

**Visual attack graph + live command execution for red teamers**

HackMap is a lightweight, local-first pentest mapping tool that combines an interactive Cytoscape graph with real-time shell command execution and persistent command history — all in one clean interface.

Think BloodHound + custom C2 beacon tracker + live terminal, built for real engagements.

### Features

- Interactive drag-and-drop attack graph (nodes = hosts/users/domains)
- Visual connection paths (RDP, WinRM, SMB, etc.)
- Per-node command execution with **real-time streaming output**
- Full command history persisted per target (with timestamps)
- "Owned" flag with skull indicator
- One-click **PDF engagement report** export
- Zero authentication by design — runs on `localhost` only
- No dependencies beyond Python 3 + Flask

