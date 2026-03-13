"use strict";

(() => {
  const TAU = Math.PI * 2;
  const VALID_MODES = ["centralized", "decentralized", "distributed"];
  const CAMERA_STATE_LABELS = {
    idle: "Camera Idle",
    starting: "Camera Starting",
    active: "Hand Tracking Live",
    unavailable: "Hand Tracking Unavailable",
    denied: "Camera Denied",
  };

  const refs = {
    appShell: document.getElementById("appShell"),
    stageShell: document.getElementById("stageShell"),
    canvas: document.getElementById("topologyCanvas"),
    video: document.getElementById("webcam"),
    jsonInput: document.getElementById("jsonInput"),
    topologyModeSelect: document.getElementById("topologyModeSelect"),
    textInput: document.getElementById("textInput"),
    generateButton: document.getElementById("generateButton"),
    startCameraButton: document.getElementById("startCameraButton"),
    loadSampleButton: document.getElementById("loadSampleButton"),
    importButton: document.getElementById("importButton"),
    exportButton: document.getElementById("exportButton"),
    pngButton: document.getElementById("pngButton"),
    fullscreenButton: document.getElementById("fullscreenButton"),
    clearButton: document.getElementById("clearButton"),
    nodeTitleInput: document.getElementById("nodeTitleInput"),
    nodeNotesInput: document.getElementById("nodeNotesInput"),
    inspectorStatus: document.getElementById("inspectorStatus"),
    nodeCount: document.getElementById("nodeCount"),
    edgeCount: document.getElementById("edgeCount"),
    modeBadge: document.getElementById("modeBadge"),
    inputBadge: document.getElementById("inputBadge"),
    trackingBadge: document.getElementById("trackingBadge"),
    gestureReadout: document.getElementById("gestureReadout"),
    hudMode: document.getElementById("hudMode"),
    hudInput: document.getElementById("hudInput"),
    hudTracking: document.getElementById("hudTracking"),
    statusBanner: document.getElementById("statusBanner"),
  };

  const ctx = refs.canvas.getContext("2d");
  const stopwords = new Set([
    "a",
    "about",
    "after",
    "again",
    "against",
    "all",
    "also",
    "am",
    "an",
    "and",
    "any",
    "are",
    "around",
    "as",
    "at",
    "be",
    "because",
    "been",
    "before",
    "being",
    "between",
    "both",
    "but",
    "by",
    "can",
    "could",
    "did",
    "do",
    "does",
    "doing",
    "done",
    "down",
    "during",
    "each",
    "even",
    "few",
    "for",
    "from",
    "further",
    "get",
    "got",
    "had",
    "has",
    "have",
    "having",
    "he",
    "her",
    "here",
    "hers",
    "him",
    "his",
    "how",
    "however",
    "i",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "itself",
    "just",
    "like",
    "made",
    "make",
    "many",
    "may",
    "me",
    "might",
    "more",
    "most",
    "much",
    "must",
    "my",
    "near",
    "need",
    "no",
    "not",
    "now",
    "of",
    "off",
    "on",
    "once",
    "one",
    "only",
    "or",
    "other",
    "our",
    "out",
    "over",
    "own",
    "per",
    "perhaps",
    "rather",
    "really",
    "same",
    "should",
    "since",
    "small",
    "so",
    "some",
    "still",
    "such",
    "than",
    "that",
    "the",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "to",
    "too",
    "under",
    "until",
    "up",
    "use",
    "using",
    "used",
    "very",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "while",
    "who",
    "why",
    "will",
    "with",
    "within",
    "without",
    "would",
    "you",
    "your",
    "yours",
    "study",
    "notes",
    "idea",
    "ideas",
    "research",
    "project",
    "system",
    "systems",
  ]);

  const state = {
    nodes: [],
    edges: [],
    selectedNodeId: null,
    hoveredNodeId: null,
    topologyMode: "centralized",
    dragState: null,
    connectState: null,
    mouse: {
      x: 0,
      y: 0,
      inside: false,
      pressed: false,
    },
    hand: {
      enabled: false,
      status: "idle",
      camera: null,
      hands: null,
      lastSeenAt: 0,
      pointerX: 0,
      pointerY: 0,
      rawX: 0,
      rawY: 0,
      visible: false,
      activeGesture: "idle",
      deleteDwellStart: 0,
      deleteTargetId: null,
      deleteFired: false,
    },
    pointerPulse: 0,
    lastFrameTime: performance.now(),
    viewport: {
      width: 0,
      height: 0,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    },
    statusMessage: "Mouse fallback is active. Start the camera to enable hand tracking.",
  };

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-5)}`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function formatModeLabel(mode) {
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  }

  function measureRadius(title, score = 1) {
    return clamp(26 + title.length * 0.24 + score * 2.2, 26, 44);
  }

  function getNode(nodeId) {
    return state.nodes.find((node) => node.id === nodeId) || null;
  }

  function computeDegrees() {
    const degrees = new Map();
    for (const node of state.nodes) {
      degrees.set(node.id, 0);
    }

    for (const edge of state.edges) {
      degrees.set(edge.source, (degrees.get(edge.source) || 0) + edge.weight);
      degrees.set(edge.target, (degrees.get(edge.target) || 0) + edge.weight);
    }

    return degrees;
  }

  function buildAdjacency() {
    const adjacency = new Map();
    for (const node of state.nodes) {
      adjacency.set(node.id, new Map());
    }

    for (const edge of state.edges) {
      if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) {
        continue;
      }

      adjacency.get(edge.source).set(edge.target, edge.weight);
      adjacency.get(edge.target).set(edge.source, edge.weight);
    }

    return adjacency;
  }

  function stageBounds() {
    return {
      width: state.viewport.width,
      height: state.viewport.height,
      centerX: state.viewport.width * 0.5,
      centerY: state.viewport.height * 0.5,
    };
  }

  function randomPoint(padding = 120) {
    const { width, height } = stageBounds();
    return {
      x: clamp(padding + Math.random() * Math.max(width - padding * 2, 1), padding, width - padding),
      y: clamp(padding + Math.random() * Math.max(height - padding * 2, 1), padding, height - padding),
    };
  }

  function setStatus(message) {
    state.statusMessage = message;
    refs.statusBanner.textContent = message;
  }

  function updateHud() {
    const nodeCount = state.nodes.length;
    const edgeCount = state.edges.length;
    const modeLabel = formatModeLabel(state.topologyMode);
    const inputLabel =
      state.hand.status === "active" && state.hand.visible
        ? `Hand Cursor ${state.hand.activeGesture === "idle" ? "Ready" : state.hand.activeGesture}`
        : "Mouse fallback active";
    const trackingLabel = CAMERA_STATE_LABELS[state.hand.status] || "Camera Idle";
    const gestureLabel = state.hand.status === "active" ? formatModeLabel(state.hand.activeGesture) : "Idle";

    refs.nodeCount.textContent = String(nodeCount);
    refs.edgeCount.textContent = String(edgeCount);
    refs.modeBadge.textContent = modeLabel;
    refs.inputBadge.textContent = inputLabel;
    refs.trackingBadge.textContent = trackingLabel;
    refs.gestureReadout.textContent = gestureLabel;
    refs.hudMode.textContent = modeLabel;
    refs.hudInput.textContent = inputLabel;
    refs.hudTracking.textContent = trackingLabel;
    refs.topologyModeSelect.value = state.topologyMode;
    refs.fullscreenButton.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
  }

  function updateInspector() {
    const node = getNode(state.selectedNodeId);

    if (!node) {
      refs.nodeTitleInput.value = "";
      refs.nodeNotesInput.value = "";
      refs.nodeTitleInput.disabled = true;
      refs.nodeNotesInput.disabled = true;
      refs.inspectorStatus.textContent = "No node selected";
      return;
    }

    refs.nodeTitleInput.disabled = false;
    refs.nodeNotesInput.disabled = false;
    refs.nodeTitleInput.value = node.title;
    refs.nodeNotesInput.value = node.notes;
    refs.inspectorStatus.textContent = node.id;
  }

  function syncUi() {
    updateHud();
    updateInspector();
  }

  function bringNodeToFront(nodeId) {
    const index = state.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0 || index === state.nodes.length - 1) {
      return;
    }

    const [node] = state.nodes.splice(index, 1);
    state.nodes.push(node);
  }

  function setSelectedNode(nodeId) {
    state.selectedNodeId = nodeId;
    if (nodeId) {
      bringNodeToFront(nodeId);
    }
    updateInspector();
    updateHud();
  }

  function findNodeAt(x, y, excludeId = null) {
    for (let index = state.nodes.length - 1; index >= 0; index -= 1) {
      const node = state.nodes[index];
      if (node.id === excludeId) {
        continue;
      }

      if (Math.hypot(x - node.x, y - node.y) <= node.radius + 14) {
        return node;
      }
    }

    return null;
  }

  function createNode(x, y, overrides = {}) {
    const node = {
      id: overrides.id || uid("node"),
      title: overrides.title || `Node ${state.nodes.length + 1}`,
      notes: overrides.notes || "",
      x: Number.isFinite(x) ? x : randomPoint().x,
      y: Number.isFinite(y) ? y : randomPoint().y,
      vx: 0,
      vy: 0,
      radius: overrides.radius || measureRadius(overrides.title || `Node ${state.nodes.length + 1}`, overrides.score || 1),
      score: overrides.score || 1,
    };

    state.nodes.push(node);
    setSelectedNode(node.id);
    updateHud();
    return node;
  }

  function edgeKey(source, target) {
    return [source, target].sort().join("::");
  }

  function findEdge(source, target) {
    const key = edgeKey(source, target);
    return state.edges.find((edge) => edgeKey(edge.source, edge.target) === key) || null;
  }

  function addEdge(source, target, weight = 1) {
    if (!source || !target || source === target || !getNode(source) || !getNode(target)) {
      return false;
    }

    const existingEdge = findEdge(source, target);
    if (existingEdge) {
      existingEdge.weight = clamp(existingEdge.weight + weight, 1, 9);
      updateHud();
      return true;
    }

    state.edges.push({
      id: uid("edge"),
      source,
      target,
      weight: clamp(weight, 1, 9),
    });
    updateHud();
    return true;
  }

  function deleteNode(nodeId) {
    const node = getNode(nodeId);
    if (!node) {
      return;
    }

    state.nodes = state.nodes.filter((item) => item.id !== nodeId);
    state.edges = state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);

    if (state.selectedNodeId === nodeId) {
      state.selectedNodeId = null;
    }

    if (state.dragState && state.dragState.nodeId === nodeId) {
      state.dragState = null;
    }

    if (state.connectState && state.connectState.sourceId === nodeId) {
      state.connectState = null;
    }

    if (state.hand.deleteTargetId === nodeId) {
      state.hand.deleteTargetId = null;
      state.hand.deleteFired = false;
    }

    setStatus(`Deleted node "${node.title}".`);
    syncUi();
  }

  function clearTopology() {
    state.nodes = [];
    state.edges = [];
    state.selectedNodeId = null;
    state.hoveredNodeId = null;
    state.dragState = null;
    state.connectState = null;
    state.hand.deleteTargetId = null;
    state.hand.deleteFired = false;
    setStatus("Canvas cleared. Mouse fallback remains available.");
    syncUi();
  }

  function modeTargets() {
    const targets = new Map();
    const { width, height, centerX, centerY } = stageBounds();
    const nodes = [...state.nodes];
    const degrees = computeDegrees();
    const adjacency = buildAdjacency();

    if (!nodes.length) {
      return targets;
    }

    const ordered = [...nodes].sort((left, right) => {
      const delta = (degrees.get(right.id) || 0) - (degrees.get(left.id) || 0);
      if (delta !== 0) {
        return delta;
      }
      return left.title.localeCompare(right.title);
    });

    if (state.topologyMode === "centralized") {
      const hub = ordered[0];
      const ringNodes = ordered.slice(1);
      targets.set(hub.id, { x: centerX, y: centerY, strength: 0.085 });
      const radius = Math.min(width, height) * 0.28;

      ringNodes.forEach((node, index) => {
        const angle = (index / Math.max(ringNodes.length, 1)) * TAU - Math.PI / 2;
        const orbit = radius + ((degrees.get(node.id) || 0) % 3) * 26;
        targets.set(node.id, {
          x: centerX + Math.cos(angle) * orbit,
          y: centerY + Math.sin(angle) * orbit,
          strength: 0.05,
        });
      });

      return targets;
    }

    if (state.topologyMode === "decentralized") {
      const hubCount = clamp(Math.min(3, ordered.length), 1, 3);
      const hubs = ordered.slice(0, hubCount);
      const centerOffsets = [
        { x: centerX, y: centerY - Math.min(height, width) * 0.16 },
        { x: centerX - width * 0.19, y: centerY + height * 0.12 },
        { x: centerX + width * 0.19, y: centerY + height * 0.12 },
      ].slice(0, hubCount);
      const clusters = hubs.map(() => []);

      hubs.forEach((hub, index) => {
        clusters[index].push(hub);
      });

      for (const node of ordered.slice(hubCount)) {
        let clusterIndex = ordered.indexOf(node) % hubCount;
        let strongestWeight = -1;

        hubs.forEach((hub, index) => {
          const weight = adjacency.get(node.id)?.get(hub.id) || 0;
          if (weight > strongestWeight) {
            strongestWeight = weight;
            clusterIndex = index;
          }
        });

        clusters[clusterIndex].push(node);
      }

      clusters.forEach((cluster, clusterIndex) => {
        const clusterCenter = centerOffsets[clusterIndex];
        const [hub, ...members] = cluster;
        if (hub) {
          targets.set(hub.id, { x: clusterCenter.x, y: clusterCenter.y, strength: 0.075 });
        }

        members.forEach((node, memberIndex) => {
          const angle = (memberIndex / Math.max(members.length, 1)) * TAU - Math.PI / 2;
          const radius = 98 + Math.floor(memberIndex / 4) * 34;
          targets.set(node.id, {
            x: clusterCenter.x + Math.cos(angle) * radius,
            y: clusterCenter.y + Math.sin(angle) * radius,
            strength: 0.05,
          });
        });
      });

      return targets;
    }

    ordered.forEach((node, index) => {
      const angle = index * 2.399963229728653;
      const radius = Math.sqrt((index + 0.5) / Math.max(ordered.length, 1)) * Math.min(width, height) * 0.38;
      targets.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        strength: 0.03,
      });
    });
    return targets;
  }

  function applyLayoutPreset(intensity = 1) {
    const targets = modeTargets();
    for (const node of state.nodes) {
      const target = targets.get(node.id);
      if (!target) {
        continue;
      }

      node.x = lerp(node.x, target.x, clamp(intensity, 0, 1));
      node.y = lerp(node.y, target.y, clamp(intensity, 0, 1));
      node.vx *= 0.2;
      node.vy *= 0.2;
    }
  }

  function currentPointer(source = null) {
    if (source === "mouse") {
      return state.mouse.inside ? { x: state.mouse.x, y: state.mouse.y } : null;
    }

    if (source === "hand") {
      return state.hand.visible ? { x: state.hand.pointerX, y: state.hand.pointerY } : null;
    }

    if (state.dragState) {
      return currentPointer(state.dragState.source);
    }

    if (state.connectState) {
      return currentPointer(state.connectState.source);
    }

    if (state.hand.status === "active" && state.hand.visible) {
      return currentPointer("hand");
    }

    return currentPointer("mouse");
  }

  function updateHoverState() {
    const pointer = currentPointer();
    const excludeId = state.dragState ? state.dragState.nodeId : null;
    state.hoveredNodeId = pointer ? findNodeAt(pointer.x, pointer.y, excludeId)?.id || null : null;
  }

  function startDrag(nodeId, source, offsetX = 0, offsetY = 0) {
    state.dragState = {
      nodeId,
      source,
      offsetX,
      offsetY,
    };
    setSelectedNode(nodeId);
  }

  function endDrag() {
    state.dragState = null;
  }

  function startConnect(sourceId, source) {
    if (!sourceId) {
      return;
    }
    state.connectState = { sourceId, source };
    setSelectedNode(sourceId);
  }

  function finishConnect(pointerNodeId) {
    if (!state.connectState) {
      return;
    }

    const sourceId = state.connectState.sourceId;
    if (pointerNodeId && sourceId !== pointerNodeId && addEdge(sourceId, pointerNodeId, 1)) {
      const sourceNode = getNode(sourceId);
      const targetNode = getNode(pointerNodeId);
      setStatus(`Connected "${sourceNode.title}" to "${targetNode.title}".`);
    }

    state.connectState = null;
  }

  function clientToCanvas(clientX, clientY) {
    const rect = refs.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function resizeCanvas() {
    const rect = refs.stageShell.getBoundingClientRect();
    state.viewport.width = rect.width;
    state.viewport.height = rect.height;
    state.viewport.dpr = Math.min(window.devicePixelRatio || 1, 2);

    refs.canvas.width = Math.round(rect.width * state.viewport.dpr);
    refs.canvas.height = Math.round(rect.height * state.viewport.dpr);
    ctx.setTransform(state.viewport.dpr, 0, 0, state.viewport.dpr, 0, 0);
  }

  function serializeGraph(source = "manual export") {
    return {
      version: 1,
      mode: state.topologyMode,
      nodes: state.nodes.map((node) => ({
        id: node.id,
        title: node.title,
        notes: node.notes,
        x: Number(node.x.toFixed(2)),
        y: Number(node.y.toFixed(2)),
      })),
      edges: state.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
      })),
      meta: {
        createdAt: new Date().toISOString(),
        source,
      },
    };
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const content = JSON.stringify(serializeGraph("Thought Topology export"), null, 2);
    downloadBlob("thought-topology-export.json", new Blob([content], { type: "application/json" }));
    setStatus("Exported topology JSON.");
  }

  function renderGraph(targetCtx, options = {}) {
    const {
      width = state.viewport.width,
      height = state.viewport.height,
      includeTransient = true,
    } = options;

    targetCtx.clearRect(0, 0, width, height);

    const gradient = targetCtx.createRadialGradient(width * 0.5, height * 0.42, 40, width * 0.5, height * 0.5, width * 0.65);
    gradient.addColorStop(0, "rgba(12, 23, 25, 0.9)");
    gradient.addColorStop(0.6, "rgba(5, 10, 12, 0.96)");
    gradient.addColorStop(1, "rgba(1, 2, 3, 1)");
    targetCtx.fillStyle = gradient;
    targetCtx.fillRect(0, 0, width, height);

    targetCtx.save();
    targetCtx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    targetCtx.lineWidth = 1;
    for (let x = 0; x < width; x += 64) {
      targetCtx.beginPath();
      targetCtx.moveTo(x + 0.5, 0);
      targetCtx.lineTo(x + 0.5, height);
      targetCtx.stroke();
    }
    for (let y = 0; y < height; y += 64) {
      targetCtx.beginPath();
      targetCtx.moveTo(0, y + 0.5);
      targetCtx.lineTo(width, y + 0.5);
      targetCtx.stroke();
    }
    targetCtx.restore();

    for (const edge of state.edges) {
      const source = getNode(edge.source);
      const target = getNode(edge.target);
      if (!source || !target) {
        continue;
      }

      const selectedRelated = source.id === state.selectedNodeId || target.id === state.selectedNodeId;
      const hoveredRelated = source.id === state.hoveredNodeId || target.id === state.hoveredNodeId;
      const alpha = selectedRelated ? 0.65 : hoveredRelated ? 0.42 : 0.22;
      const stroke = selectedRelated ? "rgba(142, 233, 221, 0.8)" : "rgba(242, 250, 248, 0.34)";
      targetCtx.save();
      targetCtx.strokeStyle = stroke;
      targetCtx.lineWidth = 1 + edge.weight * 0.18;
      targetCtx.globalAlpha = alpha;
      targetCtx.shadowBlur = selectedRelated ? 18 : 0;
      targetCtx.shadowColor = "rgba(142, 233, 221, 0.3)";
      targetCtx.beginPath();
      targetCtx.moveTo(source.x, source.y);
      targetCtx.lineTo(target.x, target.y);
      targetCtx.stroke();
      targetCtx.restore();
    }

    if (includeTransient && state.connectState) {
      const sourceNode = getNode(state.connectState.sourceId);
      const pointer = currentPointer(state.connectState.source);
      if (sourceNode && pointer) {
        targetCtx.save();
        targetCtx.strokeStyle = "rgba(184, 240, 199, 0.95)";
        targetCtx.lineWidth = 1.4;
        targetCtx.setLineDash([8, 7]);
        targetCtx.beginPath();
        targetCtx.moveTo(sourceNode.x, sourceNode.y);
        targetCtx.lineTo(pointer.x, pointer.y);
        targetCtx.stroke();
        targetCtx.restore();
      }
    }

    for (const node of state.nodes) {
      const hovered = node.id === state.hoveredNodeId;
      const selected = node.id === state.selectedNodeId;
      const beingDragged = state.dragState && state.dragState.nodeId === node.id;
      const fill = selected
        ? "rgba(142, 233, 221, 0.18)"
        : hovered
          ? "rgba(184, 240, 199, 0.12)"
          : "rgba(11, 18, 22, 0.94)";
      const stroke = selected
        ? "rgba(142, 233, 221, 0.92)"
        : hovered
          ? "rgba(184, 240, 199, 0.72)"
          : "rgba(242, 250, 248, 0.46)";

      targetCtx.save();
      targetCtx.fillStyle = fill;
      targetCtx.strokeStyle = stroke;
      targetCtx.lineWidth = selected ? 1.9 : hovered ? 1.6 : 1.1;
      targetCtx.shadowBlur = selected || beingDragged ? 24 : hovered ? 16 : 0;
      targetCtx.shadowColor = selected ? "rgba(142, 233, 221, 0.34)" : "rgba(184, 240, 199, 0.26)";
      targetCtx.beginPath();
      targetCtx.arc(node.x, node.y, node.radius, 0, TAU);
      targetCtx.fill();
      targetCtx.stroke();

      if (hovered || selected || beingDragged) {
        targetCtx.strokeStyle = selected ? "rgba(184, 240, 199, 0.38)" : "rgba(255, 255, 255, 0.18)";
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        targetCtx.arc(node.x, node.y, node.radius + 9 + Math.sin(state.pointerPulse + node.radius) * 1.4, 0, TAU);
        targetCtx.stroke();
      }

      targetCtx.fillStyle = "rgba(234, 246, 243, 0.95)";
      targetCtx.font = selected ? '600 15px "Space Grotesk", sans-serif' : '500 13px "Space Grotesk", sans-serif';
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "middle";
      targetCtx.fillText(node.title, node.x, node.y - node.radius - 18);

      if (node.notes) {
        targetCtx.fillStyle = "rgba(201, 224, 219, 0.52)";
        targetCtx.font = '400 11px "Space Grotesk", sans-serif';
        const excerpt = node.notes.length > 40 ? `${node.notes.slice(0, 39)}…` : node.notes;
        targetCtx.fillText(excerpt, node.x, node.y + node.radius + 17);
      }

      targetCtx.restore();
    }

    if (includeTransient && state.hand.visible && state.hand.status === "active") {
      drawHandCursor(targetCtx);
    }

    if (includeTransient && state.hand.activeGesture === "delete" && state.hand.deleteTargetId) {
      const node = getNode(state.hand.deleteTargetId);
      if (node) {
        const elapsed = performance.now() - state.hand.deleteDwellStart;
        const ratio = clamp(elapsed / 700, 0, 1);
        targetCtx.save();
        targetCtx.strokeStyle = `rgba(245, 141, 149, ${0.35 + ratio * 0.55})`;
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.arc(node.x, node.y, node.radius + 14, -Math.PI / 2, -Math.PI / 2 + TAU * ratio);
        targetCtx.stroke();
        targetCtx.restore();
      }
    }
  }

  function exportPng() {
    const width = state.viewport.width || 1280;
    const height = state.viewport.height || 720;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.round(width * 2);
    exportCanvas.height = Math.round(height * 2);
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.setTransform(2, 0, 0, 2, 0, 0);
    renderGraph(exportCtx, { width, height, includeTransient: false });

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        setStatus("PNG export failed.");
        return;
      }
      downloadBlob("thought-topology.png", blob);
      setStatus("Saved PNG snapshot of the topology canvas.");
    }, "image/png");
  }

  function titleCase(term) {
    return term.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  function normalizeToken(rawToken) {
    let token = rawToken.toLowerCase().replace(/[^a-z0-9'-]/g, "");
    token = token.replace(/^'+|'+$/g, "");

    if (token.length > 6 && token.endsWith("ing")) {
      token = token.slice(0, -3);
    } else if (token.length > 5 && token.endsWith("ied")) {
      token = `${token.slice(0, -3)}y`;
    } else if (token.length > 5 && token.endsWith("ies")) {
      token = `${token.slice(0, -3)}y`;
    } else if (token.length > 5 && token.endsWith("ed")) {
      token = token.slice(0, -2);
    } else if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
      token = token.slice(0, -1);
    }

    return token;
  }

  function generateFromText() {
    const raw = refs.textInput.value.trim();
    if (!raw) {
      setStatus("Paste notes before generating a topology.");
      return;
    }

    const sentenceChunks = raw
      .split(/[\n\r]+|(?<=[.!?;:])\s+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .slice(0, 120);

    const termStats = new Map();
    const sentenceTerms = [];

    sentenceChunks.forEach((sentence) => {
      const matches = sentence.match(/[A-Za-z][A-Za-z'-]{2,}/g) || [];
      const normalizedTerms = matches
        .map((token) => normalizeToken(token))
        .filter((token) => token.length >= 3 && !stopwords.has(token));
      const uniqueTerms = [...new Set(normalizedTerms)];

      sentenceTerms.push({ sentence, terms: uniqueTerms });

      uniqueTerms.forEach((term) => {
        const stats = termStats.get(term) || {
          freq: 0,
          spread: 0,
          notes: [],
        };
        stats.freq += normalizedTerms.filter((token) => token === term).length;
        stats.spread += 1;
        if (stats.notes.length < 2) {
          stats.notes.push(sentence);
        }
        termStats.set(term, stats);
      });
    });

    const rankedTerms = [...termStats.entries()]
      .map(([term, stats]) => ({
        term,
        stats,
        score: stats.freq * 1.6 + stats.spread * 2.1,
      }))
      .sort((left, right) => right.score - left.score);

    if (!rankedTerms.length) {
      setStatus("No meaningful terms were extracted from the pasted notes.");
      return;
    }

    const nodeLimit = clamp(Math.round(Math.sqrt(rankedTerms.length) * 4), 6, 18);
    const selectedTerms = rankedTerms.slice(0, nodeLimit);
    const selectedTermSet = new Set(selectedTerms.map((entry) => entry.term));

    clearTopology();
    selectedTerms.forEach((entry, index) => {
      const point = randomPoint(160);
      createNode(point.x, point.y, {
        title: titleCase(entry.term),
        notes: entry.stats.notes.join(" "),
        score: entry.score,
      });
      const node = state.nodes[index];
      node.score = entry.score;
      node.radius = measureRadius(node.title, entry.score * 0.18);
    });

    const nodeByTerm = new Map();
    state.nodes.forEach((node, index) => {
      nodeByTerm.set(selectedTerms[index].term, node);
    });

    const pairWeights = new Map();
    sentenceTerms.forEach(({ terms }) => {
      const present = terms.filter((term) => selectedTermSet.has(term));
      for (let left = 0; left < present.length; left += 1) {
        for (let right = left + 1; right < present.length; right += 1) {
          const key = edgeKey(present[left], present[right]);
          pairWeights.set(key, (pairWeights.get(key) || 0) + 1);
        }
      }
    });

    const rankedPairs = [...pairWeights.entries()]
      .map(([key, weight]) => ({ key, weight }))
      .sort((left, right) => right.weight - left.weight)
      .slice(0, Math.max(selectedTerms.length * 2, 12));

    rankedPairs.forEach(({ key, weight }) => {
      const [leftTerm, rightTerm] = key.split("::");
      const sourceNode = nodeByTerm.get(leftTerm);
      const targetNode = nodeByTerm.get(rightTerm);
      if (sourceNode && targetNode) {
        addEdge(sourceNode.id, targetNode.id, clamp(weight, 1, 4));
      }
    });

    if (!state.edges.length && state.nodes.length > 1) {
      for (let index = 0; index < state.nodes.length - 1; index += 1) {
        addEdge(state.nodes[index].id, state.nodes[index + 1].id, 1);
      }
    }

    applyLayoutPreset(1);
    setSelectedNode(state.nodes[0]?.id || null);
    setStatus(`Generated ${state.nodes.length} nodes and ${state.edges.length} links from pasted notes.`);
    syncUi();
  }

  function validateGraphPayload(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Imported JSON must be an object.");
    }

    if (payload.version !== 1) {
      throw new Error("Imported JSON must include version 1.");
    }

    if (!VALID_MODES.includes(payload.mode)) {
      throw new Error("Imported JSON must use a valid topology mode.");
    }

    if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
      throw new Error("Imported JSON must contain nodes and edges arrays.");
    }

    const nodeIds = new Set();
    const hydratedNodes = payload.nodes.map((rawNode) => {
      if (!rawNode || typeof rawNode !== "object") {
        throw new Error("Every node must be an object.");
      }

      const id = typeof rawNode.id === "string" && rawNode.id ? rawNode.id : uid("node");
      if (nodeIds.has(id)) {
        throw new Error(`Duplicate node id "${id}" found in import.`);
      }
      nodeIds.add(id);

      const point = randomPoint(120);
      const title = typeof rawNode.title === "string" && rawNode.title.trim() ? rawNode.title.trim() : "Untitled Node";
      const notes = typeof rawNode.notes === "string" ? rawNode.notes : "";
      const x = Number.isFinite(rawNode.x) ? rawNode.x : point.x;
      const y = Number.isFinite(rawNode.y) ? rawNode.y : point.y;

      return {
        id,
        title,
        notes,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: measureRadius(title, 1),
        score: 1,
      };
    });

    const hydratedEdges = payload.edges.reduce((result, rawEdge) => {
      if (!rawEdge || typeof rawEdge !== "object") {
        return result;
      }

      if (!nodeIds.has(rawEdge.source) || !nodeIds.has(rawEdge.target) || rawEdge.source === rawEdge.target) {
        return result;
      }

      const existing = result.find((edge) => edgeKey(edge.source, edge.target) === edgeKey(rawEdge.source, rawEdge.target));
      if (existing) {
        existing.weight = clamp(existing.weight + (Number(rawEdge.weight) || 1), 1, 9);
        return result;
      }

      result.push({
        id: typeof rawEdge.id === "string" && rawEdge.id ? rawEdge.id : uid("edge"),
        source: rawEdge.source,
        target: rawEdge.target,
        weight: clamp(Number(rawEdge.weight) || 1, 1, 9),
      });
      return result;
    }, []);

    return {
      mode: payload.mode,
      nodes: hydratedNodes,
      edges: hydratedEdges,
    };
  }

  function loadGraph(graph, sourceLabel = "Imported topology") {
    state.topologyMode = graph.mode;
    state.nodes = graph.nodes;
    state.edges = graph.edges;
    state.selectedNodeId = graph.nodes[0]?.id || null;
    state.hoveredNodeId = null;
    state.dragState = null;
    state.connectState = null;
    setStatus(`${sourceLabel} with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);
    syncUi();
  }

  async function importJsonFile(file) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const graph = validateGraphPayload(payload);
      loadGraph(graph, "Imported JSON topology");
    } catch (error) {
      setStatus(`Import failed: ${error.message}`);
    } finally {
      refs.jsonInput.value = "";
    }
  }

  async function loadSample() {
    try {
      const response = await fetch("topology-sample.json");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const graph = validateGraphPayload(payload);
      loadGraph(graph, "Loaded sample topology");
    } catch (error) {
      setStatus(`Failed to load sample topology: ${error.message}`);
    }
  }

  function drawHandCursor(targetCtx) {
    const x = state.hand.pointerX;
    const y = state.hand.pointerY;
    const gestureLabel = state.hand.activeGesture === "idle" ? "READY" : state.hand.activeGesture.toUpperCase();
    const radius = 14 + Math.sin(state.pointerPulse * 2.2) * 1.5;

    targetCtx.save();
    targetCtx.translate(x, y);
    targetCtx.strokeStyle = "rgba(142, 233, 221, 0.96)";
    targetCtx.fillStyle = "rgba(142, 233, 221, 0.12)";
    targetCtx.lineWidth = 1.6;
    targetCtx.shadowBlur = 18;
    targetCtx.shadowColor = "rgba(142, 233, 221, 0.35)";
    targetCtx.beginPath();
    targetCtx.arc(0, 0, radius, 0, TAU);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.beginPath();
    targetCtx.moveTo(-22, 0);
    targetCtx.lineTo(-8, 0);
    targetCtx.moveTo(8, 0);
    targetCtx.lineTo(22, 0);
    targetCtx.moveTo(0, -22);
    targetCtx.lineTo(0, -8);
    targetCtx.moveTo(0, 8);
    targetCtx.lineTo(0, 22);
    targetCtx.stroke();

    targetCtx.fillStyle = "rgba(234, 246, 243, 0.92)";
    targetCtx.font = '600 11px "Space Grotesk", sans-serif';
    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "bottom";
    targetCtx.fillText(gestureLabel, 0, -22);
    targetCtx.restore();
  }

  function updatePhysics(step) {
    const targets = modeTargets();
    const repulsion = state.topologyMode === "distributed" ? 15000 : 11000;
    const edgeSpring = state.topologyMode === "distributed" ? 0.004 : 0.0055;

    for (let left = 0; left < state.nodes.length; left += 1) {
      for (let right = left + 1; right < state.nodes.length; right += 1) {
        const first = state.nodes[left];
        const second = state.nodes[right];
        let dx = second.x - first.x;
        let dy = second.y - first.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) {
          distSq = 1;
          dx = 1;
          dy = 0;
        }

        const dist = Math.sqrt(distSq);
        const minDist = first.radius + second.radius + 26;
        const normalX = dx / dist;
        const normalY = dy / dist;
        const push = (repulsion / distSq + Math.max(minDist - dist, 0) * 0.18) * step;

        if (!state.dragState || state.dragState.nodeId !== first.id) {
          first.vx -= normalX * push;
          first.vy -= normalY * push;
        }
        if (!state.dragState || state.dragState.nodeId !== second.id) {
          second.vx += normalX * push;
          second.vy += normalY * push;
        }
      }
    }

    state.edges.forEach((edge) => {
      const source = getNode(edge.source);
      const target = getNode(edge.target);
      if (!source || !target) {
        return;
      }

      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (!dist) {
        dist = 1;
        dx = 1;
        dy = 0;
      }

      const desired = 150 + edge.weight * 8;
      const normalX = dx / dist;
      const normalY = dy / dist;
      const force = (dist - desired) * edgeSpring * step;

      if (!state.dragState || state.dragState.nodeId !== source.id) {
        source.vx += normalX * force;
        source.vy += normalY * force;
      }
      if (!state.dragState || state.dragState.nodeId !== target.id) {
        target.vx -= normalX * force;
        target.vy -= normalY * force;
      }
    });

    for (const node of state.nodes) {
      const target = targets.get(node.id);
      if (target && (!state.dragState || state.dragState.nodeId !== node.id)) {
        node.vx += (target.x - node.x) * target.strength * step;
        node.vy += (target.y - node.y) * target.strength * step;
      }

      const margin = node.radius + 18;
      if (node.x < margin) {
        node.vx += (margin - node.x) * 0.05 * step;
      } else if (node.x > state.viewport.width - margin) {
        node.vx -= (node.x - (state.viewport.width - margin)) * 0.05 * step;
      }

      if (node.y < margin) {
        node.vy += (margin - node.y) * 0.05 * step;
      } else if (node.y > state.viewport.height - margin) {
        node.vy -= (node.y - (state.viewport.height - margin)) * 0.05 * step;
      }
    }

    if (state.dragState) {
      const node = getNode(state.dragState.nodeId);
      const pointer = currentPointer(state.dragState.source);
      if (node && pointer) {
        node.x = pointer.x - state.dragState.offsetX;
        node.y = pointer.y - state.dragState.offsetY;
        node.vx = 0;
        node.vy = 0;
      }
    }

    for (const node of state.nodes) {
      if (state.dragState && state.dragState.nodeId === node.id) {
        continue;
      }
      node.x += node.vx * step;
      node.y += node.vy * step;
      node.vx *= 0.82;
      node.vy *= 0.82;
    }
  }

  function draw() {
    renderGraph(ctx, { includeTransient: true });
  }

  function animate(now) {
    const elapsed = now - state.lastFrameTime;
    state.lastFrameTime = now;
    const step = clamp(elapsed / 16.666, 0.4, 1.8);
    state.pointerPulse += elapsed * 0.0024;

    if (state.hand.status === "active") {
      state.hand.pointerX = lerp(state.hand.pointerX, state.hand.rawX, 0.32);
      state.hand.pointerY = lerp(state.hand.pointerY, state.hand.rawY, 0.32);
      if (now - state.hand.lastSeenAt > 180) {
        state.hand.visible = false;
        if (state.hand.activeGesture !== "idle") {
          transitionHandGesture("idle");
        }
      }
    }

    updateHoverState();
    updatePhysics(step);
    draw();
    requestAnimationFrame(animate);
  }

  function deleteGestureTarget(nodeId) {
    const node = getNode(nodeId);
    if (!node) {
      return;
    }

    state.hand.deleteFired = true;
    deleteNode(nodeId);
  }

  function handleDeleteGesture() {
    if (state.hand.activeGesture !== "delete") {
      state.hand.deleteTargetId = null;
      state.hand.deleteDwellStart = 0;
      state.hand.deleteFired = false;
      return;
    }

    const hovered = state.hoveredNodeId;
    if (!hovered) {
      state.hand.deleteTargetId = null;
      state.hand.deleteDwellStart = 0;
      state.hand.deleteFired = false;
      return;
    }

    if (state.hand.deleteTargetId !== hovered) {
      state.hand.deleteTargetId = hovered;
      state.hand.deleteDwellStart = performance.now();
      state.hand.deleteFired = false;
      return;
    }

    if (!state.hand.deleteFired && performance.now() - state.hand.deleteDwellStart > 700) {
      deleteGestureTarget(hovered);
    }
  }

  function transitionHandGesture(nextGesture) {
    const previousGesture = state.hand.activeGesture;
    if (previousGesture === nextGesture) {
      if (nextGesture === "delete") {
        handleDeleteGesture();
      }
      updateHud();
      return;
    }

    if (previousGesture === "drag") {
      endDrag();
    } else if (previousGesture === "connect") {
      finishConnect(findNodeAt(state.hand.pointerX, state.hand.pointerY)?.id || null);
    } else if (previousGesture === "delete") {
      state.hand.deleteTargetId = null;
      state.hand.deleteFired = false;
    }

    state.hand.activeGesture = nextGesture;

    if (nextGesture === "drag") {
      const hovered = findNodeAt(state.hand.pointerX, state.hand.pointerY);
      if (hovered) {
        startDrag(hovered.id, "hand", state.hand.pointerX - hovered.x, state.hand.pointerY - hovered.y);
        setStatus(`Hand drag engaged on "${hovered.title}".`);
      } else {
        const node = createNode(state.hand.pointerX, state.hand.pointerY, {});
        startDrag(node.id, "hand", 0, 0);
        setStatus(`Created "${node.title}" with hand pinch.`);
      }
    } else if (nextGesture === "connect") {
      const hovered = findNodeAt(state.hand.pointerX, state.hand.pointerY);
      if (hovered) {
        startConnect(hovered.id, "hand");
        setStatus(`Connect gesture armed from "${hovered.title}".`);
      } else {
        state.connectState = null;
      }
    } else if (nextGesture === "delete") {
      state.hand.deleteTargetId = null;
      state.hand.deleteDwellStart = performance.now();
      state.hand.deleteFired = false;
      setStatus("Delete gesture active. Hold over a node to remove it.");
    }

    if (nextGesture === "idle") {
      setStatus(
        state.hand.status === "active"
          ? "Hand tracking live. Thumb + index to create/select/drag."
          : "Mouse fallback is active. Start the camera to enable hand tracking.",
      );
    }

    updateHud();
  }

  function pickGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const palmScale = Math.max(Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y), 0.05);

    const ratios = [
      { gesture: "drag", ratio: Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y) / palmScale },
      { gesture: "connect", ratio: Math.hypot(middleTip.x - thumbTip.x, middleTip.y - thumbTip.y) / palmScale },
      { gesture: "delete", ratio: Math.hypot(ringTip.x - thumbTip.x, ringTip.y - thumbTip.y) / palmScale },
    ].sort((left, right) => left.ratio - right.ratio);

    const currentGesture = state.hand.activeGesture;
    if (currentGesture !== "idle") {
      const currentRatio = ratios.find((entry) => entry.gesture === currentGesture)?.ratio || 1;
      if (currentRatio < 0.7) {
        return currentGesture;
      }
    }

    if (ratios[0].ratio < 0.48) {
      return ratios[0].gesture;
    }

    return "idle";
  }

  function handleHandResults(results) {
    const landmarks = results.multiHandLandmarks?.[0];
    if (!landmarks) {
      state.hand.lastSeenAt = 0;
      state.hand.visible = false;
      transitionHandGesture("idle");
      updateHud();
      return;
    }

    const indexTip = landmarks[8];
    state.hand.lastSeenAt = performance.now();
    state.hand.visible = true;
    state.hand.rawX = clamp((1 - indexTip.x) * state.viewport.width, 18, state.viewport.width - 18);
    state.hand.rawY = clamp(indexTip.y * state.viewport.height, 18, state.viewport.height - 18);
    if (!state.hand.pointerX && !state.hand.pointerY) {
      state.hand.pointerX = state.hand.rawX;
      state.hand.pointerY = state.hand.rawY;
    }

    updateHoverState();
    transitionHandGesture(pickGesture(landmarks));
    handleDeleteGesture();
    updateHud();
  }

  async function startCamera() {
    if (state.hand.status === "active" || state.hand.status === "starting") {
      setStatus("Hand tracking is already starting or active.");
      return;
    }

    if (!window.Hands || !window.Camera) {
      state.hand.status = "unavailable";
      setStatus("MediaPipe Hands CDN failed to load. Mouse fallback remains available.");
      updateHud();
      return;
    }

    state.hand.status = "starting";
    updateHud();
    setStatus("Requesting camera permission for MediaPipe hand tracking...");

    try {
      state.hand.hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      state.hand.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.55,
      });
      state.hand.hands.onResults(handleHandResults);

      state.hand.camera = new window.Camera(refs.video, {
        onFrame: async () => {
          await state.hand.hands.send({ image: refs.video });
        },
        width: 960,
        height: 720,
      });

      await state.hand.camera.start();
      state.hand.status = "active";
      state.hand.enabled = true;
      setStatus("Hand tracking live. Use thumb + index pinch to create or drag nodes.");
    } catch (error) {
      state.hand.status = error && error.name === "NotAllowedError" ? "denied" : "unavailable";
      state.hand.enabled = false;
      setStatus(
        state.hand.status === "denied"
          ? "Camera access was denied. Mouse fallback remains fully active."
          : `Hand tracking could not start (${error.message || "unknown error"}). Mouse fallback remains active.`,
      );
    }

    updateHud();
  }

  function handleMouseDown(event) {
    if (event.button !== 0) {
      return;
    }

    const point = clientToCanvas(event.clientX, event.clientY);
    state.mouse.x = point.x;
    state.mouse.y = point.y;
    state.mouse.pressed = true;
    state.mouse.inside = true;

    const hovered = findNodeAt(point.x, point.y);
    if (event.altKey && hovered) {
      deleteNode(hovered.id);
      return;
    }

    if (event.shiftKey && hovered) {
      startConnect(hovered.id, "mouse");
      setStatus(`Shift-drag connection armed from "${hovered.title}".`);
      return;
    }

    if (hovered) {
      startDrag(hovered.id, "mouse", point.x - hovered.x, point.y - hovered.y);
      setStatus(`Dragging "${hovered.title}".`);
      return;
    }

    const created = createNode(point.x, point.y);
    startDrag(created.id, "mouse", 0, 0);
    setStatus(`Created "${created.title}".`);
  }

  function handleMouseMove(event) {
    const point = clientToCanvas(event.clientX, event.clientY);
    state.mouse.x = point.x;
    state.mouse.y = point.y;
    state.mouse.inside = true;
  }

  function handleMouseUp() {
    if (state.connectState && state.connectState.source === "mouse") {
      finishConnect(findNodeAt(state.mouse.x, state.mouse.y)?.id || null);
    }

    if (state.dragState && state.dragState.source === "mouse") {
      endDrag();
    }

    state.mouse.pressed = false;
  }

  function handleMouseLeave() {
    state.mouse.inside = false;
    state.mouse.pressed = false;
    if (state.connectState && state.connectState.source === "mouse") {
      finishConnect(null);
    }
    if (state.dragState && state.dragState.source === "mouse") {
      endDrag();
    }
  }

  function handleModeChange(event) {
    const nextMode = event.target.value;
    if (!VALID_MODES.includes(nextMode)) {
      return;
    }

    state.topologyMode = nextMode;
    applyLayoutPreset(0.32);
    setStatus(`Topology mode set to ${formatModeLabel(nextMode)}.`);
    updateHud();
  }

  function handleInspectorInput() {
    const node = getNode(state.selectedNodeId);
    if (!node) {
      return;
    }

    node.title = refs.nodeTitleInput.value.trim() || "Untitled Node";
    node.notes = refs.nodeNotesInput.value;
    node.radius = measureRadius(node.title, node.score || 1);
    refs.inspectorStatus.textContent = node.id;
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        setStatus("Unable to exit fullscreen in this browser.");
      });
      return;
    }

    refs.appShell.requestFullscreen().catch(() => {
      setStatus("Fullscreen request was blocked by the browser.");
    });
  }

  function bindEvents() {
    refs.canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    refs.stageShell.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", () => {
      resizeCanvas();
      applyLayoutPreset(0.06);
    });

    refs.topologyModeSelect.addEventListener("change", handleModeChange);
    refs.generateButton.addEventListener("click", generateFromText);
    refs.startCameraButton.addEventListener("click", startCamera);
    refs.loadSampleButton.addEventListener("click", loadSample);
    refs.importButton.addEventListener("click", () => refs.jsonInput.click());
    refs.exportButton.addEventListener("click", exportJson);
    refs.pngButton.addEventListener("click", exportPng);
    refs.fullscreenButton.addEventListener("click", toggleFullscreen);
    refs.clearButton.addEventListener("click", clearTopology);
    refs.jsonInput.addEventListener("change", (event) => {
      const [file] = event.target.files || [];
      if (file) {
        importJsonFile(file);
      }
    });
    refs.nodeTitleInput.addEventListener("input", handleInspectorInput);
    refs.nodeNotesInput.addEventListener("input", handleInspectorInput);
    document.addEventListener("fullscreenchange", updateHud);
  }

  function bootstrap() {
    resizeCanvas();
    bindEvents();
    syncUi();
    requestAnimationFrame(animate);
    loadSample();
  }

  bootstrap();
})();
