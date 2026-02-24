import uuid
from flask import Blueprint, jsonify, request, session, send_from_directory, abort, current_app
from models.graph import GraphModel
from config import Config
from flask import stream_with_context, Response
import subprocess
import threading
import queue
import time
import os
import json
from werkzeug.utils import secure_filename

api_bp = Blueprint('api', __name__, url_prefix=f'/api/{Config.API_VERSION}')

running_processes = {}

def get_graph_model():
    current_file = session.get('current_file', 'default.json')
    db_path = os.path.join(current_app.config['GRAPH_DB_DIR'], current_file)
    return GraphModel(db_path)

@api_bp.route('/graph', methods=['GET'])
def get_graph():
    graph_model = get_graph_model()
    subgraph_path_str = request.args.get('subgraph_path', '')
    subgraph_path = subgraph_path_str.split(',') if subgraph_path_str else []
    session['subgraph_path'] = subgraph_path
    return jsonify(graph_model.get_graph(subgraph_path))

@api_bp.route('/graph/edges/<edge_id>', methods=['PUT'])
def update_edge(edge_id):
    graph_model = get_graph_model()
    data = request.json
    label = data.get('label')
    color = data.get('color')
    subgraph_path = session.get('subgraph_path', [])
    if graph_model.update_edge(edge_id, label, color, subgraph_path):
        return jsonify({'message': 'Edge updated'}), 200
    return jsonify({'error': 'Edge not found'}), 404

@api_bp.route('/graph/nodes', methods=['POST'])
def add_node():
    graph_model = get_graph_model()
    data = request.json
    subgraph_path = data.get('subgraph_path', [])
    name = data.get('name', '')
    icon = data.get('icon', '\ud83d\udda5\ufe0f')
    x = data.get('x', 0)
    y = data.get('y', 0)
    node_id = graph_model.add_node(name, icon, x=x, y=y, subgraph_path=subgraph_path)
    return jsonify({'id': node_id}), 201

@api_bp.route('/graph/nodes/<node_id>', methods=['DELETE'])
def delete_node(node_id):
    graph_model = get_graph_model()
    subgraph_path = session.get('subgraph_path', [])
    target_graph = graph_model.get_subgraph_at_path(subgraph_path)
    removed = False
    target_graph["nodes"] = [
        n for n in target_graph["nodes"]
        if n["data"]["id"] != node_id
    ]
    target_graph["edges"] = [
        e for e in target_graph["edges"]
        if e["data"]["source"] != node_id and e["data"]["target"] != node_id
    ]
    graph_model._save()
    return jsonify({'message': 'Node deleted'}), 200

@api_bp.route('/graph/nodes/<node_id>', methods=['PUT'])
def update_node(node_id):
    graph_model = get_graph_model()
    data = request.json
    subgraph_path = session.get('subgraph_path', [])
    name = data.get('name')
    icon = data.get('icon')
    notes = data.get('notes')
    owned = data.get('owned')
    x = data.get('x')
    y = data.get('y')
    if graph_model.update_node(node_id, name, icon, notes, owned, x, y, subgraph_path):
        return jsonify({'message': 'Updated'}), 200
    return jsonify({'error': 'Node not found'}), 404

@api_bp.route('/graph/edges', methods=['POST'])
def add_edge():
    graph_model = get_graph_model()
    data = request.json
    subgraph_path = session.get('subgraph_path', [])
    source = data.get('source')
    target = data.get('target')
    if not source or not target:
        return jsonify({'error': 'source/target required'}), 400
    
    edge_id = graph_model.add_edge(source, target, subgraph_path=subgraph_path)
    return jsonify({'id': edge_id}), 201

@api_bp.route('/graph/edges/<edge_id>', methods=['DELETE'])
def remove_edge(edge_id):
    graph_model = get_graph_model()
    subgraph_path = session.get('subgraph_path', [])
    graph_model.remove_edge(edge_id, subgraph_path)
    return jsonify({'message': 'Removed'}), 200

@api_bp.route('/graph', methods=['DELETE'])
def clear_graph():
    graph_model = get_graph_model()
    subgraph_path = session.get('subgraph_path', [])
    graph_model.clear(subgraph_path)
    return jsonify({'message': 'Graph cleared'}), 200

