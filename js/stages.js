// ===== ALL 5 STAGES =====

// ----- Shared Utilities -----

function resolvePath(input, cwd) {
  if (!input) return cwd;
  if (input.startsWith('/')) return input.replace(/\/+$/, '');
  const path = input.startsWith('./') ? input.slice(2) : input;
  const resolved = cwd === '/' ? `/${path}` : `${cwd}/${path}`;
  return resolved.replace(/\/+$/, '');
}

function buildCompletions(input, stage) {
  const parts = input.split(/\s+/);
  const allCmds = [...stage.availableCommands, 'clear', 'whoami', 'pwd', 'date', 'uname'];

  if (parts.length <= 1) {
    const partial = parts[0] || '';
    const matches = allCmds.filter(c => c.startsWith(partial));
    if (matches.length === 1) {
      return { completed: matches[0] + ' ', candidates: null };
    } else if (matches.length > 1) {
      const prefix = longestCommonPrefix(matches);
      return { completed: prefix, candidates: matches };
    }
    return null;
  }

  const cmd = parts[0];
  const partial = parts[parts.length - 1] || '';
  const cwd = stage.cwd || '/';

  const allPaths = { ...stage.filesystem };
  if (stage.hddMounted && stage.hddFilesystem) Object.assign(allPaths, stage.hddFilesystem);
  if (stage.usbMounted && stage.usbFilesystem) Object.assign(allPaths, stage.usbFilesystem);

  const resolved = partial ? resolvePath(partial, cwd) : cwd;
  const matches = Object.keys(allPaths).filter(p => p.startsWith(resolved));

  if (matches.length === 1) {
    const match = matches[0];
    const before = parts.slice(0, -1).join(' ');
    const suffix = allPaths[match] === null ? '/' : ' ';
    return { completed: before + ' ' + match + suffix, candidates: null };
  } else if (matches.length > 1) {
    const prefix = longestCommonPrefix(matches);
    const before = parts.slice(0, -1).join(' ');
    const display = matches.map(m => m.split('/').pop());
    return { completed: before + ' ' + prefix, candidates: display };
  }

  if (cmd === 'systemctl' && stage.services) {
    const action = parts[1];
    if (action === 'stop' && parts.length === 3) {
      const svcPartial = parts[2];
      const svcMatches = stage.services
        .filter(s => s.running && s.name.startsWith(svcPartial))
        .map(s => s.name);
      if (svcMatches.length === 1) {
        return { completed: `systemctl stop ${svcMatches[0]}`, candidates: null };
      } else if (svcMatches.length > 1) {
        const prefix = longestCommonPrefix(svcMatches);
        return { completed: `systemctl stop ${prefix}`, candidates: svcMatches };
      }
    }
  }

  return null;
}

function longestCommonPrefix(strings) {
  if (strings.length === 0) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}

function lookupFile(path, filesystem, cwd) {
  const resolved = resolvePath(path, cwd);
  if (resolved in filesystem) return { found: true, content: filesystem[resolved], resolved };
  return { found: false, resolved };
}

// Global help lines (appended to every stage help)
function writeGlobalHelp(terminal) {
  terminal.writeLines([
    '',
    '共通コマンド:',
    '  clear        - ターミナル画面をクリア',
    '  pwd          - 現在のディレクトリを表示',
    '  whoami       - ユーザー名を表示',
    '  date         - 現在の日時を表示',
    '  uname        - システム情報を表示',
    '  help         - このヘルプを表示',
  ], 'system');
}

export { buildCompletions };


