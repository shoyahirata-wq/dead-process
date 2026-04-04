// ===== RPG ROOM RENDERER =====
// Canvas-based top-down room with tile map, objects, and player movement

export class Room {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.data = null;
    this.player = { x: 0, y: 0, dir: 'down' };
    this.tileSize = 0;
    this.cols = 0;
    this.rows = 0;
    this.keys = {};
    this.moveTimer = null;
    this.moveDelay = 150;
    this.overlayActive = false;
    this.onInteract = null; // callback(objectId)
    this.animFrame = null;
    this.roomTitle = null;
    this.roomTitleAlpha = 0;
    this.promptObj = null;

    this._onKey = (e) => this._handleKey(e);
    this._onKeyUp = (e) => this._handleKeyUp(e);
    this._onResize = () => this.resize();
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('resize', this._onResize);
  }

  loadRoom(data) {
    this.data = data;
    this.rows = data.tiles.length;
    this.cols = data.tiles[0].length;
    this.player.x = data.playerStart.x;
    this.player.y = data.playerStart.y;
    this.player.dir = 'down';
    this.keys = {};
    this.resize();
    this.showRoomTitle(data.title || '');
    this._startLoop();
  }

  resize() {
    if (!this.data) return;
    const container = this.canvas.parentElement;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const tileW = Math.floor(w / this.cols);
    const tileH = Math.floor(h / this.rows);
    this.tileSize = Math.min(tileW, tileH, 64);
    this.canvas.width = this.tileSize * this.cols;
    this.canvas.height = this.tileSize * this.rows;
    this.render();
  }

  _startLoop() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    const loop = () => {
      this.update();
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  _handleKey(e) {
    if (this.overlayActive) return;
    const key = e.key;

    // Movement keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(key)) {
      e.preventDefault();
      this.keys[key] = true;
    }

    // Interaction
    if (key === ' ' || key === 'Enter') {
      if (this.overlayActive) return;
      e.preventDefault();
      const obj = this.findNearbyObject();
      if (obj && this.onInteract) {
        this.onInteract(obj.id);
      }
    }
  }

  _handleKeyUp(e) {
    this.keys[e.key] = false;
  }

  update() {
    if (this.overlayActive) return;

    // Handle movement with delay
    if (this.moveTimer) return;

    let dx = 0, dy = 0;
    if (this.keys['ArrowUp'] || this.keys['w']) { dy = -1; this.player.dir = 'up'; }
    else if (this.keys['ArrowDown'] || this.keys['s']) { dy = 1; this.player.dir = 'down'; }
    else if (this.keys['ArrowLeft'] || this.keys['a']) { dx = -1; this.player.dir = 'left'; }
    else if (this.keys['ArrowRight'] || this.keys['d']) { dx = 1; this.player.dir = 'right'; }

    if (dx !== 0 || dy !== 0) {
      const nx = this.player.x + dx;
      const ny = this.player.y + dy;
      if (this.canMove(nx, ny)) {
        this.player.x = nx;
        this.player.y = ny;
      }
      this.moveTimer = setTimeout(() => { this.moveTimer = null; }, this.moveDelay);
    }

    // Update prompt
    this.promptObj = this.findNearbyObject();
  }

  render() {
    if (!this.data) return;
    const ctx = this.ctx;
    const ts = this.tileSize;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw tiles
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.drawTile(x, y, this.data.tiles[y][x]);
      }
    }

    // Draw objects
    if (this.data.objects) {
      for (const obj of this.data.objects) {
        this.drawObject(obj);
      }
    }

    // Draw player
    this.drawPlayer();

    // Draw interaction prompt
    if (this.promptObj && !this.overlayActive) {
      this.drawPrompt(this.promptObj);
    }

    // Draw room title
    if (this.roomTitleAlpha > 0 && this.roomTitle) {
      ctx.save();
      ctx.globalAlpha = this.roomTitleAlpha;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, this.canvas.height / 2 - 30, this.canvas.width, 60);
      ctx.globalAlpha = this.roomTitleAlpha;
      ctx.fillStyle = '#00ff41';
      ctx.font = `bold ${Math.max(18, ts * 0.5)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 15;
      ctx.fillText(this.roomTitle, this.canvas.width / 2, this.canvas.height / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  drawTile(x, y, type) {
    const ctx = this.ctx;
    const ts = this.tileSize;
    const px = x * ts;
    const py = y * ts;

    switch (type) {
      case 0: // Floor
        ctx.fillStyle = (x + y) % 2 === 0 ? '#0a0e0a' : '#0d120d';
        ctx.fillRect(px, py, ts, ts);
        // subtle grid lines
        ctx.strokeStyle = '#1a2a1a';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, ts, ts);
        break;
      case 1: // Wall
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(px, py, ts, ts);
        ctx.strokeStyle = '#333355';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
        // wall pattern
        ctx.fillStyle = '#222244';
        ctx.fillRect(px + 2, py + 2, ts / 2 - 2, ts / 2 - 2);
        ctx.fillRect(px + ts / 2 + 1, py + ts / 2 + 1, ts / 2 - 3, ts / 2 - 3);
        break;
      case 2: // Server rack
        ctx.fillStyle = '#0a0e0a';
        ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = '#111122';
        ctx.fillRect(px + 2, py + 1, ts - 4, ts - 2);
        // rack lights
        const lightCount = 3;
        for (let i = 0; i < lightCount; i++) {
          ctx.fillStyle = Math.random() > 0.3 ? '#00ff41' : '#ff3333';
          ctx.fillRect(px + 4, py + 4 + i * Math.floor((ts - 8) / lightCount), 3, 2);
          ctx.fillStyle = '#333';
          ctx.fillRect(px + 10, py + 4 + i * Math.floor((ts - 8) / lightCount), ts - 16, 2);
        }
        break;
    }
  }

  drawObject(obj) {
    const ctx = this.ctx;
    const ts = this.tileSize;
    const px = obj.x * ts;
    const py = obj.y * ts;
    const cx = px + ts / 2;
    const cy = py + ts / 2;
    const fontSize = Math.max(10, ts * 0.35);

    // Draw floor underneath
    ctx.fillStyle = (obj.x + obj.y) % 2 === 0 ? '#0a0e0a' : '#0d120d';
    ctx.fillRect(px, py, ts, ts);

    ctx.font = `${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    switch (obj.type) {
      case 'terminal':
        ctx.fillStyle = '#0a1a0a';
        ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
        ctx.strokeStyle = '#00aa2a';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2, py + 2, ts - 4, ts - 4);
        ctx.fillStyle = '#00ff41';
        ctx.font = `${fontSize * 0.7}px monospace`;
        ctx.fillText('>_', cx, cy);
        break;
      case 'safe':
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, ts - 6, ts - 6);
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'door':
        ctx.fillStyle = obj.unlocked ? '#003300' : '#330000';
        ctx.fillRect(px + 2, py, ts - 4, ts);
        ctx.strokeStyle = obj.unlocked ? '#00ff41' : '#ff3333';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py, ts - 4, ts);
        ctx.fillStyle = obj.unlocked ? '#00ff41' : '#ff3333';
        ctx.font = `${fontSize * 0.6}px monospace`;
        ctx.fillText(obj.unlocked ? 'OPEN' : 'LOCK', cx, cy);
        break;
      case 'note':
        ctx.fillStyle = '#2a2a0a';
        ctx.fillRect(px + ts * 0.2, py + ts * 0.15, ts * 0.6, ts * 0.7);
        ctx.strokeStyle = '#aaaa44';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + ts * 0.2, py + ts * 0.15, ts * 0.6, ts * 0.7);
        // text lines
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = '#666633';
          ctx.fillRect(px + ts * 0.28, py + ts * 0.25 + i * ts * 0.15, ts * 0.44, 1);
        }
        break;
      case 'rack_search':
        // server rack with "?" indicator
        ctx.fillStyle = '#111122';
        ctx.fillRect(px + 2, py + 1, ts - 4, ts - 2);
        ctx.fillStyle = '#ffaa00';
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillText('?', cx, cy);
        break;
      case 'desk':
        ctx.fillStyle = '#1a1510';
        ctx.fillRect(px + 2, py + ts * 0.3, ts - 4, ts * 0.5);
        ctx.strokeStyle = '#4a3a20';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2, py + ts * 0.3, ts - 4, ts * 0.5);
        ctx.fillStyle = '#555';
        ctx.font = `${fontSize * 0.6}px monospace`;
        ctx.fillText('DESK', cx, cy);
        break;
      case 'switch_panel':
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
        ctx.strokeStyle = '#4444aa';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, ts - 4, ts - 4);
        // port lights
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = '#00ff41';
          ctx.fillRect(px + 6 + i * Math.floor((ts - 12) / 4), py + ts * 0.6, 4, 3);
        }
        ctx.fillStyle = '#6666ff';
        ctx.font = `${fontSize * 0.5}px monospace`;
        ctx.fillText('SW', cx, cy - ts * 0.1);
        break;
      case 'hdd_slot':
        ctx.fillStyle = '#111';
        ctx.fillRect(px + 4, py + ts * 0.25, ts - 8, ts * 0.5);
        ctx.strokeStyle = obj.filled ? '#00ff41' : '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 4, py + ts * 0.25, ts - 8, ts * 0.5);
        ctx.fillStyle = obj.filled ? '#00ff41' : '#555';
        ctx.font = `${fontSize * 0.5}px monospace`;
        ctx.fillText(obj.filled ? 'HDD' : 'SLOT', cx, cy);
        break;
      case 'usb_slot':
        ctx.fillStyle = '#111';
        ctx.fillRect(px + 4, py + ts * 0.25, ts - 8, ts * 0.5);
        ctx.strokeStyle = obj.filled ? '#00ff41' : '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 4, py + ts * 0.25, ts - 8, ts * 0.5);
        ctx.fillStyle = obj.filled ? '#00ff41' : '#555';
        ctx.font = `${fontSize * 0.5}px monospace`;
        ctx.fillText(obj.filled ? 'USB' : 'SLOT', cx, cy);
        break;
      case 'shelf':
        ctx.fillStyle = '#1a150a';
        ctx.fillRect(px + 1, py + 2, ts - 2, ts - 4);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = '#3a2a10';
          ctx.fillRect(px + 1, py + 4 + i * Math.floor((ts - 8) / 3), ts - 2, 2);
        }
        ctx.fillStyle = '#888';
        ctx.font = `${fontSize * 0.5}px monospace`;
        ctx.fillText('SHELF', cx, cy);
        break;
      case 'core_server':
        // Pulsing red AI core
        ctx.fillStyle = '#1a0000';
        ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
        ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff3333';
        ctx.font = `${fontSize * 0.5}px monospace`;
        ctx.fillText('AI', cx, cy);
        break;
      case 'floor_map':
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
        ctx.strokeStyle = '#4444aa';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2, py + 2, ts - 4, ts - 4);
        // grid pattern
        for (let i = 1; i < 4; i++) {
          ctx.strokeStyle = '#222244';
          ctx.beginPath();
          ctx.moveTo(px + 2 + i * (ts - 4) / 4, py + 2);
          ctx.lineTo(px + 2 + i * (ts - 4) / 4, py + ts - 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px + 2, py + 2 + i * (ts - 4) / 4);
          ctx.lineTo(px + ts - 2, py + 2 + i * (ts - 4) / 4);
          ctx.stroke();
        }
        ctx.fillStyle = '#6666ff';
        ctx.font = `${fontSize * 0.45}px monospace`;
        ctx.fillText('MAP', cx, cy);
        break;
      case 'camera':
        ctx.fillStyle = (obj.x + obj.y) % 2 === 0 ? '#0a0e0a' : '#0d120d';
        ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = obj.disabled ? '#333' : '#ff3333';
        ctx.font = `${fontSize * 0.8}px monospace`;
        ctx.fillText(obj.disabled ? '📹' : '📹', cx, cy);
        if (!obj.disabled) {
          ctx.fillStyle = `rgba(255, 0, 0, ${0.2 + 0.1 * Math.sin(Date.now() / 500)})`;
          ctx.beginPath();
          ctx.arc(cx, cy, ts * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'door_perm':
        ctx.fillStyle = obj.unlocked ? '#003300' : '#1a0000';
        ctx.fillRect(px + 2, py, ts - 4, ts);
        ctx.strokeStyle = obj.unlocked ? '#00ff41' : '#ff3333';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py, ts - 4, ts);
        ctx.fillStyle = obj.unlocked ? '#00ff41' : '#ff3333';
        ctx.font = `${fontSize * 0.45}px monospace`;
        ctx.fillText(obj.unlocked ? 'OPEN' : obj.perms || '000', cx, cy);
        break;
      default:
        ctx.fillStyle = '#555';
        ctx.font = `${fontSize * 0.6}px monospace`;
        ctx.fillText('?', cx, cy);
    }
  }

  drawPlayer() {
    const ctx = this.ctx;
    const ts = this.tileSize;
    const px = this.player.x * ts;
    const py = this.player.y * ts;
    const cx = px + ts / 2;
    const cy = py + ts / 2;
    const s = ts * 0.35;

    // Body
    ctx.fillStyle = '#00ddff';
    ctx.fillRect(cx - s * 0.4, cy - s * 0.6, s * 0.8, s * 1.2);

    // Head
    ctx.fillStyle = '#00ddff';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.7, s * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator (small triangle)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const arrowSize = s * 0.25;
    switch (this.player.dir) {
      case 'up':
        ctx.moveTo(cx, cy - s - arrowSize);
        ctx.lineTo(cx - arrowSize, cy - s);
        ctx.lineTo(cx + arrowSize, cy - s);
        break;
      case 'down':
        ctx.moveTo(cx, cy + s * 0.8 + arrowSize);
        ctx.lineTo(cx - arrowSize, cy + s * 0.8);
        ctx.lineTo(cx + arrowSize, cy + s * 0.8);
        break;
      case 'left':
        ctx.moveTo(cx - s * 0.6 - arrowSize, cy);
        ctx.lineTo(cx - s * 0.6, cy - arrowSize);
        ctx.lineTo(cx - s * 0.6, cy + arrowSize);
        break;
      case 'right':
        ctx.moveTo(cx + s * 0.6 + arrowSize, cy);
        ctx.lineTo(cx + s * 0.6, cy - arrowSize);
        ctx.lineTo(cx + s * 0.6, cy + arrowSize);
        break;
    }
    ctx.closePath();
    ctx.fill();

    // Glow effect
    ctx.shadowColor = '#00ddff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(0, 221, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawPrompt(obj) {
    const ctx = this.ctx;
    const ts = this.tileSize;
    const label = `[Space] ${obj.label}`;
    const fontSize = Math.max(11, ts * 0.3);
    ctx.font = `${fontSize}px "Courier New", monospace`;
    const textW = ctx.measureText(label).width;
    const padding = 8;
    const bx = this.canvas.width / 2 - textW / 2 - padding;
    const by = this.canvas.height - 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(bx, by - fontSize / 2 - 4, textW + padding * 2, fontSize + 8);
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by - fontSize / 2 - 4, textW + padding * 2, fontSize + 8);

    ctx.fillStyle = '#00ff41';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, this.canvas.width / 2, by);
  }

  findNearbyObject() {
    if (!this.data || !this.data.objects) return null;
    const p = this.player;
    // Direction-based check
    const dirOffsets = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };
    const off = dirOffsets[p.dir];
    const fx = p.x + off.dx;
    const fy = p.y + off.dy;

    // Check facing tile
    for (const obj of this.data.objects) {
      if (obj.x === fx && obj.y === fy && obj.interactable !== false) {
        return obj;
      }
    }
    // Also check adjacent (all 4 directions)
    for (const obj of this.data.objects) {
      if (obj.interactable === false) continue;
      const dist = Math.abs(obj.x - p.x) + Math.abs(obj.y - p.y);
      if (dist === 1) return obj;
    }
    return null;
  }

  canMove(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return false;
    const tile = this.data.tiles[y][x];
    if (tile === 1 || tile === 2) return false;
    // Check objects
    if (this.data.objects) {
      for (const obj of this.data.objects) {
        if (obj.x === x && obj.y === y && obj.walkable === false) return false;
      }
    }
    return true;
  }

  setOverlayActive(active) {
    this.overlayActive = active;
    this.keys = {};
  }

  showRoomTitle(title) {
    this.roomTitle = title;
    this.roomTitleAlpha = 1;
    const fade = () => {
      this.roomTitleAlpha -= 0.01;
      if (this.roomTitleAlpha <= 0) {
        this.roomTitleAlpha = 0;
        this.roomTitle = null;
      } else {
        setTimeout(fade, 30);
      }
    };
    setTimeout(fade, 1500);
  }

  getObject(id) {
    if (!this.data || !this.data.objects) return null;
    return this.data.objects.find(o => o.id === id) || null;
  }

  stop() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (this.moveTimer) clearTimeout(this.moveTimer);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._onResize);
  }
}