@api_bp.route('/graph/nodes/<node_id>/execute', methods=['POST'])
def execute_command(node_id):
    graph_model = get_graph_model()
    data = request.json
    subgraph_path = session.get('subgraph_path', [])
    command = data.get('command', '').strip()
    if not command:
        return jsonify({'error': 'Command required'}), 400
    if node_id in running_processes:
        proc, _ = running_processes[node_id]
        if proc.poll() is None:
            proc.terminate()
        del running_processes[node_id]
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
            for line in proc.stdout:
                if line is None:
                    break
                full_output.append(line)
                q.put(line)
                yield line
            proc.wait()
            returncode = proc.returncode
        except Exception as e:
            error_line = f"\n[ERROR] {str(e)}\n"
            full_output.append(error_line)
            yield error_line
            returncode = 1
        finally:
            final_output = ''.join(full_output)
            graph_model.persist_command(node_id, command, final_output, subgraph_path)
            if node_id in running_processes:
                del running_processes[node_id]
        yield f"\n=== Command finished with return code {returncode} ===\n"
    return Response(stream_with_context(generate()), mimetype='text/plain')

@api_bp.route('/graph/nodes/<node_id>/persist-command', methods=['POST'])
def persist_command(node_id):
    graph_model = get_graph_model()
    data = request.json
    subgraph_path = session.get('subgraph_path', [])
    command = data.get('command', '')
    output = data.get('output', '')
    if graph_model.persist_command(node_id, command, output, subgraph_path):
        return jsonify({'commands': graph_model.get_node_commands(node_id, subgraph_path)}), 200
    return jsonify({'error': 'Node not found'}), 404

@api_bp.route('/graph/nodes/<node_id>/delete-command', methods=['DELETE'])
def delete_command(node_id):
    graph_model = get_graph_model()
    data = request.json
    subgraph_path = session.get('subgraph_path', [])
    index = data.get('index')
    if index is None:
        return jsonify({'error': 'Index required'}), 400
    if graph_model.delete_command(node_id, index, subgraph_path):
        return jsonify({'commands': graph_model.get_node_commands(node_id, subgraph_path)}), 200
    return jsonify({'error': 'Node not found or invalid index'}), 404

@api_bp.route('/files', methods=['GET'])
def list_files():
    files = [f for f in os.listdir(current_app.config['GRAPH_DB_DIR']) if f.endswith('.json')]
    return jsonify(files)

@api_bp.route('/files/<name>', methods=['GET'])
def download_file(name):
    if name not in [f for f in os.listdir(current_app.config['GRAPH_DB_DIR']) if f.endswith('.json')]:
        abort(404)
    return send_from_directory(current_app.config['GRAPH_DB_DIR'], name, as_attachment=True)

@api_bp.route('/switch', methods=['POST'])
def switch_file():
    data = request.get_json()
    name = data.get('name')
    if not name or not name.endswith('.json'):
        return 'Invalid file', 400
    if name not in [f for f in os.listdir(current_app.config['GRAPH_DB_DIR']) if f.endswith('.json')]:
        abort(404)
    session['current_file'] = name
    session['subgraph_path'] = []
    graph_model = get_graph_model()
    return jsonify(graph_model.get_graph())

@api_bp.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return 'No file part', 400
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400
    if not file.filename.endswith('.json'):
        return 'Invalid file type', 400
    filename = secure_filename(file.filename)
    file_path = os.path.join(current_app.config['GRAPH_DB_DIR'], filename)
    file.save(file_path)
    session['current_file'] = filename
    session['subgraph_path'] = []
    graph_model = get_graph_model()
    return jsonify(graph_model.get_graph())

@api_bp.route('/create', methods=['POST'])
def create_workspace():
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return 'Name required', 400
    if not name.endswith('.json'):
        name += '.json'
    file_path = os.path.join(current_app.config['GRAPH_DB_DIR'], name)
    if os.path.exists(file_path):
        return 'File already exists', 400
    os.makedirs(current_app.config['GRAPH_DB_DIR'], exist_ok=True)
    with open(file_path, 'w') as f:
        json.dump({"nodes": [], "edges": []}, f)
    session['current_file'] = name
    session['subgraph_path'] = []
    return jsonify({"nodes": [], "edges": []})

@api_bp.route('/graph/nodes/<node_id>/subgraph', methods=['GET'])
def get_node_subgraph(node_id):
    graph_model = get_graph_model()
    current_path = session.get('subgraph_path', [])
    target_graph = graph_model.get_subgraph_at_path(current_path)
    node = next((n for n in target_graph["nodes"] if n["data"]["id"] == node_id), None)
    if not node or "subgraph" not in node["data"]:
        return jsonify({"error": "Node has no subgraph"}), 404
    session['subgraph_path'] = current_path + [node_id]
    return jsonify(graph_model.get_graph(session['subgraph_path']))

@api_bp.route('/graph/back', methods=['POST'])
def go_back():
    current_path = session.get('subgraph_path', [])
    if current_path:
        session['subgraph_path'] = current_path[:-1]
    graph_model = get_graph_model()
    return jsonify(graph_model.get_graph(session['subgraph_path']))