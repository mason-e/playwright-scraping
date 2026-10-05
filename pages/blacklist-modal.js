class BlacklistModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { color: #e2e8f0; }
        dialog {
          width: min(760px, calc(100vw - 32px));
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
        .rows { display: grid; gap: 12px; }
        .row { display: grid; grid-template-columns: minmax(0, 260px) 220px minmax(0, 1fr); align-items: end; column-gap: 24px; row-gap: 10px; }
        .row label { display: grid; grid-column: 1; gap: 6px; color: #cbd5e1; font-size: 14px; }
        .row.company-row label:first-child { grid-column: 1; }
        .row.company-row label:nth-child(2) { grid-column: 2; }
        .row:not(.company-row) button { grid-column: 3; }
        input, select {
          width: 100%;
          min-width: 0;
          padding: 9px 10px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 4px;
          background: #0b1220;
          color: #e2e8f0;
          font: inherit;
          text-align: left;
        }
        button {
          justify-self: end;
          padding: 9px 12px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 4px;
          background: #0b1220;
          color: #e2e8f0;
          font: inherit;
          white-space: nowrap;
          cursor: pointer;
        }
        .add-button { width: 132px; border-color: #60a5fa; background: #1d4ed8; }
        button:disabled { cursor: wait; opacity: 0.6; }
        .status { min-height: 20px; margin: 0; color: #86efac; font-size: 14px; }
        .status.error { color: #fca5a5; }
        .footer { display: flex; justify-content: end; }
        @media (max-width: 620px) {
          .content { padding: 18px; }
          .row { grid-template-columns: minmax(0, 1fr) auto; column-gap: 10px; }
          .row label,
          .row.company-row label:first-child,
          .row.company-row label:nth-child(2) { grid-column: 1; }
          .row.company-row label:first-child { grid-row: 1; }
          .row.company-row label:nth-child(2) { grid-row: 2; }
          .row button { grid-column: 2; grid-row: 1 / span 2; }
          .row:not(.company-row) button { grid-column: 2; grid-row: 1; }
        }
      </style>
      <dialog aria-labelledby="blacklist-modal-title">
        <div class="content">
          <h2 id="blacklist-modal-title">Add to Blacklist</h2>
          <div class="rows">
            <div class="row company-row">
              <label>
                Company
                <input data-value-field="company" type="text" required />
              </label>
              <label>
                Reason
                <select data-reason required></select>
              </label>
              <button class="add-button" type="button" data-add-field="company">Add Company</button>
            </div>
            <div class="row">
              <label>
                Title
                <input data-value-field="title" type="text" required />
              </label>
              <button class="add-button" type="button" data-add-field="title">Add Title</button>
            </div>
            <div class="row">
              <label>
                Location
                <input data-value-field="location" type="text" required />
              </label>
              <button class="add-button" type="button" data-add-field="location">Add Location</button>
            </div>
          </div>
          <p class="status" role="status" aria-live="polite"></p>
          <div class="footer"><button type="button" data-close>Close</button></div>
        </div>
      </dialog>
    `;
  }

  connectedCallback() {
    this.shadowRoot.querySelector('[data-close]').addEventListener('click', () => {
      this.shadowRoot.querySelector('dialog').close();
    });

    this.shadowRoot.querySelectorAll('[data-add-field]').forEach((button) => {
      button.addEventListener('click', () => this.addField(button.dataset.addField, button));
    });

    this.loadReasons();
  }

  async loadReasons() {
    const select = this.shadowRoot.querySelector('[data-reason]');
    let reasons = ['Other'];

    try {
      const response = await fetch('/api/blacklist/reasons');
      if (!response.ok) {
        throw new Error(`Failed to load blacklist reasons: ${response.status}`);
      }
      const configuredReasons = await response.json();
      if (Array.isArray(configuredReasons) && configuredReasons.some((reason) => typeof reason === 'string' && reason.trim())) {
        reasons = configuredReasons.filter((reason) => typeof reason === 'string' && reason.trim());
      }
    } catch (error) {
      console.warn(error);
    }

    select.replaceChildren(...reasons.map((reason) => {
      const option = document.createElement('option');
      option.value = reason;
      option.textContent = reason;
      return option;
    }));
  }

  show(values = {}) {
    for (const field of ['company', 'title', 'location']) {
      this.shadowRoot.querySelector(`[data-value-field="${field}"]`).value = values[field] ?? '';
    }
    this.setStatus('');
    this.shadowRoot.querySelector('dialog').showModal();
  }

  async addField(field, button) {
    const input = this.shadowRoot.querySelector(`[data-value-field="${field}"]`);
    const value = input.value.trim();
    if (!value) {
      input.setCustomValidity('Enter a value to add.');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');

    const reason = this.shadowRoot.querySelector('[data-reason]').value;
    if (!reason) {
      this.setStatus('Choose a reason before adding a blacklist entry.', true);
      return;
    }

    button.disabled = true;
    this.setStatus('Adding...');
    try {
      const response = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value, reason }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Add failed: ${response.status}`);
      }

      input.value = '';
      this.setStatus(`${field[0].toUpperCase()}${field.slice(1)} added to blacklist.`);
      this.dispatchEvent(new CustomEvent('blacklist-entry-added', {
        detail: result,
        bubbles: true,
        composed: true,
      }));
    } catch (error) {
      this.setStatus(error.message || 'Could not add this blacklist entry.', true);
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

customElements.define('blacklist-modal', BlacklistModal);
