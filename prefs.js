/*
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

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences, gettext as _, pgettext} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import Utils from './src/utils/utils.js';
import Config from './src/config.js';

export default class AstraMonitorPrefs extends ExtensionPreferences {
    minimumSize = { width: 500, height: 300 };
    defaultSize = { width: 800, height: 700 };
    
    loadCustomTheme() {
        try {
            let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
            const iconsPath = Utils.metadata.dir.get_child('icons').get_path();
            iconTheme.add_search_path(iconsPath);
        }
        catch(e) {
            Utils.error(e);
        }
    }
    
    fillPreferencesWindow(window) {
        Utils.init({
            metadata: this.metadata,
            settings: this.getSettings()
        });
        
        window.connect('close-request', () => {
            Utils.clear();
        });
        
        this.loadCustomTheme();
        this.expanded = null;
        this.tab = ' '.repeat(5);
        
        const defaultCategory = Config.get_string('queued-pref-category');
        Config.set('queued-pref-category', '', 'string');
        
        const generalPage = this.setupGeneral();
        window.add(generalPage);
        
        const processorsPage = this.setupProcessors();
        window.add(processorsPage);
        
        const memoryPage = this.setupMemory();
        window.add(memoryPage);
        
        const storagePage = this.setupStorage();
        window.add(storagePage);
        
        const networkPage = this.setupNetwork();
        window.add(networkPage);
        
        const sensorsPage = this.setupSensors();
        window.add(sensorsPage);
        
        const aboutPage = this.setupAbout();
        window.add(aboutPage);
        
        if(defaultCategory) {
            if(defaultCategory === 'processors')
                window.set_visible_page(processorsPage);
            else if(defaultCategory === 'memory')
                window.set_visible_page(memoryPage);
            else if(defaultCategory === 'storage')
                window.set_visible_page(storagePage);
            else if(defaultCategory === 'network')
                window.set_visible_page(networkPage);
            else if(defaultCategory === 'sensors')
                window.set_visible_page(sensorsPage);
            else if(defaultCategory === 'about')
                window.set_visible_page(aboutPage);
        }
        
        window.set_default_size(this.defaultSize.width, this.defaultSize.height);
        window.set_size_request(this.minimumSize.width, this.minimumSize.height);
    }
    
    setupGeneral() {
        const generalPage = new Adw.PreferencesPage({title: _('General'), iconName: 'am-settings-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Dependencies')});
        let check = true;
        if(!Utils.hasProcStat())
            check = false, this.addStatusLabel(_('Cannot access /proc/stat: this extension will not work!'), 'am-dialog-error-symbolic', group);
        if(!Utils.hasProcCpuinfo())
            check = false, this.addStatusLabel(_('Cannot access /proc/cpuinfo: this extension will not work!'), 'am-dialog-error-symbolic', group);
        if(!Utils.hasProcMeminfo())
            check = false, this.addStatusLabel(_('Cannot access /proc/meminfo: this extension will not work!'), 'am-dialog-error-symbolic', group);
        if(!Utils.hasProcDiskstats())
            check = false, this.addStatusLabel(_('Cannot access /proc/diskstats: this extension will not work!'), 'am-dialog-error-symbolic', group);
        if(!Utils.hasProcNetDev())
            check = false, this.addStatusLabel(_('Cannot access /proc/net/dev: this extension will not work!'), 'am-dialog-error-symbolic', group);
        if(!Utils.hasPs())
            check = false, this.addStatusLabel(_('Cannot access \'ps\': this extension will not work!'), 'am-dialog-error-symbolic', group);
        if(!Utils.hasSensors())
            check = false, this.addStatusLabel(_('\'lm-sensors\' not installed: some features will be disabled!'), 'am-dialog-warning-symbolic', group);
        if(!Utils.hasLscpu())
            check = false, this.addStatusLabel(_('\'lscpu\' not installed: some features will be disabled!'), 'am-dialog-warning-symbolic', group);
        if(!Utils.hasLspci())
            check = false, this.addStatusLabel(_('\'lspci\' not installed: some features will be disabled!'), 'am-dialog-warning-symbolic', group);
        if(!Utils.hasLsblk())
            check = false, this.addStatusLabel(_('\'lsblk\' not installed: some features will be disabled!'), 'am-dialog-warning-symbolic', group);
        if(!Utils.hasCoresFrequency())
            check = false, this.addStatusLabel(_('Cannot access /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq: some features will be disabled!'), 'am-dialog-warning-symbolic', group);
        
        /*if(Utils.hasAMDGpu() && !Utils.hasAmdGpuTop() && !Utils.hasRadeonTop())
            check = false, this.addStatusLabel(_('AMD GPU detected but \'amdgpu_top/radeontop\' not installed: some features will be disabled!'), 'am-dialog-warning-symbolic', group);
        if(Utils.hasNVidiaGpu() && !Utils.hasNvidiaSmi())
            check = false, this.addStatusLabel(_('NVidia GPU detected but \'nvidia-smi\' not installed: some features will be disabled!'), 'am-dialog-warning-symbolic', group);
        if(Utils.hasIntelGpu() && !Utils.hasIntelGpuTop())
            check = false, this.addStatusLabel(_('Intel GPU detected but \'intel_gpu_top\' not installed: some features will be disabled!'), 'am-dialog-warning-symbolic', group);
        */
       
        const statusLabel = this.addStatusLabel(_('Checking GTop dependency...'), 'am-dialog-info-symbolic', group);
        Utils.hasGTop().then(GTopAvailable => {
            if(!GTopAvailable) {
                statusLabel.updateText(_('\'GTop\' not installed, some optional features will be disabled!'));
                statusLabel.updateIcon('am-dialog-warning-symbolic');
            }
            else if(check) {
                statusLabel.updateText(_('\'GTop\' successfully detected and added to Data Sources list.'));
                statusLabel.updateIcon('am-dialog-ok-symbolic');
                
            }
        }).catch(e => {
            Utils.error(e);
            statusLabel.updateText(_('\'GTop\' not installed, some optional features will be disabled!'));
            statusLabel.updateIcon('am-dialog-warning-symbolic');
        });
        
        if(check)
            this.addStatusLabel(_('All other dependencies are met!'), 'am-dialog-ok-symbolic', group);
        generalPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Visualization')});
        
        const themeSection = this.addExpanderRow(_('Theme'), group);
        let choicesPanel = [
            {value: 'dark', text: _('Dark')},
            {value: 'light', text: _('Light')}
        ];
        this.addComboRow(this.tab + _('Shell Theme Style'), choicesPanel, 'theme-style', themeSection, 'string');
        
        const panelSection = this.addExpanderRow(_('Panel Box'), group);
        choicesPanel = [
            {value: 'left', text: _('Left')},
            {value: 'center', text: _('Center')},
            {value: 'right', text: _('Right')},
        ];
        this.addComboRow(this.tab + _('Position'), choicesPanel, 'panel-box', panelSection, 'string');
        this.addSpinRow({title: this.tab + _('Order')}, 'panel-box-order', panelSection, {min: -10, max: 10, digits: 0, step: 1, page: 1}, true);
        
        const headersSection = this.addExpanderRow(_('Headers'), group);
        this.addSpinRow({
            title: this.tab + _('Headers Height'),
            subtitle:  this.tab + _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic'
        }, 'headers-height', headersSection, {min: 15, max: 80, digits: 0, step: 1, page: 5}, true, 28);
        this.addSpinRow({
            title: this.tab + _('Headers Margins'),
            subtitle:  this.tab + _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic'
        }, 'headers-margins', headersSection, {min: 0, max: 15, digits: 0, step: 1, page: 2}, true, 2);
        this.addFontRow({
            title: this.tab + _('Headers Font'),
            subtitle:  this.tab + _('Experimental feature: may require to disable/enable the extension.') + '\n' + this.tab + _('Set to empty to disable font override'),
            icon_name: 'am-dialog-warning-symbolic'
        }, 'headers-font-family', headersSection, '');
        this.addSpinRow({
            title: this.tab + _('Headers Font Size'),
            subtitle:  this.tab + _('Experimental feature: may require to disable/enable the extension.') + '\n' + this.tab + _('Set to 0 to disable size override'),
            icon_name: 'am-dialog-warning-symbolic'
        }, 'headers-font-size', headersSection, {min: 0, max: 30, digits: 0, step: 1, page: 2}, true, 0);
        
        generalPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Monitor Ordering')});
        Utils.getMonitorsOrder();
        this.addOrderingRows('monitors-order', group);
        generalPage.add(group);
        
        return generalPage;
    }
    
    setupProcessors() {
        const processorsPage = new Adw.PreferencesPage({title: _('Processors'), icon_name: 'am-cpu-symbolic'});
        
        /* Processors */
        let group = new Adw.PreferencesGroup({title: _('Processors')});
        this.addSwitchRow(_('Show'), 'processor-header-show', group);
        this.addSpinRow({title: _('Update frequency (seconds)')}, 'processor-update', group, {min: 0.1, max: 10, digits: 1, step: 0.1, page: 1}, true);
        
        const sourcesSection = this.addExpanderRow(_('Data Sources'), group);
        const choicesPanel = [
            {value: 'default', text: 'default (auto)'},
            {value: 'auto', text: 'auto'},
            {value: 'proc', text: 'proc'},
            {value: 'GTop', text: 'GTop'},
        ];
        this.addComboRow(this.tab + _('Top Processes'), choicesPanel, 'processor-source-top-processes', sourcesSection, 'string');
        
        processorsPage.add(group);

        /* Header */
        group = new Adw.PreferencesGroup({title: _('Header')});
        
        const orderSection = this.addExpanderRow(_('Indicators Order'), group);
        Utils.getIndicatorsOrder('processor');
        this.addOrderingRows('processor-indicators-order', orderSection, this.tab);
        
        const iconSection = this.addExpanderRow(_('Icon'), group);
        this.addSwitchRow(this.tab + _('Show Icon'), 'processor-header-icon', iconSection);
        this.addTextInputRow({
            title: this.tab + _('Icon Name'),
            subtitle:  this.tab + _('Set icon name (ie: \'cpu-symbolic\')') + '\n' + this.tab + _('Set to empty to disable icon override'),
        }, 'processor-header-icon-custom', iconSection, '');
        this.addColorRow({ title: this.tab + _('Icon Color') }, 'processor-header-icon-color', iconSection, '');
        this.addSpinRow({
            title: this.tab + _('Icon Size'),
            subtitle:  this.tab + _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic'
        }, 'processor-header-icon-size', iconSection, {min: 8, max: 30, digits: 0, step: 1, page: 1}, true, 18);
        
        const tooltipSection = this.addExpanderRow(_('Tooltip'), group);
        this.addSwitchRow(this.tab + _('Show Tooltip'), 'processor-header-tooltip', tooltipSection);
        
        const percentageSection = this.addExpanderRow(_('Percentage'), group);
        this.addSwitchRow(this.tab + _('Show Percentage'), 'processor-header-percentage', percentageSection);
        this.addSwitchRow(this.tab + _('Show Percentage Single Core'), 'processor-header-percentage-core', percentageSection);
        
        const graphSection = this.addExpanderRow(_('History Graph'), group);
        this.addSwitchRow(this.tab + _('Show History Graph'), 'processor-header-graph', graphSection);
        this.addSwitchRow(this.tab + _('History Graph Breakdown'), 'processor-header-graph-breakdown', graphSection);
        this.addSpinRow({title: this.tab + _('History Graph Width')}, 'processor-header-graph-width', graphSection, {min: 10, max: 500, digits: 0, step: 1, page: 10}, true);
        
        const barsSection = this.addExpanderRow(_('Realtime Bar'), group);
        this.addSwitchRow(this.tab + _('Show Realtime Bar'), 'processor-header-bars', barsSection);
        this.addSwitchRow(this.tab + _('Realtime per-core Bars'), 'processor-header-bars-core', barsSection);
        this.addSwitchRow(this.tab + _('Realtime Bar Breakdown'), 'processor-header-bars-breakdown', barsSection);
        processorsPage.add(group);
        
        /* Menu */
        group = new Adw.PreferencesGroup({title: _('Menu')});
        const cpuSection = this.addExpanderRow(_('CPU'), group);
        this.addSwitchRow(this.tab + _('Realtime Bars Breakdown'), 'processor-menu-bars-breakdown', cpuSection);
        this.addSwitchRow(this.tab + _('History Graph Breakdown'), 'processor-menu-graph-breakdown', cpuSection);
        this.addSwitchRow(this.tab + _('Core Bars Breakdown'), 'processor-menu-core-bars-breakdown', cpuSection);
        this.addSwitchRow(this.tab + _('Top Processes Single Core'), 'processor-menu-top-processes-percentage-core', cpuSection);
        const gpuSection = this.addExpanderRow(_('GPU'), group);
        
        const gpus = Utils.getGPUsList();
        const choicesSource = [{value: '', text: _('None')}]
        for(const gpu of gpus) {
            const keysToKeep = ['domain', 'bus', 'slot', 'vendorId', 'productId'];
            const data = Object.keys(gpu)
                .filter(key => keysToKeep.includes(key))
                .reduce((obj, key) => {
                    obj[key] = gpu[key];
                    return obj;
                }, {});
            choicesSource.push({value: data, text: Utils.getGPUModelName(gpu)});
        }
        this.addComboRow(_('Main GPU'), choicesSource, 'processor-menu-gpu', gpuSection, 'json');
        
        processorsPage.add(group);
        
        return processorsPage;
    }
    
    setupMemory() {
        const memoryPage = new Adw.PreferencesPage({title: _('Memory'), icon_name: 'am-memory-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Memory')});
        this.addSwitchRow(_('Show'), 'memory-header-show', group);
        this.addSpinRow({title: _('Update frequency (seconds)')}, 'memory-update', group, {min: 0.1, max: 10, digits: 1, step: 0.1, page: 1}, true);
        
        const choicesPanel = [
            {value: 'total-free-buffers-cached', text: _('Total - Free - Buffers - Cached')},
            {value: 'total-free', text: _('Total - Free')},
            {value: 'total-available', text: _('Total - Available')},
            {value: 'active', text: _('Active')},
        ];
        this.addComboRow(_('Used Memory'), choicesPanel, 'memory-used', group, 'string');
        
        memoryPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Header')});
        
        const orderSection = this.addExpanderRow(_('Indicators Order'), group);
        Utils.getIndicatorsOrder('memory');
        this.addOrderingRows('memory-indicators-order', orderSection, this.tab);
        
        const iconSection = this.addExpanderRow(_('Icon'), group);
        this.addSwitchRow(this.tab + _('Show Icon'), 'memory-header-icon', iconSection);
        this.addTextInputRow({
            title: this.tab + _('Icon Name'),
            subtitle:  this.tab + _('Set icon name (ie: \'memory-symbolic\')') + '\n' + this.tab + _('Set to empty to disable icon override'),
        }, 'memory-header-icon-custom', iconSection, '');
        this.addColorRow({ title: this.tab + _('Icon Color') }, 'memory-header-icon-color', iconSection, '');
        this.addSpinRow({
            title: this.tab + _('Icon Size'),
            subtitle:  this.tab + _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic'
        }, 'memory-header-icon-size', iconSection, {min: 8, max: 30, digits: 0, step: 1, page: 1}, true, 18);
        
        const tooltipSection = this.addExpanderRow(_('Tooltip'), group);
        this.addSwitchRow(this.tab + _('Show Tooltip'), 'memory-header-tooltip', tooltipSection);
        
        const percentageSection = this.addExpanderRow(_('Usage Percentage'), group);
        this.addSwitchRow(this.tab + _('Show Usage Percentage'), 'memory-header-percentage', percentageSection);
        
        const valueSection = this.addExpanderRow(_('Usage Value'), group);
        this.addSwitchRow(this.tab + _('Show Usage Value'), 'memory-header-value', valueSection);
        this.addSpinRow({title: this.tab + _('Usage Value Number Max Figures')}, 'memory-header-value-figures', valueSection, {min: 2, max: 4, digits: 0, step: 1, page: 1}, true); 
        
        const graphSection = this.addExpanderRow(_('History Graph'), group);
        this.addSwitchRow(this.tab + _('Show History Graph'), 'memory-header-graph', graphSection);
        this.addSwitchRow(this.tab + _('History Graph Breakdown'), 'memory-header-graph-breakdown', graphSection);
        this.addSpinRow({title: this.tab + _('History Graph Width')}, 'memory-header-graph-width', graphSection, {min: 10, max: 500, digits: 0, step: 1, page: 10}, true);
        
        const barsSection = this.addExpanderRow(_('Realtime Bar'), group);
        this.addSwitchRow(this.tab + _('Show Realtime Bar'), 'memory-header-bars', barsSection);
        this.addSwitchRow(this.tab + _('Realtime Bar Breakdown'), 'memory-header-bars-breakdown', barsSection);
        memoryPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Menu')});
        this.addSwitchRow(_('History Graph Breakdown'), 'memory-menu-graph-breakdown', group);
        
        memoryPage.add(group);
        
        return memoryPage;
    }
    
    setupStorage() {
        const storagePage = new Adw.PreferencesPage({title: _('Storage'), icon_name: 'am-harddisk-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Storage')});
        this.addSwitchRow(_('Show'), 'storage-header-show', group);
        this.addSpinRow({title: _('Update frequency (seconds)')}, 'storage-update', group, {min: 0.1, max: 10, digits: 1, step: 0.1, page: 1}, true);
        
        const choicesPanel = [
            {value: 'kB/s', text: _('kB/s')},
            {value: 'KiB/s', text: _('KiB/s')},
            {value: 'kb/s', text: _('kb/s')},
            {value: 'Kibit/s', text: _('Kibit/s')},
            {value: 'kBps', text: _('kBps')},
            {value: 'KiBps', text: _('KiBps')},
            {value: 'Kibps', text: _('Kibps')},
            {value: 'kbps', text: _('kbps')},
            {value: 'Kibitps', text: _('Kibitps')},
            {value: 'k ', text: _('k (as kB/s)')},
            {value: 'Ki', text: _('Ki (as KiB/s)')},
        ];
        this.addComboRow(_('Data Unit'), choicesPanel, 'storage-io-unit', group, 'string');
        
        const storageMain = Config.get_string('storage-main');
        const disks = Utils.listDisksSync();
        
        if(storageMain === '[default]' || !disks.has(storageMain)) {
            const defaultId = Utils.findDefaultDisk(disks);
            if(defaultId !== null)
                Config.set('storage-main', defaultId, 'string');
        }
        
        const choicesSource = [];
        for(const [id, disk] of disks) {
            let text;
            if(disk.label && disk.name)
                text = disk.label + ' (' + disk.name + ')';
            else if(disk.label)
                text = disk.label;
            else if(disk.name)
                text = disk.name;
            else
                text = id;
            choicesSource.push({value: id, text: text});
        }
        this.addComboRow(_('Main Disk'), choicesSource, 'storage-main', group, 'string');
        
        storagePage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Header')});
        
        const orderSection = this.addExpanderRow(_('Indicators Order'), group);
        Utils.getIndicatorsOrder('storage');
        this.addOrderingRows('storage-indicators-order', orderSection, this.tab);
        
        const iconSection = this.addExpanderRow(_('Icon'), group);
        this.addSwitchRow(this.tab + _('Show Icon'), 'storage-header-icon', iconSection);
        this.addTextInputRow({
            title: this.tab + _('Icon Name'),
            subtitle:  this.tab + _('Set icon name (ie: \'drive-harddisk-symbolic\')') + '\n' + this.tab + _('Set to empty to disable icon override'),
        }, 'storage-header-icon-custom', iconSection, '');
        this.addColorRow({ title: this.tab + _('Icon Color') }, 'storage-header-icon-color', iconSection, '');
        this.addSpinRow({
            title: this.tab + _('Icon Size'),
            subtitle:  this.tab + _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic'
        }, 'storage-header-icon-size', iconSection, {min: 8, max: 30, digits: 0, step: 1, page: 1}, true, 18);
        
        const tooltipSection = this.addExpanderRow(_('Tooltip'), group);
        this.addSwitchRow(this.tab + _('Show Tooltip'), 'storage-header-tooltip', tooltipSection);
        
        const barsSection = this.addExpanderRow(_('Main Disk'), group);
        this.addSwitchRow(this.tab + _('Show Storage Usage Bar'), 'storage-header-bars', barsSection);
        this.addSwitchRow(this.tab + _('Show Storage Usage Percentage'), 'storage-header-percentage', barsSection);
        
        const ioSection = this.addExpanderRow(_('IO'), group);
        this.addSwitchRow(this.tab + _('Show Realtime IO Bar'), 'storage-header-io-bars', ioSection);
        this.addSwitchRow(this.tab + _('Show IO History Graph'), 'storage-header-graph', ioSection);  
        this.addSpinRow({title: this.tab + _('IO History Graph Width')}, 'storage-header-graph-width', ioSection, {min: 10, max: 500, digits: 0, step: 1, page: 10}, true);
        this.addSwitchRow(this.tab + _('Show IO Speed'), 'storage-header-io', ioSection);  
        this.addSpinRow({title: this.tab + _('IO Speed Number Max Figures')}, 'storage-header-io-figures', ioSection, {min: 2, max: 4, digits: 0, step: 1, page: 1}, true); 
        this.addSpinRow({title: this.tab + _('IO Speed Threshold'), subtitle: this.tab + _('in kB/s')}, 'storage-header-io-threshold', ioSection, {min: 0, max: 1000000, digits: 0, step: 1000, page: 10000}, true); 
        
        storagePage.add(group);
        
        return storagePage;
    }
    
    setupNetwork() {
        const networkPage = new Adw.PreferencesPage({title: _('Network'), icon_name: 'am-network-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Network')});
        this.addSwitchRow(_('Show'), 'network-header-show', group);
        this.addSpinRow({title: _('Update frequency (seconds)')}, 'network-update', group, {min: 0.1, max: 10, digits: 1, step: 0.1, page: 1}, true);
        
        const choicesPanel = [
            {value: 'kB/s', text: _('kB/s')},
            {value: 'KiB/s', text: _('KiB/s')},
            {value: 'kb/s', text: _('kb/s')},
            {value: 'Kibit/s', text: _('Kibit/s')},
            {value: 'kBps', text: _('kBps')},
            {value: 'KiBps', text: _('KiBps')},
            {value: 'Kibps', text: _('Kibps')},
            {value: 'kbps', text: _('kbps')},
            {value: 'Kibitps', text: _('Kibitps')},
            {value: 'k ', text: _('k (as kB/s)')},
            {value: 'Ki', text: _('Ki (as KiB/s)')},
        ];
        this.addComboRow(_('Data Unit'), choicesPanel, 'network-io-unit', group, 'string');
        
        const ignoredSection = this.addExpanderRow(_('Ignored Network Interfaces'), group);
        
        this.addTextInputRow({
            title: this.tab + _('Regex'),
            subtitle: this.tab + _('Interfaces matching this regex will be ignored.') + '\n' + this.tab + _('Leave empty to disable. Use example:') + '\'veth\w{3,16}\'',
        }, 'network-ignored-regex', ignoredSection, '');
        
        const devices = Utils.getNetworkInterfacesSync();
        let ignoredDevices = Config.get_json('network-ignored');
        if(ignoredDevices === null || !Array.isArray(ignoredDevices))
            ignoredDevices = [];
        
        for(const [name, device] of devices.entries()) {
            const status = !ignoredDevices.includes(name);
            
            const subtitle = status ? _('Active') : _('Ignored');
            
            const row = new Adw.ActionRow({ title: name, subtitle });
            ignoredSection.add_row(row);
            
            const icon_name = status ? 'am-dialog-ok-symbolic' : 'am-dialog-error-symbolic';
            
            const icon = new Gtk.Image({ icon_name: icon_name });
            icon.set_margin_start(15);
            icon.set_margin_end(10);
            row.add_prefix(icon);
            
            const toggle = new Gtk.Switch({
                active: !status,
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
            });
            
            toggle.connect('state-set', (switchObj, state) => {
                if(state) {
                    row.subtitle = _('Ignored');
                    icon.icon_name = 'am-dialog-error-symbolic';
                    
                    let ignoredDevices = Config.get_json('network-ignored');
                    if(ignoredDevices === null || !Array.isArray(ignoredDevices))
                        ignoredDevices = [];
                    if(!ignoredDevices.includes(name))
                        ignoredDevices.push(name);
                    Config.set('network-ignored', JSON.stringify(ignoredDevices), 'string');
                } else {
                    row.subtitle = _('Active');
                    icon.icon_name = 'am-dialog-ok-symbolic';
                    
                    let ignoredDevices = Config.get_json('network-ignored');
                    if(ignoredDevices === null || !Array.isArray(ignoredDevices))
                        ignoredDevices = [];
                    if(ignoredDevices.includes(name))
                        ignoredDevices = ignoredDevices.filter(device => device !== name);
                    Config.set('network-ignored', JSON.stringify(ignoredDevices), 'string');
                }
            });
            
            row.add_suffix(toggle);
            row.activatable_widget = toggle;
        }
        
        networkPage.add(group);
        
        group = new Adw.PreferencesGroup({title: 'Header'});
        
        const orderSection = this.addExpanderRow(_('Indicators Order'), group);
        Utils.getIndicatorsOrder('network');
        this.addOrderingRows('network-indicators-order', orderSection, this.tab);
        
        const iconSection = this.addExpanderRow(_('Icon'), group);
        this.addSwitchRow(this.tab + _('Show Icon'), 'network-header-icon', iconSection);
        this.addTextInputRow({
            title: this.tab + _('Icon Name'),
            subtitle:  this.tab + _('Set icon name (ie: \'network-wired-symbolic\')') + '\n' + this.tab + _('Set to empty to disable icon override'),
        }, 'network-header-icon-custom', iconSection, '');
        this.addColorRow({ title: this.tab + _('Icon Color') }, 'network-header-icon-color', iconSection, '');
        this.addSpinRow({
            title: this.tab + _('Icon Size'),
            subtitle:  this.tab + _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic'
        }, 'network-header-icon-size', iconSection, {min: 8, max: 30, digits: 0, step: 1, page: 1}, true, 18);
        
        const tooltipSection = this.addExpanderRow(_('Tooltip'), group);
        this.addSwitchRow(this.tab + _('Show Tooltip'), 'network-header-tooltip', tooltipSection);
        
        const ioSection = this.addExpanderRow(_('IO'), group);
        this.addSwitchRow(this.tab + _('Show Realtime IO Bar'), 'network-header-bars', ioSection);
        this.addSwitchRow(this.tab + _('Show IO History Graph'), 'network-header-graph', ioSection); 
        this.addSpinRow({title: this.tab + _('IO History Graph Width')}, 'network-header-graph-width', ioSection, {min: 10, max: 500, digits: 0, step: 1, page: 10}, true); 
        this.addSwitchRow(this.tab + _('Show IO Speed'), 'network-header-io', ioSection);
        this.addSpinRow({title: this.tab + _('IO Speed Number Max Figures')}, 'network-header-io-figures', ioSection, {min: 2, max: 4, digits: 0, step: 1, page: 1}, true); 
        this.addSpinRow({title: this.tab + _('IO Speed Threshold'), subtitle: this.tab + _('in kB/s')}, 'network-header-io-threshold', ioSection, {min: 0, max: 1000000, digits: 0, step: 1000, page: 10000}, true); 

        networkPage.add(group);
        
        return networkPage;
    }
    
    setupSensors() {
        const sensorsPage = new Adw.PreferencesPage({title: _('Sensors'), icon_name: 'am-temperature-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Sensors')});
        this.addSwitchRow(_('Show'), 'sensors-header-show', group);
        this.addSpinRow({title: _('Update frequency (seconds)')}, 'sensors-update', group, {min: 1, max: 60, digits: 1, step: 0.5, page: 1}, true);
        
        let choicesUnit = [
            {value: 'celsius', text: pgettext('Celsius unit measure choice', 'Celsius')},
            {value: 'fahrenheit', text: pgettext('Fahrenheit unit measure choice', 'Fahrenheit')},
        ];
        this.addComboRow(_('Temperature Unit'), choicesUnit, 'sensors-temperature-unit', group, 'string');
        sensorsPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Header')});
        
        const orderSection = this.addExpanderRow(_('Indicators Order'), group);
        Utils.getIndicatorsOrder('sensors');
        this.addOrderingRows('sensors-indicators-order', orderSection, this.tab);
        
        const iconSection = this.addExpanderRow(_('Icon'), group);
        this.addSwitchRow(this.tab + _('Show Icon'), 'sensors-header-icon', iconSection);
        this.addTextInputRow({
            title: this.tab + _('Icon Name'),
            subtitle:  this.tab + _('Set icon name (ie: \'temperature-symbolic\')') + '\n' + this.tab + _('Set to empty to disable icon override'),
        }, 'sensors-header-icon-custom', iconSection, '');
        this.addColorRow({ title: this.tab + _('Icon Color') }, 'sensors-header-icon-color', iconSection, '');
        this.addSpinRow({
            title: this.tab + _('Icon Size'),
            subtitle:  this.tab + _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic'
        }, 'sensors-header-icon-size', iconSection, {min: 8, max: 30, digits: 0, step: 1, page: 1}, true, 18);
        
        const tooltipSection = this.addExpanderRow(_('Tooltip'), group);
        this.addSwitchRow(this.tab + _('Show Tooltip'), 'sensors-header-tooltip', tooltipSection);
        
        const sources = Utils.getSensorSources();
        
        /**
         * @type {{value:string, text:string}[]}
         */
        const choicesSource = [{value: '', text: _('None')}]
        for(const source of sources)
            choicesSource.push({value: source.value, text: source.text});
        
        const sensor1Section = this.addExpanderRow(_('Sensor 1'), group);
        this.addSwitchRow(this.tab + _('Show'), 'sensors-header-sensor1-show', sensor1Section);
        this.addComboRow(this.tab + _('Source'), choicesSource, 'sensors-header-sensor1', sensor1Section, 'json');
        
        const sensor2Section = this.addExpanderRow(_('Sensor 2'), group);
        this.addSwitchRow(this.tab + _('Show'), 'sensors-header-sensor2-show', sensor2Section);
        this.addComboRow(this.tab + _('Source'), choicesSource, 'sensors-header-sensor2', sensor2Section, 'json');
        sensorsPage.add(group);
        
        return sensorsPage;
    }
    
    setupAbout() {
        const aboutPage = new Adw.PreferencesPage({title: 'About', icon_name: 'am-dialog-info-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Info')});
        
        let version;
        if(this.metadata['version-name'] === this.metadata['version'])
            version = 'v'+this.metadata['version'];
        else if(this.metadata['version-name'])
            version = this.metadata['version-name'] + ' (EGOv' + this.metadata['version'] + ')';
        else
            version = 'EGOv' + this.metadata['version'];
        
        this.addLabelRow(_('Version'), version, group);
        this.addLinkRow(_('Changelog'), 'https://github.com/AstraExt/astra-monitor/blob/main/RELEASES.md', group);
        this.addLinkRow(_('GitHub'), 'https://github.com/AstraExt/astra-monitor', group);
        this.addLinkRow(_('GNOME Extensions page'), 'https://extensions.gnome.org/extension/6682/astra-monitor/', group);
        this.addLinkRow(_('Report a bug or suggest new feature'), 'https://github.com/AstraExt/astra-monitor/issues/new/choose', group);
        this.addLinkRow('<span color="#FFC000">★ ' + _('Buy us a coffee') + '</span>', 'https://www.buymeacoffee.com/astra.ext', group);
        this.addLinkRow('<span color="#FFC000">★ ' + _('Become a patron') + '</span>', 'https://www.patreon.com/AstraExt', group);
        this.addSwitchRow(_('Debug Mode'), 'debug-mode', group);
        aboutPage.add(group);
        
        return aboutPage;
    }
    
    addExpanderRow(title, group, icon_name = null) {
        const data = {
            title: `⁝ ${title}`,
            use_markup: true
        };
        if(icon_name)
            data.icon_name = icon_name;
        const section = new Adw.ExpanderRow(data);
        section.connect('notify::expanded', widget => {
            if(widget.expanded) {
                if(this.expanded && this.expanded !== widget)
                    this.expanded.expanded = false;
                this.expanded = widget;
            }
            else {
                if(this.expanded === widget)
                    this.expanded = null;
            }
        });
        group.add(section);
        return section;
    }
    
    addLabelRow(title, label, group) {
        const row = new Adw.ActionRow({title});
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
        
        const labelWidget = new Gtk.Label({label});
        row.add_suffix(labelWidget);
    }
    
    addTextInputRow(props, setting, group, reset = null) {
        const row = new Adw.ActionRow(props);
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
        
        const entry = new Gtk.Entry({
            text: Config.get_string(setting),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        let timeoutId;
        
        entry.connect('changed', widget => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                Config.set(setting, widget.get_text(), 'string');
            }, 1000);
        });
        
        if(reset !== null) {
            const resetButton = new Gtk.Button({
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
                icon_name: 'edit-undo-symbolic',
                sensitive: true,
            });
            row.add_suffix(resetButton);
            
            resetButton.connect('clicked', () => {
                Config.set(setting, reset, 'string');
                entry.set_text(reset);
            });
            row.add_suffix(resetButton);
        }
        
        row.add_suffix(entry);
        row.activatable_widget = entry;
    }
    
    addButtonRow(title, group, callback) {
        const row = new Adw.ActionRow({title});
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
        
        row.activatable = true;
        row.connect('activate', callback);
    }
    
    addLinkRow(title, url, group) {
        const row = new Adw.ActionRow({
            title,
            use_markup: true
        });
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
        
        const linkBtn = new Gtk.LinkButton({
            label: '',
            uri: url,
            halign: Gtk.Align.END,
            widthRequest: 1,
            opacity: 0,
            cursor: null
        });
        row.add_suffix(linkBtn);
        row.activatable_widget = linkBtn;
    }
    
    addStatusLabel(title, iconName, group) {
        let row = new Adw.ActionRow({title});
        let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        let icon = new Gtk.Image({ icon_name: iconName });
        icon.set_margin_end(10);
        box.append(icon);
        row.add_prefix(box);
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
        
        return {
            row: row,
            icon: icon,
            updateText: function(newTitle) {
                row.title = newTitle;
            },
            updateIcon: function(newIconName) {
                icon.set_from_icon_name(newIconName);
            }
        };
    }
    
    addSwitchRow(title, setting, group) {
        const row = new Adw.ActionRow({title});
        
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
        
        let toggle = new Gtk.Switch({
            active: Config.get_boolean(setting),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        Config.bind(setting, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);

        row.add_suffix(toggle);
        row.activatable_widget = toggle;
    }
    
    /**
     * 
     * @param {{title}} props 
     * @param {string} setting 
     * @param {*} group 
     * @param {string} reset
     */
    addColorRow(props, setting, group, reset = null) {
        const row = new Adw.ActionRow(props);
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
        
        const button = new Gtk.ColorButton();
        const rgba = new Gdk.RGBA();
        rgba.parse(Config.get_string(setting));
        button.set_rgba(rgba);
        button.connect('color-set', widget => {
            Config.set(setting, widget.get_rgba().to_string(), 'string');
        });
        
        if(reset !== null) {
            const resetButton = new Gtk.Button({
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
                icon_name: 'edit-undo-symbolic',
                sensitive: true,
            });
            row.add_suffix(resetButton);
            
            resetButton.connect('clicked', () => {
                Config.set(setting, reset, 'string');
                const rgba = new Gdk.RGBA();
                rgba.parse(reset);
                button.set_rgba(rgba);
            });
            row.add_suffix(resetButton);
        }
        
        row.add_suffix(button);
        row.activatable_widget = button;
    }
    
    /**
     * @param {string} title 
     * @param {{value:any, text:string}[]} choices 
     * @param {string} setting 
     * @param {*} group 
     * @param {'any'|'boolean'|'string'|'int'|'number'|'json'} type 
     */
    addComboRow(title, choices, setting, group, type = 'int') {
        let selected = -1;
        let savedValue;
        
        switch (type) {
            case 'boolean':
                savedValue = Config.get_boolean(setting);
                break;
            case 'string':
                savedValue = Config.get_string(setting);
                break;
            case 'int':
                savedValue = Config.get_int(setting);
                break;
            case 'number':
                savedValue = Config.get_double(setting);
                break;
            case 'json':
                savedValue = Config.get_string(setting)
                break;
            default:
                savedValue = Config.get_value(setting);
                break;
        }
        
        const stringList = new Gtk.StringList();
        choices.forEach(choice => stringList.append(choice.text));
        choices.forEach((choice, index) => {
            let value = choice.value;
            if(type === 'json')
                value = JSON.stringify(value);
            if(value === savedValue)
                selected = index;
        });
        
        const row = new Adw.ActionRow({title});
        
        const select = new Gtk.DropDown({
            model: stringList,
            selected,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        
        row.add_suffix(select);
        row.activatable_widget = select;
        
        if(choices[selected] && choices[selected].text)
            select.set_tooltip_text(choices[selected].text);
        select.connect('notify::selected', widget => {
            const selectedIndex = widget.selected;
            const selectedChoice = choices[selectedIndex];
            if(selectedChoice !== undefined) {
                row.set_tooltip_text(selectedChoice.text);
                
                if(type === 'json')
                    Config.set(setting, JSON.stringify(selectedChoice.value), 'string');
                else
                    Config.set(setting, selectedChoice.value, type);
            }
        });
        
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
    }
    
    /**
     * 
     * @param {{title:string, subtitle?:string, icon_name?:string}} props
     * @param {string} setting 
     * @param {*} group 
     * @param {{min:number, max:number, digits?:number, step?:number, page?:number}} adj 
     * @param {boolean} numeric
     */
    addSpinRow(props, setting, group, adj, numeric = true, reset = null) {
        const adjustment = new Gtk.Adjustment({
            lower: adj.min,
            upper: adj.max,
            step_increment: adj.step ?? 1,
            page_increment: adj.page ?? 10,
            value: (adj.digits || 0) === 0 ? Config.get_int(setting) : Config.get_double(setting)
        });
        
        const row = new Adw.ActionRow(props);    
        
        let spinButton = new Gtk.SpinButton({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
            xalign: 0.5,
            adjustment,
            digits: adj.digits || 0,
            numeric
        });
        
        if(reset !== null) {
            const resetButton = new Gtk.Button({
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
                icon_name: 'edit-undo-symbolic',
                sensitive: true,
            });
            row.add_suffix(resetButton);
            
            resetButton.connect('clicked', () => {
                Config.set(setting, reset, (adj.digits || 0) === 0 ? 'int' : 'number');
                spinButton.value = reset;
            });
        }
        
        spinButton.connect('notify::value', widget => {
            Config.set(setting, widget.value, (adj.digits || 0) === 0 ? 'int' : 'number');
        });
        row.add_suffix(spinButton);
        row.activatable_widget = spinButton;
        
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
    }
    
    /**
     * 
     * @param {{title:string, subtitle?:string, icon_name?:string}} props
     * @param {string} setting 
     * @param {*} group 
     */
    addFontRow(props, setting, group, reset = null) {
        const row = new Adw.ActionRow(props);
        
        const fontButton = new Gtk.FontButton({
            modal: true,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
            use_size: false,
            level: Gtk.FontChooserLevel.FAMILY,
            preview_text: 'Astra Monitor v' + Utils.metadata.version,
            font: Config.get_string(setting),
        });
        
        fontButton.connect('font-set', widget => {
            Config.set(setting, widget.font_desc.get_family(), 'string');
        });
        
        if(reset !== null) {
            const resetButton = new Gtk.Button({
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
                icon_name: 'edit-undo-symbolic',
                sensitive: true,
            });
            resetButton.connect('clicked', () => {
                Config.set(setting, reset, 'string');
                fontButton.font = reset;
            });
            row.add_suffix(resetButton);
        }
        
        row.add_suffix(fontButton);
        row.activatable_widget = fontButton;
        
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
    }
    
    /**
     * 
     * @param {string} config 
     * @param {*} group 
     */
    addOrderingRows(config, group, tabbing = '') {
        const monitors = Config.get_json(config);
        for(let index = 0; index < monitors.length; index++) {
            const item = monitors[index] || '';
            this.OrderingItem(item, index, monitors.length, config, group, tabbing);
        }
    }
    
    OrderingItem(item, index, count, config, group, tabbing = '') {
        const row = new Adw.ActionRow({title: `${tabbing}${index+1}. ${Utils.capitalize(item, false)}` });
        
        let buttonUp;
        if(index > 0) {
            buttonUp = new Gtk.Button({label: '↑'});
            buttonUp.connect('clicked', () => {
                const list = Config.get_json(config);
                const removed = list[index];
                list.splice(index, 1);
                list.splice(index - 1, 0, removed);
                Config.set(config, JSON.stringify(list), 'string');
            });
        }
        else {
            buttonUp = new Gtk.Button({label: '↑', sensitive: false});
        }
        
        let buttonDown;
        if(index < count - 1) {
            buttonDown = new Gtk.Button({label: '↓'});
            buttonDown.connect('clicked', () => {
                const list = Config.get_json(config);
                const removed = list[index];
                list.splice(index, 1);
                list.splice(index + 1, 0, removed);
                Config.set(config, JSON.stringify(list), 'string');
            });
        }
        else {
            buttonDown = new Gtk.Button({label: '↓', sensitive: false});
        }
        
        if(buttonDown)
            row.add_suffix(buttonDown);
        if(buttonUp)
            row.add_suffix(buttonUp);
        
        Config.connect(this, 'changed::'+config, () => {
            const list = Config.get_json(config);
            const newItem = list[index] || '';
            row.title = `${tabbing}${index+1}. ${Utils.capitalize(newItem, false)}`;
        });
        
        if(group.add)
            group.add(row);
        else
            group.add_row(row);
    }
};
