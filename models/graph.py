import json
import os
import uuid
import math
from typing import Dict, List, Any
from datetime import datetime

ICON_COLORS = {
    'PC': '#4285F4',
    'Person': '#34A853',
    'Admin': '#FBBC05',
    'Lock': '#EA4335',
    'Skull': '#131414',
    'Endpoint': '#4a4d4f',
}

ICON_EMOJIS = {
    "PC": "\ud83d\udda5",
    "Person": "\ud83e\uddcc",
    "Admin": "\ud83d\udee1",
    "Lock": "\ud83d\udd10",
    "Skull": "\ud83c\udf10",
    "Endpoint": "\ud83c\udf10",
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

        for i, node in enumerate(data.get("nodes", [])):
            pos = node.get("position", {})
            if not pos or pos.get("x") is None or pos.get("y") is None:
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
            if "commands" not in node_data:
                node_data["commands"] = []
            if "subgraph" not in node_data:
                node_data["subgraph"] = {"nodes": [], "edges": []}
            node_data["label"] = self._build_label(node_data)
            node["data"] = node_data
        
        for edge in data.get("edges", []):
            edge_data = edge.get("data", {})
            if "label" not in edge_data:
                edge_data["label"] = "\u2192"
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
        icon = node_data.get("icon", "\ud83d\udda5\ufe0f")
        name = node_data.get("name", "Unnamed Node")
        label = f"{ICON_EMOJIS[node_data['icon']]} {node_data['name']}" if ICON_COLORS.get(node_data['icon']) else node_data['name'] 
        if node_data.get("owned", False):
            label += "\n\ud83d\udc80 Owned"
        return label

    def get_subgraph_at_path(self, path: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        current = self.data
        for node_id in path:
            node = next((n for n in current["nodes"] if n["data"]["id"] == node_id), None)
            if not node or "subgraph" not in node["data"]:
                return {"nodes": [], "edges": []}
            current = node["data"]["subgraph"]
        return current

    def get_graph(self, subgraph_path: List[str] = None) -> Dict[str, List[Dict[str, Any]]]:
        subgraph_path = subgraph_path or []
        data = self.get_subgraph_at_path(subgraph_path).copy()
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

    def add_edge(self, source: str, target: str, label: str = "\u2192", color: str = "#FF9800", subgraph_path: List[str] = None) -> str:
        subgraph_path = subgraph_path or []
        target_graph = self.get_subgraph_at_path(subgraph_path)
        edge_id = f"edge-{uuid.uuid4().hex[:8]}"
        edge = {
            "group": "edges",
            "data": {"id": edge_id, "source": source, "target": target, "label": label, "color": color}
        }
        target_graph["edges"].append(edge)
        self._save()
        return edge_id

    def update_edge(self, edge_id: str, label: str = None, color: str = None, subgraph_path: List[str] = None) -> bool:
        subgraph_path = subgraph_path or []
        target_graph = self.get_subgraph_at_path(subgraph_path)
        for edge in target_graph["edges"]:
            if edge["data"]["id"] == edge_id:
                if label is not None:
                    edge["data"]["label"] = label
                if color is not None:
                    edge["data"]["color"] = color
                self._save()
                return True
        return False

    def add_node(self, name: str, icon: str, notes: str = "", owned: bool = False, x: float = 0, y: float = 0, subgraph_path: List[str] = None) -> str:
        subgraph_path = subgraph_path or []
        target_graph = self.get_subgraph_at_path(subgraph_path)
        node_id = f"node-{uuid.uuid4().hex[:8]}"
        label = self._build_label({"icon": icon, "name": name, "owned": owned})
        if x == 0 and y == 0:
            x, y = 400, 300
        node = {
            "group": "nodes",
            "data": {
                "id": node_id,
                "name": name or "Unnamed Node",
                "icon": icon or "\ud83d\udda5\ufe0f",
                "iconColor": ICON_COLORS.get(icon, '#007ACC'),
                "notes": notes,
                "owned": owned,
                "commands": [],
                "subgraph": {"nodes": [], "edges": []},
                "label": label
            },
            "position": {"x": x, "y": y}
        }
        target_graph["nodes"].append(node)
        self._save()
        return node_id

    def update_node(self, node_id: str, name: str = None, icon: str = None, notes: str = None, owned: bool = None, x: float = None, y: float = None, subgraph_path: List[str] = None):
        subgraph_path = subgraph_path or []
        target_graph = self.get_subgraph_at_path(subgraph_path)
        for node in target_graph["nodes"]:
            if node["data"]["id"] == node_id:
                if name is not None:
                    node["data"]["name"] = name
                if icon is not None:
                    node["data"]["icon"] = icon
                    node["data"]["iconColor"] = ICON_COLORS.get(icon, '#4285F4')
                if notes is not None:
                    node["data"]["notes"] = notes
                if owned is not None:
                    node["data"]["owned"] = owned
                if x is not None and y is not None:
                    node["position"] = {"x": x, "y": y}
                node["data"]["label"] = self._build_label(node["data"])
                if "iconColor" not in node["data"]:
                    node["data"]["iconColor"] = ICON_COLORS.get(icon or node["data"].get("icon", "PC"), '#4285F4')
                self._save()
                return True
        return False

    def remove_edge(self, edge_id: str, subgraph_path: List[str] = None):
        subgraph_path = subgraph_path or []
        target_graph = self.get_subgraph_at_path(subgraph_path)
        target_graph["edges"] = [e for e in target_graph["edges"] if e["data"]["id"] != edge_id]
        self._save()

    def clear(self, subgraph_path: List[str] = None):
        subgraph_path = subgraph_path or []
        if not subgraph_path:
            self.data = {"nodes": [], "edges": []}
        else:
            target_graph = self.get_subgraph_at_path(subgraph_path[:-1])
            node = next((n for n in target_graph["nodes"] if n["data"]["id"] == subgraph_path[-1]), None)
            if node:
                node["data"]["subgraph"] = {"nodes": [], "edges": []}
        self._save()

    def persist_command(self, node_id: str, command: str, output: str, subgraph_path: List[str] = None) -> bool:
        subgraph_path = subgraph_path or []
        target_graph = self.get_subgraph_at_path(subgraph_path)
        for node in target_graph["nodes"]:
            if node["data"]["id"] == node_id:
                node["data"]["commands"].append({
                    "command": command,
                    "output": output,
                    "timestamp": datetime.utcnow().isoformat()
                })
                self._save()
                return True
        return False

    def get_node_commands(self, node_id: str, subgraph_path: List[str] = None) -> List[Dict[str, Any]]:
        subgraph_path = subgraph_path or []
        target_graph = self.get_subgraph_at_path(subgraph_path)
        for node in target_graph["nodes"]:
            if node["data"]["id"] == node_id:
                return node["data"]["commands"]
        return []

    def delete_command(self, node_id: str, index: int, subgraph_path: List[str] = None) -> bool:
        subgraph_path = subgraph_path or []
        target_graph = self.get_subgraph_at_path(subgraph_path)
        for node in target_graph["nodes"]:
            if node["data"]["id"] == node_id and 0 <= index < len(node["data"]["commands"]):
                node["data"]["commands"].pop(index)
                self._save()
                return True
        return False