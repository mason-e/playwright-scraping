class ClearOlderModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.keepCounts = [1000, 750, 500, 300, 250, 200, 100];
    this.ageDays = [7, 14, 30, 45, 60];
    this.shadowRoot.innerHTML = `
      <style>
        :host { color: #e2e8f0; }
        dialog {
          width: min(520px, calc(100vw - 32px));
          max-height: calc(100dvh - 32px);
          padding: 0;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 8px;
          background: #111827;
          color: inherit;
        }
        dialog::backdrop { background: rgba(2, 6, 23, 0.72); }
        .content { display: grid; gap: 18px; padding: 22px; }
        h2 { margin: 0; font-size: 20px; }
        .cleanup-option { display: grid; gap: 12px; padding: 14px; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 6px; }
        label { display: flex; align-items: baseline; gap: 4px; color: #cbd5e1; font-size: 14px; }
        output { color: #f8fafc; font-weight: 600; }
        input[type="range"] { width: 100%; margin: 2px 0; accent-color: #60a5fa; }
        .ticks { display: flex; justify-content: space-between; gap: 6px; margin-top: -8px; color: #94a3b8; font-size: 12px; }
        button {
          justify-self: end;
          padding: 9px 12px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 4px;
          background: #0b1220;
          color: #e2e8f0;
          font: inherit;
          cursor: pointer;
        }
        button:hover { background: rgba(148, 163, 184, 0.12); }
        button:disabled { cursor: wait; opacity: 0.6; }
        .action-button { border-color: #60a5fa; background: #1d4ed8; }
        .status { min-height: 20px; margin: 0; color: #86efac; font-size: 14px; }
        .status.error { color: #fca5a5; }
        .footer { display: flex; justify-content: end; }
        @media (max-width: 480px) {
          .content { padding: 18px; }
          .ticks { font-size: 11px; }
        }
      </style>
      <dialog aria-labelledby="clear-older-title">
        <div class="content">
          <h2 id="clear-older-title">Clear Older Results</h2>
          <section class="cleanup-option" aria-label="Keep a number of recent entries">
            <label for="keep-count-range">Clear to last <output data-count-output>1000</output> entries</label>
            <input id="keep-count-range" data-count-range type="range" min="0" max="6" step="1" value="0" />
            <div class="ticks" aria-hidden="true"><span>1000</span><span>750</span><span>500</span><span>300</span><span>250</span><span>200</span><span>100</span></div>
            <button class="action-button" type="button" data-clear-count>Clear to last 1000 entries</button>
          </section>
          <section class="cleanup-option" aria-label="Clear entries by age">
            <label for="age-range">Clear older than <output data-age-output>60</output> days</label>
            <input id="age-range" data-age-range type="range" min="0" max="4" step="1" value="4" />
            <div class="ticks" aria-hidden="true"><span>7</span><span>14</span><span>30</span><span>45</span><span>60</span></div>
            <button class="action-button" type="button" data-clear-age>Clear older than 60 days</button>
          </section>
          <p class="status" role="status" aria-live="polite"></p>
          <div class="footer"><button type="button" data-close>Close</button></div>
        </div>
      </dialog>
    `;
  }

  connectedCallback() {
    const dialog = this.shadowRoot.querySelector('dialog');
    this.shadowRoot.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    this.shadowRoot.querySelector('[data-count-range]').addEventListener('input', () => this.updateLabels());
    this.shadowRoot.querySelector('[data-age-range]').addEventListener('input', () => this.updateLabels());
    this.shadowRoot.querySelector('[data-clear-count]').addEventListener('click', () => this.clearByCount());
    this.shadowRoot.querySelector('[data-clear-age]').addEventListener('click', () => this.clearByAge());
  }

  show() {
    this.setStatus('');
    this.shadowRoot.querySelector('dialog').showModal();
  }

  updateLabels() {
    const count = this.keepCounts[Number(this.shadowRoot.querySelector('[data-count-range]').value)];
    const days = this.ageDays[Number(this.shadowRoot.querySelector('[data-age-range]').value)];
    this.shadowRoot.querySelector('[data-count-output]').textContent = count;
    this.shadowRoot.querySelector('[data-age-output]').textContent = days;
    this.shadowRoot.querySelector('[data-clear-count]').textContent = `Clear to last ${count} entries`;
    this.shadowRoot.querySelector('[data-clear-age]').textContent = `Clear older than ${days} days`;
    this.shadowRoot.querySelector('[data-count-range]').setAttribute('aria-valuetext', `${count} entries`);
    this.shadowRoot.querySelector('[data-age-range]').setAttribute('aria-valuetext', `${days} days`);
  }

  async clearByCount() {
    const range = this.shadowRoot.querySelector('[data-count-range]');
    await this.clear({ mode: 'count', count: this.keepCounts[Number(range.value)] }, this.shadowRoot.querySelector('[data-clear-count]'));
  }

  async clearByAge() {
    const range = this.shadowRoot.querySelector('[data-age-range]');
    await this.clear({ mode: 'age', days: this.ageDays[Number(range.value)] }, this.shadowRoot.querySelector('[data-clear-age]'));
  }

  async clear(payload, button) {
    button.disabled = true;
    this.setStatus('Clearing...');
    try {
      const response = await fetch('/api/jobs/clear-older', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Request failed: ${response.status}`);
      }

      this.setStatus(`Deleted ${result.deleted} entries; ${result.remaining} remain.`);
      this.dispatchEvent(new CustomEvent('jobs-cleared', { bubbles: true, composed: true, detail: result }));
    } catch (error) {
      console.error(error);
      this.setStatus('Could not clear entries. Please try again.', true);
    } finally {
      button.disabled = false;
    }
  }

  setStatus(message, isError = false) {
    const status = this.shadowRoot.querySelector('.status');
    status.textContent = message;
    status.classList.toggle('error', isError);
  }
}

customElements.define('clear-older-modal', ClearOlderModal);