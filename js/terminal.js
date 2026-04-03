// ===== TERMINAL EMULATOR =====

export class Terminal {
  constructor(onCommand) {
    this.outputEl = document.getElementById('terminal-output');
    this.inputEl = document.getElementById('terminal-input');
    this.onCommand = onCommand;
    this.onTabComplete = null; // set by Game
    this.history = [];
    this.historyIndex = -1;
    this.enabled = true;

    this.inputEl.addEventListener('keydown', (e) => this.handleKey(e));
  }

  handleKey(e) {
    if (!this.enabled) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (this.onTabComplete) {
        const result = this.onTabComplete(this.inputEl.value);
        if (result) {
          this.inputEl.value = result.completed;
          if (result.candidates && result.candidates.length > 1) {
            this.writeLine(`$ ${this.inputEl.value}`, 'input');
            this.writeLines(result.candidates, 'system');
          }
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      const cmd = this.inputEl.value.trim();
      if (cmd) {
        this.history.push(cmd);
        this.historyIndex = this.history.length;
        this.writeLine(`$ ${cmd}`, 'input');
        this.inputEl.value = '';
        this.onCommand(cmd);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.inputEl.value = this.history[this.historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.inputEl.value = this.history[this.historyIndex];
      } else {
        this.historyIndex = this.history.length;
        this.inputEl.value = '';
      }
    }
  }

  writeLine(text, className = '') {
    const line = document.createElement('div');
    line.className = `output-line ${className}`;
    line.textContent = text;
    this.outputEl.appendChild(line);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  writeLines(lines, className = '') {
    lines.forEach(l => this.writeLine(l, className));
  }

  writeError(text) {
    this.writeLine(text, 'error');
  }

  writeSystem(text) {
    this.writeLine(text, 'system');
  }

  writeAI(text) {
    this.writeLine(text, 'ai-message');
  }

  writeSuccess(text) {
    this.writeLine(text, 'success');
  }

  clear() {
    this.outputEl.innerHTML = '';
  }

  focus() {
    this.inputEl.focus();
  }

  disable() {
    this.enabled = false;
    this.inputEl.disabled = true;
  }

  enable() {
    this.enabled = true;
    this.inputEl.disabled = false;
    this.focus();
  }
}
