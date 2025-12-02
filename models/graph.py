import json
import os
import uuid
import math
from typing import Dict, List, Any
from datetime import datetime 

ICON_COLORS = {
    'PC': '#4285F4',    # Blue
    'Person': '#34A853',  # Green
    'Admin': '#FBBC05',   # Yellow
    'Lock': '#EA4335',    # Red
    'Skull': '#9AA0A6',   # Gray
    'Endpoint': '#9AA0A6',   # Gray
}

ICON_EMOJIS = {
    "PC": "🖥",
    "Person": "🧌",
    "Admin": "🛡",
    "Lock": "🔐",
    "Skull": "🏴‍☠️",
    "Endpoint": "🌐",
}

class GraphModel:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.data = self._load()

    def _load(self) -> Dict[str, List[Dict[str, Any]]]:
        data = {"nodes": [], "edges": []}
        if os.path.exists(self.db_path):
            with open(self.db_path, 'r') as f:
                data = json.load(f)
        
        # FORCE VALID POSITIONS (FIX NULL VALUES)
        for i, node in enumerate(data.get("nodes", [])):
            pos = node.get("position", {})
            if not pos or pos.get("x") is None or pos.get("y") is None:
                # Spread nodes in circle
                angle = (i * 2 * math.pi) / max(len(data["nodes"]), 1)
                radius = max(200, len(data["nodes"]) * 50)
                node["position"] = {
                    "x": 400 + math.cos(angle) * radius,
                    "y": 300 + math.sin(angle) * radius
                }
            
            node_data = node.get("data", {})
            if "notes" not in node_data:
                node_data["notes"] = ""
            if "owned" not in node_data:
                node_data["owned"] = False
            if "commands" not in node_data:  # NEW: Initialize commands list
                node_data["commands"] = []
            node_data["label"] = self._build_label(node_data)
            node["data"] = node_data
        
        for edge in data.get("edges", []):
            edge_data = edge.get("data", {})
            if "label" not in edge_data:
                edge_data["label"] = "→"
            edge["data"] = edge_data
        
        self._save_data(data)
        return data

    def _save(self):
        self._save_data(self.data)

    def _save_data(self, data):
        dir_path = os.path.dirname(self.db_path)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)
        with open(self.db_path, 'w') as f:
            json.dump(data, f, indent=2)

    def _build_label(self, node_data):
        icon = node_data.get("icon", "🖥️")
        name = node_data.get("name", "Unnamed Node")
        #label = f"{icon}\n{name}"
        label = f"{ICON_EMOJIS[node_data['icon']]} {node_data['name']}" if ICON_COLORS.get(node_data['icon']) else node_data['name'] 
        if node_data.get("owned", False):
            label += "\n💀 Owned"
        return label

    def get_graph(self) -> Dict[str, List[Dict[str, Any]]]:
        data = self.data.copy()
        # FORCE VALID POSITIONS EVERY API CALL
        for i, node in enumerate(data["nodes"]):
            pos = node.get("position", {})
            if not pos or pos.get("x") is None or pos.get("y") is None or math.isnan(pos.get("x", 0)) or math.isnan(pos.get("y", 0)):
                angle = (i * 2 * math.pi) / max(len(data["nodes"]), 1)
                radius = max(200, len(data["nodes"]) * 50)
                node["position"] = {
                    "x": 400 + math.cos(angle) * radius,
                    "y": 300 + math.sin(angle) * radius
                }
        print(f"API: Fixed {len(data['nodes'])} node positions")
        return data

    def add_edge(self, source: str, target: str, label: str = "→", color: str = "#FF9800") -> str:
        edge_id = f"edge-{uuid.uuid4().hex[:8]}"
        edge = {
            "group": "edges",
            "data": {"id": edge_id, "source": source, "target": target, "label": label, "color": color}
        }
        self.data["edges"].append(edge)
        self._save()
        return edge_id

    def update_edge(self, edge_id: str, label: str = None, color: str = None) -> bool:
        for edge in self.data["edges"]:
            if edge["data"]["id"] == edge_id:
                if label is not None:
                    edge["data"]["label"] = label
                if color is not None:
                    edge["data"]["color"] = color
                self._save()
                return True
        return False
        
    def add_node(self, name: str, icon: str, notes: str = "", owned: bool = False, x: float = 0, y: float = 0) -> str:
        node_id = f"node-{uuid.uuid4().hex[:8]}"
        label = self._build_label({"icon": icon, "name": name, "owned": owned})
        # ENSURE VALID POS
        if x == 0 and y == 0:
            x, y = 400, 300
        node = {
            "group": "nodes",
            "data": {
                "id": node_id,
                "name": name or "Unnamed Node",
                "icon": icon or "🖥️",
                "iconColor": ICON_COLORS.get(icon, '#007ACC'),
                "notes": notes,
                "owned": owned,
                "commands": [],  # NEW: Initialize commands
                "label": label
            },
            "position": {"x": x, "y": y}
        }
        self.data["nodes"].append(node)
        self._save()
        return node_id

    # graph.py
    def update_node(self, node_id: str, name: str = None, icon: str = None, notes: str = None, owned: bool = None, x: float = None, y: float = None):
        for node in self.data["nodes"]:
            if node["data"]["id"] == node_id:
                if name is not None:
                    node["data"]["name"] = name
                if icon is not None:
                    node["data"]["icon"] = icon
                    node["data"]["iconColor"] = ICON_COLORS.get(icon, '#4285F4')  # THIS WAS MISSING!
                if notes is not None:
                    node["data"]["notes"] = notes
                if owned is not None:
                    node["data"]["owned"] = owned
                if x is not None and y is not None:
                    node["position"] = {"x": x, "y": y}

                # ALWAYS rebuild label + ensure iconColor exists
                node["data"]["label"] = self._build_label(node["data"])
                if "iconColor" not in node["data"]:
                    node["data"]["iconColor"] = ICON_COLORS.get(icon or node["data"].get("icon", "PC"), '#4285F4')

                self._save()
                return True
        return False

    def remove_edge(self, edge_id: str):
        self.data["edges"] = [e for e in self.data["edges"] if e["data"]["id"] != edge_id]
        self._save()

    def clear(self):
        self.data = {"nodes": [], "edges": []}
        self._save()

    # NEW: Persist command
    def persist_command(self, node_id: str, command: str, output: str) -> bool:
        for node in self.data["nodes"]:
            if node["data"]["id"] == node_id:
                node["data"]["commands"].append({
                    "command": command,
                    "output": output,
                    "timestamp": datetime.utcnow().isoformat()
                })
                self._save()
                return True
        return False

    # NEW: Get node commands
    def get_node_commands(self, node_id: str) -> List[Dict[str, Any]]:
        for node in self.data["nodes"]:
            if node["data"]["id"] == node_id:
                return node["data"]["commands"]
        return []

    # NEW: Delete command
    def delete_command(self, node_id: str, index: int) -> bool:
        for node in self.data["nodes"]:
            if node["data"]["id"] == node_id and 0 <= index < len(node["data"]["commands"]):
                node["data"]["commands"].pop(index)
                self._save()
                return True
        return False