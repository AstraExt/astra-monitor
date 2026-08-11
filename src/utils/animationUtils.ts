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

import St from 'gi://St';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';

/**
 * Shell-only animation helpers.
 * Must not be imported from prefs: St is unavailable outside GNOME Shell.
 */
export default class AnimationUtils {
    private static readonly useParamsObject = (() => {
        const shellMajor = Number.parseInt(Config.PACKAGE_VERSION.split('.')[0], 10);
        return !Number.isNaN(shellMajor) && shellMajor >= 51;
    })();

    /**
     * Reads the system reduced-motion setting when available (GNOME 51+).
     * Older Shell versions always report false.
     */
    static get reducedMotion(): boolean {
        try {
            const reduce = (St as any).ReducedMotion?.REDUCE;
            if(reduce === undefined) return false;
            // reducedMotion is available since St/GNOME 51; @girs typings lag behind
            return (St.Settings.get() as any).reducedMotion === reduce;
        } catch(_e) {
            return false;
        }
    }

    /**
     * PopupMenu.open()/close() params adapter.
     * Shell 45-50 expect a boolean; Shell 51+ expect `{animate: boolean}`.
     * Also forces animation off when reduced motion is enabled.
     * Typed as `any` because @girs still declares the pre-51 signature.
     */
    static getMenuParams(animate: boolean): any {
        const shouldAnimate = animate && !AnimationUtils.reducedMotion;
        return AnimationUtils.useParamsObject ? { animate: shouldAnimate } : shouldAnimate;
    }
}
