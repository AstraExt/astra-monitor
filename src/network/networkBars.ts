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

import GObject from 'gi://GObject';

import Config from '../config.js';
import BarsBase, { BarProps } from '../bars.js';
import { MaxSpeeds, NetworkIO } from './networkMonitor.js';

type NetworkBarsParams = BarProps & {
    /* empty */
};

export default GObject.registerClass(
class NetworkBars extends BarsBase {
    private maxSpeeds?: MaxSpeeds;
    
    constructor(params: NetworkBarsParams) {
        super(params);
        
        Config.connect(this, 'changed::network-header-io-bars-color1', this.setStyle.bind(this));
        Config.connect(this, 'changed::network-header-io-bars-color2', this.setStyle.bind(this));
    }
    
    setStyle() {
        super.setStyle();
        
        this.colors = [
            Config.get_string('network-header-io-bars-color1') ?? 'rgba(29,172,214,1.0)',
            Config.get_string('network-header-io-bars-color2') ?? 'rgba(214,29,29,1.0)'
        ];
    }
    
    setMaxSpeeds(maxSpeeds: MaxSpeeds) {
        this.maxSpeeds = maxSpeeds;
    }
    
    setUsage(usage: NetworkIO) {
        const uploadSpeed = usage && usage.bytesUploadedPerSec ? usage.bytesUploadedPerSec : 0;
        const downloadSpeed = usage && usage.bytesDownloadedPerSec ? usage.bytesDownloadedPerSec : 0;
        const maxUploadSpeed = this.maxSpeeds && this.maxSpeeds.bytesUploadedPerSec ? this.maxSpeeds.bytesUploadedPerSec : 1;
        const maxDownloadSpeed = this.maxSpeeds && this.maxSpeeds.bytesDownloadedPerSec ? this.maxSpeeds.bytesDownloadedPerSec : 1;
        
        this.updateBars([
            [{ color: 0, value: uploadSpeed / maxUploadSpeed }],
            [{ color: 1, value: downloadSpeed / maxDownloadSpeed }],
        ]);
    }
});