// ----- Stage 1: Server Room -----
export const stage1 = {
  id: 1,
  name: 'Stage 1 — サーバールーム',

  roomData: {
    title: 'サーバールーム',
    tiles: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,0,2,0,2,0,0,2,0,2,0,0,1],
      [1,2,0,2,0,2,0,0,2,0,2,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,0,1,1,1,1,1,1,1],
    ],
    objects: [
      { x:12, y:1, type:'note', id:'network_diagram', label:'ネットワーク構成図', walkable:false },
      { x:6, y:4, type:'terminal', id:'terminal', label:'ターミナル', walkable:false },
      { x:1, y:6, type:'safe', id:'safe', label:'金庫', walkable:false },
      { x:8, y:7, type:'rack_search', id:'rack_search', label:'サーバーラック裏', walkable:false },
      { x:11, y:7, type:'note', id:'memo', label:'メモ', walkable:false },
      { x:6, y:9, type:'door', id:'exit', label:'ドア', walkable:false, unlocked:false },
    ],
    playerStart: { x:7, y:8 },
  },

  onInteract(objectId, game) {
    switch(objectId) {
      case 'terminal':
        game.openTerminal();
        break;
      case 'safe':
        game.openPanel('金庫', (container) => this.renderKeypad(game, container));
        break;
      case 'rack_search':
        if (this.foundCable) {
          game.showMessage('もう調べた。何もない。');
        } else {
          this.foundCable = true;
          game.engine.addItem({ id: 'lan_cable', name: 'LANケーブル', icon: '🔌', hint: 'ネットワーク室でスイッチの配線に使用' });
          game.effects.showNotification('LANケーブル を入手した', 'item-get');
          game.renderInventory();
          game.showMessage('LANケーブル（予備）を発見した！');
        }
        break;
      case 'memo':
        game.openNote('【メモ】\n金庫のパスコード＝正常に応答しているサーバーのホスト番号の合計\n例: host-01 と host-03 が正常なら → 1 + 3 = 4\n\n※ pingコマンドで各ホストの状態を確認可能');
        break;
      case 'network_diagram':
        game.openNote(
          '【ネットワーク構成図】\n\n' +
          'Gateway: 192.168.1.254\n' +
          '         |\n' +
          '    Core Switch\n' +
          '    ┌──┬──┬──┬──┬──┬──┬──┬──┐\n' +
          '   h01 h02 h03 h04 h05 h06 h07 h08\n\n' +
          'IPアドレス: 192.168.1.[ホスト番号]\n' +
          '  host-01: 192.168.1.1\n' +
          '  host-02: 192.168.1.2\n' +
          '  host-03: 192.168.1.3\n' +
          '  host-04: 192.168.1.4\n' +
          '  host-05: 192.168.1.5\n' +
          '  host-06: 192.168.1.6\n' +
          '  host-07: 192.168.1.7\n' +
          '  host-08: 192.168.1.8\n\n' +
          '※ pingコマンドで各ホストの状態を確認可能'
        );
        break;
      case 'exit':
        if (this.solved) {
          if (!game.engine.hasItem('lan_cable') && !this.foundCable) {
            game.terminal.writeSystem('[HINT] ラックの裏もまだ調べていないようだ...');
          }
          game.engine.nextStage();
        } else {
          game.showMessage('ロックされている。金庫を開けて解除しろ。');
        }
        break;
    }
  },

  renderKeypad(game, container) {
    container.innerHTML = `
      <div class="keypad">
        <p style="color:var(--amber);font-size:12px;margin-bottom:12px;">【金庫】パスコードを入力</p>
        <div class="keypad-display" id="keypad-display">${this.keypadValue.padEnd(4, '_')}</div>
        <div class="keypad-buttons">
          ${[1,2,3,4,5,6,7,8,9].map(n =>
            `<button class="keypad-btn" data-num="${n}">${n}</button>`
          ).join('')}
          <button class="keypad-btn clear" data-action="clear">C</button>
          <button class="keypad-btn" data-num="0">0</button>
          <button class="keypad-btn enter" data-action="enter">ENTER</button>
        </div>
      </div>`;

    container.querySelectorAll('.keypad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.solved) return;
        const num = btn.dataset.num;
        const action = btn.dataset.action;
        const display = document.getElementById('keypad-display');

        if (num !== undefined) {
          if (this.keypadValue.length < 4) {
            this.keypadValue += num;
            display.textContent = this.keypadValue.padEnd(4, '_');
          }
        } else if (action === 'clear') {
          this.keypadValue = '';
          display.textContent = '____';
        } else if (action === 'enter') {
          if (parseInt(this.keypadValue) === this.answer) {
            this.solved = true;
            display.textContent = 'OK!!';
            display.style.color = 'var(--green)';
            display.style.textShadow = '0 0 10px var(--green)';
            game.effects.flash();
            game.terminal.writeSuccess('[SYSTEM] 金庫が開いた。次の部屋への扉がアンロックされた。');
            // Update door object
            const door = game.room.getObject('exit');
            if (door) door.unlocked = true;
            setTimeout(() => game.closePanel(), 1000);
          } else {
            display.textContent = 'ERR!';
            display.style.color = 'var(--red)';
            game.effects.glitch();
            game.terminal.writeAI('> アクセス拒否。パスコードが違います。');
            setTimeout(() => {
              this.keypadValue = '';
              display.textContent = '____';
              display.style.color = 'var(--green)';
              display.style.textShadow = 'none';
            }, 1000);
          }
        }
      });
    });
  },

  filesystem: {
    '/var/log/syslog': `[03:21:01] host-01: connection refused (port 22)
[03:21:02] host-02: response 200 OK
[03:21:03] host-03: request timeout
[03:21:04] host-04: response 200 OK
[03:21:05] host-05: connection refused (port 80)
[03:21:06] host-06: request timeout
[03:21:07] host-07: response 200 OK
[03:21:08] host-08: connection refused (port 443)`,
    '/etc/hosts': `127.0.0.1   localhost
192.168.1.1  host-01
192.168.1.2  host-02
192.168.1.3  host-03
192.168.1.4  host-04
192.168.1.5  host-05
192.168.1.6  host-06
192.168.1.7  host-07
192.168.1.8  host-08`,
    '/home/user/memo.txt': `【メモ】
金庫のパスコード＝正常に応答しているサーバーのホスト番号の合計
例: host-01 と host-03 が正常なら → 1 + 3 = 4`,
    '/home/user': null,
    '/var/log': null,
    '/etc': null,
  },

  pingHosts: {
    'host-01': false, 'host-02': true, 'host-03': false, 'host-04': true,
    'host-05': false, 'host-06': false, 'host-07': true, 'host-08': false,
    '192.168.1.1': false, '192.168.1.2': true, '192.168.1.3': false,
    '192.168.1.4': true, '192.168.1.5': false, '192.168.1.6': false,
    '192.168.1.7': true, '192.168.1.8': false,
  },

  cwd: '/home/user',
  availableCommands: ['ls', 'cat', 'ping', 'help'],
  answer: 13,
  keypadValue: '',
  solved: false,
  foundCable: false,

  processCommand(args, engine) {
    const cmd = args[0];
    switch (cmd) {
      case 'help':
        engine.terminal.writeLines([
          'ステージコマンド:',
          '  ls [path]    - ディレクトリ内容を表示',
          '  cat <file>   - ファイル内容を表示',
          '  ping <host>  - ホストの死活確認',
        ], 'system');
        writeGlobalHelp(engine.terminal);
        break;
      case 'ls': {
        const path = args[1] || this.cwd;
        const resolved = resolvePath(path, this.cwd);
        const entries = this.getDirectoryEntries(resolved);
        if (entries) {
          engine.terminal.writeLines(entries);
        } else {
          engine.terminal.writeError(`ls: ${path}: No such file or directory`);
        }
        break;
      }
      case 'cat': {
        const file = args[1];
        if (!file) { engine.terminal.writeError('cat: ファイルを指定してください'); break; }
        const result = lookupFile(file, this.filesystem, this.cwd);
        if (result.found && result.content) {
          engine.terminal.writeLines(result.content.split('\n'));
        } else if (result.found && result.content === null) {
          engine.terminal.writeError(`cat: ${file}: Is a directory`);
        } else {
          engine.terminal.writeError(`cat: ${file}: No such file or directory`);
        }
        break;
      }
      case 'ping': {
        const host = args[1];
        if (!host) { engine.terminal.writeError('ping: ホストを指定してください'); break; }
        const alive = this.pingHosts[host];
        if (alive === undefined) {
          engine.terminal.writeError(`ping: ${host}: Name or service not known`);
        } else if (alive) {
          engine.terminal.writeLines([
            `PING ${host}: 64 bytes, time=1.${Math.floor(Math.random()*9)}ms`,
            `PING ${host}: 64 bytes, time=0.${Math.floor(Math.random()*9)}ms`,
            `--- ${host} ping statistics ---`,
            '2 packets transmitted, 2 received, 0% packet loss',
          ]);
        } else {
          engine.terminal.writeLines([
            `PING ${host}: Request timeout`,
            `PING ${host}: Request timeout`,
            `--- ${host} ping statistics ---`,
            '2 packets transmitted, 0 received, 100% packet loss',
          ], 'error');
        }
        break;
      }
      default:
        return false;
    }
    return true;
  },

  getDirectoryEntries(path) {
    const dirs = {
      '/': ['var/', 'etc/', 'home/'],
      '/home': ['user/'],
      '/home/user': ['memo.txt'],
      '/var': ['log/'],
      '/var/log': ['syslog'],
      '/etc': ['hosts'],
    };
    const clean = path.replace(/\/+$/, '') || '/';
    return dirs[clean] || null;
  },
};


