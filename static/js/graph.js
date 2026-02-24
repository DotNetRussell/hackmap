let cy, currentNodeId = null, selectedNodes = [];
let modalMaximized = false;  // Track modal size
let currentEdgeId = null;
let currentFile = 'default.json';  // Default
let selectedSubgraphNode = null;  // Track node selected for subgraph operations
let subgraphIndicators = {};  // Store indicators for cleanup
// Function to load files into dropdown
function loadFileList() {
  fetch('/api/v1/files')
    .then(response => response.json())
    .then(files => {
      const select = document.getElementById('file-select');
      select.innerHTML = '';
      files.forEach(file => {
        const option = document.createElement('option');
        option.value = file;
        option.textContent = file;
        if (file === currentFile) option.selected = true;
        select.appendChild(option);
      });
    })
    .catch(e => console.error('Error loading file list:', e));
}
// Switch file on dropdown change
document.getElementById('file-select').addEventListener('change', (e) => {
  const name = e.target.value;
  console.log('Switching to file:', name);
  fetch('/api/v1/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  .then(response => response.json())
  .then(data => {
    console.log('Switched file data:', data);
    // Reload the graph with new data (combine nodes and edges into array)
    cy.elements().remove();
    const elements = (data.nodes || []).concat(data.edges || []);
    cy.add(elements);
    // Apply subgraph class to nodes with subgraphs
    cy.nodes().forEach(node => {
      const nodeData = node.data();
      if (nodeData.subgraph && nodeData.subgraph.nodes && nodeData.subgraph.nodes.length > 0) {
        node.addClass('has-subgraph');
      }
    });
    currentFile = name;
    // Reset subgraph path on file switch
    sessionStorage.setItem('subgraph_path', JSON.stringify([]));
    updateBreadcrumb([]);
    selectedSubgraphNode = null;
    toggleButtons();
    updateSubgraphIndicators();
    setTimeout(() => {
      adjustZoomAndCenter();
    }, 10);
  })
  .catch(e => console.error('Error switching file:', e));
});
// Download button
document.getElementById('download-btn').addEventListener('click', () => {
  const selectedFile = document.getElementById('file-select').value || currentFile;
  console.log('Downloading file:', selectedFile);
  window.location.href = `/api/v1/files/${selectedFile}`;
});
// Upload button
document.getElementById('upload-btn').addEventListener('click', () => {
  document.getElementById('upload-input').click();
});
document.getElementById('upload-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    console.log('Uploading file:', file.name);
    const formData = new FormData();
    formData.append('file', file);
    fetch('/api/v1/upload', { method: 'POST', body: formData })
      .then(response => response.json())
      .then(data => {
        console.log('Uploaded file data:', data);
        // Reload graph and file list (combine nodes and edges into array)
        cy.elements().remove();
        const elements = (data.nodes || []).concat(data.edges || []);
        cy.add(elements);
        // Apply subgraph class to nodes with subgraphs
        cy.nodes().forEach(node => {
          const nodeData = node.data();
          if (nodeData.subgraph && nodeData.subgraph.nodes && nodeData.subgraph.nodes.length > 0) {
            node.addClass('has-subgraph');
          }
        });
        loadFileList();
        currentFile = file.name;
        // Reset subgraph path on upload
        sessionStorage.setItem('subgraph_path', JSON.stringify([]));
        updateBreadcrumb([]);
        selectedSubgraphNode = null;
        toggleButtons();
        updateSubgraphIndicators();
        setTimeout(() => {
          adjustZoomAndCenter();
        }, 10);
      })
      .catch(e => console.error('Error uploading file:', e));
  }
});
// NEW: New Workspace button
document.getElementById('new-workspace-btn').addEventListener('click', () => {
  document.getElementById('new-workspace-modal').style.display = 'block';
});
// NEW: Close new workspace modal
function closeNewWorkspaceModal() {
  document.getElementById('new-workspace-modal').style.display = 'none';
  document.getElementById('workspace-name').value = '';
}
// NEW: Create workspace
function createWorkspace() {
  const name = document.getElementById('workspace-name').value.trim();
  if (!name) {
    alert('Name required!');
    return;
  }
  if (!name.endsWith('.json')) {
    alert('Name must end with .json!');
    return;
  }
  fetch('/api/v1/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => { throw new Error(text); });
    }
    return response.json();
  })
  .then(data => {
    console.log('Created workspace:', name);
    // Reload graph and file list (combine nodes and edges into array)
    cy.elements().remove();
    const elements = (data.nodes || []).concat(data.edges || []);
    cy.add(elements);
    // Apply subgraph class to nodes with subgraphs
    cy.nodes().forEach(node => {
      const nodeData = node.data();
      if (nodeData.subgraph && nodeData.subgraph.nodes && nodeData.subgraph.nodes.length > 0) {
        node.addClass('has-subgraph');
      }
    });
    loadFileList();
    currentFile = name;
    // Reset subgraph path on new workspace
    sessionStorage.setItem('subgraph_path', JSON.stringify([]));
    updateBreadcrumb([]);
    selectedSubgraphNode = null;
    toggleButtons();
    updateSubgraphIndicators();
    setTimeout(() => {
      adjustZoomAndCenter();
    }, 10);
    closeNewWorkspaceModal();
  })
  .catch(e => {
    alert('Error creating workspace: ' + e.message);
    console.error('Error creating workspace:', e);
  });
}
function updateConnectButton() {
    const btn = document.getElementById('connect-btn');
    if (selectedNodes.length >= 2) {
        btn.disabled = false;
        btn.textContent = `🔗 Connect ${selectedNodes.length} Nodes`;
    } else {
        btn.disabled = true;
        btn.textContent = '🔗 Connect Selected';
    }
}
async function saveEdgeModal() {
    const label = document.getElementById('edge-label').value.trim();
    const color = document.getElementById('edge-color').value;
    if (!label) return alert('Label required!');
    try {
        await fetch(`/api/v1/graph/edges/${currentEdgeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label, color })
        });
        loadGraph();
        closeEdgeModal();
    } catch (e) {
        console.error(e);
    }
}
// Function to close edge modal
function closeEdgeModal() {
    document.getElementById('edge-modal').style.display = 'none';
    currentEdgeId = null;
}
async function connectSelected() {
    if (selectedNodes.length < 2) {
        alert('Select at least 2 nodes to connect!');
        return;
    }
    let success = true;
    for (let i = 0; i < selectedNodes.length - 1; i++) {
        const source = selectedNodes[i];
        const target = selectedNodes[i + 1];
        try {
            const res = await fetch('/api/v1/graph/edges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source, target })
            });
            if (!res.ok) success = false;
        } catch (e) {
            success = false;
        }
    }
    loadGraph();
    selectedNodes.forEach(id => cy.$('#' + id).removeClass('selected-multi'));
    selectedNodes = [];
    updateConnectButton();
    if (success) {
        showNotification('Nodes connected in sequence!', loadGraph);
    }
}
document.addEventListener('DOMContentLoaded', function() {
    cy = cytoscape({
        container: document.getElementById('cy'),
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': 'data(iconColor)',
                    'label': 'data(label)', 
                    'text-valign': 'center',
                    'color': 'white',
                    'font-size': 18,
                    'font-weight': 'bold',
                    'width': 160,
                    'height': 160,
                    'text-wrap': 'wrap',
                    'text-max-width': 140,
                    'border-width': 4,
                    'border-color': 'rgba(255,255,255,0.8)',
                    'border-opacity': 1
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 8,
                    'line-color': 'data(color)',  // Use dynamic color from data
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': 'data(color)',  // Match arrow to line
                    'target-arrow-fill': 'filled',
                    'curve-style': 'bezier',
                    'label': 'data(label)',  // Use dynamic label from data
                    'font-size': 16,
                    'color': 'white',
                    'text-background-color': 'rgba(0,0,0,0.7)',
                    'text-background-opacity': 0.8
                }
            },
            { selector: 'node:selected', style: { 'border-width': 8, 'border-color': '#FFD700' } },
            { selector: '.selected-multi', style: { 'border-color': 'orange', 'border-width': 6 } },
            { selector: '.selected-subgraph', style: { 'border-color': 'blue', 'border-width': 6 } },
            { selector: '.drag-target', style: { 'border-width': 6, 'border-color': '#00FF00' } }  // FIXED: Static drag-target style
        ],
        layout: { 
            name: 'cose',
            idealEdgeLength: 200,
            nodeDimensionsIncludeLabels: true
        },
        wheelSensitivity: 0.1,
        userZoomingEnabled: true,
        userPanningEnabled: true
    });
    loadGraph();
    setupEvents();
    requestNotificationPermission();  // Request notification permission
    loadFileList();  // Load file list on startup
});
function setupEvents() {
    let dragStartNode = null;
    
    // Shift-click = multi-select (orange), Ctrl-click = select for subgraph (blue), left-click = open modal
    cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        const shiftKey = evt.originalEvent.shiftKey;
        const ctrlKey = evt.originalEvent.ctrlKey;
        
        if (shiftKey) {
            // Multi-select for connect (orange)
            const idx = selectedNodes.indexOf(node.id());
            if (idx > -1) {
                selectedNodes.splice(idx, 1);
                node.removeClass('selected-multi');
            } else {
                selectedNodes.push(node.id());
                node.addClass('selected-multi');
            }
            updateConnectButton();
            toggleButtons();
        } else if (ctrlKey) {
            // Select for subgraph (blue)
            if (selectedSubgraphNode === node.id()) {
                selectedSubgraphNode = null;
                node.removeClass('selected-subgraph');
            } else {
                selectedSubgraphNode = node.id();
                node.addClass('selected-subgraph');
            }
            toggleButtons();
            console.log('Selected for subgraph:', selectedSubgraphNode);
        } else {
            // Always open modal on left-click
            currentNodeId = node.id();
            const data = node.data();
            document.getElementById('modal-name').value = data.name;
            document.getElementById('modal-icon').value = data.icon;
            document.getElementById('modal-notes').value = data.notes || '';
            document.getElementById('modal-owned').checked = data.owned || false;
            document.getElementById('node-modal').style.display = 'block';
            // Make modal fullscreen by default
            toggleModalSize();
            console.log('✅ Modal opened:', data.name);
            
            selectedNodes.forEach(id => cy.$('#' + id).removeClass('selected-multi'));
            selectedNodes = [];
            updateConnectButton();
            selectedSubgraphNode = null;
            cy.$('#' + selectedSubgraphNode).removeClass('selected-subgraph');
            toggleButtons();
            
            // Load persisted commands but do not show flyout automatically
            loadPersistedCommands(data.commands || []);
        }
    });
    // FIXED: Position saving on drag end
    cy.on('dragfreeon', 'node', function(evt) {
        const node = evt.target;
        const pos = node.position();
        console.log('💾 Saving position:', node.id(), pos.x.toFixed(0), pos.y.toFixed(0));
        fetch(`/api/v1/graph/nodes/${node.id()}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: pos.x, y: pos.y })
        }).then(res => {
            if (res.ok) console.log('✅ Position saved');
        }).catch(e => console.error('❌ Position save failed:', e));
    });
    // UPDATED: Drag-to-connect only if the dragged node is selected
    cy.on('dragstart', 'node', function(evt) {
        const node = evt.target;
        if (!selectedNodes.includes(node.id())) {
            dragStartNode = null;
            return;
        }
        dragStartNode = node;
        console.log('🏋️‍♂️ Drag started from selected node:', dragStartNode.id());
    });
    cy.on('drag', 'node', function(evt) {
        if (!dragStartNode) return;
        // Check if dragging over another node
        const draggedNode = evt.target;
        const nearbyNodes = cy.nodes().filter(function(n) {
            return n.id() !== draggedNode.id() && 
                   draggedNode.position().distanceTo(n.position()) < 120;  // FIXED: Increased threshold
        });
        
        if (nearbyNodes.length > 0) {
            nearbyNodes.forEach(targetNode => {
                console.log('🎯 Drag over:', targetNode.id());
                // Visual feedback - highlight target
                targetNode.addClass('drag-target');
            });
        }
    });
    cy.on('dragfree', 'node', function(evt) {
        if (!dragStartNode) return;
        const draggedNode = evt.target;
        
        // Check for connection on drop
        if (dragStartNode.id() !== draggedNode.id()) {
            const nearbyNodes = cy.nodes().filter(function(n) {
                return n.id() !== draggedNode.id() && 
                       draggedNode.position().distanceTo(n.position()) < 120;
            });
            
            if (nearbyNodes.length > 0) {
                const targetNode = nearbyNodes[0]; // Closest
                connectNodes(dragStartNode.id(), targetNode.id());
                console.log('✅ CONNECTED:', dragStartNode.id(), '→', targetNode.id());
                // Clear selection after connect
                selectedNodes = selectedNodes.filter(id => id !== dragStartNode.id());
                cy.$('#' + dragStartNode.id()).removeClass('selected-multi');
                updateConnectButton();
            }
        }
        
        // Clear highlights
        cy.nodes('.drag-target').removeClass('drag-target');
        dragStartNode = null;
    });
    // Right-click edge to remove
    cy.on('cxttap', 'edge', function(evt) {
        evt.preventDefault();
        const edge = evt.target;
        if (confirm('Remove connection?')) {
            removeEdge(edge.id());
        }
    });
    // Click background to deselect
    cy.on('tap', function(evt) {
        if (evt.target === cy) {
            selectedNodes.forEach(id => cy.$('#' + id).removeClass('selected-multi'));
            selectedNodes = [];
            updateConnectButton();
            if (selectedSubgraphNode) {
                cy.$('#' + selectedSubgraphNode).removeClass('selected-subgraph');
                selectedSubgraphNode = null;
            }
            toggleButtons();
        }
    });
    cy.on('dbltap', 'edge', function(evt) {
        const edge = evt.target;
        currentEdgeId = edge.id();
        const data = edge.data();
        document.getElementById('edge-label').value = data.label || '→';
        document.getElementById('edge-color').value = data.color || '#FF9800';
        document.getElementById('edge-modal').style.display = 'block';
    });
    // NEW: Update indicators on pan, zoom, or drag
    cy.on('pan zoom dragfreeon', updateSubgraphIndicators);
}
function updateConnectButton() {
    const btn = document.getElementById('connect-btn');
    if (selectedNodes.length >= 2) {
        btn.disabled = false;
        btn.textContent = `🔗 Connect ${selectedNodes.length} Nodes`;
    } else {
        btn.disabled = true;
        btn.textContent = '🔗 Connect Selected';
    }
}
async function executeCommand() {
    const input = document.getElementById('command-input');
    const command = input.value.trim();
    if (!command || !currentNodeId) return;
    // Create live output box
    const outputBox = document.createElement('div');
    outputBox.className = 'persisted-command';
    outputBox.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
            <strong>${escapeHtml(command)}</strong>
            <small style="color:#888;">Running...</small>
        </div>
        <pre style="background:#222; padding:8px; margin:5px 0; font-size:12px; max-height:300px; overflow:auto;" 
             id="live-output-${currentNodeId}"></pre>
    `;
    document.getElementById('persisted-commands').prepend(outputBox);
    const livePre = outputBox.querySelector('pre');
    // Always clear input immediately
    input.value = '';
    try {
        const response = await fetch(`/api/v1/graph/nodes/${currentNodeId}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        });
        if (!response.ok) throw new Error('Failed to start');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            livePre.textContent += chunk;
            livePre.scrollTop = livePre.scrollHeight;
        }
        // Final refresh
        loadGraph();
    } catch (e) {
        livePre.textContent += `\n[ERROR] ${e.message}\n`;
    }
}
async function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    let y = 20;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 15;
    const maxWidth = 180; // 210mm - 30mm margins
    const wrapText = (text, fontSize = 10, isBold = false) => {
        pdf.setFontSize(fontSize);
        pdf.setFont(undefined, isBold ? 'bold' : 'normal');
        const lines = pdf.splitTextToSize(text, maxWidth);
        lines.forEach(line => {
            if (y > pageHeight - 20) {
                pdf.addPage();
                y = 20;
            }
            pdf.text(line, margin, y);
            y += fontSize <= 9 ? 5 : 6;
        });
    };

    // Function to recursively collect hierarchical data
    async function collectHierarchicalData(path = []) {
        const url = path.length > 0 ? `/api/v1/graph?subgraph_path=${path.join(',')}` : '/api/v1/graph';
        const res = await fetch(url);
        const data = await res.json();
        const graph = { nodes: data.nodes, edges: data.edges, subgraphs: {} };
        for (const node of data.nodes) {
            if (node.data.subgraph && node.data.subgraph.nodes && node.data.subgraph.nodes.length > 0) {
                graph.subgraphs[node.data.id] = await collectHierarchicalData(path.concat(node.data.id));
            }
        }
        return graph;
    }

    // Function to collect all Person nodes
    async function collectAllPersons(graph, persons = []) {
        persons.push(...graph.nodes.filter(n => n.data.icon === 'Person'));
        for (const sub of Object.values(graph.subgraphs)) {
            collectAllPersons(sub, persons);
        }
        return persons;
    }

    // Function to add graph section recursively
    function addGraphSection(graph, indent = 0, parentName = null) {
        const indentStr = '  '.repeat(indent);
        if (indent > 0) {
            wrapText(`${indentStr}--- Subgraph of ${parentName} ---`, 12, true);
            y += 5;
        }
        // Connections in this graph
        if (graph.edges.length > 0) {
            wrapText(`${indentStr}Connections:`, 11, true);
            graph.edges.forEach(edge => {
                const source = graph.nodes.find(n => n.data.id === edge.data.source)?.data?.name || edge.data.source;
                const target = graph.nodes.find(n => n.data.id === edge.data.target)?.data?.name || edge.data.target;
                const label = edge.data.label || '→';
                wrapText(`${indentStr}${source} ${label} ${target}`, 10);
            });
            y += 5;
        }
        // Node details
        wrapText(`${indentStr}Nodes:`, 11, true);
        graph.nodes.forEach(node => {
            const d = node.data;
            const status = d.owned ? " [Owned]" : "";
            wrapText(`${indentStr}${d.icon} ${d.name}${status}`, 10, true);
            if (d.notes?.trim()) {
                wrapText(`${indentStr}  Notes: ${d.notes.trim()}`, 9);
            }
            if (d.commands?.length > 0) {
                wrapText(`${indentStr}  Commands Executed (${d.commands.length}):`, 9, true);
                d.commands.slice().reverse().forEach(cmd => {
                    wrapText(`${indentStr}    $ ${cmd.command}`, 9, true);
                    const output = cmd.output.trim();
                    if (output) {
                        const lines = output.split('\n').slice(0, 50); // limit per command
                        lines.forEach(line => wrapText(`${indentStr}      ${line}`, 8));
                        if (output.split('\n').length > 50) wrapText(`${indentStr}      (... output truncated)`, 8);
                    } else {
                        wrapText(`${indentStr}      (no output)`, 8);
                    }
                    wrapText(`${indentStr}    — ${new Date(cmd.timestamp).toLocaleString()}`, 7);
                    y += 2;
                });
            }
            // Recursively add subgraph
            if (graph.subgraphs[d.id]) {
                y += 5;
                addGraphSection(graph.subgraphs[d.id], indent + 1, d.name);
            }
            y += 5;
        });
    }

    try {
        const fullGraph = await collectHierarchicalData();
        const allPersons = await collectAllPersons(fullGraph);
        pdf.setFontSize(20);
        pdf.setFont(undefined, 'bold');
        pdf.text("HackMap - Engagement Report", margin, y);
        y += 15;
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'normal');
        wrapText(`Generated: ${new Date().toLocaleString()}`);
        // Count total nodes and edges recursively
        function countTotals(graph) {
            let totalNodes = graph.nodes.length;
            let totalEdges = graph.edges.length;
            let owned = graph.nodes.filter(n => n.data.owned).length;
            for (const sub of Object.values(graph.subgraphs)) {
                const subCounts = countTotals(sub);
                totalNodes += subCounts.totalNodes;
                totalEdges += subCounts.totalEdges;
                owned += subCounts.owned;
            }
            return { totalNodes, totalEdges, owned };
        }
        const totals = countTotals(fullGraph);
        wrapText(`Total Nodes: ${totals.totalNodes} | Owned: ${totals.owned} | Total Edges: ${totals.totalEdges}`);
        y += 10;

        // Users section
        if (allPersons.length > 0) {
            wrapText("=== Users ===", 14, true);
            y += 5;
            allPersons.forEach(person => {
                const d = person.data;
                const status = d.owned ? " [Owned]" : "";
                wrapText(`${d.icon} ${d.name}${status}`, 12, true);
                if (d.notes?.trim()) {
                    wrapText(`Notes: ${d.notes.trim()}`, 10);
                }
                if (d.commands?.length > 0) {
                    wrapText(`Commands Executed (${d.commands.length}):`, 10, true);
                    d.commands.slice().reverse().forEach(cmd => {
                        wrapText(`$ ${cmd.command}`, 10, true);
                        const output = cmd.output.trim();
                        if (output) {
                            const lines = output.split('\n').slice(0, 50);
                            lines.forEach(line => wrapText(line, 9));
                            if (output.split('\n').length > 50) wrapText("(... output truncated)", 9);
                        } else {
                            wrapText("(no output)", 9);
                        }
                        wrapText(`— ${new Date(cmd.timestamp).toLocaleString()}`, 8);
                        y += 2;
                    });
                }
                y += 5;
            });
            y += 10;
        }

        addGraphSection(fullGraph);
        pdf.save(`hackmap-report-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
        alert("PDF generation failed: " + e.message);
    }
}
async function persistCommandOutput(command, output) {
    try {
        const res = await fetch(`/api/v1/graph/nodes/${currentNodeId}/persist-command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, output })
        });
        if (res.ok) {
            const data = await res.json();
            loadPersistedCommands(data.commands);
        }
    } catch (e) {
        console.error('Persist failed:', e);
    }
}
// GLOBAL: Track current node for flyout
let currentNodeForFlyout = null;
// UPDATED: Load persisted commands + show flyout
function loadPersistedCommands(commands = []) {
    const container = document.getElementById('persisted-commands');
    const flyoutContainer = document.getElementById('flyout-commands');
    const flyout = document.getElementById('node-command-flyout');
    const title = document.getElementById('flyout-title');
    // Update modal list
    container.innerHTML = '';
    if (commands.length === 0) {
        container.innerHTML = '<p style="color:#888; font-style:italic;">No commands executed yet</p>';
    } else {
        // Newest first
        [...commands].reverse().forEach((cmd, idx) => {
            const revIdx = commands.length - 1 - idx;
            const div = document.createElement('div');
            div.className = 'persisted-command';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:12px;">${escapeHtml(cmd.command)}</strong>
                    <button onclick="deletePersistedCommand(${revIdx})" style="font-size:10px; padding:2px 6px;">Delete</button>
                </div>
                <pre style="margin:4px 0; font-size:11px; max-height:100px; overflow:auto;">${escapeHtml(cmd.output)}</pre>
                <small style="color:#888;">${new Date(cmd.timestamp).toLocaleString()}</small>
            `;
            container.appendChild(div);
        });
    }
    // Do not automatically show flyout; wait for button click
}
function showCommandHistory() {
    if (!currentNodeId) return;
    const flyoutContainer = document.getElementById('flyout-commands');
    const flyout = document.getElementById('node-command-flyout');
    const title = document.getElementById('flyout-title');
    const node = cy.$('#' + currentNodeId);
    const commands = node.data('commands') || [];
    title.textContent = `Commands: ${node.data('name') || 'Node'}`;
    flyoutContainer.innerHTML = document.getElementById('persisted-commands').innerHTML;  // Mirror content
    flyout.style.display = 'block';
}
// Auto-hide flyout when modal closes
function closeModal() {
    document.getElementById('node-modal').style.display = 'none';
    document.getElementById('node-command-flyout').style.display = 'none';
    currentNodeId = null;
    currentNodeForFlyout = null;
    modalMaximized = false;
}
// Safety: escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
async function deletePersistedCommand(index) {
    if (!currentNodeId) return;
    try {
        await fetch(`/api/v1/graph/nodes/${currentNodeId}/delete-command`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index })
        });
        // Reload node data
        const node = cy.$('#' + currentNodeId);
        const commands = node.data('commands') || [];
        commands.splice(index, 1);
        node.data('commands', commands);
        loadPersistedCommands(commands);
    } catch (e) {
        console.error('Delete failed:', e);
    }
}
function closeSidePanel() {
    document.getElementById('side-panel').style.display = 'none';
    document.getElementById('command-output').textContent = '';
}
// UPDATED: Toggle modal size to full expand
function toggleModalSize() {
    const modal = document.getElementById('node-modal');
    const content = document.querySelector('#node-modal .modal-content');  // FIXED: Target the node modal specifically
    modalMaximized = !modalMaximized;
    if (modalMaximized) {
        content.style.width = '95vw';
        content.style.height = '95vh';
        content.style.margin = '2.5vh auto';
        content.style.maxWidth = 'none';  // Allow full width
    } else {
        content.style.width = '80%';
        content.style.maxWidth = '500px';
        content.style.height = 'auto';
        content.style.margin = '15% auto';
    }
}
// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}
// Show notification or toast
function showNotification(message, onConfirm) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Command Output', { body: message });
        notification.onclick = onConfirm;
    } else {
        // Fallback toast
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.display = 'block';
        toast.onclick = onConfirm;
        setTimeout(() => toast.style.display = 'none', 5000);
    }
}
// View all commands flyout with reverse order
function viewCommands() {
    const flyout = document.getElementById('commands-flyout');
    const container = document.getElementById('all-commands');
    container.innerHTML = '';
    
    // Fetch all nodes and their commands
    fetch('/api/v1/graph')
        .then(res => res.json())
        .then(data => {
            data.nodes.forEach(node => {
                const nodeDiv = document.createElement('div');
                nodeDiv.className = 'node-commands';
                nodeDiv.innerHTML = `<h4>${node.data.name}</h4>`;
                const commands = node.data.commands || [];
                // UPDATED: Reverse order (newest first)
                commands.slice().reverse().forEach(cmd => {
                    const cmdDiv = document.createElement('div');
                    cmdDiv.className = 'command-item';
                    cmdDiv.innerHTML = `<strong>${cmd.command}</strong><pre>${cmd.output}</pre>`;
                    nodeDiv.appendChild(cmdDiv);
                });
                container.appendChild(nodeDiv);
            });
            flyout.style.display = 'block';
        })
        .catch(e => console.error('Failed to load commands:', e));
}
function closeCommandsFlyout() {
    document.getElementById('commands-flyout').style.display = 'none';
}
async function loadGraph() {
    const subgraphPath = JSON.parse(sessionStorage.getItem('subgraph_path') || '[]');
    const url = subgraphPath.length > 0 ? `/api/v1/graph?subgraph_path=${subgraphPath.join(',')}` : '/api/v1/graph';
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log('📊 Loaded:', data.nodes?.length || 0, 'nodes');
        cy.elements().remove();
        // Combine nodes and edges into a single array for Cytoscape
        const elements = (data.nodes || []).concat(data.edges || []);
        cy.add(elements);
        // Apply subgraph class to nodes with subgraphs
        cy.nodes().forEach(node => {
            const nodeData = node.data();
            if (nodeData.subgraph && nodeData.subgraph.nodes && nodeData.subgraph.nodes.length > 0) {
                node.addClass('has-subgraph');
            }
        });
        updateSubgraphIndicators();
        // FIXED: Adjust zoom and center
        setTimeout(() => {
            adjustZoomAndCenter();
        }, 10);
        console.log('🔍 View adjusted. Elements:', cy.elements().size());
    } catch (e) {
        console.error('❌ Load failed:', e);
    }
}
function resetView() {
    cy.fit(cy.elements(), 60);
    cy.center();
}
// NEW: Adjust zoom and center function
function adjustZoomAndCenter() {
    const nodeCount = cy.elements().nodes().length;
    if (nodeCount <= 3) {
        // For small graphs, set zoom so each node is ~10% of viewport height
        const desiredNodeHeightPercent = 0.1; // 10%
        const nodeHeight = 160; // Node height in graph units
        const zoomLevel = (window.innerHeight * desiredNodeHeightPercent) / nodeHeight;
        cy.zoom(zoomLevel);
        cy.center();
    } else {
        // For larger graphs, fit with padding
        cy.fit(cy.elements(), 60);
        cy.center();
    }
}
async function addNode() {
    const subgraphPath = JSON.parse(sessionStorage.getItem('subgraph_path') || '[]');
    const name = document.getElementById('node-name').value.trim();
    const icon = document.getElementById('node-icon').value;
    if (!name) return alert('Name required!');
    
    let x = 400, y = 300;
    if (cy.elements().nodes().length > 0) {
        const bb = cy.extent();
        if (!isNaN(bb.x1)) {
            x = bb.x1 + Math.random() * Math.max(100, bb.w2 - bb.x1);
            y = bb.y1 + Math.random() * Math.max(100, bb.h2 - bb.y1);
        }
    }
    
    try {
        const res = await fetch('/api/v1/graph/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon, x, y, subgraph_path: subgraphPath })
        });
        if (res.ok) {
            console.log('✅ Added:', name, 'at', x.toFixed(0), y.toFixed(0));
            loadGraph();
            document.getElementById('node-name').value = '';
        }
    } catch (e) {
        console.error('❌ Add error:', e);
    }
}
async function addSubNode() {
    if (selectedNodes.length !== 1) return alert('Select exactly one node for sub-node!');
    const subgraphNode = selectedNodes[0];
    const name = document.getElementById('node-name').value.trim();
    const icon = document.getElementById('node-icon').value;
    if (!name) return alert('Name required!');
    
    let x = 400, y = 300;
    if (cy.elements().nodes().length > 0) {
        const bb = cy.extent();
        if (!isNaN(bb.x1)) {
            x = bb.x1 + Math.random() * Math.max(100, bb.w2 - bb.x1);
            y = bb.y1 + Math.random() * Math.max(100, bb.h2 - bb.y1);
        }
    }
    
    try {
        const res = await fetch('/api/v1/graph/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon, x, y, subgraph_path: [subgraphNode] })
        });
        if (res.ok) {
            console.log('✅ Added subnode:', name, 'to', subgraphNode);
            loadGraph();
            document.getElementById('node-name').value = '';
            // Deselect after adding
            cy.$('#' + subgraphNode).removeClass('selected-multi');
            selectedNodes = [];
            updateConnectButton();
            toggleButtons();
        } else {
            alert('Failed to add subnode.');
        }
    } catch (e) {
        console.error('❌ Add subnode error:', e);
    }
}
function toggleButtons() {
    const addNodeBtn = document.getElementById('add-node-btn');
    const addSubNodeBtn = document.getElementById('add-sub-node-btn');
    if (selectedNodes.length === 1) {
        addNodeBtn.style.display = 'none';
        addSubNodeBtn.style.display = 'inline-block';
    } else {
        addNodeBtn.style.display = 'inline-block';
        addSubNodeBtn.style.display = 'none';
    }
}
function updateSubgraphIndicators() {
    // Clear existing indicators
    Object.values(subgraphIndicators).forEach(ind => ind.remove());
    subgraphIndicators = {};
    
    // Add indicators for nodes with subgraphs in the current view
    cy.nodes().forEach(node => {
        const nodeData = node.data();
        if (nodeData.subgraph && nodeData.subgraph.nodes && nodeData.subgraph.nodes.length > 0) {
            const bb = node.renderedBoundingBox();
            const cyContainer = document.getElementById('cy');
            const indicator = document.createElement('div');
            indicator.className = 'subgraph-indicator';
            indicator.textContent = '📁';
            // Position closer to edge for overlap (Venn diagram style)
            indicator.style.left = `${bb.x2 - 20}px`;
            indicator.style.top = `${bb.y1 - 5}px`;
            indicator.addEventListener('click', (e) => {
                e.stopPropagation();
                // Drill down into subgraph
                fetch(`/api/v1/graph/nodes/${node.id()}/subgraph`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            alert('No subgraph available');
                        } else {
                            cy.elements().remove();
                            const elements = (data.nodes || []).concat(data.edges || []);
                            cy.add(elements);
                            // Apply subgraph class to nodes with subgraphs
                            cy.nodes().forEach(node => {
                              const nodeData = node.data();
                              if (nodeData.subgraph && nodeData.subgraph.nodes && nodeData.subgraph.nodes.length > 0) {
                                node.addClass('has-subgraph');
                              }
                            });
                            const currentPath = JSON.parse(sessionStorage.getItem('subgraph_path') || '[]');
                            const newPath = currentPath.concat(node.id());
                            sessionStorage.setItem('subgraph_path', JSON.stringify(newPath));
                            updateBreadcrumb(newPath);
                            document.getElementById('back-btn').style.display = 'block';
                            updateSubgraphIndicators();  // Clear old indicators immediately
                            setTimeout(() => {
                                adjustZoomAndCenter();
                            }, 10);
                        }
                    })
                    .catch(e => console.error('Error drilling into subgraph:', e));
            });
            cyContainer.appendChild(indicator);
            subgraphIndicators[node.id()] = indicator;
        }
    });
}
async function connectNodes(source, target) {
    try {
        const res = await fetch('/api/v1/graph/edges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, target })
        });
        if (res.ok) {
            console.log('✅ Edge created via API');
            loadGraph();
        } else {
            console.error('❌ Edge API failed:', res.status);
        }
    } catch (e) {
        console.error('Connect failed:', e);
    }
}
async function deleteCurrentNode() {
    if (!currentNodeId) return;
    if (!confirm(`Permanently delete node "${cy.$('#' + currentNodeId).data('name') || 'this node'}"?`)) return;
    try {
        // Remove node from Cytoscape
        cy.$('#' + currentNodeId).remove();
        // Remove from backend (optional but recommended for persistence)
        await fetch(`/api/v1/graph/nodes/${currentNodeId}`, {
            method: 'DELETE'
        });
        closeModal();
        console.log('Node deleted:', currentNodeId);
    } catch (e) {
        alert('Failed to delete node');
        console.error(e);
    }
}
async function removeEdge(edgeId) {
    try {
        await fetch(`/api/v1/graph/edges/${edgeId}`, { method: 'DELETE' });
        loadGraph();
    } catch (e) {
        console.error(e);
    }
}
async function saveModal() {
    const name = document.getElementById('modal-name').value.trim();
    const icon = document.getElementById('modal-icon').value;
    const notes = document.getElementById('modal-notes').value;
    const owned = document.getElementById('modal-owned').checked;
    if (!name) return alert('Name required!');
    try {
        await fetch(`/api/v1/graph/nodes/${currentNodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon, notes, owned })
        });
        loadGraph();  // Forces full refresh with correct icon/color
        closeModal();
    } catch (e) {
        console.error(e);
    }
}
async function clearGraph() {
    if (confirm('Clear all?')) {
        try {
            await fetch('/api/v1/graph', { method: 'DELETE' });
            cy.elements().remove();
        } catch (e) {
            console.error(e);
        }
    }
}
// NEW: Back button handler
document.getElementById('back-btn').addEventListener('click', () => {
    fetch('/api/v1/graph/back', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            cy.elements().remove();
            const elements = (data.nodes || []).concat(data.edges || []);
            cy.add(elements);
            // Apply subgraph class to nodes with subgraphs
            cy.nodes().forEach(node => {
              const nodeData = node.data();
              if (nodeData.subgraph && nodeData.subgraph.nodes && nodeData.subgraph.nodes.length > 0) {
                node.addClass('has-subgraph');
              }
            });
            const currentPath = JSON.parse(sessionStorage.getItem('subgraph_path') || '[]');
            if (currentPath.length > 0) {
                const newPath = currentPath.slice(0, -1);
                sessionStorage.setItem('subgraph_path', JSON.stringify(newPath));
                updateBreadcrumb(newPath);
                if (newPath.length === 0) {
                    document.getElementById('back-btn').style.display = 'none';
                }
            }
            updateSubgraphIndicators();  // Refresh indicators immediately after back
            setTimeout(() => {
                adjustZoomAndCenter();
            }, 10);
        })
        .catch(e => console.error('Error going back:', e));
});
// NEW: Update breadcrumb display
function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (path.length === 0) {
        breadcrumb.textContent = 'Root Graph';
    } else {
        breadcrumb.textContent = 'Subgraph: ' + path.join(' > ');
    }
}