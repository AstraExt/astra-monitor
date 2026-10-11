/*!
 * Copyright (C) 2023 Lju
 *
 * This file is part of Astra Monitor extension for GNOME Shell.
 * [https://github.com/AstraExt/astra-monitor]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import Clutter from 'gi://Clutter';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';

/**
 * Shell-only compatibility helpers.
 * Must not be imported from prefs: Shell resources are unavailable outside GNOME Shell.
 */
export default class ShellCompat {
    private static readonly hasBoxOrientation = (() => {
        const shellMajor = Number.parseInt(Config.PACKAGE_VERSION.split('.')[0], 10);
        return !Number.isNaN(shellMajor) && shellMajor >= 48;
    })();

    /**
     * St.BoxLayout orientation params adapter, to be spread into the constructor params.
     * Shell 45-47 only know `vertical`; Shell 48+ have `orientation`; Shell 51 removed `vertical`.
     * Typed as `any` because @girs still declares the pre-48 property.
     */
    static getBoxLayoutParams(vertical: boolean): any {
        if(!ShellCompat.hasBoxOrientation) return { vertical };
        return {
            orientation: vertical ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL,
        };
    }
}