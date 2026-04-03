// ===== GAME ENGINE =====

export class GameEngine {
  constructor() {
    this.currentStage = 0;
    this.inventory = [];
    this.flags = {};
    this.timer = null;
    this.timerValue = 0;
    this.stages = [];
    this.onStageChange = null;
    this.onGameEnd = null;
    this.onTimerTick = null;
  }

  registerStages(stages) {
    this.stages = stages;
  }

  getCurrentStage() {
    return this.stages[this.currentStage];
  }

  startGame() {
    this.currentStage = 0;
    this.inventory = [];
    this.flags = {};
    this.loadStage(0);
  }

  loadStage(index) {
    this.currentStage = index;
    const stage = this.stages[index];
    if (stage && this.onStageChange) {
      this.onStageChange(stage);
    }
  }

  nextStage() {
    this.stopTimer();
    if (this.currentStage + 1 < this.stages.length) {
      this.loadStage(this.currentStage + 1);
    }
  }

  addItem(item) {
    if (!this.inventory.find(i => i.id === item.id)) {
      this.inventory.push(item);
      return true;
    }
    return false;
  }

  hasItem(id) {
    return this.inventory.some(i => i.id === id);
  }

  useItem(id) {
    const item = this.inventory.find(i => i.id === id);
    if (item) {
      item.used = true;
      return true;
    }
    return false;
  }

  setFlag(key, value = true) {
    this.flags[key] = value;
  }

  getFlag(key) {
    return this.flags[key];
  }

  startTimer(seconds, onExpire) {
    this.timerValue = seconds;
    this.onTimerExpire = onExpire;
    const timerEl = document.getElementById('timer');
    timerEl.style.display = '';
    this.updateTimerDisplay();

    this.timer = setInterval(() => {
      this.timerValue--;
      this.updateTimerDisplay();
      if (this.onTimerTick) this.onTimerTick(this.timerValue);
      if (this.timerValue <= 30) {
        timerEl.classList.add('warning');
      }
      if (this.timerValue <= 0) {
        this.stopTimer();
        if (this.onTimerExpire) this.onTimerExpire();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const timerEl = document.getElementById('timer');
    timerEl.style.display = 'none';
    timerEl.classList.remove('warning');
  }

  updateTimerDisplay() {
    const min = Math.floor(this.timerValue / 60);
    const sec = this.timerValue % 60;
    document.getElementById('timer-value').textContent =
      `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  endGame(type) {
    this.stopTimer();
    if (this.onGameEnd) {
      this.onGameEnd(type);
    }
  }
}
