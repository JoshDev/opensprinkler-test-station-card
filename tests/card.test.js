/**
 * Tests for OpenSprinkler Test Station Card
 */

// Load the card module - this will register the custom elements
require('../src/opensprinkler-test-station-card.js');

describe('OpenSprinklerTestStationCard', () => {
  let CardClass;
  let card;

  beforeAll(() => {
    CardClass = global.registeredElements['opensprinkler-test-station-card'];
  });

  beforeEach(() => {
    card = new CardClass();
  });

  describe('initialization', () => {
    test('should register custom element', () => {
      expect(customElements.define).toHaveBeenCalledWith(
        'opensprinkler-test-station-card',
        expect.any(Function)
      );
    });

    test('should register card editor', () => {
      expect(customElements.define).toHaveBeenCalledWith(
        'opensprinkler-test-station-card-editor',
        expect.any(Function)
      );
    });

    test('should register with window.customCards', () => {
      expect(window.customCards).toContainEqual(
        expect.objectContaining({
          type: 'opensprinkler-test-station-card',
          name: 'OpenSprinkler Test Station Card',
        })
      );
    });
  });

  describe('setConfig', () => {
    test('should accept minimal config', () => {
      expect(() => card.setConfig({})).not.toThrow();
    });

    test('should set default values', () => {
      card.setConfig({});
      expect(card._config.title).toBe('Station Test');
      expect(card._config.default_runtime).toBe(300);
      expect(card._config.columns).toBe(2);
      expect(card._config.show_presets).toBe(true);
      expect(card._config.show_all_off).toBe(true);
    });

    test('should accept custom title', () => {
      card.setConfig({ title: 'My Stations' });
      expect(card._config.title).toBe('My Stations');
    });

    test('should accept custom runtime', () => {
      card.setConfig({ default_runtime: 600 });
      expect(card._config.default_runtime).toBe(600);
    });

    test('should accept custom columns', () => {
      card.setConfig({ columns: 3 });
      expect(card._config.columns).toBe(3);
    });

    test('should accept custom presets', () => {
      const presets = [30, 60, 120];
      card.setConfig({ presets });
      expect(card._config.presets).toEqual(presets);
    });

    test('should allow disabling presets', () => {
      card.setConfig({ show_presets: false });
      expect(card._config.show_presets).toBe(false);
    });

    test('should allow disabling all-off button', () => {
      card.setConfig({ show_all_off: false });
      expect(card._config.show_all_off).toBe(false);
    });

    test('should accept specific stations list', () => {
      const stations = ['switch.s01_lawn', 'switch.s02_garden'];
      card.setConfig({ stations });
      expect(card._config.stations).toEqual(stations);
    });
  });

  describe('getCardSize', () => {
    test('should return card size', () => {
      expect(card.getCardSize()).toBe(3);
    });
  });

  describe('static methods', () => {
    test('getStubConfig should return default config', () => {
      const stubConfig = CardClass.getStubConfig();
      expect(stubConfig).toEqual({
        title: 'Station Test',
        default_runtime: 300,
        columns: 2,
        show_presets: true,
        show_all_off: true,
        presets: [60, 300, 600, 900],
      });
    });
  });
});

describe('Time Formatting', () => {
  let CardClass;
  let card;

  beforeAll(() => {
    CardClass = global.registeredElements['opensprinkler-test-station-card'];
  });

  beforeEach(() => {
    card = new CardClass();
  });

  test('should format 0 seconds', () => {
    expect(card._formatTime(0)).toBe('0:00');
  });

  test('should format seconds only', () => {
    expect(card._formatTime(45)).toBe('0:45');
  });

  test('should format minutes and seconds', () => {
    expect(card._formatTime(125)).toBe('2:05');
  });

  test('should format exact minutes', () => {
    expect(card._formatTime(300)).toBe('5:00');
  });

  test('should handle null/undefined', () => {
    expect(card._formatTime(null)).toBe('0:00');
    expect(card._formatTime(undefined)).toBe('0:00');
  });

  test('should format preset labels for seconds', () => {
    expect(card._formatPresetLabel(30)).toBe('30s');
  });

  test('should format preset labels for minutes', () => {
    expect(card._formatPresetLabel(60)).toBe('1m');
    expect(card._formatPresetLabel(300)).toBe('5m');
    expect(card._formatPresetLabel(900)).toBe('15m');
  });
});

describe('Station Detection', () => {
  let CardClass;
  let card;

  beforeAll(() => {
    CardClass = global.registeredElements['opensprinkler-test-station-card'];
  });

  beforeEach(() => {
    card = new CardClass();
    card.setConfig({});
  });

  test('should extract station index from entity id', () => {
    expect(card._extractStationIndex('switch.s01_front_lawn')).toBe(1);
    expect(card._extractStationIndex('switch.s05_garden')).toBe(5);
    expect(card._extractStationIndex('switch.s12_backyard')).toBe(12);
  });

  test('should return 0 for non-matching entity ids', () => {
    expect(card._extractStationIndex('switch.some_other_entity')).toBe(0);
  });

  test('should detect running station', () => {
    card._stations = [
      { entity_id: 'switch.s01', state: 'off' },
      { entity_id: 'switch.s02', state: 'on', seconds_remaining: 120 },
      { entity_id: 'switch.s03', state: 'off' },
    ];

    const running = card._getRunningStation();
    expect(running).toEqual({
      entity_id: 'switch.s02',
      state: 'on',
      seconds_remaining: 120,
    });
  });

  test('should return undefined when no station running', () => {
    card._stations = [
      { entity_id: 'switch.s01', state: 'off' },
      { entity_id: 'switch.s02', state: 'off' },
    ];

    expect(card._getRunningStation()).toBeUndefined();
  });
});

