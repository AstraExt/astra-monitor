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

import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import MenuBase from '../menu.js';
import Utils from '../utils/utils.js';

import Config from '../config.js';

export default class GpuMenu extends MenuBase {
    /*private gpuSectionLabel!: St.Label;*/

    constructor(sourceActor: St.Widget, arrowAlignment: number, arrowSide: St.Side) {
        super(sourceActor, arrowAlignment, { name: 'Gpu Menu', arrowSide });

        /*this.gpuSectionLabel = */ this.addMenuSection(_('GPU'));

        this.addUtilityButtons('gpu');
    }

    async onOpen() {
        this.clear();
    }

    async onClose() {}

    clear() {
        //Clear elements before updating them (in case of a lagging update)
    }

    update(_code: string, ..._args: any[]) {}

    destroy() {
        this.close(true);
        this.removeAll();

        Utils.gpuMonitor.unlisten(this);

        Config.clear(this);

        super.destroy();
    }
}