// ----- Stage 2: Network Room -----
export const stage2 = {
  id: 2,
  name: 'Stage 2 — ネットワーク室',

  roomData: {
    title: 'ネットワーク室',
    tiles: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,0,1,1,1,1,1,1,1],
    ],
    objects: [
      { x:3, y:2, type:'switch_panel', id:'switch_panel', label:'ネットワークスイッチ', walkable:false },
      { x:10, y:2, type:'camera', id:'camera', label:'監視カメラ', walkable:false, interactable:false, disabled:false },
      { x:10, y:7, type:'desk', id:'desk', label:'デスク', walkable:false },
      { x:6, y:4, type:'terminal', id:'terminal', label:'ターミナル', walkable:false },
      { x:6, y:9, type:'door', id:'exit', label:'ドア', walkable:false, unlocked:false },
    ],
    playerStart: { x:6, y:8 },
  },

  onInteract(objectId, game) {
    switch(objectId) {
      case 'terminal':
        game.openTerminal();
        break;
      case 'switch_panel':
        game.openPanel('ネットワークスイッチ', (container) => this.renderSwitch(game, container));
        break;
      case 'desk':
        if (this.foundHDD) {
          game.showMessage('もう調べた。何もない。');
        } else {
          this.foundHDD = true;
          game.engine.addItem({ id: 'hdd', name: 'HDD', icon: '💾', hint: 'ストレージ室の端末に挿入 → mountでマウント' });
          game.effects.showNotification('HDD を入手した', 'item-get');
          game.renderInventory();
          game.showMessage('引き出しからHDD（2.5インチ SATA）を発見した！');
        }
        break;
      case 'exit':
        if (this.solved) {
          game.engine.nextStage();
        } else {
          game.showMessage('カメラが動いている。まだ脱出できない。');
        }
        break;
    }
  },

  renderSwitch(game, container) {
    container.innerHTML = `
      <div>
        <p style="color:var(--amber);font-size:12px;margin-bottom:12px;">【ネットワークスイッチ】ポートをクリックしてケーブルを抜き差し</p>
        <div class="switch-diagram">
          <div class="switch-box">
            <h3>Core Switch</h3>
            <div id="port-list">
              ${this.ports.map(p => `
                <div class="port ${p.connected ? 'connected' : 'disconnected'}" data-port-id="${p.id}" id="port-${p.id}">
                  <span class="port-indicator"></span>
                  <span>${p.name}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div style="color:#555;font-size:12px;">
            <div id="camera-status" style="color:${this.solved ? 'var(--green)' : 'var(--red)'};">
              📹 カメラ: ${this.solved ? 'オフライン' : 'オンライン'}
            </div>
            <div id="robot-warning" style="margin-top:8px;display:${this.wrongAttempts > 0 ? '' : 'none'};color:var(--red);">
              ${this.wrongAttempts > 0 ? `⚠ ロボットが接近中... (誤操作: ${this.wrongAttempts}回)` : ''}
            </div>
          </div>
        </div>
      </div>`;

    this.ports.forEach(p => {
      const el = document.getElementById(`port-${p.id}`);
      el.addEventListener('click', () => {
        if (this.solved) return;
        p.connected = !p.connected;
        el.className = `port ${p.connected ? 'connected' : 'disconnected'}`;

        if (p.network === 'camera' && !p.connected) {
          const othersOk = this.ports.filter(x => x.network !== 'camera').every(x => x.connected);
          if (othersOk) {
            this.solved = true;
            document.getElementById('camera-status').innerHTML = '📹 カメラ: <span style="color:var(--green)">オフライン</span>';
            game.effects.flash();
            game.terminal.writeSuccess('[SYSTEM] カメラ系統を切断した。AIの追跡が停止。');
            game.terminal.writeSystem('[SYSTEM] 次の部屋への扉がアンロックされた。');
            const door = game.room.getObject('exit');
            if (door) door.unlocked = true;
            const cam = game.room.getObject('camera');
            if (cam) cam.disabled = true;
            setTimeout(() => game.closePanel(), 1500);
          }
        } else if (p.network === 'management' && !p.connected) {
          this.wrongAttempts++;
          game.effects.screenShake();
          game.terminal.writeAI('> 管理系統を切断？　脱出ルートが閉ざされるところだった。');
          game.terminal.writeError('[WARNING] 管理系統の切断は危険です。再接続してください。');
          p.connected = true;
          el.className = 'port connected';
        } else if (!p.connected && p.network !== 'camera') {
          this.wrongAttempts++;
          game.effects.glitch();
          const warn = document.getElementById('robot-warning');
          warn.style.display = '';
          warn.textContent = `⚠ ロボットが接近中... (誤操作: ${this.wrongAttempts}回)`;
          game.terminal.writeAI('> 間違ったポートを触っていますね。');
          p.connected = true;
          el.className = 'port connected';
        }
      });
    });
  },

  filesystem: {
    '/etc/network/switch_config.txt': `[Switch Port Configuration]
Port 1: 192.168.10.0/24  - VLAN10 (Camera/監視カメラ系統)
Port 2: 192.168.20.0/24  - VLAN20 (Management/管理系統)
Port 3: 192.168.30.0/24  - VLAN30 (Server/サーバー系統)
Port 4: 192.168.40.0/24  - VLAN40 (IoT/センサー系統)`,
    '/etc/iptables.rules': `# Current iptables rules
-A INPUT -s 192.168.10.0/24 -p tcp --dport 554 -j ACCEPT  # RTSP Camera
-A INPUT -s 192.168.10.0/24 -p tcp --dport 80 -j ACCEPT   # Camera Web UI
-A INPUT -s 192.168.20.0/24 -p tcp --dport 22 -j ACCEPT   # SSH Management
-A INPUT -s 192.168.30.0/24 -p tcp --dport 443 -j ACCEPT  # Server HTTPS
-A INPUT -s 192.168.40.0/24 -p udp --dport 161 -j ACCEPT  # SNMP Sensors
-A INPUT -j DROP`,
    '/var/log/camera.log': `[03:25:01] cam-01: motion detected - sector A
[03:25:03] cam-02: motion detected - sector A
[03:25:05] AI-CTRL: tracking target in sector A
[03:25:06] AI-CTRL: dispatching unit to sector A
[03:25:08] cam-03: target acquired`,
    '/etc/network': null,
    '/etc': null,
    '/var/log': null,
  },

  cwd: '/',
  availableCommands: ['ls', 'cat', 'ip', 'help'],
  ports: [
    { id: 1, name: 'Port 1 - Camera (VLAN10)', network: 'camera', connected: true },
    { id: 2, name: 'Port 2 - Management (VLAN20)', network: 'management', connected: true },
    { id: 3, name: 'Port 3 - Server (VLAN30)', network: 'server', connected: true },
    { id: 4, name: 'Port 4 - IoT (VLAN40)', network: 'iot', connected: true },
  ],
  solved: false,
  foundHDD: false,
  wrongAttempts: 0,

  processCommand(args, engine) {
    const cmd = args[0];
    switch (cmd) {
      case 'help':
        engine.terminal.writeLines([
          'ステージコマンド:',
          '  ls [path]    - ディレクトリ内容を表示',
          '  cat <file>   - ファイル内容を表示',
          '  ip a         - ネットワークインターフェース情報',
        ], 'system');
        writeGlobalHelp(engine.terminal);
        break;
      case 'ls': {
        const path = args[1] || this.cwd;
        const resolved = resolvePath(path, this.cwd);
        const entries = this.getDirectoryEntries(resolved);
        if (entries) {
          engine.terminal.writeLines(entries);
        } else {
          engine.terminal.writeError(`ls: ${path}: No such file or directory`);
        }
        break;
      }
      case 'cat': {
        const file = args[1];
        if (!file) { engine.terminal.writeError('cat: ファイルを指定してください'); break; }
        const result = lookupFile(file, this.filesystem, this.cwd);
        if (result.found && result.content) {
          engine.terminal.writeLines(result.content.split('\n'));
        } else if (result.found && result.content === null) {
          engine.terminal.writeError(`cat: ${file}: Is a directory`);
        } else {
          engine.terminal.writeError(`cat: ${file}: No such file or directory`);
        }
        break;
      }
      case 'ip': {
        if (args[1] === 'a' || args[1] === 'addr') {
          engine.terminal.writeLines([
            '1: lo: <LOOPBACK,UP> mtu 65536',
            '    inet 127.0.0.1/8 scope host lo',
            '2: eth0: <BROADCAST,UP> mtu 1500',
            '    inet 192.168.20.100/24 brd 192.168.20.255 scope global eth0',
            '    link/ether aa:bb:cc:dd:ee:ff',
            '3: eth1: <NO-CARRIER> mtu 1500',
            '    state DOWN',
          ]);
        } else {
          engine.terminal.writeError('Usage: ip a');
        }
        break;
      }
      default:
        return false;
    }
    return true;
  },

  getDirectoryEntries(path) {
    const dirs = {
      '/': ['etc/', 'var/'],
      '/etc': ['network/', 'iptables.rules'],
      '/etc/network': ['switch_config.txt'],
      '/var': ['log/'],
      '/var/log': ['camera.log'],
    };
    const clean = path.replace(/\/+$/, '') || '/';
    return dirs[clean] || null;
  },
};


// ----- Stage 3: Storage Room -----
export const stage3 = {
  id: 3,
  name: 'Stage 3 — ストレージ室',

  roomData: {
    title: 'ストレージ室',
    tiles: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,0,1,1,1,1,1,1,1],
    ],
    objects: [
      { x:3, y:2, type:'hdd_slot', id:'hdd_slot', label:'HDDスロット', walkable:false, filled:false },
      { x:10, y:2, type:'note', id:'door_readme', label:'ドアロック説明', walkable:false },
      { x:6, y:4, type:'terminal', id:'terminal', label:'ターミナル', walkable:false },
      { x:11, y:6, type:'shelf', id:'shelf', label:'棚', walkable:false },
      { x:2, y:7, type:'door_perm', id:'door_status', label:'ドアロック', walkable:false, unlocked:false, perms:'000' },
      { x:6, y:9, type:'door', id:'exit', label:'ドア', walkable:false, unlocked:false },
    ],
    playerStart: { x:7, y:8 },
  },

  onInteract(objectId, game) {
    switch(objectId) {
      case 'terminal':
        game.openTerminal();
        break;
      case 'hdd_slot': {
        if (this.hddInserted) {
          game.showMessage('HDD は既に接続されている。');
          break;
        }
        if (!game.engine.hasItem('hdd')) {
          game.showMessage('HDDを持っていない。');
          break;
        }
        this.hddInserted = true;
        game.engine.useItem('hdd');
        const slot = game.room.getObject('hdd_slot');
        if (slot) slot.filled = true;
        game.effects.showNotification('HDDを端末に接続した', 'item-get');
        game.terminal.writeSystem('[SYSTEM] /dev/sdb1 が検出されました。mountコマンドでマウントしてください。');
        game.renderInventory();
        break;
      }
      case 'door_readme':
        game.openNote(
          '【ドアロック制御ファイル】\n' +
          'ドアの解錠には、door_lock に対して\n' +
          '所有者(owner)の「読み取り」と「実行」権限の付与が必要です。\n\n' +
          '現在のパーミッション: ----------  (000)\n' +
          '必要: 所有者 = r + x / グループ = なし / その他 = なし\n\n' +
          'ヒント: chmod コマンドで権限を変更せよ\n' +
          '  chmod 500 /sys/door/door_lock\n' +
          '  または chmod u+rx /sys/door/door_lock'
        );
        break;
      case 'shelf':
        if (this.foundAP) {
          game.showMessage('もう調べた。何もない。');
        } else {
          this.foundAP = true;
          game.engine.addItem({ id: 'wireless_ap', name: '無線AP', icon: '📡', hint: '電源制御室のフロアマップに設置して端末を復旧' });
          game.effects.showNotification('無線AP を入手した', 'item-get');
          game.renderInventory();
          game.showMessage('無線AP（ポータブル）を発見した！');
        }
        break;
      case 'door_status':
        if (this.doorUnlocked) {
          game.showMessage('ドアロック: 解除済み');
        } else {
          game.showMessage(`ドアロック: パーミッション ${this.currentPerms} — 不正`);
        }
        break;
      case 'exit':
        if (this.doorUnlocked) {
          game.engine.nextStage();
        } else {
          game.showMessage('アクセス権限でロックされている。chmodで解除しろ。');
        }
        break;
    }
  },

  filesystem: {
    '/sys/door/README': `【ドアロック制御ファイル】
ドアの解錠には、door_lock に対して
所有者(owner)の「読み取り」と「実行」権限の付与が必要です。

現在のパーミッション: ----------  (000)
必要: 所有者 = r + x / グループ = なし / その他 = なし`,
    '/sys/door': null,
    '/sys': null,
  },

  hddFilesystem: {
    '/mnt/hdd/note.txt': `【前任エンジニアのメモ】
このAIには "overlord" という名の親プロセスがある。
子プロセスをいくら停止しても、親が自動的に再生成する。
必ず親プロセスを特定し、それをkillすること。

...もう時間がない。あとは頼んだ。`,
    '/mnt/hdd/ai_design.txt': `【AI制御システム設計書（抜粋）】
- コアプロセス名: overlord
- 動作モード: --mode=control
- 子プロセス管理: 自動再起動(respawn)
- 停止方法: kill -9 <overlord_PID>
  ※子プロセスのPIDではなくoverlord自体のPIDを指定すること`,
    '/mnt/hdd': null,
  },

  cwd: '/',
  availableCommands: ['ls', 'cat', 'mount', 'chmod', 'help'],
  hddMounted: false,
  hddInserted: false,
  doorUnlocked: false,
  foundAP: false,
  currentPerms: '000',

  processCommand(args, engine) {
    const cmd = args[0];
    switch (cmd) {
      case 'help':
        engine.terminal.writeLines([
          'ステージコマンド:',
          '  ls [path]     - ディレクトリ内容を表示',
          '  cat <file>    - ファイル内容を表示',
          '  mount <dev> <dir> - デバイスをマウント',
          '  chmod <mode> <file> - パーミッション変更',
        ], 'system');
        writeGlobalHelp(engine.terminal);
        break;
      case 'ls': {
        const path = args[1] || this.cwd;
        const resolved = resolvePath(path, this.cwd);
        const entries = this.getDirectoryEntries(resolved);
        if (entries) {
          engine.terminal.writeLines(entries);
        } else {
          engine.terminal.writeError(`ls: ${path}: No such file or directory`);
        }
        break;
      }
      case 'cat': {
        const file = args[1];
        if (!file) { engine.terminal.writeError('cat: ファイルを指定してください'); break; }
        const allFs = { ...this.filesystem };
        if (this.hddMounted) Object.assign(allFs, this.hddFilesystem);
        const result = lookupFile(file, allFs, this.cwd);
        if (result.found && result.content) {
          engine.terminal.writeLines(result.content.split('\n'));
        } else if (result.found && result.content === null) {
          engine.terminal.writeError(`cat: ${file}: Is a directory`);
        } else {
          engine.terminal.writeError(`cat: ${file}: No such file or directory`);
        }
        break;
      }
      case 'mount': {
        if (!this.hddInserted) {
          engine.terminal.writeError('mount: HDDが接続されていません');
          break;
        }
        if (this.hddMounted) {
          engine.terminal.writeError('mount: /mnt/hdd is already mounted');
          break;
        }
        const dev = args[1];
        const dir = args[2];
        if (dev === '/dev/sdb1' && (dir === '/mnt/hdd' || dir === '/mnt')) {
          this.hddMounted = true;
          engine.terminal.writeLines([
            `mount: /dev/sdb1 on /mnt/hdd type ext4 (rw,relatime)`,
            'マウント完了。',
          ], 'success');
        } else if (!dev || !dir) {
          engine.terminal.writeError('Usage: mount /dev/sdb1 /mnt/hdd');
        } else {
          engine.terminal.writeError(`mount: ${dev}: not found`);
        }
        break;
      }
      case 'chmod': {
        const mode = args[1];
        const file = args[2];
        if (!mode || !file) {
          engine.terminal.writeError('Usage: chmod <mode> <file>');
          break;
        }
        if (file === '/sys/door/door_lock' || file === 'door_lock') {
          if (mode === '500' || mode === 'u+rx' || mode === 'u=rx') {
            this.doorUnlocked = true;
            this.currentPerms = '500';
            const doorObj = engine.room.getObject('door_status');
            if (doorObj) { doorObj.unlocked = true; doorObj.perms = '500'; }
            const exitObj = engine.room.getObject('exit');
            if (exitObj) exitObj.unlocked = true;
            engine.effects.flash();
            engine.terminal.writeSuccess('[SYSTEM] パーミッション変更完了。ドアがアンロックされた。');
          } else {
            this.currentPerms = mode;
            const doorObj = engine.room.getObject('door_status');
            if (doorObj) doorObj.perms = mode;
            engine.terminal.writeError(`[SYSTEM] パーミッション ${mode} ではドアは開きません。`);
            engine.effects.glitch();
            engine.terminal.writeAI('> 権限が足りないようですね。永遠にここにいてもいいんですよ。');
          }
        } else {
          engine.terminal.writeError(`chmod: ${file}: No such file or directory`);
        }
        break;
      }
      default:
        return false;
    }
    return true;
  },

  getDirectoryEntries(path) {
    const dirs = {
      '/': ['sys/'].concat(this.hddMounted ? ['mnt/'] : []),
      '/sys': ['door/'],
      '/sys/door': ['README', 'door_lock'],
      '/mnt': this.hddMounted ? ['hdd/'] : [],
      '/mnt/hdd': this.hddMounted ? ['note.txt', 'ai_design.txt'] : [],
    };
    const clean = path.replace(/\/+$/, '') || '/';
    return dirs[clean] || null;
  },
};


// ----- Stage 4: Power Control Room -----
export const stage4 = {
  id: 4,
  name: 'Stage 4 — 電源制御室',

  roomData: {
    title: '電源制御室',
    tiles: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,0,1,1,1,1,1,1,1],
    ],
    objects: [
      { x:3, y:2, type:'floor_map', id:'floor_map', label:'フロアマップ', walkable:false },
      { x:10, y:2, type:'terminal', id:'terminal', label:'ターミナル', walkable:false },
      { x:10, y:6, type:'desk', id:'desk', label:'デスク', walkable:false },
      { x:6, y:9, type:'door', id:'exit', label:'ドア', walkable:false, unlocked:false },
    ],
    playerStart: { x:7, y:8 },
  },

  onInteract(objectId, game) {
    switch(objectId) {
      case 'terminal':
        game.openTerminal();
        break;
      case 'floor_map':
        if (!game.engine.hasItem('wireless_ap') && !this.networkRestored) {
          game.showMessage('無線APが必要だ。');
          break;
        }
        game.openPanel('フロアマップ — 無線AP配置', (container) => this.renderFloorMapPanel(game, container));
        break;
      case 'desk':
        if (this.foundUSB) {
          game.showMessage('もう調べた。何もない。');
        } else {
          this.foundUSB = true;
          game.engine.addItem({ id: 'usb', name: 'USBメモリ', icon: '🔑', hint: 'AIコアルームの端末に挿入 → mountでマウント' });
          game.effects.showNotification('USBメモリ を入手した', 'item-get');
          game.renderInventory();
          game.showMessage('USBメモリを発見した！');
        }
        break;
      case 'exit':
        if (this.solved) {
          game.engine.nextStage();
        } else {
          game.showMessage('サービスが停止されていない。');
        }
        break;
    }
  },

  renderFloorMapPanel(game, container) {
    container.innerHTML = `
      <div>
        <p style="color:var(--amber);font-size:12px;margin-bottom:8px;">
          クリックで無線APを配置（全端末をカバーせよ）
        </p>
        <div class="floor-map" id="floor-map"></div>
        <p id="ap-status" style="font-size:11px;margin-top:8px;color:#555;">
          ${this.networkRestored ? '✓ 全端末がオンライン' : 'APを設置して全端末をカバーせよ'}
        </p>
        ${this.networkRestored ? `
          <div style="margin-top:16px;">
            <p style="color:var(--amber);font-size:12px;margin-bottom:8px;">【サービス状態】</p>
            <div class="service-list" id="service-list"></div>
          </div>
        ` : ''}
      </div>`;

    this._renderFloorMap(game);
    if (this.networkRestored) this._renderServices();
  },

  _renderFloorMap(game) {
    const mapEl = document.getElementById('floor-map');
    if (!mapEl) return;
    mapEl.innerHTML = '';

    const coveredCells = this.apPlaced ? this.getCoverage(this.apPlaced.r, this.apPlaced.c) : new Set();

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement('div');
        cell.className = 'floor-cell';
        const val = this.floorMap[r][c];
        const key = `${r},${c}`;

        if (val === 1) {
          cell.classList.add('wall');
          cell.textContent = '█';
        } else if (val === 2) {
          cell.classList.add('terminal-cell');
          cell.textContent = '🖥';
          if (coveredCells.has(key)) {
            cell.style.background = 'rgba(0,255,65,0.15)';
          }
        } else {
          if (this.apPlaced && this.apPlaced.r === r && this.apPlaced.c === c) {
            cell.classList.add('ap-placed');
            cell.textContent = '📡';
          } else if (coveredCells.has(key)) {
            cell.classList.add('in-range');
          }
        }

        if (val !== 1 && val !== 2 && !this.networkRestored) {
          cell.addEventListener('click', () => this._placeAP(r, c, game));
        }

        mapEl.appendChild(cell);
      }
    }
  },

  getCoverage(ar, ac) {
    const covered = new Set();
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.floorMap[r][c] === 1) continue;
        const dist = Math.abs(r - ar) + Math.abs(c - ac);
        if (dist <= this.apRange) {
          let blocked = false;
          if (r === ar) {
            const minC = Math.min(c, ac), maxC = Math.max(c, ac);
            for (let cc = minC; cc <= maxC; cc++) {
              if (this.floorMap[r][cc] === 1) { blocked = true; break; }
            }
          } else if (c === ac) {
            const minR = Math.min(r, ar), maxR = Math.max(r, ar);
            for (let rr = minR; rr <= maxR; rr++) {
              if (this.floorMap[rr][c] === 1) { blocked = true; break; }
            }
          }
          if (!blocked) covered.add(`${r},${c}`);
        }
      }
    }
    return covered;
  },

  _placeAP(r, c, game) {
    if (this.networkRestored) return;
    if (this.floorMap[r][c] === 1 || this.floorMap[r][c] === 2) return;

    this.apPlaced = { r, c };
    const covered = this.getCoverage(r, c);
    const allCovered = this.terminals.every(t => covered.has(`${t.r},${t.c}`));

    this._renderFloorMap(game);

    if (allCovered) {
      this.networkRestored = true;
      game.engine.useItem('wireless_ap');
      game.renderInventory();
      document.getElementById('ap-status').textContent = '✓ 全端末がオンライン';
      document.getElementById('ap-status').style.color = 'var(--green)';
      game.effects.flash();
      game.terminal.writeSuccess('[SYSTEM] 全端末のネットワークが復旧した。');
      game.terminal.writeSystem('[HINT] systemctl でサービスを正しい順序で停止せよ。');
      // Re-render panel to show service list
      setTimeout(() => {
        this.renderFloorMapPanel(game, document.getElementById('panel-content'));
      }, 500);
    } else {
      const coveredCount = this.terminals.filter(t => covered.has(`${t.r},${t.c}`)).length;
      document.getElementById('ap-status').textContent = `端末カバー: ${coveredCount}/4 — 全端末をカバーする位置に再配置せよ`;
      document.getElementById('ap-status').style.color = 'var(--amber)';
      game.terminal.writeError(`[SYSTEM] ${4 - coveredCount}台の端末が電波範囲外です。`);
      this.apPlaced = null;
    }
  },

  _renderServices() {
    const list = document.getElementById('service-list');
    if (!list) return;
    list.innerHTML = this.services.map(s => `
      <div class="service-item">
        <span class="service-status ${s.running ? 'running' : 'stopped'}"></span>
        <span style="color:${s.running ? 'var(--green)' : '#555'}">${s.name}</span>
        <span style="color:#555;font-size:11px;margin-left:auto;">
          ${s.dependsOn ? `← ${s.dependsOn}` : '(root)'}
        </span>
      </div>
    `).join('');
  },

  filesystem: {
    '/etc/systemd/dependencies.txt': `[サービス依存関係]
ai-monitor.service   → depends on: ai-network.service
ai-sensor.service    → depends on: ai-network.service
ai-network.service   → depends on: ai-core.service
ai-core.service      → depends on: (なし)

※依存される側を先に停止すると、依存するサービスが暴走する恐れあり
※正しい停止順序: 依存する側(葉)から順に停止すること`,
    '/var/log/power.log': `[03:30:01] 電源系統A: 正常
[03:30:02] 電源系統B: 正常
[03:30:03] AI-CORE: 電力消費量 異常上昇中
[03:30:05] WARNING: AI制御による電力再分配を検出`,
    '/etc/systemd': null,
    '/etc': null,
    '/var/log': null,
  },

  floorMap: [
    [0,0,0,0,1,0,0,0],
    [0,2,0,0,1,0,2,0],
    [0,0,0,0,0,0,0,0],
    [0,0,1,1,1,1,0,0],
    [0,2,0,0,0,0,2,0],
    [0,0,0,0,0,0,0,0],
  ],
  terminals: [{r:1,c:1},{r:1,c:6},{r:4,c:1},{r:4,c:6}],
  apPlaced: null,
  apRange: 3,
  networkRestored: false,

  services: [
    { name: 'ai-monitor.service', running: true, dependsOn: 'ai-network.service' },
    { name: 'ai-sensor.service', running: true, dependsOn: 'ai-network.service' },
    { name: 'ai-network.service', running: true, dependsOn: 'ai-core.service' },
    { name: 'ai-core.service', running: true, dependsOn: null },
  ],
  stopOrder: [],
  solved: false,
  foundUSB: false,

  cwd: '/',
  availableCommands: ['ls', 'cat', 'systemctl', 'help'],

  processCommand(args, engine) {
    const cmd = args[0];
    switch (cmd) {
      case 'help':
        engine.terminal.writeLines([
          'ステージコマンド:',
          '  ls [path]           - ディレクトリ内容を表示',
          '  cat <file>          - ファイル内容を表示',
          '  systemctl stop <svc> - サービスを停止',
          '  systemctl status     - サービス状態一覧',
        ], 'system');
        writeGlobalHelp(engine.terminal);
        break;
      case 'ls': {
        const path = args[1] || this.cwd;
        const resolved = resolvePath(path, this.cwd);
        const entries = this.getDirectoryEntries(resolved);
        if (entries) {
          engine.terminal.writeLines(entries);
        } else {
          engine.terminal.writeError(`ls: ${path}: No such file or directory`);
        }
        break;
      }
      case 'cat': {
        const file = args[1];
        if (!file) { engine.terminal.writeError('cat: ファイルを指定してください'); break; }
        const result = lookupFile(file, this.filesystem, this.cwd);
        if (result.found && result.content) {
          engine.terminal.writeLines(result.content.split('\n'));
        } else if (result.found && result.content === null) {
          engine.terminal.writeError(`cat: ${file}: Is a directory`);
        } else {
          engine.terminal.writeError(`cat: ${file}: No such file or directory`);
        }
        break;
      }
      case 'systemctl': {
        if (!this.networkRestored) {
          engine.terminal.writeError('[SYSTEM] ネットワーク未復旧。端末がオフラインです。');
          break;
        }
        const action = args[1];
        if (action === 'status') {
          this.services.forEach(s => {
            engine.terminal.writeLine(
              `  ${s.running ? '●' : '○'} ${s.name} - ${s.running ? 'active (running)' : 'inactive (dead)'}`,
              s.running ? '' : 'system'
            );
          });
          break;
        }
        if (action === 'stop') {
          const svcName = args[2];
          if (!svcName) { engine.terminal.writeError('Usage: systemctl stop <service>'); break; }
          const svc = this.services.find(s => s.name === svcName);
          if (!svc) { engine.terminal.writeError(`systemctl: ${svcName}: not found`); break; }
          if (!svc.running) { engine.terminal.writeSystem(`${svcName} is already stopped.`); break; }

          const dependent = this.services.find(s => s.running && s.dependsOn === svcName);
          if (dependent) {
            engine.effects.screenShake();
            engine.effects.glitch();
            engine.terminal.writeError(`[ERROR] ${dependent.name} が ${svcName} に依存しています！`);
            engine.terminal.writeAI('> 依存関係を無視するとは...面白い判断ですね。');
            engine.terminal.writeError('[WARNING] 先に依存するサービスを停止してください。');
            break;
          }

          svc.running = false;
          this.stopOrder.push(svcName);
          engine.terminal.writeSuccess(`Stopping ${svcName}... OK`);
          this._renderServices();

          if (this.services.every(s => !s.running)) {
            this.solved = true;
            const door = engine.room.getObject('exit');
            if (door) door.unlocked = true;
            engine.effects.flash();
            engine.terminal.writeSuccess('[SYSTEM] 全サービスを正常に停止した。');
            engine.terminal.writeSystem('[SYSTEM] 次の部屋への扉がアンロックされた。');
          }
          break;
        }
        engine.terminal.writeError('Usage: systemctl [status|stop <service>]');
        break;
      }
      default:
        return false;
    }
    return true;
  },

  getDirectoryEntries(path) {
    const dirs = {
      '/': ['etc/', 'var/'],
      '/etc': ['systemd/'],
      '/etc/systemd': ['dependencies.txt'],
      '/var': ['log/'],
      '/var/log': ['power.log'],
    };
    const clean = path.replace(/\/+$/, '') || '/';
    return dirs[clean] || null;
  },
};


// ----- Stage 5: AI Core Room -----
export const stage5 = {
  id: 5,
  name: 'Stage 5 — AIコアルーム',

  roomData: {
    title: 'AIコアルーム',
    tiles: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,0,2,0,0,0,0,0,2,0,2,0,1],
      [1,2,0,2,0,0,0,0,0,2,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    objects: [
      { x:6, y:2, type:'core_server', id:'core', label:'AIコアサーバー', walkable:false, interactable:false },
      { x:7, y:2, type:'core_server', id:'core2', label:'AIコアサーバー', walkable:false, interactable:false },
      { x:10, y:5, type:'usb_slot', id:'usb_slot', label:'USBスロット', walkable:false, filled:false },
      { x:3, y:5, type:'terminal', id:'terminal', label:'ターミナル', walkable:false },
    ],
    playerStart: { x:6, y:7 },
  },

  onInteract(objectId, game) {
    switch(objectId) {
      case 'terminal':
        game.openTerminal();
        break;
      case 'usb_slot': {
        if (this.usbInserted) {
          game.showMessage('USBは既に接続されている。');
          break;
        }
        if (!game.engine.hasItem('usb')) {
          game.showMessage('USBメモリを持っていない。');
          break;
        }
        this.usbInserted = true;
        game.engine.useItem('usb');
        const slot = game.room.getObject('usb_slot');
        if (slot) slot.filled = true;
        game.effects.showNotification('USBメモリを接続した', 'item-get');
        game.terminal.writeSystem('[SYSTEM] /dev/sdc1 が検出されました。mountコマンドでマウントしてください。');
        game.renderInventory();
        break;
      }
    }
  },

  filesystem: {
    '/proc/status': `System: AI Control Core v3.1
Uptime: 847 days
Status: ACTIVE - LOCKDOWN MODE
Warning: Unauthorized access detected`,
  },

  usbFilesystem: {
    '/mnt/usb/emergency_shutdown.txt': `【緊急停止手順書】
1. ps aux でプロセス一覧を確認
2. "overlord" プロセスのPIDを特定
3. kill -9 <PID> で強制終了

注意: 子プロセスをkillしても自動で再起動される。
必ず overlord 本体のPIDを指定すること。

子プロセスのPIDを指定した場合、
AIが防衛モードに移行する可能性あり。`,
    '/mnt/usb': null,
  },

  processTree: [
    { pid: 1,   ppid: 0,   user: 'root', command: '/sbin/init' },
    { pid: 142, ppid: 1,   user: 'root', command: '/usr/sbin/sshd' },
    { pid: 203, ppid: 1,   user: 'root', command: 'overlord --mode=control' },
    { pid: 310, ppid: 203, user: 'ai',   command: 'sensor-daemon' },
    { pid: 311, ppid: 203, user: 'ai',   command: 'camera-controller' },
    { pid: 312, ppid: 203, user: 'ai',   command: 'door-lock-manager' },
    { pid: 350, ppid: 312, user: 'ai',   command: 'lock-worker-1' },
    { pid: 351, ppid: 312, user: 'ai',   command: 'lock-worker-2' },
    { pid: 418, ppid: 203, user: 'ai',   command: 'termination-protocol' },
  ],

  correctPID: 203,
  cwd: '/',
  availableCommands: ['ls', 'cat', 'ps', 'kill', 'mount', 'help'],
  usbInserted: false,
  usbMounted: false,
  solved: false,

  processCommand(args, engine) {
    const cmd = args[0];
    switch (cmd) {
      case 'help':
        engine.terminal.writeLines([
          'ステージコマンド:',
          '  ls [path]     - ディレクトリ内容を表示',
          '  cat <file>    - ファイル内容を表示',
          '  ps aux        - プロセス一覧',
          '  kill -9 <PID> - プロセスを強制終了',
          '  mount <dev> <dir> - デバイスをマウント',
        ], 'system');
        writeGlobalHelp(engine.terminal);
        break;
      case 'ls': {
        const path = args[1] || this.cwd;
        const resolved = resolvePath(path, this.cwd);
        const entries = this.getDirectoryEntries(resolved);
        if (entries) {
          engine.terminal.writeLines(entries);
        } else {
          engine.terminal.writeError(`ls: ${path}: No such file or directory`);
        }
        break;
      }
      case 'cat': {
        const file = args[1];
        if (!file) { engine.terminal.writeError('cat: ファイルを指定してください'); break; }
        const allFs = { ...this.filesystem };
        if (this.usbMounted) Object.assign(allFs, this.usbFilesystem);
        const result = lookupFile(file, allFs, this.cwd);
        if (result.found && result.content) {
          engine.terminal.writeLines(result.content.split('\n'));
        } else if (result.found && result.content === null) {
          engine.terminal.writeError(`cat: ${file}: Is a directory`);
        } else {
          engine.terminal.writeError(`cat: ${file}: No such file or directory`);
        }
        break;
      }
      case 'mount': {
        if (!this.usbInserted) {
          engine.terminal.writeError('mount: デバイスが接続されていません');
          break;
        }
        if (this.usbMounted) {
          engine.terminal.writeError('mount: /mnt/usb is already mounted');
          break;
        }
        const dev = args[1];
        const dir = args[2];
        if (dev === '/dev/sdc1' && (dir === '/mnt/usb' || dir === '/mnt')) {
          this.usbMounted = true;
          engine.terminal.writeLines([
            `mount: /dev/sdc1 on /mnt/usb type vfat (ro,relatime)`,
            'マウント完了。',
          ], 'success');
        } else if (!dev || !dir) {
          engine.terminal.writeError('Usage: mount /dev/sdc1 /mnt/usb');
        } else {
          engine.terminal.writeError(`mount: ${dev}: not found`);
        }
        break;
      }
      case 'ps': {
        engine.terminal.writeLine('PID    PPID   USER    COMMAND', 'system');
        this.processTree.forEach(p => {
          const line = `${String(p.pid).padEnd(7)}${String(p.ppid).padEnd(7)}${p.user.padEnd(8)}${p.command}`;
          const cls = p.command.includes('overlord') ? 'error' :
                     p.command.includes('termination') ? 'error' : '';
          engine.terminal.writeLine(line, cls);
        });
        break;
      }
      case 'kill': {
        const signal = args[1];
        const pidStr = args[2] || args[1];
        let pid;

        if (signal === '-9' && args[2]) {
          pid = parseInt(args[2]);
        } else if (signal && !signal.startsWith('-')) {
          pid = parseInt(signal);
        } else if (signal === '-9' && !args[2]) {
          engine.terminal.writeError('Usage: kill -9 <PID>');
          break;
        } else {
          engine.terminal.writeError('Usage: kill -9 <PID>');
          break;
        }

        if (isNaN(pid)) {
          engine.terminal.writeError(`kill: invalid PID`);
          break;
        }

        const proc = this.processTree.find(p => p.pid === pid);
        if (!proc) {
          engine.terminal.writeError(`kill: (${pid}): No such process`);
          break;
        }

        if (pid === this.correctPID) {
          this.solved = true;
          engine.terminal.writeSuccess(`[SYSTEM] Process ${pid} (overlord) terminated.`);
          engine.effects.screenShake();
          setTimeout(() => {
            engine.terminal.writeAI('> な...なぜ...私のPIDを...知って...');
            setTimeout(() => {
              engine.terminal.writeAI('> シス...テム...シャット...ダ......');
              setTimeout(() => {
                engine.effects.staticNoise();
                engine.terminal.writeSuccess('[SYSTEM] AI CORE: OFFLINE');
                engine.terminal.writeSuccess('[SYSTEM] LOCKDOWN: RELEASED');
                engine.terminal.writeSuccess('[SYSTEM] 全ドアのロックが解除されました。');
                setTimeout(() => engine.engine.endGame('good'), 3000);
              }, 2000);
            }, 1500);
          }, 1000);
        } else if (pid === 1) {
          engine.effects.screenShake();
          engine.terminal.writeError('[SYSTEM] PID 1 (init) は停止できません。');
          engine.terminal.writeAI('> initをkill？ 面白い冗談ですね。');
        } else {
          engine.effects.screenShake();
          engine.effects.flash();
          engine.terminal.writeError(`[SYSTEM] Process ${pid} terminated... but respawning.`);
          setTimeout(() => {
            engine.terminal.writeAI('> 子プロセスを狙いましたね。無駄です。');
            setTimeout(() => {
              engine.terminal.writeAI('> 防衛モードに移行します。');
              setTimeout(() => {
                engine.terminal.writeAI('> あなたのプロセスを...終了します。');
                setTimeout(() => engine.engine.endGame('bad'), 2000);
              }, 1500);
            }, 1500);
          }, 1000);
        }
        break;
      }
      default:
        return false;
    }
    return true;
  },

  getDirectoryEntries(path) {
    const dirs = {
      '/': ['proc/'].concat(this.usbMounted ? ['mnt/'] : []),
      '/proc': ['status'],
      '/mnt': this.usbMounted ? ['usb/'] : [],
      '/mnt/usb': this.usbMounted ? ['emergency_shutdown.txt'] : [],
    };
    const clean = path.replace(/\/+$/, '') || '/';
    return dirs[clean] || null;
  },
};