describe('OpenSprinkler Integration Detection', () => {
  let CardClass;
  let card;

  beforeAll(() => {
    CardClass = global.registeredElements['opensprinkler-test-station-card'];
  });

  beforeEach(() => {
    card = new CardClass();
    card.setConfig({});
  });

  test('should detect OpenSprinkler integration when stations exist', () => {
    card._hass = {
      states: {
        'binary_sensor.s01_test_station_running': {
          state: 'off',
          attributes: { opensprinkler_type: 'station' },
        },
      },
    };
    expect(card._hasOpenSprinklerIntegration()).toBe(true);
  });

  test('should return false when no OpenSprinkler entities exist', () => {
    card._hass = {
      states: {
        'switch.some_other_entity': { state: 'off', attributes: {} },
      },
    };
    expect(card._hasOpenSprinklerIntegration()).toBe(false);
  });

  test('should return false when hass is not set', () => {
    card._hass = null;
    expect(card._hasOpenSprinklerIntegration()).toBe(false);
  });
});

describe('Hass Integration', () => {
  let CardClass;
  let card;
  let mockHass;

  beforeAll(() => {
    CardClass = global.registeredElements['opensprinkler-test-station-card'];
  });

  beforeEach(() => {
    card = new CardClass();
    card.setConfig({});

    // Mock OpenSprinkler entities using the real structure:
    // - binary_sensor.*_station_running for running state
    // - switch.*_station_enabled for control
    const now = new Date();
    const endTime = new Date(now.getTime() + 180000); // 3 minutes from now

    mockHass = {
      states: {
        'binary_sensor.s01_front_lawn_station_running': {
          state: 'off',
          attributes: {
            friendly_name: 'S01 Front Lawn Station Running',
            name: 'S01 - Front Lawn',
            opensprinkler_type: 'station',
            index: 1,
          },
        },
        'switch.s01_front_lawn_station_enabled': {
          state: 'on',
          attributes: {
            friendly_name: 'S01 Front Lawn Station Enabled',
          },
        },
        'binary_sensor.s02_backyard_station_running': {
          state: 'on',
          attributes: {
            friendly_name: 'S02 Backyard Station Running',
            name: 'S02 - Backyard',
            opensprinkler_type: 'station',
            index: 2,
            end_time: endTime.toISOString(),
          },
        },
        'switch.s02_backyard_station_enabled': {
          state: 'on',
          attributes: {
            friendly_name: 'S02 Backyard Station Enabled',
          },
        },
        'switch.unrelated_switch': {
          state: 'off',
          attributes: {
            friendly_name: 'Unrelated',
          },
        },
      },
      callService: jest.fn().mockResolvedValue(undefined),
    };
  });

  test('should update stations from hass state', () => {
    card.hass = mockHass;

    expect(card._stations).toHaveLength(2);
    expect(card._stations[0].entity_id).toBe('switch.s01_front_lawn_station_enabled');
    expect(card._stations[1].entity_id).toBe('switch.s02_backyard_station_enabled');
  });

  test('should sort stations by index', () => {
    card.hass = mockHass;

    expect(card._stations[0].index).toBe(1);
    expect(card._stations[1].index).toBe(2);
  });

  test('should call opensprinkler.run service', async () => {
    card.hass = mockHass;

    await card._runStation('switch.s01_front_lawn_station_enabled', 300);

    expect(mockHass.callService).toHaveBeenCalledWith('opensprinkler', 'run', {
      entity_id: 'switch.s01_front_lawn_station_enabled',
      run_seconds: 300,
    });
  });

  test('should call opensprinkler.stop to stop station', async () => {
    card.hass = mockHass;

    await card._stopStation('switch.s01_front_lawn_station_enabled');

    expect(mockHass.callService).toHaveBeenCalledWith('opensprinkler', 'stop', {
      entity_id: 'switch.s01_front_lawn_station_enabled',
    });
  });

  test('should call opensprinkler.stop for all-off', async () => {
    card.hass = mockHass;

    await card._stopAllStations();

    expect(mockHass.callService).toHaveBeenCalledWith('opensprinkler', 'stop', {
      entity_id: ['switch.s01_front_lawn_station_enabled', 'switch.s02_backyard_station_enabled'],
    });
  });
});

describe('Card Editor', () => {
  let EditorClass;
  let editor;

  beforeAll(() => {
    EditorClass = global.registeredElements['opensprinkler-test-station-card-editor'];
  });

  beforeEach(() => {
    editor = new EditorClass();
  });

  test('should accept config', () => {
    expect(() => editor.setConfig({ title: 'Test' })).not.toThrow();
  });

  test('should dispatch config-changed event on value change', () => {
    editor.setConfig({ title: 'Test' });

    const dispatchSpy = jest.spyOn(editor, 'dispatchEvent');
    editor._valueChanged('title', 'New Title');

    expect(dispatchSpy).toHaveBeenCalled();
    expect(editor._config.title).toBe('New Title');
  });
});
