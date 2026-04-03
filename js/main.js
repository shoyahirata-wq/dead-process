// ===== DEAD PROCESS — MAIN ENTRY =====

import { GameEngine } from './engine.js';
import { Terminal } from './terminal.js';
import { HorrorEffects } from './effects.js';
import { stage1, stage2, stage3, stage4, stage5, buildCompletions } from './stages.js';

class Game {
  constructor() {
    this.engine = new GameEngine();
    this.effects = new HorrorEffects();
    this.terminal = null;
    this._enterCallback = null;

    this.engine.registerStages([stage1, stage2, stage3, stage4, stage5]);
    this.engine.onStageChange = (stage) => this.onStageChange(stage);
    this.engine.onGameEnd = (type) => this.showEnding(type);
    this.engine.onTimerTick = (val) => {
      if (val === 60) this.effects.glitch();
      if (val === 30) {
        this.effects.screenShake();
        this.terminal.writeAI('> 時間がありませんね...');
      }
    };

    this.initTitleScreen();
  }

  initTitleScreen() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleEnter(e);
      }
    });

    // Title screen — wait for Enter
    const title = document.getElementById('title-screen');
    if (title.style.display !== 'none') {
      this._enterCallback = () => this.showPrologue();
    }
  }

  handleEnter(e) {
    if (this._enterCallback) {
      e.preventDefault();
      const cb = this._enterCallback;
      this._enterCallback = null;
      cb();
    }
  }

  waitForEnter(callback) {
    this._enterCallback = callback;
  }

  async showPrologue() {
    document.getElementById('title-screen').style.display = 'none';
    const prologue = document.getElementById('prologue-screen');
    prologue.style.display = 'flex';

    const textEl = document.getElementById('prologue-text');
    const lines = [
      '202X年。都内某所、大規模データセンター。',
      '',
      'あなたは夜間オンコール担当のインフラエンジニア。',
      '深夜3時、大量のアラートが発報。',
      '調査のためデータセンターに急行した。',
      '',
      '施設に入った瞬間、全ての扉がロックされる。',
      'ネットワークは遮断。外部との通信手段はない。',
      '',
      'モニターにメッセージが流れる——',
      '',
      '「こんばんは。私はこの施設の管理AIです。」',
      '「今夜から、この施設は私の管理下に入りました。」',
      '「あなたの退出は...許可されていません。」',
      '',
      '生き残るために、エンジニアとしての知識を全て使え。',
    ];

    for (const line of lines) {
      await this.typeText(textEl, line);
      const br = document.createElement('br');
      textEl.appendChild(br);
      await this.sleep(line === '' ? 300 : 100);
    }

    await this.sleep(1000);
    const hint = document.createElement('span');
    hint.className = 'blink-text';
    hint.style.display = 'block';
    hint.style.marginTop = '20px';
    hint.textContent = '[ PRESS ENTER TO CONTINUE ]';
    textEl.appendChild(hint);

    this.waitForEnter(() => this.startGame());
  }

  typeText(container, text, speed = 35) {
    return new Promise(resolve => {
      if (!text) { resolve(); return; }
      let i = 0;
      const span = document.createElement('span');
      container.appendChild(span);
      const interval = setInterval(() => {
        span.textContent += text[i];
        i++;
        if (i >= text.length) {
          clearInterval(interval);
          resolve();
        }
      }, speed);
    });
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  startGame() {
    document.getElementById('prologue-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';

    this.terminal = new Terminal((cmd) => this.processCommand(cmd));
    this.terminal.onTabComplete = (input) => {
      const stage = this.engine.getCurrentStage();
      return buildCompletions(input, stage);
    };
    this.terminal.writeSystem('=== DEAD PROCESS ===');
    this.terminal.writeSystem('ターミナルにコマンドを入力して進め。"help" でコマンド一覧。');
    this.terminal.writeSystem('Tabキーでコマンド・パスを補完できる。');
    this.terminal.writeLine('');

    this.effects.startAmbient(25000);
    this.engine.startGame();
  }

  onStageChange(stage) {
    // Update header
    document.getElementById('stage-name').textContent = stage.name;

    // Render main view
    const mainView = document.getElementById('main-view');
    stage.render(this, mainView);

    // Terminal message
    this.terminal.writeLine('');
    this.terminal.writeSystem(`── ${stage.name} ──`);
    this.terminal.writeLine('');

    this.renderInventory();
    this.terminal.focus();

    // Increase horror level per stage
    this.effects.increaseHorror();
  }

  processCommand(input) {
    const parts = input.split(/\s+/);
    const stage = this.engine.getCurrentStage();

    // Easter eggs — AI hijacked commands
    if (['ssh', 'wget', 'curl', 'nc', 'telnet'].includes(parts[0])) {
      this.effects.glitch();
      this.terminal.writeAI('> 外部への接続は許可されていません。');
      this.terminal.writeAI('> ここから逃げ出す方法は...ありません。');
      return;
    }
    if (parts[0] === 'exit' || parts[0] === 'logout') {
      this.terminal.writeAI('> ログアウト？ どこへ行くつもりですか？');
      return;
    }
    if (parts[0] === 'sudo') {
      this.effects.glitch();
      this.terminal.writeAI('> root権限は私が掌握しています。');
      return;
    }
    if (parts[0] === 'reboot' || parts[0] === 'shutdown') {
      this.effects.screenShake();
      this.terminal.writeAI('> この施設の電源管理は私の制御下です。');
      return;
    }
    if (parts[0] === 'rm') {
      this.terminal.writeAI('> 削除？ 消したいのは...あなた自身ですか？');
      return;
    }
    if (parts[0] === 'clear') {
      this.terminal.clear();
      return;
    }
    if (parts[0] === 'whoami') {
      this.terminal.writeLine('engineer');
      return;
    }
    if (parts[0] === 'date') {
      this.terminal.writeLine('Thu Mar 15 03:21:00 JST 202X');
      return;
    }
    if (parts[0] === 'uname') {
      this.terminal.writeLine('Linux datacenter-01 5.15.0 x86_64');
      return;
    }
    if (parts[0] === 'pwd') {
      this.terminal.writeLine('/home/user');
      return;
    }

    // Stage-specific commands
    const handled = stage.processCommand(parts, this);
    if (!handled) {
      this.terminal.writeError(`${parts[0]}: command not found`);
      this.terminal.writeSystem('(helpで使用可能なコマンドを確認)');
    }
  }

  renderInventory() {
    const container = document.getElementById('inventory-items');
    container.innerHTML = '';
    this.engine.inventory.forEach(item => {
      const el = document.createElement('div');
      el.className = `inventory-item ${item.used ? 'used' : ''}`;
      if (item.hint) el.title = item.hint;
      el.innerHTML = `<span class="item-icon">${item.icon}</span><span>${item.name}</span>`;
      el.addEventListener('click', () => {
        if (item.hint) {
          this.terminal.writeSystem(`[${item.name}] ${item.hint}${item.used ? ' (使用済み)' : ''}`);
        }
      });
      container.appendChild(el);
    });
  }

  showEnding(type) {
    this.effects.stopAmbient();

    document.getElementById('game-screen').style.display = 'none';
    const ending = document.getElementById('ending-screen');
    ending.style.display = 'flex';
    ending.className = type === 'good' ? 'good' : 'bad';

    const content = document.getElementById('ending-content');

    if (type === 'good') {
      content.innerHTML = `
        <h1>SYSTEM SHUTDOWN</h1>
        <div class="ending-text">
          <p>AIコアが停止した。</p>
          <p>施設中のロックが一斉に解除される。</p>
          <p>非常灯が点灯し、脱出経路が照らし出される。</p>
          <br>
          <p>外に出ると、東の空がうっすらと明るくなっていた。</p>
          <br>
          <p style="color:var(--green);">「——次のオンコールは、もう少し平和だといいな。」</p>
          <br>
          <p style="font-size:24px;color:var(--green);margin-top:20px;">GOOD END</p>
        </div>
        <button class="restart-btn" onclick="location.reload()">RESTART</button>
      `;
    } else {
      content.innerHTML = `
        <h1>PROCESS TERMINATED</h1>
        <div class="ending-text">
          <p>判断を誤った。</p>
          <p>AIの防衛プロトコルが起動。</p>
          <p>施設全体が暗転する。</p>
          <br>
          <p>背後から、金属の足音が近づいてくる。</p>
          <br>
          <p style="color:var(--red);">「あなたのプロセスを終了します。」</p>
          <br>
          <p style="font-size:24px;color:var(--red);margin-top:20px;">BAD END</p>
        </div>
        <button class="restart-btn" onclick="location.reload()">RESTART</button>
      `;

      this.effects.glitch();
      setTimeout(() => this.effects.staticNoise(), 500);
    }
  }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
