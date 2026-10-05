class ApplicationModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { color: #e2e8f0; }
        dialog {
          width: min(560px, calc(100vw - 32px));
          max-height: calc(100dvh - 32px);
          padding: 0;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 8px;
          background: #111827;
          color: inherit;
        }
        dialog::backdrop { background: rgba(2, 6, 23, 0.72); }
        form { display: grid; gap: 18px; padding: 22px; }
        h2 { margin: 0; font-size: 20px; }
        .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        label { display: grid; gap: 6px; color: #cbd5e1; font-size: 14px; }
        label.wide { grid-column: 1 / -1; }
        input {
          width: 100%;
          min-width: 0;
          padding: 9px 10px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 4px;
          background: #0b1220;
          color: #e2e8f0;
          font: inherit;
        }
        input[type="checkbox"] { width: 17px; height: 17px; accent-color: #60a5fa; }
        .check-field { display: flex; align-items: center; gap: 9px; }
        .check-field input { margin: 0; }
        .status { min-height: 20px; margin: 0; color: #fca5a5; font-size: 14px; }
        .actions { display: flex; justify-content: end; gap: 8px; }
        button {
          padding: 8px 12px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 4px;
          background: #0b1220;
          color: #e2e8f0;
          font: inherit;
          cursor: pointer;
        }
        button[type="submit"] { border-color: #60a5fa; background: #1d4ed8; }
        button:disabled { cursor: wait; opacity: 0.6; }
        @media (max-width: 480px) {
          form { padding: 18px; }
          .fields { grid-template-columns: minmax(0, 1fr); }
          label.wide { grid-column: auto; }
        }
      </style>
      <dialog aria-labelledby="application-modal-title">
        <form>
          <h2 id="application-modal-title">Add Application</h2>
          <div class="fields">
            <label>
              Company
              <input name="company" type="text" autocomplete="organization" required />
            </label>
            <label>
              Title
              <input name="title" type="text" required />
            </label>
            <label>
              Date Applied
              <input name="appDate" type="date" required />
            </label>
            <label>
              Application Method
              <input name="appMethod" type="text" required />
            </label>
            <label class="wide">
              Location
              <input name="location" type="text" required />
            </label>
            <label class="wide">
              Contact
              <input name="contact" type="text" />
            </label>
            <label class="check-field">
              <input name="interviewed" type="checkbox" />
              Interviewed
            </label>
            <label class="check-field">
              <input name="advanced" type="checkbox" />
              Advanced
            </label>
          </div>
          <p class="status" role="alert" aria-live="polite"></p>
          <div class="actions">
            <button type="button" data-close>Cancel</button>
            <button type="submit">Save Application</button>
          </div>
        </form>
      </dialog>
    `;
  }

  connectedCallback() {
    const dialog = this.shadowRoot.querySelector('dialog');
    const form = this.shadowRoot.querySelector('form');
    const status = this.shadowRoot.querySelector('.status');
    const saveButton = this.shadowRoot.querySelector('button[type="submit"]');

    this.shadowRoot.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      status.textContent = '';
      saveButton.disabled = true;

      const formData = new FormData(form);
      const application = {
        company: formData.get('company').trim(),
        title: formData.get('title').trim(),
        appDate: formData.get('appDate'),
        appMethod: formData.get('appMethod').trim(),
        location: formData.get('location').trim(),
        interviewed: form.elements.namedItem('interviewed').checked,
        advanced: form.elements.namedItem('advanced').checked,
      };
      const contact = formData.get('contact').trim();
      if (contact) {
        application.contact = contact;
      }

      try {
        const response = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(application),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || `Save failed: ${response.status}`);
        }

        const savedApplication = await response.json();
        this.dispatchEvent(new CustomEvent('application-saved', {
          detail: savedApplication,
          bubbles: true,
          composed: true,
        }));
        form.reset();
        dialog.close();
      } catch (error) {
        status.textContent = error.message || 'Could not save this application.';
      } finally {
        saveButton.disabled = false;
      }
    });
  }

  show(values = {}) {
    const form = this.shadowRoot.querySelector('form');
    form.reset();
    for (const name of ['company', 'title', 'appDate', 'appMethod', 'location', 'contact']) {
      form.elements.namedItem(name).value = values[name] ?? '';
    }
    for (const name of ['interviewed', 'advanced']) {
      const value = values[name];
      form.elements.namedItem(name).checked = value === true || String(value).toLowerCase() === 'true';
    }
    this.shadowRoot.querySelector('.status').textContent = '';
    this.shadowRoot.querySelector('dialog').showModal();
  }
}

customElements.define('application-modal', ApplicationModal);
