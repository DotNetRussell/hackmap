![BloodBash verbose output example](https://i.imgur.com/m5RVnJZ.png)

# HackMap 🗺️
**Visual attack graph + live command execution for red teamers, penetration testers, and students**
HackMap is a lightweight, local-first pentest mapping tool that combines an interactive Cytoscape graph with real-time shell command execution, persistent command history, subgraphs, and hierarchical PDF reports — all in one clean, responsive interface.

### Quick Start
1. Install Python 3 and Flask.
2. Run `python app.py`.
3. Open `http://localhost:5000` in your browser.
4. Create a workspace, add nodes, connect them, execute commands, and export reports.
   
### Features
- **Multiple Workspaces**: Track and switch between multiple JSON-based workspaces for different engagements.
- **Interactive Graph**: Drag-and-drop nodes with icons (PC, Person, Admin, Lock, Skull, Endpoint) for visual attack mapping.
- **Subgraphs**: Drill down into nested graphs under parent nodes (e.g., sub-networks, detailed breakdowns).
- **Navigation**: Breadcrumb trail and back button for subgraph navigation; subgraph indicators (📁) on nodes with subgraphs.
- **Node Selection & Actions**:
  - Shift-click: Multi-select nodes (orange border) for connecting multiple targets.
  - Ctrl-click: Select nodes for subgraph operations (blue border).
  - Connect selected: Link multiple nodes in sequence.
  - Add sub-nodes: Create nodes within subgraphs of selected parents.
- **Real-Time Command Execution**: Execute shell commands directly on nodes with streaming output (e.g., `whoami`, `netstat`).
- **Command History**: Persistent per-node command logs with timestamps; view in modal or flyout.
- **Ownership Tracking**: "Owned" flag with skull icon for compromised assets.
- **Edge Customization**: Double-click edges to edit labels (e.g., RDP, SMB) and colors.
- **PDF Report Export**: Hierarchical, well-structured reports including:
  - Total stats (nodes, edges, owned).
  - Dedicated "Users" section for all Person nodes.
  - Connections and node details (notes, commands) organized by subgraphs.
- **Responsive Design**: Toolbar collapses on small screens; zoom adjusts for small graphs (~10-13% node size).
- **No Dependencies**: Runs on Python 3 + Flask; zero authentication, fully local.
- **Export/Import**: Download/upload JSON files for backup/sharing.

### Screenshots
### Easily generate network diagrams using nodes 
![HackMap in action](https://i.imgur.com/SzMCI0i.png)
![HackMap in action](https://i.imgur.com/ryzWFKi.png)
![HackMap in action](https://i.imgur.com/L844UpX.png)
![HackMap in action](https://i.imgur.com/k91I5si.png)
### Each node has contextual notes as well as the ability to tie shell commands directly to the node for tracking
![HackMap in action](https://i.imgur.com/NGftOC3.png)
### Generate a report that dumps out all the raw node data for more organized report writing 
![HackMap in action](https://i.imgur.com/pSuQfQj.png)
