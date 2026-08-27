/**
 * Shared styles for the Filament Manager panel.
 *
 * Everything is expressed through Home Assistant theme variables so the panel
 * follows the active theme including dark mode.
 */

export const panelStyles = `
  :host {
    display: block;
    height: 100%;
    background: var(--primary-background-color, #fafafa);
    color: var(--primary-text-color, #212121);
    font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
  }

  * { box-sizing: border-box; }

  .app-header {
    position: sticky;
    top: 0;
    z-index: 4;
    background: var(--app-header-background-color, var(--primary-color, #03a9f4));
    color: var(--app-header-text-color, #fff);
    box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.16));
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 56px;
    padding: 0 12px;
    font-size: 20px;
    font-weight: 400;
  }

  .toolbar .title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .menu-button {
    display: none;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    line-height: 0;
  }
  :host([narrow]) .menu-button { display: block; }
  .menu-button:hover { background: rgba(255, 255, 255, 0.12); }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 0 8px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar { display: none; }

  .tab {
    appearance: none;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    color: inherit;
    opacity: 0.72;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.4px;
    padding: 12px 16px;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .tab:hover { opacity: 1; }
  .tab[aria-selected="true"] { opacity: 1; border-bottom-color: currentColor; }

  .content {
    max-width: 1240px;
    margin: 0 auto;
    padding: 16px;
  }

  /* ---------------- cards ---------------- */

  .card {
    background: var(--card-background-color, #fff);
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
    border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, transparent);
    padding: 16px;
  }

  .section-title {
    font-size: 16px;
    font-weight: 500;
    margin: 24px 0 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-title:first-child { margin-top: 0; }
  .section-title .spacer { flex: 1; }

  /* ---------------- summary strip ---------------- */

  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .stat {
    background: var(--card-background-color, #fff);
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
    padding: 14px 16px;
  }
  .stat .value {
    font-size: 26px;
    font-weight: 500;
    line-height: 1.15;
    color: var(--primary-text-color);
  }
  .stat .label {
    font-size: 12px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--secondary-text-color, #727272);
    margin-top: 4px;
  }

  /* ---------------- filter bar ---------------- */

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 16px;
  }
  .filters .grow { flex: 1 1 200px; min-width: 160px; }

  /* ---------------- form controls ---------------- */

  input[type="text"],
  input[type="number"],
  input[type="date"],
  input[type="search"],
  select,
  textarea {
    width: 100%;
    font: inherit;
    font-size: 14px;
    color: var(--primary-text-color);
    background: var(--card-background-color, #fff);
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 8px;
    padding: 9px 10px;
  }
  textarea { resize: vertical; min-height: 64px; }
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--primary-color, #03a9f4);
    box-shadow: 0 0 0 1px var(--primary-color, #03a9f4);
  }
  input[type="color"] {
    width: 48px;
    height: 40px;
    padding: 2px;
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 8px;
    background: var(--card-background-color, #fff);
    cursor: pointer;
  }
  label.field { display: block; }
  label.field > .label-text {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--secondary-text-color, #727272);
    margin-bottom: 4px;
  }
  .hint {
    font-size: 12px;
    color: var(--secondary-text-color, #727272);
    margin-top: 4px;
  }

  button {
    font: inherit;
    cursor: pointer;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    padding: 9px 16px;
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }
  .btn:hover { filter: brightness(1.08); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }

  .btn.secondary {
    background: transparent;
    color: var(--primary-color, #03a9f4);
    border: 1px solid var(--divider-color, #e0e0e0);
  }
  .btn.text {
    background: transparent;
    color: var(--primary-color, #03a9f4);
    padding: 8px 10px;
  }
  .btn.danger { background: var(--error-color, #db4437); color: #fff; }
  .btn.danger.text { background: transparent; color: var(--error-color, #db4437); }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 50%;
    background: transparent;
    color: var(--primary-text-color);
    font-size: 18px;
    line-height: 1;
    flex: 0 0 auto;
  }
  .icon-btn:hover { background: var(--divider-color, #e0e0e0); }
  .icon-btn:disabled { opacity: 0.35; cursor: not-allowed; background: transparent; }
  .icon-btn.plain { border: none; }
  .icon-btn.danger { color: var(--error-color, #db4437); }

  /* ---------------- inventory cards ---------------- */

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
  }

  .spool-card { display: flex; flex-direction: column; gap: 10px; }

  .spool-head { display: flex; align-items: flex-start; gap: 12px; }

  .swatch {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex: 0 0 auto;
    border: 2px solid var(--divider-color, #e0e0e0);
    box-shadow: inset 0 -6px 10px rgba(0, 0, 0, 0.18);
  }
  .swatch.small { width: 26px; height: 26px; border-width: 1px; }

  .spool-title { flex: 1; min-width: 0; }
  .spool-title .name {
    font-size: 15px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .spool-title .sub {
    font-size: 13px;
    color: var(--secondary-text-color, #727272);
    margin-top: 2px;
  }

  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--divider-color, #e0e0e0);
    color: var(--primary-text-color);
    white-space: nowrap;
  }
  .chip.sealed { background: rgba(3, 169, 244, 0.16); color: var(--primary-color, #03a9f4); }
  .chip.open { background: rgba(255, 152, 0, 0.18); color: #e08600; }
  .chip.muted { background: transparent; border: 1px solid var(--divider-color, #e0e0e0); color: var(--secondary-text-color, #727272); }

  .bar {
    position: relative;
    height: 8px;
    border-radius: 999px;
    background: var(--divider-color, #e0e0e0);
    overflow: hidden;
  }
  .bar > span {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 999px;
    background: var(--primary-color, #03a9f4);
  }
  .bar.low > span { background: var(--error-color, #db4437); }
  .bar.mid > span { background: var(--warning-color, #ffa600); }

  .open-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  .open-row .bar { flex: 1; }
  .open-row .amount { color: var(--secondary-text-color, #727272); white-space: nowrap; }

  .meta {
    font-size: 12px;
    color: var(--secondary-text-color, #727272);
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
  }

  /* ---------------- lists (manage / admin) ---------------- */

  .list { display: flex; flex-direction: column; gap: 8px; }

  .row {
    background: var(--card-background-color, #fff);
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
    padding: 12px 14px;
  }
  .row-main {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .row-main .grow { flex: 1 1 220px; min-width: 0; }
  .row-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  .counter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 999px;
    padding: 2px;
  }
  .counter .num {
    min-width: 34px;
    text-align: center;
    font-size: 15px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .counter .icon-btn { width: 30px; height: 30px; border: none; }

  .sub-list {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--divider-color, #e0e0e0);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .spool-edit {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }
  .spool-edit .num-field { width: 104px; flex: 0 0 auto; }
  .spool-edit .grow { flex: 1 1 160px; }

  /* ---------------- empty state ---------------- */

  .empty {
    text-align: center;
    padding: 48px 16px;
    color: var(--secondary-text-color, #727272);
  }
  .empty .big { font-size: 44px; line-height: 1; margin-bottom: 12px; }
  .empty h3 { margin: 0 0 6px; color: var(--primary-text-color); font-weight: 500; }
  .empty p { margin: 0 0 16px; }

  /* ---------------- dialog ---------------- */

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .dialog {
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color);
    border-radius: var(--ha-card-border-radius, 14px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.32);
    width: min(640px, 100%);
    max-height: min(88vh, 900px);
    display: flex;
    flex-direction: column;
  }
  .dialog h2 {
    margin: 0;
    padding: 20px 24px 8px;
    font-size: 20px;
    font-weight: 500;
  }
  .dialog .body { padding: 8px 24px 16px; overflow-y: auto; }
  .dialog .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 16px 16px;
    flex-wrap: wrap;
  }
  .dialog .actions .spacer { flex: 1; }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 14px;
  }
  .form-grid .span-2 { grid-column: 1 / -1; }
  .color-field { display: flex; gap: 8px; align-items: flex-end; }
  .color-field .grow { flex: 1; }

  .error-text {
    color: var(--error-color, #db4437);
    font-size: 13px;
    margin-top: 8px;
  }

  /* ---------------- toast ---------------- */

  .toast {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    z-index: 20;
    background: #323232;
    color: #fff;
    border-radius: 8px;
    padding: 12px 18px;
    font-size: 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    max-width: calc(100vw - 32px);
  }
  .toast.error { background: var(--error-color, #db4437); }

  .id-badge {
    font-family: var(--code-font-family, monospace);
    font-size: 11px;
    color: var(--secondary-text-color, #727272);
    background: var(--divider-color, #e0e0e0);
    border-radius: 4px;
    padding: 1px 6px;
    cursor: pointer;
    border: none;
  }

  @media (max-width: 600px) {
    .content { padding: 12px; }
    .grid { grid-template-columns: 1fr; }
    .toolbar { font-size: 18px; }
  }
`;
