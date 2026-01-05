/**
 * OpenSprinkler Test Station Card
 * A Home Assistant Lovelace card for testing OpenSprinkler irrigation stations
 *
 * @version 1.0.0
 * @author JoshDev
 * @license MIT
 */

const CARD_VERSION = '1.0.0';

console.info(
  `%c OPENSPRINKLER-TEST-STATION-CARD %c v${CARD_VERSION} `,
  'color: white; background: #3498db; font-weight: bold;',
  'color: #3498db; background: white; font-weight: bold;'
);

class OpenSprinklerTestStationCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._stations = [];
    this._updateInterval = null;
    this._lastRunningState = false;
  }

  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._updateStations();

    // Check if any station is running to manage the update interval
    const hasRunning = this._stations.some(s => s.state === 'on');

    // Start interval timer when station starts running
    if (hasRunning && !this._updateInterval) {
      this._startUpdateInterval();
    } else if (!hasRunning && this._updateInterval) {
      this._stopUpdateInterval();
    }

    // Always re-render when hass changes
    this._render();
  }

  get hass() {
    return this._hass;
  }

  _startUpdateInterval() {
    // Update every second when a station is running
    this._updateInterval = setInterval(() => {
      if (this._hass) {
        this._updateStations();
        this._render();
      }
    }, 1000);
  }

  _stopUpdateInterval() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  }

  disconnectedCallback() {
    this._stopUpdateInterval();
  }

  setConfig(config) {
    if (!config.entity_prefix) {
      // Try to auto-detect OpenSprinkler entities
      config.entity_prefix = 'switch.';
    }

    this._config = {
      title: config.title || 'Station Test',
      entity_prefix: config.entity_prefix || 'switch.',
      opensprinkler_device: config.opensprinkler_device || null,
      default_runtime: config.default_runtime || 300, // 5 minutes in seconds
      stations: config.stations || [], // Empty = auto-detect all
      show_all_off: config.show_all_off !== false,
      show_presets: config.show_presets !== false,
      columns: config.columns || 2,
      presets: config.presets || [60, 300, 600, 900], // 1, 5, 10, 15 minutes
      theme: config.theme || 'auto',
      ...config,
    };

    this._render();
  }

  getCardSize() {
    return 3;
  }

  _updateStations() {
    if (!this._hass) return;

    const stations = [];
    const configuredStations = this._config.stations || [];

    // Find all OpenSprinkler station binary_sensors (station_running entities)
    // These have the best data: name, index, start_time, end_time
    Object.keys(this._hass.states).forEach((entityId) => {
      const state = this._hass.states[entityId];

      // Match OpenSprinkler station running binary_sensors
      const isStationRunningSensor =
        entityId.startsWith('binary_sensor.') &&
        entityId.endsWith('_station_running') &&
        state.attributes &&
        state.attributes.opensprinkler_type === 'station';

      if (isStationRunningSensor) {
        // Get the corresponding switch entity for control
        const baseName = entityId
          .replace('binary_sensor.', '')
          .replace(/_station_running$/, '');
        const switchEntityId = `switch.${baseName}_station_enabled`;

        // Check if we should include this station
        const matchesConfig = configuredStations.length === 0 ||
          configuredStations.includes(switchEntityId) ||
          configuredStations.includes(entityId);

        if (matchesConfig) {
          const isRunning = state.state === 'on';

          // Calculate seconds remaining from end_time
          let secondsRemaining = 0;
          if (isRunning && state.attributes.end_time) {
            const endTime = new Date(state.attributes.end_time);
            const now = new Date();
            secondsRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
          }

          // Use name from binary_sensor attributes (cleaner than switch name)
          const stationName = state.attributes.name ||
            state.attributes.friendly_name?.replace(' Station Running', '') ||
            baseName;

          stations.push({
            entity_id: switchEntityId,
            name: this._cleanStationName(stationName),
            state: isRunning ? 'on' : 'off',
            index: state.attributes.index || this._extractStationIndex(entityId),
            seconds_remaining: secondsRemaining,
            running_sensor: entityId,
            running_program_id: state.attributes.running_program_id,
          });
        }
      }
    });

    // Sort by index
    stations.sort((a, b) => (a.index || 0) - (b.index || 0));
    this._stations = stations;
  }

  _extractStationIndex(entityId) {
    // Match s1, s01, s12, etc.
    const match = entityId.match(/[._]s(\d{1,2})[_-]/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  _cleanStationName(name) {
    if (!name) return name;
    // OpenSprinkler integration appends "Enabled" to station names - remove it
    return name.replace(/\s+Enabled$/i, '').trim();
  }

  _getRunningStation() {
    return this._stations.find((s) => s.state === 'on');
  }

  _hasOpenSprinklerIntegration() {
    if (!this._hass) return false;
    return Object.keys(this._hass.states).some(id =>
      id.endsWith('_station_running') &&
      this._hass.states[id].attributes?.opensprinkler_type === 'station'
    );
  }

  _formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  _formatPresetLabel(seconds) {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  }

  async _runStation(entityId, seconds) {
    if (!this._hass) return;

    const runtime = seconds || this._config.default_runtime;

    // Use OpenSprinkler service if available
    try {
      await this._hass.callService('opensprinkler', 'run', {
        entity_id: entityId,
        run_seconds: runtime,
      });
    } catch (e) {
      // Fallback to switch.turn_on
      await this._hass.callService('switch', 'turn_on', {
        entity_id: entityId,
      });
    }
  }

  async _stopStation(entityId) {
    if (!this._hass) return;

    // Use OpenSprinkler stop service (same as stop all, but for single station)
    try {
      await this._hass.callService('opensprinkler', 'stop', {
        entity_id: entityId,
      });
    } catch (e) {
      // Fallback to switch.turn_off
      await this._hass.callService('switch', 'turn_off', {
        entity_id: entityId,
      });
    }
  }

  async _stopAllStations() {
    if (!this._hass) return;

    // Get all station entity_ids
    const stationIds = this._stations.map(s => s.entity_id);

    if (stationIds.length === 0) return;

    // Try OpenSprinkler stop service with entity_ids
    try {
      await this._hass.callService('opensprinkler', 'stop', {
        entity_id: stationIds,
      });
    } catch (e) {
      // Fallback: stop each station individually
      for (const station of this._stations) {
        if (station.state === 'on') {
          await this._stopStation(station.entity_id);
        }
      }
    }
  }

  _render() {
    if (!this.shadowRoot) return;

    // Check if OpenSprinkler integration is available
    if (this._hass && !this._hasOpenSprinklerIntegration()) {
      this.shadowRoot.innerHTML = `
        <style>
          ${this._getStyles()}
        </style>
        <ha-card>
          <div class="card-header">
            <div class="title">${this._config.title || 'Station Test'}</div>
          </div>
          <div class="card-content">
            ${this._renderMissingIntegration()}
          </div>
        </ha-card>
      `;
      return;
    }

    const runningStation = this._getRunningStation();
    const runtime = this._config.default_runtime || 300;

    this.shadowRoot.innerHTML = `
      <style>
        ${this._getStyles()}
      </style>
      <ha-card>
        <div class="card-header">
          <div class="title">${this._config.title || 'Station Test'}</div>
          ${runningStation ? this._renderStatusBadge(runningStation) : ''}
        </div>

        <div class="card-content">
          ${this._config.show_presets ? this._renderPresets() : ''}

          ${runningStation ? this._renderRunningIndicator(runningStation) : `
          <div class="runtime-display">
            <span class="runtime-label">Run time:</span>
            <span class="runtime-value">${this._formatTime(runtime)}</span>
          </div>
          `}

          <div class="stations-grid" style="grid-template-columns: repeat(${this._config.columns}, 1fr);">
            ${this._stations.map((station) => this._renderStationButton(station)).join('')}
          </div>

          ${this._config.show_all_off ? this._renderAllOffButton() : ''}
        </div>
      </ha-card>
    `;

    this._attachEventListeners();
  }

  _renderMissingIntegration() {
    return `
      <div class="missing-integration">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <div class="missing-title">OpenSprinkler Integration Not Found</div>
        <div class="missing-description">
          This card requires the OpenSprinkler integration to be installed and configured.
        </div>
        <a href="https://github.com/vinteo/hass-opensprinkler" target="_blank" rel="noopener noreferrer" class="missing-link">
          <ha-icon icon="mdi:open-in-new"></ha-icon>
          Install from HACS
        </a>
      </div>
    `;
  }

  _renderStatusBadge(_station) {
    return `
      <div class="status-badge running">
        <ha-icon icon="mdi:water"></ha-icon>
        <span>Active</span>
      </div>
    `;
  }

  _renderRunningIndicator(station) {
    const progress = station.seconds_remaining > 0
      ? Math.max(0, (station.seconds_remaining / this._config.default_runtime) * 100)
      : 0;

    return `
      <div class="running-indicator">
        <div class="running-indicator-bg"></div>
        <div class="running-indicator-content">
          <div class="running-icon-container">
            <ha-icon icon="mdi:sprinkler-variant" class="running-icon"></ha-icon>
            <div class="running-ripple"></div>
            <div class="running-ripple delay"></div>
          </div>
          <div class="running-info">
            <div class="running-label">Running Station</div>
            <div class="running-station-name">${station.name}</div>
          </div>
          <div class="running-time-container">
            <div class="running-time-label">Time Left</div>
            <div class="running-time">${this._formatTime(station.seconds_remaining)}</div>
          </div>
        </div>
        <div class="running-progress-container">
          <div class="running-progress-bar" style="width: ${progress}%"></div>
        </div>
      </div>
    `;
  }

  _renderPresets() {
    const presets = this._config.presets || [60, 300, 600, 900];
    return `
      <div class="presets-row">
        ${presets
          .map(
            (seconds) => `
          <button
            class="preset-btn ${this._config.default_runtime === seconds ? 'active' : ''}"
            data-seconds="${seconds}"
          >
            ${this._formatPresetLabel(seconds)}
          </button>
        `
          )
          .join('')}
      </div>
    `;
  }

  _renderStationButton(station) {
    const isRunning = station.state === 'on';
    const progress = isRunning && station.seconds_remaining > 0
      ? Math.max(0, (station.seconds_remaining / this._config.default_runtime) * 100)
      : 0;

    return `
      <div class="station-card ${isRunning ? 'running' : ''}" data-entity="${station.entity_id}">
        <div class="station-progress" style="width: ${isRunning ? progress : 0}%"></div>
        <div class="station-content">
          <ha-icon icon="${isRunning ? 'mdi:water' : 'mdi:water-off'}"></ha-icon>
          <span class="station-name">${station.name}</span>
          ${isRunning ? `<span class="station-time">${this._formatTime(station.seconds_remaining)}</span>` : ''}
        </div>
        <button class="station-btn ${isRunning ? 'stop' : 'start'}" data-entity="${station.entity_id}">
          ${isRunning ? 'Stop' : 'Start'}
        </button>
      </div>
    `;
  }

  _renderAllOffButton() {
    const hasRunning = this._stations.some((s) => s.state === 'on');
    return `
      <button class="all-off-btn ${hasRunning ? 'active' : ''}" id="all-off">
        <ha-icon icon="mdi:stop-circle"></ha-icon>
        <span>Stop All Stations</span>
      </button>
    `;
  }

  _renderFooterStatus(station) {
    return `
      <div class="card-footer">
        <div class="footer-status">
          <ha-icon icon="mdi:sprinkler-variant" class="spinning"></ha-icon>
          <span class="footer-text">
            <strong>${station.name}</strong> running
            ${station.seconds_remaining > 0 ? `— ${this._formatTime(station.seconds_remaining)} remaining` : ''}
          </span>
        </div>
        <div class="footer-progress">
          <div class="progress-bar" style="width: ${Math.max(0, (station.seconds_remaining / this._config.default_runtime) * 100)}%"></div>
        </div>
      </div>
    `;
  }

  _attachEventListeners() {
    // Preset buttons
    this.shadowRoot.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const seconds = parseInt(e.target.dataset.seconds, 10);
        this._config.default_runtime = seconds;
        this._render();
      });
    });

    // Station buttons
    this.shadowRoot.querySelectorAll('.station-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entityId = e.target.dataset.entity;
        const station = this._stations.find((s) => s.entity_id === entityId);

        if (station && station.state === 'on') {
          this._stopStation(entityId);
        } else {
          this._runStation(entityId, this._config.default_runtime);
        }
      });
    });

    // All off button
    const allOffBtn = this.shadowRoot.querySelector('#all-off');
    if (allOffBtn) {
      allOffBtn.addEventListener('click', () => {
        this._stopAllStations();
      });
    }
  }

  _getStyles() {
    return `
      :host {
        --os-primary-color: var(--primary-color, #3498db);
        --os-success-color: var(--success-color, #27ae60);
        --os-danger-color: var(--error-color, #e74c3c);
        --os-warning-color: var(--warning-color, #f39c12);
        --os-text-color: var(--primary-text-color, #333);
        --os-text-secondary: var(--secondary-text-color, #666);
        --os-card-bg: var(--card-background-color, var(--ha-card-background, var(--paper-card-background-color, white)));
        --os-divider: var(--divider-color, rgba(127, 127, 127, 0.3));
        --os-secondary-bg: var(--secondary-background-color, var(--card-background-color, rgba(127, 127, 127, 0.1)));
        --os-border-radius: 12px;
        --os-transition: all 0.2s ease;
      }

      ha-card {
        overflow: hidden;
        border-radius: var(--os-border-radius);
        background: var(--os-card-bg);
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 16px 8px;
      }

      .title {
        font-size: 1.2em;
        font-weight: 500;
        color: var(--os-text-color);
      }

      .status-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.8em;
        font-weight: 500;
      }

      .status-badge.running {
        background: var(--os-success-color);
        color: white;
      }

      .status-badge ha-icon {
        --mdc-icon-size: 14px;
      }

      .card-content {
        padding: 8px 16px 16px;
      }

      .presets-row {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }

      .preset-btn {
        flex: 1;
        padding: 8px 12px;
        border: 2px solid var(--os-divider);
        border-radius: 8px;
        background: transparent;
        color: var(--os-text-color);
        font-size: 0.9em;
        font-weight: 500;
        cursor: pointer;
        transition: var(--os-transition);
      }

      .preset-btn:hover {
        border-color: var(--os-primary-color);
        background: rgba(52, 152, 219, 0.15);
      }

      .preset-btn.active {
        border-color: var(--os-primary-color);
        background: var(--os-primary-color);
        color: var(--text-primary-color, white);
      }

      .runtime-display {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        padding: 8px;
        background: var(--os-secondary-bg);
        border-radius: 8px;
      }

      .runtime-label {
        color: var(--os-text-secondary);
        font-size: 0.9em;
      }

      .runtime-value {
        font-size: 1.4em;
        font-weight: 600;
        color: var(--os-primary-color);
        font-family: 'Roboto Mono', monospace;
      }

      /* Running Indicator */
      .running-indicator {
        position: relative;
        margin-bottom: 16px;
        padding: 16px;
        border-radius: 12px;
        overflow: hidden;
        background: linear-gradient(135deg, rgba(39, 174, 96, 0.15), rgba(39, 174, 96, 0.08));
        border: 2px solid var(--os-success-color);
        box-shadow: 0 0 20px rgba(39, 174, 96, 0.3);
        animation: glow 2s ease-in-out infinite alternate;
      }

      @keyframes glow {
        from {
          box-shadow: 0 0 15px rgba(39, 174, 96, 0.2);
        }
        to {
          box-shadow: 0 0 25px rgba(39, 174, 96, 0.4);
        }
      }

      .running-indicator-bg {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg,
          transparent 0%,
          rgba(39, 174, 96, 0.15) 50%,
          transparent 100%
        );
        animation: shimmer 2s infinite;
      }

      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .running-indicator-content {
        position: relative;
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .running-icon-container {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
      }

      .running-icon {
        --mdc-icon-size: 32px;
        color: var(--os-success-color);
        animation: spin 3s linear infinite;
        z-index: 1;
      }

      .running-ripple {
        position: absolute;
        width: 48px;
        height: 48px;
        border: 2px solid rgba(39, 174, 96, 0.6);
        border-radius: 50%;
        animation: ripple 1.5s ease-out infinite;
        opacity: 0;
      }

      .running-ripple.delay {
        animation-delay: 0.75s;
      }

      @keyframes ripple {
        0% {
          transform: scale(0.5);
          opacity: 0.8;
        }
        100% {
          transform: scale(1.5);
          opacity: 0;
        }
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .running-info {
        flex: 1;
      }

      .running-label {
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--os-success-color);
        font-weight: 600;
        margin-bottom: 2px;
      }

      .running-station-name {
        font-size: 1.1em;
        font-weight: 600;
        color: var(--os-text-color);
      }

      .running-time-container {
        text-align: right;
      }

      .running-time-label {
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--os-text-secondary);
        margin-bottom: 2px;
      }

      .running-time {
        font-size: 1.6em;
        font-weight: 700;
        color: var(--os-success-color);
        font-family: 'Roboto Mono', monospace;
        animation: pulse 1s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .running-progress-container {
        position: relative;
        height: 6px;
        margin-top: 12px;
        background: rgba(39, 174, 96, 0.2);
        border-radius: 3px;
        overflow: hidden;
      }

      .running-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, var(--os-success-color), #5dbe8a);
        border-radius: 3px;
        transition: width 1s linear;
        box-shadow: 0 0 8px rgba(39, 174, 96, 0.5);
      }

      .stations-grid {
        display: grid;
        gap: 12px;
        margin-bottom: 16px;
      }

      .station-card {
        position: relative;
        overflow: hidden;
        border: 2px solid var(--os-divider);
        border-radius: 10px;
        background: var(--os-card-bg);
        transition: var(--os-transition);
      }

      .station-card:hover {
        border-color: var(--os-primary-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      .station-card.running {
        border-color: var(--os-success-color);
        background: rgba(39, 174, 96, 0.1);
      }

      .station-progress {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: rgba(39, 174, 96, 0.2);
        transition: width 1s linear;
        pointer-events: none;
      }

      .station-content {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
      }

      .station-content ha-icon {
        --mdc-icon-size: 24px;
        color: var(--os-text-secondary);
      }

      .station-card.running .station-content ha-icon {
        color: var(--os-success-color);
      }

      .station-name {
        flex: 1;
        font-size: 0.95em;
        font-weight: 500;
        color: var(--os-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .station-time {
        font-family: 'Roboto Mono', monospace;
        font-size: 0.85em;
        color: var(--os-success-color);
        font-weight: 600;
      }

      .station-btn {
        position: relative;
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
        transition: var(--os-transition);
      }

      .station-btn.start {
        background: var(--os-primary-color);
        color: var(--text-primary-color, white);
      }

      .station-btn.start:hover {
        filter: brightness(0.9);
      }

      .station-btn.stop {
        background: var(--os-danger-color);
        color: var(--text-primary-color, white);
      }

      .station-btn.stop:hover {
        filter: brightness(0.9);
      }

      .all-off-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 14px;
        border: 2px solid var(--os-danger-color);
        border-radius: 10px;
        background: transparent;
        color: var(--os-danger-color);
        font-size: 1em;
        font-weight: 600;
        cursor: pointer;
        transition: var(--os-transition);
      }

      .all-off-btn:hover,
      .all-off-btn.active {
        background: var(--os-danger-color);
        color: var(--text-primary-color, white);
      }

      .all-off-btn ha-icon {
        --mdc-icon-size: 20px;
      }

      .card-footer {
        padding: 12px 16px;
        background: rgba(39, 174, 96, 0.1);
        border-top: 1px solid rgba(39, 174, 96, 0.3);
      }

      .footer-status {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .footer-status ha-icon {
        --mdc-icon-size: 20px;
        color: var(--os-success-color);
      }

      .footer-status ha-icon.spinning {
        animation: spin 2s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .footer-text {
        font-size: 0.9em;
        color: var(--os-text-color);
      }

      .footer-text strong {
        color: var(--os-success-color);
      }

      .footer-progress {
        height: 4px;
        background: rgba(39, 174, 96, 0.25);
        border-radius: 2px;
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        background: var(--os-success-color);
        transition: width 1s linear;
      }

      /* Empty state */
      .empty-state {
        text-align: center;
        padding: 32px 16px;
        color: var(--os-text-secondary);
      }

      .empty-state ha-icon {
        --mdc-icon-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      /* Missing integration warning */
      .missing-integration {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 24px 16px;
        background: rgba(var(--rgb-warning-color, 255, 152, 0), 0.1);
        border: 2px solid var(--os-warning-color);
        border-radius: 12px;
      }

      .missing-integration > ha-icon {
        --mdc-icon-size: 48px;
        color: var(--os-warning-color);
        margin-bottom: 12px;
      }

      .missing-title {
        font-size: 1.1em;
        font-weight: 600;
        color: var(--os-text-color);
        margin-bottom: 8px;
      }

      .missing-description {
        font-size: 0.9em;
        color: var(--os-text-secondary);
        margin-bottom: 16px;
        line-height: 1.4;
      }

      .missing-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 20px;
        background: var(--os-primary-color);
        color: var(--text-primary-color, white);
        text-decoration: none;
        border-radius: 8px;
        font-weight: 500;
        font-size: 0.9em;
        transition: var(--os-transition);
      }

      .missing-link:hover {
        filter: brightness(0.9);
      }

      .missing-link ha-icon {
        --mdc-icon-size: 18px;
      }
    `;
  }

  // Card configuration UI
  static getConfigElement() {
    return document.createElement('opensprinkler-test-station-card-editor');
  }

  static getStubConfig() {
    return {
      title: 'Station Test',
      default_runtime: 300,
      columns: 2,
      show_presets: true,
      show_all_off: true,
      presets: [60, 300, 600, 900],
    };
  }
}

