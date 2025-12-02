import uuid
from flask import Blueprint, jsonify, request
from models.graph import GraphModel
from config import Config
from flask import stream_with_context, Response
import subprocess
import threading
import queue
import time

api_bp = Blueprint('api', __name__, url_prefix=f'/api/{Config.API_VERSION}')

graph_model = GraphModel(Config.GRAPH_DB_PATH)

@api_bp.route('/graph', methods=['GET'])
def get_graph():
    return jsonify(graph_model.get_graph())

@api_bp.route('/graph/nodes', methods=['POST'])
def add_node():
    data = request.json
    name = data.get('name', '')
    icon = data.get('icon', '🖥️')
    x = data.get('x', 0)
    y = data.get('y', 0)
    node_id = graph_model.add_node(name, icon, x=x, y=y)
    return jsonify({'id': node_id}), 201

@api_bp.route('/graph/nodes/<node_id>', methods=['DELETE'])
def delete_node(node_id):
    removed = False
    # Remove node
    graph_model.data["nodes"] = [
        n for n in graph_model.data["nodes"]
        if n["data"]["id"] != node_id
    ]
    # Remove any edges connected to it
    graph_model.data["edges"] = [
        e for e in graph_model.data["edges"]
        if e["data"]["source"] != node_id and e["data"]["target"] != node_id
    ]
    graph_model._save()
    return jsonify({'message': 'Node deleted'}), 200


@api_bp.route('/graph/nodes/<node_id>', methods=['PUT'])
def update_node(node_id):
    data = request.json
    name = data.get('name')
    icon = data.get('icon')
    notes = data.get('notes')
    owned = data.get('owned')
    x = data.get('x')
    y = data.get('y')
    if graph_model.update_node(node_id, name, icon, notes, owned, x, y):
        return jsonify({'message': 'Updated'}), 200
    return jsonify({'error': 'Node not found'}), 404

@api_bp.route('/graph/edges', methods=['POST'])
def add_edge():
    data = request.json
    source = data.get('source')
    target = data.get('target')
    if not source or not target:
        return jsonify({'error': 'source/target required'}), 400
    
    edge_id = f"edge-{uuid.uuid4().hex[:8]}"
    edge = {
        "group": "edges",
        "data": {"id": edge_id, "source": source, "target": target, "label": "→"}
    }
    graph_model.data["edges"].append(edge)
    graph_model._save()
    return jsonify({'id': edge_id}), 201

@api_bp.route('/graph/edges/<edge_id>', methods=['DELETE'])
def remove_edge(edge_id):
    graph_model.remove_edge(edge_id)
    return jsonify({'message': 'Removed'}), 200

@api_bp.route('/graph', methods=['DELETE'])
def clear_graph():
    graph_model.clear()
    return jsonify({'message': 'Graph cleared'}), 200

# Global dict to store running processes (node_id → process + queue)
running_processes = {}

@api_bp.route('/graph/nodes/<node_id>/execute', methods=['POST'])
def execute_command(node_id):
    data = request.json
    command = data.get('command', '').strip()
    if not command:
        return jsonify({'error': 'Command required'}), 400

    # Kill any previous running command on this node (optional safety)
    if node_id in running_processes:
        proc, _ = running_processes[node_id]
        if proc.poll() is None:
            proc.terminate()
        del running_processes[node_id]

    # Start new process
    proc = subprocess.Popen(
        command,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True
    )

    q = queue.Queue()
    running_processes[node_id] = (proc, q)

    def generate():
        full_output = []
        try:
            # Read line by line as it comes
            for line in proc.stdout:
                if line is None:
                    break
                full_output.append(line)
                q.put(line)  # for polling later if needed
                yield line

            proc.wait()
            returncode = proc.returncode

        except Exception as e:
            error_line = f"\n[ERROR] {str(e)}\n"
            full_output.append(error_line)
            yield error_line
            returncode = 1
        finally:
            # Always persist final result
            final_output = ''.join(full_output)
            graph_model.persist_command(node_id, command, final_output)
            if node_id in running_processes:
                del running_processes[node_id]

        # Send final status
        yield f"\n=== Command finished with return code {returncode} ===\n"

    return Response(stream_with_context(generate()), mimetype='text/plain')

# NEW: Persist command output
@api_bp.route('/graph/nodes/<node_id>/persist-command', methods=['POST'])
def persist_command(node_id):
    data = request.json
    command = data.get('command', '')
    output = data.get('output', '')
    if graph_model.persist_command(node_id, command, output):
        return jsonify({'commands': graph_model.get_node_commands(node_id)}), 200
    return jsonify({'error': 'Node not found'}), 404

# NEW: Delete persisted command
@api_bp.route('/graph/nodes/<node_id>/delete-command', methods=['DELETE'])
def delete_command(node_id):
    data = request.json
    index = data.get('index')
    if index is None:
        return jsonify({'error': 'Index required'}), 400
    if graph_model.delete_command(node_id, index):
        return jsonify({'commands': graph_model.get_node_commands(node_id)}), 200
    return jsonify({'error': 'Node not found or invalid index'}), 404