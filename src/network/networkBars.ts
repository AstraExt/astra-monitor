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

import BarsBase, { BarProps } from '../bars.js';
import { MaxSpeeds, NetworkIO } from './networkMonitor.js';

type NetworkBarsParams = BarProps & {
    colors?: string[]
};

export default GObject.registerClass(
class NetworkBars extends BarsBase {
    private maxSpeeds?: MaxSpeeds;
    
    constructor(params: NetworkBarsParams) {
        //TODO: Make these configurable
        if(params.colors === undefined)
            params.colors = ['rgb(29,172,214)', 'rgb(214,29,29)'];
        
        super(params);
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