// =====================================================================
// ui.js – Menüs und Meldungen (HTML über dem Spielbild)
// ---------------------------------------------------------------------
// Jeder Knopf mit data-action="xyz" ruft den Handler auf, der mit
// ui.on('xyz', ...) registriert wurde.
// =====================================================================

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.root = $('ui');
    this.screens = {};
    for (const el of this.root.querySelectorAll('.screen')) this.screens[el.id.replace('screen-', '')] = el;
    this.handlers = {};
    this.current = null;
    this.onClick = null;
    this.messageCallback = null;
    this.padPrev = new Map();
    this.toastTimer = 0;

    this.root.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button || button.disabled) return;
      if (this.onClick) this.onClick();
      this.emit(button.dataset.action, button);
    });
    this.on('message-ok', () => {
      const cb = this.messageCallback;
      this.messageCallback = null;
      if (cb) cb();
    });
  }

  on(action, fn) {
    this.handlers[action] = fn;
  }

  emit(action, el) {
    const fn = this.handlers[action];
    if (fn) fn(el);
  }

  /** Einen Bildschirm zeigen (oder mit null alle verstecken). */
  show(name) {
    for (const [key, el] of Object.entries(this.screens)) el.classList.toggle('visible', key === name);
    this.current = name;
    if (name) {
      const first = this.visibleButtons()[0];
      if (first && !matchMedia('(pointer: coarse)').matches) first.focus({ preventScroll: true });
    } else if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  hide() {
    this.show(null);
  }

  isOpen() {
    return this.current !== null;
  }

  setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  setStatus(id, text, isError = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', isError);
  }

  /** Große Meldung mit OK-Knopf. */
  message(title, text, onOk) {
    this.setText('message-title', title);
    this.setText('message-text', text);
    this.messageCallback = onOk || null;
    this.show('message');
  }

  /** Kurze Einblendung unten. */
  toast(text, ms = 2200) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
  }

  visibleButtons() {
    if (!this.current) return [];
    return Array.from(this.screens[this.current].querySelectorAll('button')).filter(
      (b) => !b.hidden && !b.disabled && b.offsetParent !== null
    );
  }

  // Menü mit dem Gamepad bedienen: Steuerkreuz/Stick hoch/runter, A = auswählen
  pollGamepads() {
    // Läuft jedes Bild, damit ein schon gedrückter Knopf nicht sofort einen Menüpunkt auslöst
    if (!navigator.getGamepads) return;
    for (const pad of navigator.getGamepads()) {
      if (!pad) continue;
      const ay = pad.axes[1] || 0;
      const now = {
        up: (pad.buttons[12] && pad.buttons[12].pressed) || ay < -0.6 || (pad.buttons[14] && pad.buttons[14].pressed),
        down: (pad.buttons[13] && pad.buttons[13].pressed) || ay > 0.6 || (pad.buttons[15] && pad.buttons[15].pressed),
        ok: pad.buttons[0] && pad.buttons[0].pressed,
      };
      const prev = this.padPrev.get(pad.index) || {};
      this.padPrev.set(pad.index, now);
      if (!this.current) continue;
      const buttons = this.visibleButtons();
      if (!buttons.length) continue;
      let index = buttons.indexOf(document.activeElement);
      if (now.up && !prev.up) index = index <= 0 ? buttons.length - 1 : index - 1;
      else if (now.down && !prev.down) index = index < 0 || index >= buttons.length - 1 ? 0 : index + 1;
      else if (now.ok && !prev.ok && index >= 0) {
        buttons[index].click();
        continue;
      } else continue;
      buttons[index].focus({ preventScroll: true });
    }
  }
}
