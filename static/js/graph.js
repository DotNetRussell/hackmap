let cy, currentNodeId = null, selectedNodes = [];
let modalMaximized = false;  // Track modal size
let currentEdgeId = null;
let currentFile = 'default.json';  // Default

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
    currentFile = name;
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
        loadFileList();
        currentFile = file.name;
      })
      .catch(e => console.error('Error uploading file:', e));
  }
});

// Connect all selected nodes in sequence 
function updateConnectButton() {
    const btn = document.getElementById('connect-btn');
    if (selectedNodes.length >= 2) {
        btn.disabled = false;
        btn.textContent = `Connect ${selectedNodes.length} Nodes`;
    } else {
        btn.disabled = true;
        btn.textContent = 'Connect Selected';
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
    
    // Left-click = modal, SHIFT/CTRL+click = multi-select
    cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        const shiftKey = evt.originalEvent.shiftKey || evt.originalEvent.ctrlKey;
        
        if (shiftKey) {
            if (selectedNodes.includes(node.id())) {
                selectedNodes = selectedNodes.filter(id => id !== node.id());
                node.removeClass('selected-multi');
            } else {
                selectedNodes.push(node.id());
                node.addClass('selected-multi');
            }
            updateConnectButton();
            console.log('Multi-selected:', selectedNodes);
        } else {
            currentNodeId = node.id();
            const data = node.data();
            document.getElementById('modal-name').value = data.name;
            document.getElementById('modal-icon').value = data.icon;
            document.getElementById('modal-notes').value = data.notes || '';
            document.getElementById('modal-owned').checked = data.owned || false;
            document.getElementById('node-modal').style.display = 'block';
            console.log('✅ Modal opened:', data.name);
            
            selectedNodes.forEach(id => cy.$('#' + id).removeClass('selected-multi'));
            selectedNodes = [];
            updateConnectButton();
            
            // Load persisted commands
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
}

function updateConnectButton() {
    const btn = document.getElementById('connect-btn');
    btn.disabled = selectedNodes.length !== 2;
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

    try {
        const res = await fetch('/api/v1/graph');
        const data = await res.json();

        pdf.setFontSize(20);
        pdf.setFont(undefined, 'bold');
        pdf.text("HackMap - Engagement Report", margin, y);
        y += 12;

        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        wrapText(`Generated: ${new Date().toLocaleString()}`);
        wrapText(`Total Nodes: ${data.nodes.length} | Owned: ${data.nodes.filter(n => n.data.owned).length}`);
        y += 8;

        data.nodes.forEach(node => {
            const d = node.data;
            const status = d.owned ? "Owned" : "";
            wrapText(`${d.icon} ${d.name} ${status}`, 13, true);

            if (d.notes?.trim()) {
                wrapText(`Notes: ${d.notes.trim()}`, 10);
            }

            if (d.commands?.length > 0) {
                wrapText(`Commands Executed (${d.commands.length}):`, 11, true);
                d.commands.slice().reverse().forEach(cmd => {
                    wrapText(`$ ${cmd.command}`, 10, true);

                    const output = cmd.output.trim();
                    if (output) {
                        const lines = output.split('\n').slice(0, 50); // limit per command
                        lines.forEach(line => wrapText(line, 9));
                        if (output.split('\n').length > 50) wrapText("(... output truncated)", 9);
                    } else {
                        wrapText("(no output)", 9);
                    }
                    wrapText(`— ${new Date(cmd.timestamp).toLocaleString()}`, 8);
                    y += 3;
                });
            }
            y += 8; // spacing between nodes
        });

        pdf.save(`hackmap-report-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
        alert("PDF generation failed: " + e.message);
    }
}

// Persist command output
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

    // Update and show flyout
    if (currentNodeId) {
        title.textContent = `Commands: ${cy.$('#' + currentNodeId).data('name') || 'Node'}`;
        flyoutContainer.innerHTML = container.innerHTML;  // Mirror content
        flyout.style.display = 'block';
        currentNodeForFlyout = currentNodeId;
    }
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
    try {
        const res = await fetch('/api/v1/graph');
        const data = await res.json();
        console.log('📊 Loaded:', data.nodes?.length || 0, 'nodes');
        cy.elements().remove();
        // Combine nodes and edges into a single array for Cytoscape
        const elements = (data.nodes || []).concat(data.edges || []);
        cy.add(elements);
        // FIXED: Remove layout to preserve positions; just fit and center
        cy.fit(cy.elements(), 60);
        cy.center();
        console.log('🔍 View adjusted. Elements:', cy.elements().size());
    } catch (e) {
        console.error('❌ Load failed:', e);
    }
}

function resetView() {
    cy.fit(cy.elements(), 60);
    cy.center();
}

async function addNode() {
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
            body: JSON.stringify({ name, icon, x, y })
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