// Card Editor for UI configuration
class OpenSprinklerTestStationCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this._availableStations = [];
  }

  set hass(hass) {
    const firstLoad = !this._hass;
    this._hass = hass;
    this._updateAvailableStations();
    // Re-render on first hass load to show stations
    if (firstLoad || !this._rendered) {
      this._rendered = true;
      this._render();
    }
  }

  _updateAvailableStations() {
    if (!this._hass) return;

    const stations = [];
    Object.keys(this._hass.states).forEach((entityId) => {
      const state = this._hass.states[entityId];

      // Match OpenSprinkler station running binary_sensors
      if (
        entityId.startsWith('binary_sensor.') &&
        entityId.endsWith('_station_running') &&
        state.attributes &&
        state.attributes.opensprinkler_type === 'station'
      ) {
        const baseName = entityId
          .replace('binary_sensor.', '')
          .replace(/_station_running$/, '');
        const switchEntityId = `switch.${baseName}_station_enabled`;

        const stationName = state.attributes.name ||
          state.attributes.friendly_name?.replace(' Station Running', '') ||
          baseName;

        stations.push({
          entity_id: switchEntityId,
          name: this._cleanStationName(stationName),
          index: state.attributes.index || this._extractStationIndex(entityId),
        });
      }
    });
    stations.sort((a, b) => (a.index || 0) - (b.index || 0));
    this._availableStations = stations;
  }

  _extractStationIndex(entityId) {
    // Match s1, s01, s12, etc.
    const match = entityId.match(/[._]s(\d{1,2})[_-]/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  _cleanStationName(name) {
    if (!name) return name;
    // OpenSprinkler integration appends "Enabled" to station names - remove it
    return name.replace(/\s+Enabled$/i, '').trim();
  }

  setConfig(config) {
    this._config = { ...config };
    // Only render if we haven't rendered yet
    if (!this._rendered) {
      this._rendered = true;
      this._render();
    }
  }

  configChanged(newConfig) {
    const event = new Event('config-changed', {
      bubbles: true,
      composed: true,
    });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }

  _render() {
    const selectedStations = this._config.stations || [];
    const stationsHelp = selectedStations.length === 0
      ? 'All stations will be shown (auto-detect)'
      : `${selectedStations.length} station(s) selected`;

    this.innerHTML = `
      <div class="editor">
        <ha-textfield
          label="Title"
          id="title-input"
        ></ha-textfield>

        <ha-textfield
          label="Default Runtime (seconds)"
          type="number"
          id="runtime-input"
        ></ha-textfield>

        <ha-textfield
          label="Columns"
          type="number"
          min="1"
          max="4"
          id="columns-input"
        ></ha-textfield>

        <div class="station-section">
          <div class="section-header">
            <span class="section-title">Stations</span>
            <span class="section-help">${stationsHelp}</span>
          </div>
          <div class="station-list">
            ${this._availableStations.map(station => `
              <label class="station-item">
                <input
                  type="checkbox"
                  value="${station.entity_id}"
                  ${selectedStations.length === 0 || selectedStations.includes(station.entity_id) ? 'checked' : ''}
                  class="station-checkbox"
                />
                <span class="station-label">${station.name}</span>
              </label>
            `).join('')}
          </div>
          <div class="station-actions">
            <button type="button" class="action-btn" id="select-all">Select All</button>
            <button type="button" class="action-btn" id="select-none">Select None</button>
          </div>
        </div>

        <ha-formfield label="Show Presets">
          <ha-switch id="show-presets-switch"></ha-switch>
        </ha-formfield>

        <ha-formfield label="Show All Off Button">
          <ha-switch id="show-all-off-switch"></ha-switch>
        </ha-formfield>
      </div>

      <style>
        .editor {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
        }
        ha-textfield {
          width: 100%;
        }
        .station-section {
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          padding: 12px;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .section-title {
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .section-help {
          font-size: 0.85em;
          color: var(--secondary-text-color);
        }
        .station-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 12px;
        }
        .station-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 4px;
          cursor: pointer;
          background: var(--secondary-background-color, rgba(127,127,127,0.1));
        }
        .station-item:hover {
          background: var(--primary-color);
          color: var(--text-primary-color, white);
        }
        .station-checkbox {
          cursor: pointer;
        }
        .station-label {
          font-size: 0.9em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .station-actions {
          display: flex;
          gap: 8px;
        }
        .action-btn {
          flex: 1;
          padding: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          background: transparent;
          color: var(--primary-text-color);
          cursor: pointer;
          font-size: 0.85em;
        }
        .action-btn:hover {
          background: var(--primary-color);
          color: var(--text-primary-color, white);
          border-color: var(--primary-color);
        }
      </style>
    `;

    this._attachEditorListeners();
  }

  _attachEditorListeners() {
    // Set initial values on text fields
    const titleInput = this.querySelector('#title-input');
    const runtimeInput = this.querySelector('#runtime-input');
    const columnsInput = this.querySelector('#columns-input');
    const showPresetsSwitch = this.querySelector('#show-presets-switch');
    const showAllOffSwitch = this.querySelector('#show-all-off-switch');

    if (titleInput) {
      titleInput.value = this._config.title || '';
      titleInput.addEventListener('input', (e) => {
        this._valueChanged('title', e.target.value);
      });
    }

    if (runtimeInput) {
      runtimeInput.value = this._config.default_runtime || 300;
      runtimeInput.addEventListener('input', (e) => {
        this._valueChanged('default_runtime', parseInt(e.target.value, 10) || 300);
      });
    }

    if (columnsInput) {
      columnsInput.value = this._config.columns || 2;
      columnsInput.addEventListener('input', (e) => {
        this._valueChanged('columns', parseInt(e.target.value, 10) || 2);
      });
    }

    if (showPresetsSwitch) {
      showPresetsSwitch.checked = this._config.show_presets !== false;
      showPresetsSwitch.addEventListener('change', (e) => {
        this._valueChanged('show_presets', e.target.checked);
      });
    }

    if (showAllOffSwitch) {
      showAllOffSwitch.checked = this._config.show_all_off !== false;
      showAllOffSwitch.addEventListener('change', (e) => {
        this._valueChanged('show_all_off', e.target.checked);
      });
    }

    // Station checkbox listeners
    this.querySelectorAll('.station-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this._updateStationSelection();
      });
    });

    // Select all/none buttons
    const selectAllBtn = this.querySelector('#select-all');
    const selectNoneBtn = this.querySelector('#select-none');

    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        this.querySelectorAll('.station-checkbox').forEach(cb => cb.checked = true);
        this._updateStationSelection();
      });
    }

    if (selectNoneBtn) {
      selectNoneBtn.addEventListener('click', () => {
        this.querySelectorAll('.station-checkbox').forEach(cb => cb.checked = false);
        this._updateStationSelection();
      });
    }
  }

  _updateStationSelection() {
    const checkboxes = this.querySelectorAll('.station-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const noneChecked = Array.from(checkboxes).every(cb => !cb.checked);

    let stations;
    if (allChecked || noneChecked) {
      // All or none selected = auto-detect all
      stations = [];
    } else {
      // Specific selection
      stations = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    }

    this._valueChanged('stations', stations);
  }

  _valueChanged(key, value) {
    this._config = { ...this._config, [key]: value };
    this.configChanged(this._config);
  }
}

// Register the card
customElements.define('opensprinkler-test-station-card', OpenSprinklerTestStationCard);
customElements.define('opensprinkler-test-station-card-editor', OpenSprinklerTestStationCardEditor);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'opensprinkler-test-station-card',
  name: 'OpenSprinkler Test Station Card',
  description: 'A card for testing OpenSprinkler irrigation stations',
  preview: true,
  documentationURL: 'https://github.com/JoshDev/opensprinkler-test-station-card',
});
