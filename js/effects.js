// ===== HORROR EFFECTS =====

export class HorrorEffects {
  constructor() {
    this.overlay = document.getElementById('horror-overlay');
    this.horrorLevel = 0;
  }

  glitch() {
    this.overlay.className = 'glitch';
    setTimeout(() => { this.overlay.className = ''; }, 300);
  }

  flash() {
    this.overlay.className = 'flash';
    setTimeout(() => { this.overlay.className = ''; }, 500);
  }

  staticNoise() {
    this.overlay.className = 'static';
    setTimeout(() => { this.overlay.className = ''; }, 2000);
  }

  screenShake() {
    const container = document.getElementById('game-container');
    container.style.transition = 'transform 0.05s';
    let count = 0;
    const shake = setInterval(() => {
      const x = (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 10;
      container.style.transform = `translate(${x}px, ${y}px)`;
      count++;
      if (count > 10) {
        clearInterval(shake);
        container.style.transform = 'translate(0, 0)';
      }
    }, 50);
  }

  flicker(element, duration = 2000) {
    const start = Date.now();
    const interval = setInterval(() => {
      element.style.opacity = Math.random() > 0.5 ? '1' : '0.3';
      if (Date.now() - start > duration) {
        clearInterval(interval);
        element.style.opacity = '1';
      }
    }, 80);
  }

  typewriterScare(element, text, speed = 60) {
    return new Promise(resolve => {
      let i = 0;
      element.textContent = '';
      const interval = setInterval(() => {
        element.textContent += text[i];
        i++;
        if (i >= text.length) {
          clearInterval(interval);
          resolve();
        }
      }, speed);
    });
  }

  async showNotification(message, type = 'item-get', duration = 3000) {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transition = 'opacity 0.3s';
      setTimeout(() => notif.remove(), 300);
    }, duration);
  }

  randomAmbientEffect() {
    const effects = [
      () => this.glitch(),
      () => this.flicker(document.getElementById('main-view'), 500),
    ];
    const idx = Math.floor(Math.random() * effects.length);
    effects[idx]();
  }

  startAmbient(intervalMs = 30000) {
    this._ambientInterval = setInterval(() => {
      if (Math.random() < 0.4 + this.horrorLevel * 0.1) {
        this.randomAmbientEffect();
      }
    }, intervalMs);
  }

  stopAmbient() {
    if (this._ambientInterval) {
      clearInterval(this._ambientInterval);
      this._ambientInterval = null;
    }
  }

  increaseHorror() {
    this.horrorLevel = Math.min(this.horrorLevel + 1, 5);
  }
}
