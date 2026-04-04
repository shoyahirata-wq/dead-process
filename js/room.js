// ===== RPG ROOM RENDERER =====
// Canvas-based top-down room with sprite image support

export class Room {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.data = null;
    this.player = { x: 0, y: 0, dir: 'down', frame: 0 };
    this.tileSize = 0;
    this.cols = 0;
    this.rows = 0;
    this.keys = {};
    this.moveTimer = null;
    this.moveDelay = 150;
    this.overlayActive = false;
    this.onInteract = null;
    this.animFrame = null;
    this.roomTitle = null;
    this.roomTitleAlpha = 0;
    this.promptObj = null;
    this.tick = 0;

    // Sprite image system
    this.sprites = {};
    this.spritesLoaded = false;
    this._loadSprites();

    this._onKey = (e) => this._handleKey(e);
    this._onKeyUp = (e) => this._handleKeyUp(e);
    this._onResize = () => this.resize();
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('resize', this._onResize);
  }

  // --- Sprite loading ---
  _loadSprites() {
    const spriteNames = [
      // Player directions
      'player_down', 'player_up', 'player_left', 'player_right',
      // Tiles
      'tile_floor', 'tile_wall', 'tile_rack',
      // Objects
      'terminal', 'safe', 'door_locked', 'door_unlocked',
      'note', 'server_rack', 'desk', 'switch_panel',
      'hdd_slot', 'usb_slot', 'shelf', 'core_server',
      'camera', 'floor_map',
    ];

    let loaded = 0;
    const total = spriteNames.length;

    for (const name of spriteNames) {
      const img = new Image();
      img.src = `images/sprites/${name}.png`;
      img.onload = () => {
        this.sprites[name] = img;
        loaded++;
        if (loaded >= total) this.spritesLoaded = true;
      };
      img.onerror = () => {
        console.warn(`[Room] Failed to load sprite: ${name}`);
        loaded++;
        if (loaded >= total) this.spritesLoaded = true;
      };
    }
  }

  _hasSprite(name) {
    return !!(this.sprites[name]);
  }

  _drawSprite(name, x, y, w, h) {
    if (this.sprites[name]) {
      this.ctx.drawImage(this.sprites[name], x, y, w, h);
      return true;
    }
    return false;
  }

  loadRoom(data) {
    this.data = data;
    this.rows = data.tiles.length;
    this.cols = data.tiles[0].length;
    this.player.x = data.playerStart.x;
    this.player.y = data.playerStart.y;
    this.player.dir = 'down';
    this.player.frame = 0;
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
      this.tick++;
      this.update();
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  _handleKey(e) {
    if (this.overlayActive) return;
    const key = e.key;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(key)) {
      e.preventDefault();
      this.keys[key] = true;
    }
    if (key === ' ' || key === 'Enter') {
      if (this.overlayActive) return;
      e.preventDefault();
      const obj = this.findNearbyObject();
      if (obj && this.onInteract) this.onInteract(obj.id);
    }
  }

  _handleKeyUp(e) { this.keys[e.key] = false; }

  update() {
    if (this.overlayActive) return;
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
      this.player.frame++;
      this.moveTimer = setTimeout(() => { this.moveTimer = null; }, this.moveDelay);
    }

    this.promptObj = this.findNearbyObject();
  }

  render() {
    if (!this.data) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++)
        this.drawTile(x, y, this.data.tiles[y][x]);

    if (this.data.objects)
      for (const obj of this.data.objects) this.drawObject(obj);

    this.drawPlayer();

    if (this.promptObj && !this.overlayActive) this.drawPrompt(this.promptObj);

    if (this.roomTitleAlpha > 0 && this.roomTitle) {
      ctx.save();
      ctx.globalAlpha = this.roomTitleAlpha;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, this.canvas.height / 2 - 30, this.canvas.width, 60);
      ctx.fillStyle = '#00ff41';
      ctx.font = `bold ${Math.max(18, this.tileSize * 0.5)}px "Courier New", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 15;
      ctx.fillText(this.roomTitle, this.canvas.width / 2, this.canvas.height / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // --- Pixel helper ---
  px(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  // --- TILES ---
  drawTile(x, y, type) {
    const ts = this.tileSize;
    const px = x * ts;
    const py = y * ts;

    // Try sprite images first
    const tileMap = { 0: 'tile_floor', 1: 'tile_wall', 2: 'tile_rack' };
    const spriteName = tileMap[type];
    if (spriteName && this._drawSprite(spriteName, px, py, ts, ts)) {
      return; // sprite drawn successfully
    }

    // Fallback: programmatic drawing
    const ctx = this.ctx;
    const u = Math.max(1, Math.floor(ts / 16));

    switch (type) {
      case 0: {
        const dark = (x + y) % 2 === 0;
        ctx.fillStyle = dark ? '#0c100c' : '#101410';
        ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = dark ? '#0e130e' : '#121712';
        ctx.fillRect(px + ts/2 - u/2, py + u*2, u, ts - u*4);
        ctx.fillRect(px + u*2, py + ts/2 - u/2, ts - u*4, u);
        ctx.fillStyle = '#1a251a';
        ctx.fillRect(px + u, py + u, u, u);
        ctx.fillRect(px + ts - u*2, py + ts - u*2, u, u);
        break;
      }
      case 1: {
        ctx.fillStyle = '#1c1c32';
        ctx.fillRect(px, py, ts, ts);
        const bh = Math.max(2, Math.floor(ts / 4));
        for (let row = 0; row < 4; row++) {
          const by = py + row * bh;
          const offset = (row % 2 === 0) ? 0 : Math.floor(ts / 2);
          ctx.fillStyle = '#2a2a4a';
          ctx.fillRect(px, by, ts, Math.max(1, u/2));
          ctx.fillStyle = (row % 2 === 0) ? '#222240' : '#1e1e38';
          const bw = Math.floor(ts / 2);
          for (let col = 0; col < 3; col++) {
            const bx = px + col * bw - offset;
            if (bx + bw > px && bx < px + ts) {
              const clippedX = Math.max(px, bx);
              const clippedW = Math.min(px + ts, bx + bw) - clippedX;
              ctx.fillRect(clippedX + u/2, by + u/2, clippedW - u, bh - u);
            }
          }
        }
        ctx.fillStyle = '#333358';
        ctx.fillRect(px, py, ts, u);
        ctx.fillRect(px, py + ts - u, ts, u);
        ctx.fillRect(px, py, u, ts);
        ctx.fillRect(px + ts - u, py, u, ts);
        break;
      }
      case 2: {
        ctx.fillStyle = '#0c100c';
        ctx.fillRect(px, py, ts, ts);
        const rackX = px + u*2, rackY = py + u, rackW = ts - u*4, rackH = ts - u*2;
        ctx.fillStyle = '#151520';
        ctx.fillRect(rackX, rackY, rackW, rackH);
        ctx.fillStyle = '#2a2a40';
        ctx.fillRect(rackX, rackY, rackW, u);
        ctx.fillRect(rackX, rackY + rackH - u, rackW, u);
        ctx.fillRect(rackX, rackY, u, rackH);
        ctx.fillRect(rackX + rackW - u, rackY, u, rackH);
        const slotCount = 5;
        const slotH = Math.max(2, Math.floor((rackH - u*2) / slotCount));
        for (let i = 0; i < slotCount; i++) {
          const sy = rackY + u + i * slotH;
          ctx.fillStyle = '#1a1a2a';
          ctx.fillRect(rackX + u*2, sy + 1, rackW - u*4, slotH - 2);
          const seed = (x * 17 + y * 31 + i * 7) % 10;
          const ledOn = (this.tick + seed * 20) % 120 < 100;
          ctx.fillStyle = ledOn ? '#00ff41' : '#004400';
          ctx.fillRect(rackX + u*2, sy + Math.floor(slotH/2) - u/2, u*2, u);
          ctx.fillStyle = '#333';
          ctx.fillRect(rackX + u*5, sy + Math.floor(slotH/2) - u/2, rackW - u*8, u);
        }
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = '#0a0a15';
          ctx.fillRect(rackX + u*3 + i * u*3, rackY + u, u*2, u);
        }
        break;
      }
    }
  }

  // --- OBJECTS ---
  drawObject(obj) {
    const ctx = this.ctx;
    const ts = this.tileSize;
    const px = obj.x * ts;
    const py = obj.y * ts;
    const u = Math.max(1, Math.floor(ts / 16));

    // Floor underneath
    this.drawTile(obj.x, obj.y, 0);

    // Map object types to sprite names
    const spriteMap = {
      terminal: 'terminal',
      safe: 'safe',
      note: 'note',
      rack_search: 'server_rack',
      desk: 'desk',
      switch_panel: 'switch_panel',
      hdd_slot: 'hdd_slot',
      usb_slot: 'usb_slot',
      shelf: 'shelf',
      core_server: 'core_server',
      camera: 'camera',
      floor_map: 'floor_map',
    };

    // Door uses different sprites based on state
    if (obj.type === 'door' || obj.type === 'door_perm') {
      const doorSprite = obj.unlocked ? 'door_unlocked' : 'door_locked';
      if (this._drawSprite(doorSprite, px, py, ts, ts)) {
        // Overlay permission text for door_perm
        if (obj.type === 'door_perm' && !obj.unlocked) {
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(px + u*3, py + ts - u*6, ts - u*6, u*4);
          ctx.fillStyle = '#ff6666';
          ctx.font = `bold ${Math.max(8, ts*0.2)}px monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(obj.perms || '000', px + ts/2, py + ts - u*4);
        }
        return;
      }
      // Fallback
      if (obj.type === 'door_perm') {
        this._drawDoorPerm(px, py, ts, u, obj);
      } else {
        this._drawDoor(px, py, ts, u, obj);
      }
      return;
    }

    // Try sprite for other objects
    const spriteName = spriteMap[obj.type];
    if (spriteName && this._drawSprite(spriteName, px, py, ts, ts)) {
      // Add dynamic overlays on top of sprites

      // HDD/USB slot: show filled state
      if ((obj.type === 'hdd_slot' || obj.type === 'usb_slot') && obj.filled) {
        const label = obj.type === 'hdd_slot' ? 'HDD' : 'USB';
        ctx.fillStyle = 'rgba(0, 255, 65, 0.15)';
        ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = '#00ff41';
        ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 6;
        ctx.font = `bold ${Math.max(8, ts*0.18)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${label} OK`, px + ts/2, py + ts - u*3);
        ctx.shadowBlur = 0;
      }

      // Camera: show disabled overlay
      if (obj.type === 'camera' && obj.disabled) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(px, py, ts, ts);
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + u*3, py + u*3);
        ctx.lineTo(px + ts - u*3, py + ts - u*3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + ts - u*3, py + u*3);
        ctx.lineTo(px + u*3, py + ts - u*3);
        ctx.stroke();
      }

      // Core server: pulsing red overlay
      if (obj.type === 'core_server') {
        const pulse = 0.5 + 0.5 * Math.sin(this.tick * 0.05);
        ctx.fillStyle = `rgba(255, 0, 0, ${0.03 + pulse * 0.06})`;
        ctx.fillRect(px, py, ts, ts);
      }

      // Rack search: glowing ? indicator
      if (obj.type === 'rack_search') {
        const qx = px + ts/2, qy = py + ts/2;
        ctx.fillStyle = 'rgba(255, 170, 0, 0.12)';
        ctx.beginPath(); ctx.arc(qx, qy, ts*0.3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8;
        ctx.font = `bold ${Math.max(12, ts*0.4)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', qx, qy);
        ctx.shadowBlur = 0;
      }

      return;
    }

    // Fallback: programmatic drawing
    switch (obj.type) {
      case 'terminal': this._drawTerminal(px, py, ts, u); break;
      case 'safe': this._drawSafe(px, py, ts, u); break;
      case 'door': this._drawDoor(px, py, ts, u, obj); break;
      case 'door_perm': this._drawDoorPerm(px, py, ts, u, obj); break;
      case 'note': this._drawNote(px, py, ts, u); break;
      case 'rack_search': this._drawRackSearch(px, py, ts, u); break;
      case 'desk': this._drawDesk(px, py, ts, u); break;
      case 'switch_panel': this._drawSwitch(px, py, ts, u); break;
      case 'hdd_slot': this._drawSlot(px, py, ts, u, obj, 'HDD'); break;
      case 'usb_slot': this._drawSlot(px, py, ts, u, obj, 'USB'); break;
      case 'shelf': this._drawShelf(px, py, ts, u); break;
      case 'core_server': this._drawCoreServer(px, py, ts, u); break;
      case 'floor_map': this._drawFloorMap(px, py, ts, u); break;
      case 'camera': this._drawCamera(px, py, ts, u, obj); break;
      default:
        ctx.fillStyle = '#555';
        ctx.font = `${ts*0.3}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', px+ts/2, py+ts/2);
    }
  }

  // --- PLAYER ---
  drawPlayer() {
    const ctx = this.ctx;
    const ts = this.tileSize;
    const px = this.player.x * ts;
    const py = this.player.y * ts;
    const dir = this.player.dir;

    // Try sprite image
    const spriteName = `player_${dir}`;
    if (this._hasSprite(spriteName)) {
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      const cx = px + ts / 2;
      const u = Math.max(1, Math.floor(ts / 16));
      ctx.beginPath();
      ctx.ellipse(cx, py + ts - u*2, u*4, u*1.5, 0, 0, Math.PI*2);
      ctx.fill();

      // Draw player sprite
      this._drawSprite(spriteName, px, py, ts, ts);

      // ID badge glow overlay (subtle green glow on chest area)
      ctx.fillStyle = '#00ff41';
      ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 4;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(px + ts * 0.6, py + ts * 0.5, ts * 0.1, ts * 0.08);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      return;
    }

    // Fallback: programmatic player drawing
    this._drawPlayerFallback();
  }

  _drawPlayerFallback() {
    const ctx = this.ctx;
    const ts = this.tileSize;
    const px = this.player.x * ts;
    const py = this.player.y * ts;
    const u = Math.max(1, Math.floor(ts / 16));
    const cx = px + ts / 2;
    const dir = this.player.dir;
    const walkCycle = this.player.frame % 4;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, py + ts - u*2, u*4, u*1.5, 0, 0, Math.PI*2);
    ctx.fill();

    const headY = py + u*2;
    const headH = u*4;
    const bodyY = headY + headH;
    const bodyH = u*5;
    const legY = bodyY + bodyH;
    const legH = u*3;
    const headW = u*5;
    const bodyW = u*6;
    const armW = u*1.5;

    switch (dir) {
      case 'down': {
        const legOff = (walkCycle < 2) ? u : -u;
        ctx.fillStyle = '#1a3a5a';
        ctx.fillRect(cx - u*2, legY, u*1.5, legH + legOff * 0.3);
        ctx.fillRect(cx + u*0.5, legY, u*1.5, legH - legOff * 0.3);
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - u*2.5, legY + legH + legOff * 0.3 - u, u*2.5, u);
        ctx.fillRect(cx + u*0.5, legY + legH - legOff * 0.3 - u, u*2.5, u);
        ctx.fillStyle = '#1a5a8a';
        ctx.fillRect(cx - bodyW/2, bodyY, bodyW, bodyH);
        ctx.fillStyle = '#1a4a7a';
        ctx.fillRect(cx - u*0.5, bodyY + u, u, bodyH - u*2);
        ctx.fillStyle = '#225588';
        ctx.fillRect(cx - bodyW/2 + u, bodyY + u, u*2, u*2);
        const armOff = (walkCycle % 2 === 0) ? u*0.5 : -u*0.5;
        ctx.fillStyle = '#1a5a8a';
        ctx.fillRect(cx - bodyW/2 - armW, bodyY + u + armOff, armW, bodyH - u*2);
        ctx.fillRect(cx + bodyW/2, bodyY + u - armOff, armW, bodyH - u*2);
        ctx.fillStyle = '#ddb088';
        ctx.fillRect(cx - bodyW/2 - armW, bodyY + bodyH - u + armOff, armW, u);
        ctx.fillRect(cx + bodyW/2, bodyY + bodyH - u - armOff, armW, u);
        ctx.fillStyle = '#ddb088';
        ctx.fillRect(cx - headW/2, headY, headW, headH);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(cx - headW/2 - u*0.5, headY - u, headW + u, u*2);
        ctx.fillRect(cx - headW/2 - u*0.5, headY, u, headH * 0.3);
        ctx.fillRect(cx + headW/2, headY, u, headH * 0.3);
        ctx.fillStyle = '#222';
        ctx.fillRect(cx - u*1.5, headY + u*1.5, u, u);
        ctx.fillRect(cx + u*0.5, headY + u*1.5, u, u);
        ctx.fillStyle = '#00ff41';
        ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 3;
        ctx.fillRect(cx + bodyW/2 - u*2, bodyY + bodyH - u*3, u*1.5, u*2);
        ctx.shadowBlur = 0;
        break;
      }
      case 'up': {
        const legOff = (walkCycle < 2) ? u : -u;
        ctx.fillStyle = '#1a3a5a';
        ctx.fillRect(cx - u*2, legY, u*1.5, legH + legOff * 0.3);
        ctx.fillRect(cx + u*0.5, legY, u*1.5, legH - legOff * 0.3);
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - u*2, legY + legH + legOff * 0.3 - u, u*2, u);
        ctx.fillRect(cx + u*0.5, legY + legH - legOff * 0.3 - u, u*2, u);
        ctx.fillStyle = '#1a5a8a';
        ctx.fillRect(cx - bodyW/2, bodyY, bodyW, bodyH);
        ctx.fillStyle = '#1a4a7a';
        ctx.fillRect(cx - u, bodyY + u*2, u*2, u*2);
        const armOff = (walkCycle % 2 === 0) ? u*0.5 : -u*0.5;
        ctx.fillStyle = '#1a5a8a';
        ctx.fillRect(cx - bodyW/2 - armW, bodyY + u - armOff, armW, bodyH - u*2);
        ctx.fillRect(cx + bodyW/2, bodyY + u + armOff, armW, bodyH - u*2);
        ctx.fillStyle = '#ddb088';
        ctx.fillRect(cx - bodyW/2 - armW, bodyY + bodyH - u - armOff, armW, u);
        ctx.fillRect(cx + bodyW/2, bodyY + bodyH - u + armOff, armW, u);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(cx - headW/2, headY, headW, headH);
        ctx.fillStyle = '#ddb088';
        ctx.fillRect(cx - headW/2 + u, headY + u, headW - u*2, headH - u);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(cx - headW/2 - u*0.5, headY - u, headW + u, u*2.5);
        break;
      }
      case 'left': {
        const legOff = (walkCycle < 2) ? u : -u;
        ctx.fillStyle = '#1a3a5a';
        ctx.fillRect(cx - u*1.5, legY, u*2.5, legH + legOff * 0.3);
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - u*2, legY + legH + legOff * 0.3 - u, u*3, u);
        ctx.fillStyle = '#1a5a8a';
        ctx.fillRect(cx - u*2, bodyY, u*4, bodyH);
        const armOff = (walkCycle % 2 === 0) ? u : -u;
        ctx.fillStyle = '#1a5a8a';
        ctx.fillRect(cx - u*3, bodyY + u*1.5 + armOff, armW, bodyH - u*3);
        ctx.fillStyle = '#ddb088';
        ctx.fillRect(cx - u*3, bodyY + bodyH - u*1.5 + armOff, armW, u);
        ctx.fillStyle = '#ddb088';
        ctx.fillRect(cx - u*2.5, headY, u*4.5, headH);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(cx - u*2.5, headY - u, u*5, u*2);
        ctx.fillRect(cx + u, headY, u*1.5, headH * 0.5);
        ctx.fillStyle = '#222';
        ctx.fillRect(cx - u*2, headY + u*1.5, u, u);
        ctx.fillStyle = '#00ff41';
        ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 3;
        ctx.fillRect(cx - u*2, bodyY + bodyH - u*3, u*1.5, u*2);
        ctx.shadowBlur = 0;
        break;
      }
      case 'right': {
        const legOff = (walkCycle < 2) ? u : -u;
        ctx.fillStyle = '#1a3a5a';
        ctx.fillRect(cx - u, legY, u*2.5, legH + legOff * 0.3);
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - u, legY + legH + legOff * 0.3 - u, u*3, u);
        ctx.fillStyle = '#1a5a8a';
        ctx.fillRect(cx - u*2, bodyY, u*4, bodyH);
        const armOff = (walkCycle % 2 === 0) ? u : -u;
        ctx.fillStyle = '#1a5a8a';
        ctx.fillRect(cx + u*1.5, bodyY + u*1.5 + armOff, armW, bodyH - u*3);
        ctx.fillStyle = '#ddb088';
        ctx.fillRect(cx + u*1.5, bodyY + bodyH - u*1.5 + armOff, armW, u);
        ctx.fillStyle = '#ddb088';
        ctx.fillRect(cx - u*2, headY, u*4.5, headH);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(cx - u*2.5, headY - u, u*5, u*2);
        ctx.fillRect(cx - u*2.5, headY, u*1.5, headH * 0.5);
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + u, headY + u*1.5, u, u);
        ctx.fillStyle = '#00ff41';
        ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 3;
        ctx.fillRect(cx + u*0.5, bodyY + bodyH - u*3, u*1.5, u*2);
        ctx.shadowBlur = 0;
        break;
      }
    }
  }

  // --- Fallback drawing methods (used when sprites not loaded) ---

  _drawTerminal(px, py, ts, u) {
    const ctx = this.ctx;
    ctx.fillStyle = '#2a2520';
    ctx.fillRect(px + u*2, py + ts - u*5, ts - u*4, u*4);
    const mx = px + u*3, my = py + u*2, mw = ts - u*6, mh = ts - u*8;
    ctx.fillStyle = '#222';
    ctx.fillRect(mx - u, my - u, mw + u*2, mh + u*2);
    ctx.fillStyle = '#001a00';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#002a00';
    ctx.fillRect(mx + u, my + u, mw - u*2, mh - u*2);
    const lineH = Math.max(2, Math.floor(mh / 6));
    for (let i = 0; i < 4; i++) {
      const lw = mw * (0.4 + ((i * 37) % 5) * 0.1);
      ctx.fillStyle = '#00ff41';
      ctx.fillRect(mx + u*2, my + u*2 + i * lineH, Math.min(lw, mw - u*4), Math.max(1, u));
    }
    if (this.tick % 60 < 30) {
      ctx.fillStyle = '#00ff41';
      ctx.fillRect(mx + u*2, my + u*2 + 4 * lineH, u*2, Math.max(1, u));
    }
    ctx.fillStyle = '#333';
    ctx.fillRect(px + ts/2 - u*2, py + ts - u*6, u*4, u*2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(px + u*4, py + ts - u*3, ts - u*8, u*2);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#333';
      ctx.fillRect(px + u*5 + i * u*2, py + ts - u*2.5, u, u*0.5);
    }
  }

  _drawSafe(px, py, ts, u) {
    const ctx = this.ctx;
    const sx = px + u*2, sy = py + u*2, sw = ts - u*4, sh = ts - u*4;
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = '#404040';
    ctx.fillRect(sx, sy, sw, u);
    ctx.fillRect(sx, sy + sh - u, sw, u);
    ctx.fillRect(sx, sy, u, sh);
    ctx.fillRect(sx + sw - u, sy, u, sh);
    ctx.fillStyle = '#222';
    ctx.fillRect(sx + u*2, sy + u*2, sw - u*4, sh - u*4);
    const dcx = px + ts/2, dcy = py + ts/2;
    const dr = Math.max(3, ts * 0.12);
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath(); ctx.arc(dcx, dcy, dr, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#cc8800';
    ctx.beginPath(); ctx.arc(dcx, dcy, dr * 0.5, 0, Math.PI*2); ctx.fill();
    for (let a = 0; a < 8; a++) {
      const angle = a * Math.PI / 4;
      ctx.fillStyle = '#ffcc44';
      ctx.fillRect(dcx + Math.cos(angle) * dr * 0.7 - u/2, dcy + Math.sin(angle) * dr * 0.7 - u/2, u, u);
    }
    ctx.fillStyle = '#666';
    ctx.fillRect(sx + sw - u*4, dcy - u*2, u*2, u*4);
    ctx.fillStyle = '#111';
    ctx.fillRect(dcx - u/2, dcy + dr + u*2, u, u*2);
  }

  _drawDoor(px, py, ts, u, obj) {
    const ctx = this.ctx;
    const open = obj.unlocked;
    ctx.fillStyle = '#333';
    ctx.fillRect(px + u, py, ts - u*2, ts);
    ctx.fillStyle = open ? '#1a3a1a' : '#3a1a1a';
    ctx.fillRect(px + u*2, py + u, ts - u*4, ts - u*2);
    const panelW = ts - u*6;
    const panelH = (ts - u*6) / 2;
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = open ? '#224422' : '#441818';
      ctx.fillRect(px + u*3, py + u*2 + i * (panelH + u), panelW, panelH);
      ctx.strokeStyle = open ? '#336633' : '#552222';
      ctx.lineWidth = u * 0.5;
      ctx.strokeRect(px + u*3, py + u*2 + i * (panelH + u), panelW, panelH);
    }
    const hy = py + ts/2;
    ctx.fillStyle = open ? '#00ff41' : '#ff3333';
    ctx.fillRect(px + ts - u*5, hy - u, u*2, u*3);
    ctx.fillStyle = open ? '#00ff41' : '#ff3333';
    ctx.shadowColor = open ? '#00ff41' : '#ff3333';
    ctx.shadowBlur = 6;
    ctx.fillRect(px + ts/2 - u, py + u*2, u*2, u*2);
    ctx.shadowBlur = 0;
  }

  _drawDoorPerm(px, py, ts, u, obj) {
    const ctx = this.ctx;
    const open = obj.unlocked;
    this._drawDoor(px, py, ts, u, obj);
    if (!open) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(px + u*3, py + ts - u*5, ts - u*6, u*3);
      ctx.fillStyle = '#ff6666';
      ctx.font = `${Math.max(8, ts*0.18)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(obj.perms || '000', px + ts/2, py + ts - u*3.5);
    }
  }

  _drawNote(px, py, ts, u) {
    const ctx = this.ctx;
    const nx = px + u*3, ny = py + u*2, nw = ts - u*6, nh = ts - u*4;
    ctx.fillStyle = '#111';
    ctx.fillRect(nx + u, ny + u, nw, nh);
    ctx.fillStyle = '#d4c896';
    ctx.fillRect(nx, ny, nw, nh);
    ctx.fillStyle = '#b8aa78';
    ctx.beginPath();
    ctx.moveTo(nx + nw - u*3, ny);
    ctx.lineTo(nx + nw, ny + u*3);
    ctx.lineTo(nx + nw, ny);
    ctx.closePath();
    ctx.fill();
    const lineCount = 5;
    const lineH = Math.max(2, Math.floor((nh - u*4) / lineCount));
    for (let i = 0; i < lineCount; i++) {
      const lw = nw * (0.5 + ((i * 23) % 4) * 0.12);
      ctx.fillStyle = '#5a5030';
      ctx.fillRect(nx + u*2, ny + u*2 + i * lineH, Math.min(lw, nw - u*4), Math.max(1, u * 0.7));
    }
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(nx + nw/2, ny - u, u*1.2, 0, Math.PI*2);
    ctx.fill();
  }

  _drawRackSearch(px, py, ts, u) {
    const ctx = this.ctx;
    ctx.fillStyle = '#151520';
    ctx.fillRect(px + u*2, py + u, ts - u*4, ts - u*2);
    ctx.fillStyle = '#2a2a40';
    ctx.fillRect(px + u*2, py + u, ts - u*4, u);
    ctx.fillRect(px + u*2, py + ts - u*2, ts - u*4, u);
    const slotH = Math.max(3, Math.floor((ts - u*4) / 4));
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(px + u*4, py + u*2 + i * slotH, ts - u*8, slotH - 2);
    }
    const qx = px + ts/2, qy = py + ts/2;
    ctx.fillStyle = 'rgba(255, 170, 0, 0.15)';
    ctx.beginPath(); ctx.arc(qx, qy, ts*0.3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffaa00';
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8;
    ctx.font = `bold ${Math.max(12, ts*0.4)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', qx, qy);
    ctx.shadowBlur = 0;
  }

  _drawDesk(px, py, ts, u) {
    const ctx = this.ctx;
    ctx.fillStyle = '#3a2a15';
    ctx.fillRect(px + u*2, py + ts*0.55, u*2, ts*0.4);
    ctx.fillRect(px + ts - u*4, py + ts*0.55, u*2, ts*0.4);
    ctx.fillStyle = '#4a3820';
    ctx.fillRect(px + u, py + ts*0.35, ts - u*2, u*4);
    ctx.fillStyle = '#5a4830';
    ctx.fillRect(px + u*2, py + ts*0.35, ts - u*4, u);
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(px + u*3, py + ts*0.35 + u*4, ts*0.4, u*3);
    ctx.fillStyle = '#888';
    ctx.fillRect(px + u*3 + ts*0.15, py + ts*0.35 + u*5, ts*0.1, u);
    ctx.fillStyle = '#555';
    ctx.fillRect(px + ts - u*6, py + ts*0.28, u*3, u*3);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(px + ts - u*5.5, py + ts*0.2, u, u*3);
    ctx.fillStyle = '#00aaff';
    ctx.fillRect(px + ts - u*4.5, py + ts*0.22, u, u*3);
  }

  _drawSwitch(px, py, ts, u) {
    const ctx = this.ctx;
    const sx = px + u*2, sy = py + u*3, sw = ts - u*4, sh = ts - u*6;
    ctx.fillStyle = '#1a1a30';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = '#3333558';
    ctx.fillRect(sx, sy, sw, u); ctx.fillRect(sx, sy+sh-u, sw, u);
    ctx.fillRect(sx, sy, u, sh); ctx.fillRect(sx+sw-u, sy, u, sh);
    ctx.fillStyle = '#222244';
    ctx.fillRect(sx + u*2, sy + u, sw - u*4, u*2);
    ctx.fillStyle = '#4444aa';
    ctx.font = `${Math.max(6, ts*0.12)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SWITCH', px + ts/2, sy + u*2);
    const portW = Math.max(2, Math.floor((sw - u*6) / 4));
    const portH = Math.max(2, u*2);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const portX = sx + u*2 + col * (portW + u);
        const portY = sy + u*4 + row * (portH + u);
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(portX, portY, portW, portH);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(portX, portY, portW, portH);
      }
    }
    const ledY = sy + sh - u*3;
    for (let i = 0; i < 4; i++) {
      const active = (this.tick + i * 30) % 90 < 80;
      ctx.fillStyle = active ? '#00ff41' : '#003300';
      ctx.shadowColor = active ? '#00ff41' : 'transparent';
      ctx.shadowBlur = active ? 4 : 0;
      ctx.fillRect(sx + u*3 + i * (portW + u), ledY, u*1.5, u*1.5);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0066aa';
    ctx.fillRect(px + ts/2 - u/2, py, u, u*3);
  }

  _drawSlot(px, py, ts, u, obj, label) {
    const ctx = this.ctx;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(px + u*2, py + u*2, ts - u*4, ts - u*4);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px + u*2, py + u*2, ts - u*4, u);
    ctx.fillStyle = '#001100';
    ctx.fillRect(px + u*3, py + u*4, ts - u*6, u*4);
    ctx.fillStyle = obj.filled ? '#00ff41' : '#444';
    ctx.font = `${Math.max(7, ts*0.15)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(obj.filled ? `${label} OK` : 'EMPTY', px + ts/2, py + u*6);
    const slotY = py + ts/2 + u;
    ctx.fillStyle = obj.filled ? '#003300' : '#111';
    ctx.fillRect(px + u*4, slotY, ts - u*8, u*3);
    ctx.strokeStyle = obj.filled ? '#00ff41' : '#444';
    ctx.lineWidth = u * 0.5;
    ctx.strokeRect(px + u*4, slotY, ts - u*8, u*3);
    if (obj.filled) {
      ctx.fillStyle = '#00aa33';
      ctx.fillRect(px + u*4 + u, slotY + u*0.5, ts - u*10, u*2);
      ctx.fillStyle = '#00ff41';
      ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 4;
      ctx.fillRect(px + ts - u*6, slotY + u, u, u);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#444';
    ctx.fillRect(px + ts - u*4, py + ts - u*4, u*2, u*2);
  }

  _drawShelf(px, py, ts, u) {
    const ctx = this.ctx;
    ctx.fillStyle = '#2a1f10';
    ctx.fillRect(px + u, py + u, ts - u*2, ts - u*2);
    const shelfCount = 3;
    const shelfH = Math.floor((ts - u*4) / shelfCount);
    for (let i = 0; i < shelfCount; i++) {
      const sy = py + u*2 + i * shelfH;
      ctx.fillStyle = '#3a2a15';
      ctx.fillRect(px + u, sy + shelfH - u*1.5, ts - u*2, u*1.5);
      if (i === 0) {
        for (let j = 0; j < 3; j++) {
          ctx.fillStyle = ['#2255aa', '#aa3322', '#33aa33'][j];
          ctx.fillRect(px + u*3 + j * u*3, sy + u, u*2, shelfH - u*3);
        }
      } else if (i === 1) {
        ctx.fillStyle = '#4a4a30';
        ctx.fillRect(px + u*2, sy + u*2, u*5, shelfH - u*4);
        ctx.fillStyle = '#555540';
        ctx.fillRect(px + u*8, sy + u, u*4, shelfH - u*3);
      } else {
        ctx.fillStyle = '#666';
        ctx.fillRect(px + u*3, sy + u*2, u*2, u*2);
        ctx.fillStyle = '#886622';
        ctx.fillRect(px + u*7, sy + u, u*3, shelfH - u*3);
      }
    }
    ctx.fillStyle = '#3a2a15';
    ctx.fillRect(px + u, py + u, u, ts - u*2);
    ctx.fillRect(px + ts - u*2, py + u, u, ts - u*2);
  }

  _drawCoreServer(px, py, ts, u) {
    const ctx = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(this.tick * 0.05);
    ctx.fillStyle = `rgba(255, 0, 0, ${0.05 + pulse * 0.08})`;
    ctx.fillRect(px, py, ts, ts);
    ctx.fillStyle = '#1a0505';
    ctx.fillRect(px + u, py + u, ts - u*2, ts - u*2);
    ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 + pulse * 0.5})`;
    ctx.lineWidth = u;
    ctx.strokeRect(px + u, py + u, ts - u*2, ts - u*2);
    const coreR = Math.max(4, ts * 0.15);
    const cx = px + ts/2, cy = py + ts/2;
    for (let r = 3; r >= 0; r--) {
      ctx.fillStyle = `rgba(255, 0, 0, ${(0.05 + pulse * 0.05) * (4 - r)})`;
      ctx.beginPath(); ctx.arc(cx, cy, coreR + r * u*2, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = `rgb(${180 + pulse * 75}, 0, 0)`;
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = u * 0.5;
    ctx.beginPath(); ctx.moveTo(cx - coreR*0.7, cy); ctx.lineTo(cx + coreR*0.7, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - coreR*0.7); ctx.lineTo(cx, cy + coreR*0.7); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const on = (this.tick + i * 15) % 50 < 35;
      ctx.fillStyle = on ? '#ff3333' : '#330000';
      ctx.fillRect(px + u*3 + i * u*2, py + u*2, u*1.5, u*1.5);
    }
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 6;
    ctx.font = `bold ${Math.max(8, ts*0.18)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('AI', cx, py + ts - u*3);
    ctx.shadowBlur = 0;
  }

  _drawFloorMap(px, py, ts, u) {
    const ctx = this.ctx;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(px + u*2, py + u*2, ts - u*4, ts - u*4);
    const sx = px + u*3, sy = py + u*3, sw = ts - u*6, sh = ts - u*6;
    ctx.fillStyle = '#000820';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = '#112244';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * sw/4, sy); ctx.lineTo(sx + i * sw/4, sy + sh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx, sy + i * sh/4); ctx.lineTo(sx + sw, sy + i * sh/4);
      ctx.stroke();
    }
    const dotR = Math.max(1, u);
    const dots = [[0.2,0.2],[0.8,0.2],[0.2,0.8],[0.8,0.8]];
    dots.forEach((d, i) => {
      const on = (this.tick + i * 20) % 60 < 40;
      ctx.fillStyle = on ? '#00aaff' : '#003355';
      ctx.fillRect(sx + sw*d[0] - dotR, sy + sh*d[1] - dotR, dotR*2, dotR*2);
    });
    ctx.strokeStyle = '#4444aa';
    ctx.lineWidth = u;
    ctx.strokeRect(px + u*2, py + u*2, ts - u*4, ts - u*4);
    ctx.fillStyle = '#333';
    ctx.fillRect(px + ts/2 - u, py + u, u*2, u*2);
  }

  _drawCamera(px, py, ts, u, obj) {
    const ctx = this.ctx;
    const off = obj.disabled;
    ctx.fillStyle = '#333';
    ctx.fillRect(px + ts/2 - u*2, py + u, u*4, u*2);
    ctx.fillStyle = '#444';
    ctx.fillRect(px + ts/2 - u, py + u*2, u*2, u*3);
    const bx = px + ts/2 - u*4, by = py + u*4, bw = u*8, bh = u*5;
    ctx.fillStyle = off ? '#2a2a2a' : '#333';
    ctx.fillRect(bx, by, bw, bh);
    const lx = px + ts/2, ly = by + bh/2;
    ctx.fillStyle = off ? '#222' : '#111';
    ctx.beginPath(); ctx.arc(lx, ly, u*2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = off ? '#333' : '#0066cc';
    ctx.beginPath(); ctx.arc(lx, ly, u*1.2, 0, Math.PI*2); ctx.fill();
    if (!off) {
      const blink = this.tick % 40 < 25;
      ctx.fillStyle = blink ? '#ff0000' : '#440000';
      ctx.shadowColor = blink ? '#ff0000' : 'transparent';
      ctx.shadowBlur = blink ? 6 : 0;
      ctx.fillRect(bx + bw - u*2, by + u, u*1.5, u*1.5);
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255, 0, 0, ${0.03 + 0.02 * Math.sin(this.tick * 0.03)})`;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(px + u*2, py + ts - u);
      ctx.lineTo(px + ts - u*2, py + ts - u);
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- PROMPT ---
  drawPrompt(obj) {
    const ctx = this.ctx;
    const ts = this.tileSize;
    const label = `[Space] ${obj.label}`;
    const fontSize = Math.max(11, ts * 0.28);
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    const textW = ctx.measureText(label).width;
    const padding = 10;
    const bx = this.canvas.width / 2 - textW / 2 - padding;
    const by = this.canvas.height - 28;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(bx - 2, by - fontSize/2 - 6, textW + padding*2 + 4, fontSize + 12);
    ctx.strokeStyle = '#00ff41';
    ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 4;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 2, by - fontSize/2 - 6, textW + padding*2 + 4, fontSize + 12);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00ff41';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, this.canvas.width / 2, by);
  }

  // --- LOGIC ---
  findNearbyObject() {
    if (!this.data || !this.data.objects) return null;
    const p = this.player;
    const dirOffsets = {
      up: {dx:0,dy:-1}, down: {dx:0,dy:1},
      left: {dx:-1,dy:0}, right: {dx:1,dy:0},
    };
    const off = dirOffsets[p.dir];
    const fx = p.x + off.dx, fy = p.y + off.dy;
    for (const obj of this.data.objects) {
      if (obj.x === fx && obj.y === fy && obj.interactable !== false) return obj;
    }
    for (const obj of this.data.objects) {
      if (obj.interactable === false) continue;
      if (Math.abs(obj.x - p.x) + Math.abs(obj.y - p.y) === 1) return obj;
    }
    return null;
  }

  canMove(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return false;
    if (this.data.tiles[y][x] === 1 || this.data.tiles[y][x] === 2) return false;
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
        this.roomTitleAlpha = 0; this.roomTitle = null;
      } else { setTimeout(fade, 30); }
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
