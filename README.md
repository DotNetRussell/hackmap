# HackMap 🗺️

**Visual attack graph + live command execution for red teamers**

HackMap is a lightweight, local-first pentest mapping tool that combines an interactive Cytoscape graph with real-time shell command execution and persistent command history — all in one clean interface.

### Features

- Track multiple workspaces at once
- Export graph data for easy backup and sharing
- Interactive drag-and-drop attack graph 
- Visual connection paths (RDP, WinRM, SMB, etc.)
- Per-node command execution with **real-time streaming output**
- Command history persisted per target (with timestamps)
- "Owned" flag with skull indicator
- One-click **PDF engagement report** export
- Very light weight, zero authentication by design 
- No dependencies beyond Python 3 + Flask

### Screenshot

### Easily generate network diagrams using nodes 
![HackMap in action](https://i.imgur.com/ryzWFKi.png)
![HackMap in action](https://i.imgur.com/L844UpX.png)
![HackMap in action](https://i.imgur.com/k91I5si.png)

### Each node has contextual notes as well as the ability to tie shell commands directly to the node for tracking
![HackMap in action](https://i.imgur.com/NGftOC3.png)

### Generate a report that dumps out all the raw node data for more organized report writing 
![HackMap in action](https://i.imgur.com/MhFFQp1.png)
