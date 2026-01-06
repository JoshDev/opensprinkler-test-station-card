# OpenSprinkler Test Station Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/release/JoshDev/opensprinkler-test-station-card.svg)](https://github.com/JoshDev/opensprinkler-test-station-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Home Assistant Lovelace card for quickly testing OpenSprinkler irrigation stations. Perfect for system setup, troubleshooting, and seasonal maintenance.

## Features

- **Quick Station Testing** - Start any station with a single tap
- **Preset Run Times** - Quick presets for 1, 5, 10, and 15 minutes (customizable)
- **Live Status Display** - See which station is running and time remaining
- **Progress Indicator** - Visual progress bar for running stations
- **Emergency Stop** - All-off button to immediately stop all stations
- **Auto-Detection** - Automatically finds OpenSprinkler station entities
- **Responsive Design** - Configurable column layout (1-4 columns)
- **Theme Support** - Adapts to your Home Assistant theme

## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/JoshDev/opensprinkler-test-station-card/main/img/not-running.png" width="400" alt="Card in idle state">
  <img src="https://raw.githubusercontent.com/JoshDev/opensprinkler-test-station-card/main/img/running.png" width="400" alt="Card with running station">
</p>

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click the three dots menu → **Custom repositories**
3. Add `https://github.com/JoshDev/opensprinkler-test-station-card` as a **Lovelace** repository
4. Search for "OpenSprinkler Test Station Card" and install
5. Restart Home Assistant

### Manual Installation

1. Download `opensprinkler-test-station-card.js` from the [latest release](https://github.com/JoshDev/opensprinkler-test-station-card/releases)
2. Copy to `/config/www/opensprinkler-test-station-card.js`
3. Add the resource in **Settings → Dashboards → Resources**:
   ```yaml
   url: /local/opensprinkler-test-station-card.js
   type: module
   ```

## Configuration

### Basic Configuration

```yaml
type: custom:opensprinkler-test-station-card
title: Station Test
```

### Full Configuration

```yaml
type: custom:opensprinkler-test-station-card
title: Irrigation Test
default_runtime: 300          # Default run time in seconds (5 min)
columns: 2                    # Number of columns (1-4)
show_presets: true            # Show preset time buttons
show_all_off: true            # Show emergency stop button
presets:                      # Custom preset times in seconds
  - 60
  - 300
  - 600
  - 900
stations:                     # Optional: specific stations to show
  - switch.s01_front_lawn
  - switch.s02_back_yard
  - switch.s03_garden
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | `Station Test` | Card title |
| `default_runtime` | number | `300` | Default run time in seconds |
| `columns` | number | `2` | Number of columns (1-4) |
| `show_presets` | boolean | `true` | Show preset time buttons |
| `show_all_off` | boolean | `true` | Show emergency stop button |
| `presets` | array | `[60, 300, 600, 900]` | Preset times in seconds |
| `stations` | array | `[]` | Specific stations to show (empty = auto-detect) |

## Usage

1. **Select Run Time** - Click a preset button (1m, 5m, 10m, 15m) or use the default
2. **Start a Station** - Click the "Start" button on any station
3. **Monitor Progress** - Watch the progress bar and time remaining
4. **Stop a Station** - Click "Stop" on a running station
5. **Emergency Stop** - Click "Stop All Stations" to halt everything

## Requirements

> **Important:** This card requires the OpenSprinkler integration to be installed and configured first.

- Home Assistant 2024.1.0 or newer
- [OpenSprinkler Integration](https://github.com/vinteo/hass-opensprinkler) installed via HACS
- An OpenSprinkler controller connected to Home Assistant

The card uses the `opensprinkler.run` and `opensprinkler.stop` services provided by the integration to control stations.

## Troubleshooting

### Stations not showing up

The card auto-detects stations by looking for switch entities matching OpenSprinkler patterns. If your stations aren't detected:

1. Manually specify stations in the config:
   ```yaml
   stations:
     - switch.your_station_entity_id
   ```

2. Check that your OpenSprinkler integration is working properly

### Run command not working

The card tries to use the `opensprinkler.run` service first, then falls back to `switch.turn_on`. Make sure:

1. Your OpenSprinkler integration supports the `opensprinkler.run` service
2. The station entities are controllable switches

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenSprinkler](https://opensprinkler.com/) for the amazing irrigation controller
- [hass-opensprinkler](https://github.com/vinteo/hass-opensprinkler) for the Home Assistant integration
- The Home Assistant community for inspiration and support
