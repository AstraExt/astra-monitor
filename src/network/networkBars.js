/*
 * Copyright (C) 2023 Lju
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

import { BarsBase } from '../bars.js';

export const NetworkBars = GObject.registerClass({
    
}, class NetworkBarsBase extends BarsBase {
    constructor(params) {
        //TODO: Make these configurable
        if(params.colors === undefined)
            params.colors = ['rgb(29,172,214)', 'rgb(214,29,29)'];
        
        super(params);
    }
    
    setUsage(usage, maxSpeeds) {
        let uploadSpeed = usage && usage.bytesUploadedPerSec ? usage.bytesUploadedPerSec : 0;
        let downloadSpeed = usage && usage.bytesDownloadedPerSec ? usage.bytesDownloadedPerSec : 0;
        let maxUploadSpeed = maxSpeeds && maxSpeeds.bytesUploadedPerSec ? maxSpeeds.bytesUploadedPerSec : 1;
        let maxDownloadSpeed = maxSpeeds && maxSpeeds.bytesDownloadedPerSec ? maxSpeeds.bytesDownloadedPerSec : 1;
        
        this.updateBars([
            [{ color: 0, value: uploadSpeed / maxUploadSpeed }],
            [{ color: 1, value: downloadSpeed / maxDownloadSpeed }],
        ]);
    }
});