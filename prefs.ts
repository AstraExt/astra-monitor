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
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences, gettext as _, pgettext} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import Utils, { GpuInfo } from './src/utils/utils.js';
import Config, { TypeEnumStr } from './src/config.js';

type RowProps = {
    title: string;
    subtitle?:string;
    icon_name?: string;
    tabs?: number;
    use_markup?: boolean;
};

type AdjustamentProps = {
    min:number,
    max:number,
    digits?:number,
    step?:number,
    page?:number
};

type ColorCallback = (color: string) => void;
enum ColorCategory { MAIN, SECONDARY }

type Choice = {value:any, text:string, disabled?:boolean};

export default class AstraMonitorPrefs extends ExtensionPreferences {
    private minimumSize = { width: 500, height: 300 };
    private defaultSize = { width: 800, height: 700 };
    private expanded: any = null;
    
    private loadCustomTheme() {
        try {
            const display = Gdk.Display.get_default();
            if(!display)
                throw new Error('Display not found');
            const iconTheme = Gtk.IconTheme.get_for_display(display);
            if(!Utils.metadata)
                throw new Error('Metadata not found');
            const iconsPath = (Utils.metadata as any).dir.get_child('icons').get_path();
            if(!iconsPath)
                throw new Error('Icons path not found');
            iconTheme.add_search_path(iconsPath);
        }
        catch(e: any) {
            Utils.error(e);
        }
    }
    
    fillPreferencesWindow(window: Adw.PreferencesWindow) {
        Utils.init({
            service: 'prefs',
            metadata: this.metadata,
            settings: this.getSettings()
        });
        
        window.connect('close-request', () => {
            Utils.clear();
        });
        
        this.loadCustomTheme();
        
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
        
        const aboutPage = this.setupAbout(window);
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
    
    private setupGeneral() {
        const generalPage = new Adw.PreferencesPage({title: _('General'), iconName: 'am-settings-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Dependencies')});
        let check = true;
        if(!Utils.hasProcStat())
            check = false, this.addStatusLabel({title: _('Cannot access /proc/stat: this extension will not work!')}, 'am-dialog-error-symbolic', group);
        if(!Utils.hasProcCpuinfo())
            check = false, this.addStatusLabel({title: _('Cannot access /proc/cpuinfo: this extension will not work!')}, 'am-dialog-error-symbolic', group);
        if(!Utils.hasProcMeminfo())
            check = false, this.addStatusLabel({title: _('Cannot access /proc/meminfo: this extension will not work!')}, 'am-dialog-error-symbolic', group);
        if(!Utils.hasProcDiskstats())
            check = false, this.addStatusLabel({title: _('Cannot access /proc/diskstats: this extension will not work!')}, 'am-dialog-error-symbolic', group);
        if(!Utils.hasProcNetDev())
            check = false, this.addStatusLabel({title: _('Cannot access /proc/net/dev: this extension will not work!')}, 'am-dialog-error-symbolic', group);
        if(!Utils.hasPs())
            check = false, this.addStatusLabel({title: _('Cannot access \'ps\': this extension will not work!')}, 'am-dialog-error-symbolic', group);
        //if(!Utils.hasLmSensors())
        //    check = false, this.addStatusLabel({title: _('\'lm-sensors\' not installed: some features will be disabled!')}, 'am-dialog-warning-symbolic', group);
        if(!Utils.hasHwmon())
            check = false, this.addStatusLabel({title: _('Cannot access /sys/class/hwmon: sensors monitoring will not work!')}, 'am-dialog-error-symbolic', group);
        if(!Utils.hasLscpu())
            check = false, this.addStatusLabel({title: _('\'lscpu\' not installed: some features will be disabled!')}, 'am-dialog-warning-symbolic', group);
        if(!Utils.hasLspci())
            check = false, this.addStatusLabel({title: _('\'lspci\' not installed: some features will be disabled!')}, 'am-dialog-warning-symbolic', group);
        if(!Utils.hasLsblk())
            check = false, this.addStatusLabel({title: _('\'lsblk\' not installed: some features will be disabled!')}, 'am-dialog-warning-symbolic', group);
        if(!Utils.hasCoresFrequency())
            check = false, this.addStatusLabel({title: _('Cannot access /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq: some features will be disabled!')}, 'am-dialog-warning-symbolic', group);
        if(!Utils.hasIp())
            check = false, this.addStatusLabel({title: _('\'iproute2\' not installed: some features will be disabled!')}, 'am-dialog-warning-symbolic', group);
        if(!Utils.hasIw() && !Utils.hasIwconfig())
            check = false, this.addStatusLabel({title: _('\'iwconfig\' and \'iw\' not installed: install one of them to enable wireless network info!')}, 'am-dialog-warning-symbolic', group);
        
        if(Utils.hasAMDGpu() && !Utils.hasAmdGpuTop())
            check = false, this.addStatusLabel({title: _('AMD GPU detected but \'amdgpu_top\' not installed: some optional features will be disabled!')}, 'am-dialog-warning-symbolic', group);
        if(Utils.hasNVidiaGpu() && !Utils.hasNvidiaSmi())
            check = false, this.addStatusLabel({title: _('NVidia GPU detected but \'nvidia-smi\' not installed: some optional features will be disabled!')}, 'am-dialog-warning-symbolic', group);
        /*if(Utils.hasIntelGpu() && !Utils.hasIntelGpuTop())
            check = false, this.addStatusLabel(_('Intel GPU detected but \'intel_gpu_top\' not installed: some optional features will be disabled!'), 'am-dialog-warning-symbolic', group);*/
        
        const statusLabel = this.addStatusLabel({title:_('Checking GTop dependency...')}, 'am-dialog-info-symbolic', group);
        
        Utils.hasGTop().then((GTopAvailable: boolean) => {
            if(!GTopAvailable) {
                statusLabel.row.title = _('\'GTop\' not installed, some optional features will be disabled! For a better experience and performance, install it from your package manager.');
                statusLabel.icon.set_from_icon_name('am-dialog-warning-symbolic');
            }
            else {
                statusLabel.row.title = _('\'GTop\' successfully detected and added to Data Sources list.');
                statusLabel.icon.set_from_icon_name('am-dialog-ok-symbolic');
            }
        }).catch((e: any) => {
            Utils.error(e);
            statusLabel.row.title = _('\'GTop\' not installed, some optional features will be disabled! For a better experience and performance, install it from your package manager.');
            statusLabel.icon.set_from_icon_name('am-dialog-warning-symbolic');
        });
        
        if(check)
            this.addStatusLabel({title: _('All other dependencies are met!')}, 'am-dialog-ok-symbolic', group);
        generalPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Visualization')});
        
        const themeSection = this.addExpanderRow({title: _('Theme')}, group);
        let choicesPanel = [
            {value: 'dark', text: _('Dark')},
            {value: 'light', text: _('Light')}
        ];
        this.addComboRow({
            title: _('Shell TOPBAR Theme Style'),
            subtitle:  _('Set to "Dark" or "Light" based on your shell TOPBAR theme to improve readability.'),
            tabs: 1
        }, choicesPanel, 'theme-style', themeSection, 'string', 'dark');
        
        choicesPanel = [
            {value: 'top', text: _('Top')},
            {value: 'bottom', text: _('Bottom')},
            {value: 'left', text: _('Left')},
            {value: 'right', text: _('Right')}
        ];
        this.addComboRow({
            title: _('Shell TOPBAR/DASH/PANEL Position'),
            subtitle:  _('Set this if you moved your shell to another position to improve the layout.') + '\n' + _('Disable/Enable the extension to apply changes.'),
            tabs: 1
        }, choicesPanel, 'shell-bar-position', themeSection, 'string', 'top');
        
        this.addColorRow({
            title: _('Main Color'),
            subtitle: _('Setting this will replace all main colors.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, (color: string) => {
            if(color)
                this.setAllColors(color, ColorCategory.MAIN);
        }, themeSection, 'rgba(29,172,214,1.0)');
        this.addColorRow({
            title: _('Secondary Color'),
            subtitle: _('Setting this will replace all secondary colors.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, (color: string) => {
            if(color)
                this.setAllColors(color, ColorCategory.SECONDARY);
        }, themeSection, 'rgba(214,29,29,1.0)');
        
        const panelSection = this.addExpanderRow({title: _('Panel Box')}, group);
        choicesPanel = [
            {value: 'left', text: _('Left')},
            {value: 'center', text: _('Center')},
            {value: 'right', text: _('Right')},
        ];
        this.addComboRow({title: _('Position'), tabs: 1}, choicesPanel, 'panel-box', panelSection, 'string');
        this.addSpinRow({title: _('Order'), tabs: 1}, 'panel-box-order', panelSection, {min: -10, max: 10, digits: 0, step: 1, page: 1}, true);
        this.addSpinRow({
            title: _('Left Margin'),
            subtitle:  _('Experimental feature: may not function properly.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'panel-margin-left', panelSection, {min: 0, max: 1000, digits: 0, step: 1, page: 10}, true, 0);
        this.addSpinRow({
            title: _('Right Margin'),
            subtitle: _('Experimental feature: may not function properly.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'panel-margin-right', panelSection, {min: 0, max: 1000, digits: 0, step: 1, page: 10}, true, 0);        
        
        const headersSection = this.addExpanderRow({title: _('Headers')}, group);
        this.addSpinRow({
            title: _('Startup Delay (seconds)'),
            subtitle: _('Increase if the extension is not properly formatted on startup.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'startup-delay', headersSection, {min: 1, max: 10, digits: 1, step: 0.5, page: 1}, true, 2);
        this.addSpinRow({
            title: _('Headers Height'),
            subtitle: _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'headers-height', headersSection, {min: 15, max: 80, digits: 0, step: 1, page: 5}, true, 28);
        this.addFontRow({
            title: _('Headers Font'),
            subtitle: _('Experimental feature: may require to disable/enable the extension.') + '\n' + _('Set to empty to disable font override'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'headers-font-family', headersSection, '');
        this.addSpinRow({
            title: _('Headers Font Size'),
            subtitle: _('Experimental feature: may require to disable/enable the extension.') + '\n' + _('Set to 0 to disable size override'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'headers-font-size', headersSection, {min: 0, max: 30, digits: 0, step: 1, page: 2}, true, 0);
        
        generalPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Monitor Ordering')});
        Utils.getMonitorsOrder();
        this.addOrderingRows('monitors-order', group, -1);
        generalPage.add(group);
        
        return generalPage;
    }
    
    private setupProcessors() {
        const processorsPage = new Adw.PreferencesPage({title: _('Processors'), icon_name: 'am-cpu-symbolic'});
        
        /* Processors */
        let group = new Adw.PreferencesGroup({title: _('Processors')});
        this.addSwitchRow({title: _('Show')}, 'processor-header-show', group);
        this.addSpinRow({title: _('Update frequency (seconds)')}, 'processor-update', group, {min: 0.1, max: 10, digits: 1, step: 0.1, page: 1}, true, 1.5);
        
        const sourcesSection = this.addExpanderRow({title: _('Data Sources')}, group);
        
        const cpuUsageSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'GTop', text: 'GTop'},
            {value: 'proc', text: '/proc/stat'},
        ];
        this.addComboRow({title: _('Cpu Usage'), tabs: 1}, cpuUsageSources, 'processor-source-cpu-usage', sourcesSection, 'string', 'auto');
        
        const cpuCoresUsageSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'GTop', text: 'GTop'},
            {value: 'proc', text: '/proc/stat'},
        ];
        this.addComboRow({title: _('Cpu Cores Usage'), tabs: 1}, cpuCoresUsageSources, 'processor-source-cpu-cores-usage', sourcesSection, 'string', 'auto');
        
        const cpuTopProcessesSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'GTop', text: 'GTop'},
            {value: 'proc', text: '/proc/[pid]/stat'},
        ];
        this.addComboRow({title: _('Top Processes'), tabs: 1}, cpuTopProcessesSources, 'processor-source-top-processes', sourcesSection, 'string', 'auto');
        
        const cpuLoadAverageSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'proc', text: '/proc/loadavg'},
        ];
        this.addComboRow({title: _('Load Average'), tabs: 1}, cpuLoadAverageSources, 'processor-source-load-avg', sourcesSection, 'string', 'auto');
        
        processorsPage.add(group);
        
        /* Header */
        group = new Adw.PreferencesGroup({title: _('Header')});
        
        const orderSection = this.addExpanderRow({title: _('Indicators Order')}, group);
        Utils.getIndicatorsOrder('processor');
        this.addOrderingRows('processor-indicators-order', orderSection);
        
        const iconSection = this.addExpanderRow({title: _('Icon')}, group);
        this.addSwitchRow({title: _('Show Icon'), tabs: 1}, 'processor-header-icon', iconSection);
        this.addTextInputRow({
            title: _('Icon Name'),
            subtitle: _('Set icon name (ie: \'cpu-symbolic\')') + '\n' + _('Set to empty to disable icon override'),
            tabs: 1
        }, 'processor-header-icon-custom', iconSection, '');
        this.addColorRow({ title: _('Icon Color'), tabs: 1 }, 'processor-header-icon-color', iconSection, '');
        this.addColorRow({ title: _('Icon Alert Color'), tabs: 1 }, 'processor-header-icon-alert-color', iconSection, 'rgba(235, 64, 52, 1)');
        this.addSpinRow({
            title: _('Icon Size'),
            subtitle: _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'processor-header-icon-size', iconSection, {min: 8, max: 30, digits: 0, step: 1, page: 1}, true, 18);
        
        const percentageSection = this.addExpanderRow({title: _('Percentage')}, group);
        this.addSwitchRow({title: _('Show Percentage'), tabs: 1}, 'processor-header-percentage', percentageSection);
        this.addSwitchRow({title: _('Single Core Percentage'), tabs: 1}, 'processor-header-percentage-core', percentageSection);
        this.addSpinRow({
            title: _('Icon Alert'),
            subtitle: _('Set 0 to disable. Value is percentage of total cpu.'),
            tabs: 1
        }, 'processor-header-percentage-icon-alert-threshold', percentageSection, {min: 0, max: 100, digits: 0, step: 1, page: 10}, true, 0);
        
        const graphSection = this.addExpanderRow({title: _('History Graph')}, group);
        this.addSwitchRow({title: _('Show History Graph'), tabs: 1}, 'processor-header-graph', graphSection);
        this.addColorRow({
            title: _('Main Color'),
            subtitle: _('<b>Total usage</b> color (<b>User usage</b> when breakdown is enabled).'),
            tabs: 1
        }, 'processor-header-graph-color1', graphSection, 'rgba(29,172,214,1.0)');
        this.addSwitchRow({title:_('History Graph Breakdown'), tabs: 1}, 'processor-header-graph-breakdown', graphSection);
        this.addColorRow({
            title: _('Secondary Color'),
            subtitle: _('<b>System usage</b> color.'),
            tabs: 1
        }, 'processor-header-graph-color2', graphSection, 'rgba(214,29,29,1.0)');
        this.addSpinRow({title: _('History Graph Width'), tabs: 1}, 'processor-header-graph-width', graphSection, {min: 10, max: 500, digits: 0, step: 1, page: 10}, true, 30);
        
        const barsSection = this.addExpanderRow({title: _('Realtime Bar')}, group);
        this.addSwitchRow({title: _('Show Realtime Bar'), tabs: 1}, 'processor-header-bars', barsSection);
        this.addSwitchRow({title: _('Realtime per-core Bars'), tabs: 1}, 'processor-header-bars-core', barsSection);
        this.addColorRow({
            title: _('Main Color'),
            subtitle: _('<b>Total usage</b> color (<b>User usage</b> when breakdown is enabled).'),
            tabs: 1
        }, 'processor-header-bars-color1', barsSection, 'rgba(29,172,214,1.0)');
        this.addSwitchRow({title: _('Realtime Bar Breakdown'), tabs: 1}, 'processor-header-bars-breakdown', barsSection);
        this.addColorRow({
            title: _('Secondary Color'),
            subtitle: _('<b>System usage</b> color.'),
            tabs: 1
        }, 'processor-header-bars-color2', barsSection, 'rgba(214,29,29,1.0)');
        processorsPage.add(group);
        
        /* Tooltip */
        group = new Adw.PreferencesGroup({title: _('Tooltip')});
        this.addSwitchRow({title: _('Show Tooltip'), tabs: 0}, 'processor-header-tooltip', group);
        this.addSwitchRow({title: _('Percentage'), tabs: 0}, 'processor-header-tooltip-percentage', group);
        this.addSwitchRow({title: _('Single Core Percentage'), tabs: 0}, 'processor-header-tooltip-percentage-core', group);
        processorsPage.add(group);
        
        /* Menu */
        group = new Adw.PreferencesGroup({title: _('Menu')});
        const cpuSection = this.addExpanderRow({title: _('CPU')}, group);
        this.addSwitchRow({title: _('Realtime Bars Breakdown'), tabs: 1}, 'processor-menu-bars-breakdown', cpuSection);
        this.addSwitchRow({title: _('History Graph Breakdown'), tabs: 1}, 'processor-menu-graph-breakdown', cpuSection);
        this.addSwitchRow({title: _('Core Bars Breakdown'), tabs: 1}, 'processor-menu-core-bars-breakdown', cpuSection);
        this.addSwitchRow({title: _('Top Processes Single Core'), tabs: 1}, 'processor-menu-top-processes-percentage-core', cpuSection);
        const gpuSection = this.addExpanderRow({title: _('GPU')}, group);
        
        const gpus = Utils.getGPUsList();
        const choicesSource = [{value: '', text: _('None')}];
        for(const gpu of gpus) {
            const keysToKeep = ['domain', 'bus', 'slot', 'vendorId', 'productId'];
            const data = Object.keys(gpu)
                .filter(key => keysToKeep.includes(key))
                .reduce((obj: any, key: string) => {
                    obj[key] = gpu[key as keyof GpuInfo];
                    return obj;
                }, {});
            choicesSource.push({value: data, text: Utils.getGPUModelName(gpu)});
        }
        this.addDropRow({title: _('Main GPU'), tabs: 1}, choicesSource, 'processor-menu-gpu', gpuSection, 'json');
        this.addColorRow({
            title: _('Bars Color'),
            subtitle: _('GPU bars main color.'),
            tabs: 1
        }, 'processor-menu-gpu-color', gpuSection, 'rgba(29,172,214,1.0)');
        
        processorsPage.add(group);
        
        return processorsPage;
    }
    
    private setupMemory() {
        const memoryPage = new Adw.PreferencesPage({title: _('Memory'), icon_name: 'am-memory-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Memory')});
        this.addSwitchRow({title: _('Show')}, 'memory-header-show', group);
        this.addSpinRow({title: _('Update frequency (seconds)')}, 'memory-update', group, {min: 0.1, max: 10, digits: 1, step: 0.1, page: 1}, true, 3.0);
        
        let choicesPanel = [
            {value: 'kB-kiB', text: _('kB (as kiB)')},
            {value: 'kB-KB', text: _('kB (as KB)')},
            {value: 'kiB', text: _('kiB')},
            {value: 'KiB', text: _('KiB')},
            {value: 'KB', text: _('KB')},
            {value: 'k ', text: _('k (as kB)')},
            {value: 'Ki', text: _('Ki (as Ki)')},
        ];
        this.addComboRow({title: _('Data Unit')}, choicesPanel, 'memory-unit', group, 'string', 'kB-kiB');
        
        choicesPanel = [
            {value: 'total-free-buffers-cached', text: _('Used = Total - Free - Buffers - Cached')},
            {value: 'total-free', text: _('Used = Total - Free')},
            {value: 'total-available', text: _('Used = Total - Available')},
            {value: 'active', text: _('Used = Active')},
        ];
        this.addComboRow({title: _('Used Memory')}, choicesPanel, 'memory-used', group, 'string', 'total-free-buffers-cached');
        
        const sourcesSection = this.addExpanderRow({title: _('Data Sources')}, group);
        
        const memoryUsageSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'GTop', text: 'GTop'},
            {value: 'proc', text: '/proc/meminfo'},
        ];
        this.addComboRow({title: _('Memory Usage'), tabs: 1}, memoryUsageSources, 'memory-source-memory-usage', sourcesSection, 'string', 'auto');
        
        const memoryTopProcessesSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'GTop', text: 'GTop'},
            {value: 'proc', text: 'ps + /proc/[pid]'},
        ];
        this.addComboRow({title: _('Top Processes'), tabs: 1}, memoryTopProcessesSources, 'memory-source-top-processes', sourcesSection, 'string', 'auto');
        
        memoryPage.add(group);
        
        /* Header */
        group = new Adw.PreferencesGroup({title: _('Header')});
        
        const orderSection = this.addExpanderRow({title: _('Indicators Order')}, group);
        Utils.getIndicatorsOrder('memory');
        this.addOrderingRows('memory-indicators-order', orderSection);
        
        const iconSection = this.addExpanderRow({title: _('Icon')}, group);
        this.addSwitchRow({title: _('Show Icon'), tabs: 1}, 'memory-header-icon', iconSection);
        this.addTextInputRow({
            title: _('Icon Name'),
            subtitle: _('Set icon name (ie: \'memory-symbolic\')') + '\n' + _('Set to empty to disable icon override'),
            tabs: 1
        }, 'memory-header-icon-custom', iconSection, '');
        this.addColorRow({title: _('Icon Color'), tabs: 1}, 'memory-header-icon-color', iconSection, '');
        this.addColorRow({title: _('Icon Alert Color'), tabs: 1}, 'memory-header-icon-alert-color', iconSection, 'rgba(235, 64, 52, 1)');
        this.addSpinRow({
            title: _('Icon Size'),
            subtitle: _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'memory-header-icon-size', iconSection, {min: 8, max: 30, digits: 0, step: 1, page: 1}, true, 18);
        
        const percentageSection = this.addExpanderRow({title: _('Usage Percentage')}, group);
        this.addSwitchRow({title: _('Show Usage Percentage'), tabs: 1}, 'memory-header-percentage', percentageSection);
        this.addSpinRow({
            title: _('Icon Alert'),
            subtitle: _('Set 0 to disable. Value is percentage of ram usage.'),
            tabs: 1
        }, 'memory-header-percentage-icon-alert-threshold', percentageSection, {min: 0, max: 100, digits: 0, step: 1, page: 10}, true, 0);
        
        const valueSection = this.addExpanderRow({title: _('Usage Value')}, group);
        this.addSwitchRow({title: _('Show Usage Value'), tabs: 1}, 'memory-header-value', valueSection);
        this.addSpinRow({title: _('Usage Value Max Number of Figures'), tabs: 1}, 'memory-header-value-figures', valueSection, {min: 2, max: 4, digits: 0, step: 1, page: 1}, true, 3); 
        
        const freeSection = this.addExpanderRow({title: _('Free Value')}, group);
        this.addSwitchRow({title: _('Show Free Value'), tabs: 1}, 'memory-header-free', freeSection);
        this.addSpinRow({title: _('Free Value Max Number of Figures'), tabs: 1}, 'memory-header-free-figures', freeSection, {min: 2, max: 4, digits: 0, step: 1, page: 1}, true, 3); 
        this.addSpinRow({
            title: _('Icon Alert'),
            subtitle: _('Set 0 to disable. Value is free MB of ram.'),
            tabs: 1
        }, 'memory-header-free-icon-alert-threshold', freeSection, {min: 0, max: 100000, digits: 0, step: 100, page: 1000}, true, 0);
        
        const graphSection = this.addExpanderRow({title: _('History Graph')}, group);
        this.addSwitchRow({title: _('Show History Graph'), tabs: 1}, 'memory-header-graph', graphSection);
        this.addColorRow({
            title: _('Main Color'),
            subtitle: _('<b>Used</b> memory color.'),
            tabs: 1
        }, 'memory-header-graph-color1', graphSection, 'rgba(29,172,214,1.0)');
        this.addSwitchRow({title: _('History Graph Breakdown'), tabs: 1}, 'memory-header-graph-breakdown', graphSection);
        this.addColorRow({
            title: _('Secondary Color'),
            subtitle: _('<b>Allocated <u>unused</u></b> memory color.'),
            tabs: 1
        }, 'memory-header-graph-color2', graphSection, 'rgba(29,172,214,0.3)');
        this.addSpinRow({title: _('History Graph Width'), tabs: 1}, 'memory-header-graph-width', graphSection, {min: 10, max: 500, digits: 0, step: 1, page: 10}, true, 30);
        
        const barsSection = this.addExpanderRow({title: _('Realtime Bar')}, group);
        this.addSwitchRow({title: _('Show Realtime Bar'), tabs: 1}, 'memory-header-bars', barsSection);
        this.addColorRow({
            title: _('Main Color'),
            subtitle: _('<b>Used</b> memory color.'),
            tabs: 1
        }, 'memory-header-bars-color1', barsSection, 'rgba(29,172,214,1.0)');
        this.addSwitchRow({title: _('Realtime Bar Breakdown'), tabs: 1}, 'memory-header-bars-breakdown', barsSection);
        this.addColorRow({
            title: _('Secondary Color'),
            subtitle: _('<b>Allocated <u>unused</u></b> memory color.'),
            tabs: 1
        }, 'memory-header-bars-color2', barsSection, 'rgba(29,172,214,0.3)');
        memoryPage.add(group);
        
        /* Tooltip */
        group = new Adw.PreferencesGroup({title: _('Tooltip')});
        this.addSwitchRow({title: _('Show Tooltip'), tabs: 0}, 'memory-header-tooltip', group);
        this.addSwitchRow({title: _('Usage Percentage'), tabs: 0}, 'memory-header-tooltip-percentage', group);
        this.addSwitchRow({title: _('Usage Value'), tabs: 0}, 'memory-header-tooltip-value', group);
        this.addSwitchRow({title: _('Free Value'), tabs: 0}, 'memory-header-tooltip-free', group);
        memoryPage.add(group);
        
        /* Menu */
        group = new Adw.PreferencesGroup({title: _('Menu')});
        
        const memorySection = this.addExpanderRow({title: _('Memory')}, group);
        this.addSwitchRow({title: _('History Graph Breakdown'), tabs: 1}, 'memory-menu-graph-breakdown', memorySection);
        
        const swapSection = this.addExpanderRow({title: _('Swap')}, group);
        this.addColorRow({
            title: _('Swap Bar Color'),
            subtitle: _('Swap bar main color.'),
            tabs: 1
        }, 'memory-menu-swap-color', swapSection, 'rgba(29,172,214,1.0)');
        
        memoryPage.add(group);
        
        return memoryPage;
    }
    
    private setupStorage() {
        const storagePage = new Adw.PreferencesPage({title: _('Storage'), icon_name: 'am-harddisk-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Storage')});
        this.addSwitchRow({title: _('Show')}, 'storage-header-show', group);
        this.addSpinRow({title: _('Update frequency (seconds)')}, 'storage-update', group, {min: 0.1, max: 10, digits: 1, step: 0.1, page: 1}, true, 3.0);
        
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
        this.addComboRow({title: _('Data Unit')}, choicesPanel, 'storage-io-unit', group, 'string', 'kB/s');
        
        const storageMain = Config.get_string('storage-main');
        const disks = Utils.listDisksSync();
        
        if(storageMain === '[default]' || !storageMain || !disks.has(storageMain)) {
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
        this.addComboRow({title: _('Main Disk')}, choicesSource, 'storage-main', group, 'string');
        
        const ignoredSection = this.addExpanderRow({title: _('Ignored Storage Devices')}, group);
        
        this.addTextInputRow({
            title: _('Regex'),
            subtitle: _('Devices matching this regex will be ignored.') + '\n' + _('Leave empty to disable. Usage example: ') + '\'md{1,3}\'',
            tabs: 1
        }, 'storage-ignored-regex', ignoredSection, '');
        
        const devices = Utils.getBlockDevicesSync();
        let ignoredDevices = Config.get_json('storage-ignored');
        if(ignoredDevices === null || !Array.isArray(ignoredDevices))
            ignoredDevices = [];
        
        const main = Config.get_string('storage-main');
        for(const [id, device] of devices.entries()) {
            const name = device.kname;
            const status = !ignoredDevices.includes(name);
            
            let subtitle = status ? _('Active') : _('Ignored');
            if(id === main)
                subtitle = _('Main');
            
            const row = new Adw.ActionRow({ title: name, subtitle });
            ignoredSection.add_row(row);
            
            let icon_name = status ? 'am-dialog-ok-symbolic' : 'am-dialog-error-symbolic';
            if(id === main)
                icon_name = 'am-star-symbolic';
            
            const icon = new Gtk.Image({ icon_name: icon_name });
            icon.set_margin_start(15);
            icon.set_margin_end(10);
            row.add_prefix(icon);
            
            const toggle = new Gtk.Switch({
                active: !status,
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
            });
            
            if(id === main) {
                toggle.sensitive = false;
                toggle.tooltip_text = _('Main disk cannot be ignored');
            }
            
            toggle.connect('state-set', (_switchObj, state) => {
                if(state) {
                    row.subtitle = _('Ignored');
                    icon.icon_name = 'am-dialog-error-symbolic';
                    
                    let ignoredDevices = Config.get_json('storage-ignored');
                    if(ignoredDevices === null || !Array.isArray(ignoredDevices))
                        ignoredDevices = [];
                    if(!ignoredDevices.includes(name))
                        ignoredDevices.push(name);
                    Config.set('storage-ignored', JSON.stringify(ignoredDevices), 'string');
                }
                else {
                    row.subtitle = _('Active');
                    icon.icon_name = 'am-dialog-ok-symbolic';
                    
                    let ignoredDevices = Config.get_json('storage-ignored');
                    if(ignoredDevices === null || !Array.isArray(ignoredDevices))
                        ignoredDevices = [];
                    if(ignoredDevices.includes(name))
                        ignoredDevices = ignoredDevices.filter((device: string) => device !== name);
                    Config.set('storage-ignored', JSON.stringify(ignoredDevices), 'string');
                }
            });
            
            row.add_suffix(toggle);
            row.activatable_widget = toggle;
        }
        
        const sourcesSection = this.addExpanderRow({title: _('Data Sources')}, group);
        
        const storageUsageSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'GTop', text: 'GTop'},
            {value: 'proc', text: 'lsblk'},
        ];
        this.addComboRow({title: _('Storage Usage'), tabs: 1}, storageUsageSources, 'storage-source-storage-usage', sourcesSection, 'string', 'auto');
        
        const storageTopProcessesSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'GTop', text: 'GTop'},
        ];
        this.addComboRow({title: _('Top Processes'), tabs: 1}, storageTopProcessesSources, 'storage-source-top-processes', sourcesSection, 'string', 'auto');
        
        const storageIOSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'proc', text: '/proc/diskstats'}
        ];
        this.addComboRow({title: _('Storage IO'), tabs: 1}, storageIOSources, 'storage-source-storage-io', sourcesSection, 'string', 'auto');
        
        storagePage.add(group);
        
        /* Header */
        group = new Adw.PreferencesGroup({title: _('Header')});
        
        const orderSection = this.addExpanderRow({title: _('Indicators Order')}, group);
        Utils.getIndicatorsOrder('storage');
        this.addOrderingRows('storage-indicators-order', orderSection);
        
        const iconSection = this.addExpanderRow({title: _('Icon')}, group);
        this.addSwitchRow({title: _('Show Icon'), tabs: 1}, 'storage-header-icon', iconSection);
        this.addTextInputRow({
            title: _('Icon Name'),
            subtitle: _('Set icon name (ie: \'drive-harddisk-symbolic\')') + '\n' + _('Set to empty to disable icon override'),
            tabs: 1
        }, 'storage-header-icon-custom', iconSection, '');
        this.addColorRow({title: _('Icon Color'), tabs: 1}, 'storage-header-icon-color', iconSection, '');
        this.addColorRow({title: _('Icon Alert Color'), tabs: 1}, 'storage-header-icon-alert-color', iconSection, 'rgba(235, 64, 52, 1)');
        this.addSpinRow({
            title: _('Icon Size'),
            subtitle: _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'storage-header-icon-size', iconSection, {min: 8, max: 30, digits: 0, step: 1, page: 1}, true, 18);
        
        const mainDiskSection = this.addExpanderRow({title: _('Main Disk')}, group);
        
        this.addLabelRow({title: _('Usage Bar'), tabs: 1}, '', mainDiskSection);
        this.addSwitchRow({title: _('Show Main Disk Usage Bar'), tabs: 2}, 'storage-header-bars', mainDiskSection);
        this.addColorRow({
            title: _('Main Color'),
            subtitle: _('<b>Used</b> storage color.'),
            tabs: 2
        }, 'storage-header-bars-color1', mainDiskSection, 'rgba(29,172,214,1.0)');
        
        this.addLabelRow({title: _('Usage Percentage'), tabs: 1}, '', mainDiskSection);
        this.addSwitchRow({title: _('Show Main Disk Usage Percentage'), tabs: 2}, 'storage-header-percentage', mainDiskSection);
        this.addSpinRow({
            title: _('Icon Alert'),
            subtitle: _('Set 0 to disable. Value is percentage of disk usage.'),
            tabs: 2
        }, 'storage-header-percentage-icon-alert-threshold', mainDiskSection, {min: 0, max: 100, digits: 0, step: 1, page: 10}, true, 0);
        
        this.addLabelRow({title: _('Usage Value'), tabs: 1}, '', mainDiskSection);
        this.addSwitchRow({title: _('Show Main Disk Usage Value'), tabs: 2}, 'storage-header-value', mainDiskSection);
        this.addSpinRow({title: _('Usage Value Max Number of Figures'), tabs: 2}, 'storage-header-value-figures', mainDiskSection, {min: 2, max: 4, digits: 0, step: 1, page: 1}, true, 3); 
        
        this.addLabelRow({title: _('Free Value'), tabs: 1}, '', mainDiskSection);
        this.addSwitchRow({title: _('Show Main Disk Free Value'), tabs: 2}, 'storage-header-free', mainDiskSection);
        this.addSpinRow({title: _('Free Value Max Number of Figures'), tabs: 2}, 'storage-header-free-figures', mainDiskSection, {min: 2, max: 4, digits: 0, step: 1, page: 1}, true, 3); 
        this.addSpinRow({
            title: _('Icon Alert'),
            subtitle: _('Set 0 to disable. Value is free MB of storage.'),
            tabs: 2
        }, 'storage-header-free-icon-alert-threshold', mainDiskSection, {min: 0, max: 100000, digits: 0, step: 100, page: 1000}, true, 0);
        
        const ioSection = this.addExpanderRow({title: _('IO')}, group);
        
        this.addLabelRow({title: _('Realtime IO Bar'), tabs: 1}, '', ioSection);
        this.addSwitchRow({title: _('Show Realtime IO Bar'), tabs: 2}, 'storage-header-io-bars', ioSection);
        this.addColorRow({
            title: _('Read Color'),
            subtitle: _('<b>Read</b> IO Bar color.'),
            tabs: 2
        }, 'storage-header-io-bars-color1', ioSection, 'rgba(29,172,214,1.0)');
        this.addColorRow({
            title: _('Write Color'),
            subtitle: _('<b>Write</b> IO Bar color.'),
            tabs: 2
        }, 'storage-header-io-bars-color2', ioSection, 'rgba(214,29,29,1.0)');
        
        this.addLabelRow({title: _('IO History Graph'), tabs: 1}, '', ioSection);
        this.addSwitchRow({title: _('Show IO History Graph'), tabs: 2}, 'storage-header-graph', ioSection);
        this.addColorRow({
            title: _('Read Color'),
            subtitle: _('<b>Read</b> IO History Graph color.'),
            tabs: 2
        }, 'storage-header-io-graph-color1', ioSection, 'rgba(29,172,214,1.0)');
        this.addColorRow({
            title: _('Write Color'),
            subtitle: _('<b>Write</b> IO History Graph color.'),
            tabs: 2
        }, 'storage-header-io-graph-color2', ioSection, 'rgba(214,29,29,1.0)');
        this.addSpinRow({title: _('IO History Graph Width'), tabs: 2}, 'storage-header-graph-width', ioSection, {min: 10, max: 500, digits: 0, step: 1, page: 10}, true, 30);
        
        this.addLabelRow({title: _('IO Speed'), tabs: 1}, '', ioSection);
        this.addSwitchRow({title: _('Show IO Speed'), tabs: 2}, 'storage-header-io', ioSection);
        
        const layouts = [
            {value: 'vertical', text: _('Vertical')},
            {value: 'horizontal', text: _('Horizontal')},
        ];
        this.addComboRow({title: _('IO Speed Layout'), tabs: 2}, layouts, 'storage-header-io-layout', ioSection, 'string', 'vertical');
        
        this.addSpinRow({title: _('IO Speed Max Number of Figures'), tabs: 2}, 'storage-header-io-figures', ioSection, {min: 2, max: 4, digits: 0, step: 1, page: 1}, true, 3);
        this.addSpinRow({title: _('IO Speed Threshold'), subtitle: _('in kB/s'), tabs: 2}, 'storage-header-io-threshold', ioSection, {min: 0, max: 1000000, digits: 0, step: 1000, page: 10000}, true, 0);
        
        storagePage.add(group);
        
        /* Tooltip */
        group = new Adw.PreferencesGroup({title: _('Tooltip')});
        this.addSwitchRow({title: _('Show Tooltip'), tabs: 0}, 'storage-header-tooltip', group);
        this.addSwitchRow({title: _('Main Disk Usage Percentage'), tabs: 0}, 'storage-header-tooltip-percentage', group);
        this.addSwitchRow({title: _('Main Disk Usage Value'), tabs: 0}, 'storage-header-tooltip-value', group);
        this.addSwitchRow({title: _('Main Disk Free Value'), tabs: 0}, 'storage-header-tooltip-free', group);
        this.addSwitchRow({title: _('IO Speed'), tabs: 0}, 'storage-header-tooltip-io', group);
        storagePage.add(group);
        
        /* Menu */
        group = new Adw.PreferencesGroup({title: _('Menu')});
        
        const ioArrows = this.addExpanderRow({title: _('IO Arrows')}, group);
        this.addColorRow({
            title: _('Read Color'),
            subtitle: _('<b>Read</b> IO arrow color.'),
            tabs: 2
        }, 'storage-menu-arrow-color1', ioArrows, 'rgba(29,172,214,1.0)');
        this.addColorRow({
            title: _('Write Color'),
            subtitle: _('<b>Write</b> IO arrow color.'),
            tabs: 2
        }, 'storage-menu-arrow-color2', ioArrows, 'rgba(214,29,29,1.0)');
        
        const devicesSection = this.addExpanderRow({title: _('Devices')}, group);
        this.addColorRow({
            title: _('Device Usage Bar Color'),
            tabs: 1
        }, 'storage-menu-device-color', devicesSection, 'rgba(29,172,214,1.0)');
        
        storagePage.add(group);
        
        return storagePage;
    }
    
    private setupNetwork() {
        const networkPage = new Adw.PreferencesPage({title: _('Network'), icon_name: 'am-network-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Network')});
        this.addSwitchRow({title: _('Show')}, 'network-header-show', group);
        this.addSpinRow({title: _('Update frequency (seconds)')}, 'network-update', group, {min: 0.1, max: 10, digits: 1, step: 0.1, page: 1}, true, 1.5);
        
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
        this.addComboRow({title: _('Data Unit')}, choicesPanel, 'network-io-unit', group, 'string', 'kB/s');
        
        const ignoredSection = this.addExpanderRow({title: _('Ignored Network Interfaces')}, group);
        
        this.addTextInputRow({
            title: _('Regex'),
            subtitle: _('Interfaces matching this regex will be ignored.') + '\n' + _('Leave empty to disable. Usage example: ') + '\'veth\\w{3,16}\'',
            tabs: 1
        }, 'network-ignored-regex', ignoredSection, '');
        
        const devices = Utils.getNetworkInterfacesSync();
        let ignoredDevices = Config.get_json('network-ignored');
        if(ignoredDevices === null || !Array.isArray(ignoredDevices))
            ignoredDevices = [];
        
        for(const [name, ] of devices.entries()) {
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
            
            toggle.connect('state-set', (_switchObj, state) => {
                if(state) {
                    row.subtitle = _('Ignored');
                    icon.icon_name = 'am-dialog-error-symbolic';
                    
                    let ignoredDevices = Config.get_json('network-ignored');
                    if(ignoredDevices === null || !Array.isArray(ignoredDevices))
                        ignoredDevices = [];
                    if(!ignoredDevices.includes(name))
                        ignoredDevices.push(name);
                    Config.set('network-ignored', JSON.stringify(ignoredDevices), 'string');
                }
                else {
                    row.subtitle = _('Active');
                    icon.icon_name = 'am-dialog-ok-symbolic';
                    
                    let ignoredDevices = Config.get_json('network-ignored');
                    if(ignoredDevices === null || !Array.isArray(ignoredDevices))
                        ignoredDevices = [];
                    if(ignoredDevices.includes(name))
                        ignoredDevices = ignoredDevices.filter((device: string) => device !== name);
                    Config.set('network-ignored', JSON.stringify(ignoredDevices), 'string');
                }
            });
            
            row.add_suffix(toggle);
            row.activatable_widget = toggle;
        }
        
        const sourcesSection = this.addExpanderRow({title: _('Data Sources')}, group);
        const networkIOSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'GTop', text: 'GTop'},
            {value: 'proc', text: '/proc/net/dev'},
        ];
        this.addComboRow({title: _('Network IO'), tabs: 1}, networkIOSources, 'network-source-network-io', sourcesSection, 'string', 'auto');
        
        this.addTextInputRow({
            title: _('Public IPv4 Address'),
            subtitle: _('Set to empty to disable. Address will be regex matched.'),
            tabs: 1,
        }, 'network-source-public-ipv4', sourcesSection, 'https://api.ipify.org');
        
        this.addTextInputRow({
            title: _('Public IPv6 Address'),
            subtitle: _('Set to empty to disable. Address will be regex matched.'),
            tabs: 1,
        }, 'network-source-public-ipv6', sourcesSection, 'https://api6.ipify.org');
        
        const networkWirelessSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'iwconfig', text: 'iwconfig'},
            {value: 'iw', text: 'iw'},
        ];
        this.addComboRow({title: _('Wireless Info'), tabs: 1}, networkWirelessSources, 'network-source-wireless', sourcesSection, 'string', 'auto');
        
        networkPage.add(group);
        
        /* Header */
        group = new Adw.PreferencesGroup({title: 'Header'});
        
        const orderSection = this.addExpanderRow({title: _('Indicators Order')}, group);
        Utils.getIndicatorsOrder('network');
        this.addOrderingRows('network-indicators-order', orderSection);
        
        const iconSection = this.addExpanderRow({title: _('Icon')}, group);
        this.addSwitchRow({title: _('Show Icon'), tabs: 1}, 'network-header-icon', iconSection);
        this.addTextInputRow({
            title: _('Icon Name'),
            subtitle:  _('Set icon name (ie: \'network-wired-symbolic\')') + '\n' + _('Set to empty to disable icon override'),
            tabs: 1
        }, 'network-header-icon-custom', iconSection, '');
        this.addColorRow({title: _('Icon Color'), tabs: 1}, 'network-header-icon-color', iconSection, '');
        this.addColorRow({title: _('Icon Alert Color'), tabs: 1}, 'network-header-icon-alert-color', iconSection, 'rgba(235, 64, 52, 1)');
        this.addSpinRow({
            title: _('Icon Size'),
            subtitle: _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'network-header-icon-size', iconSection, {min: 8, max: 30, digits: 0, step: 1, page: 1}, true, 18);
        
        const ioSection = this.addExpanderRow({title: _('IO')}, group);
        
        this.addLabelRow({title: _('Realtime IO Bar'), tabs: 1}, '', ioSection);
        this.addSwitchRow({title: _('Show Realtime IO Bar'), tabs: 2}, 'network-header-bars', ioSection);
        this.addColorRow({
            title: _('Upload Color'),
            subtitle: _('<b>Upload</b> IO Bar color.'),
            tabs: 2
        }, 'network-header-io-bars-color1', ioSection, 'rgba(29,172,214,1.0)');
        this.addColorRow({
            title: _('Download Color'),
            subtitle: _('<b>Download</b> IO Bar color.'),
            tabs: 2
        }, 'network-header-io-bars-color2', ioSection, 'rgba(214,29,29,1.0)');
        
        this.addLabelRow({title: _('IO History Graph'), tabs: 1}, '', ioSection);
        this.addSwitchRow({title: _('Show IO History Graph'), tabs: 2}, 'network-header-graph', ioSection); 
        this.addColorRow({
            title: _('Upload Color'),
            subtitle: _('<b>Upload</b> IO History Graph color.'),
            tabs: 2
        }, 'network-header-io-graph-color1', ioSection, 'rgba(29,172,214,1.0)');
        this.addColorRow({
            title: _('Download Color'),
            subtitle: _('<b>Download</b> IO History Graph color.'),
            tabs: 2
        }, 'network-header-io-graph-color2', ioSection, 'rgba(214,29,29,1.0)');
        this.addSpinRow({title: _('IO History Graph Width'), tabs: 2}, 'network-header-graph-width', ioSection, {min: 10, max: 500, digits: 0, step: 1, page: 10}, true, 30); 
        
        this.addLabelRow({title: _('IO Speed'), tabs: 1}, '', ioSection);
        this.addSwitchRow({title: _('Show IO Speed'), tabs: 2}, 'network-header-io', ioSection);
        
        const layouts = [
            {value: 'vertical', text: _('Vertical')},
            {value: 'horizontal', text: _('Horizontal')},
        ];
        this.addComboRow({title: _('IO Speed Layout'), tabs: 2}, layouts, 'network-header-io-layout', ioSection, 'string', 'vertical');
        
        this.addSpinRow({title: _('IO Speed Max Number of Figures'), tabs: 2}, 'network-header-io-figures', ioSection, {min: 2, max: 4, digits: 0, step: 1, page: 1}, true, 3); 
        this.addSpinRow({title: _('IO Speed Threshold'), subtitle: _('in kB/s'), tabs: 2}, 'network-header-io-threshold', ioSection, {min: 0, max: 1000000, digits: 0, step: 1000, page: 10000}, true, 0); 
        
        networkPage.add(group);
        
        /* Tooltip */
        group = new Adw.PreferencesGroup({title: _('Tooltip')});
        this.addSwitchRow({title: _('Show Tooltip'), tabs: 0}, 'network-header-tooltip', group);
        this.addSwitchRow({title: _('IO Speed'), tabs: 0}, 'network-header-tooltip-io', group);
        networkPage.add(group);
        
        /* Menu */
        group = new Adw.PreferencesGroup({title: _('Menu')});
        
        const ioArrows = this.addExpanderRow({title: _('IO Arrows')}, group);
        this.addColorRow({
            title: _('Upload Color'),
            subtitle: _('<b>Upload</b> IO arrow color.'),
            tabs: 2
        }, 'network-menu-arrow-color1', ioArrows, 'rgba(29,172,214,1.0)');
        this.addColorRow({
            title: _('Download Color'),
            subtitle: _('<b>Download</b> IO arrow color.'),
            tabs: 2
        }, 'network-menu-arrow-color2', ioArrows, 'rgba(214,29,29,1.0)');
        
        networkPage.add(group);
        
        return networkPage;
    }
    
    private setupSensors() {
        const sensorsPage = new Adw.PreferencesPage({title: _('Sensors'), icon_name: 'am-temperature-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Sensors')});
        this.addSwitchRow({title: _('Show')}, 'sensors-header-show', group);
        this.addSpinRow({title: _('Update frequency (seconds)')}, 'sensors-update', group, {min: 1, max: 60, digits: 1, step: 0.5, page: 1}, true, 3.0);
        
        const choicesUnit = [
            {value: 'celsius', text: pgettext('Celsius unit measure choice', 'Celsius')},
            {value: 'fahrenheit', text: pgettext('Fahrenheit unit measure choice', 'Fahrenheit')},
        ];
        this.addComboRow({title: _('Temperature Unit')}, choicesUnit, 'sensors-temperature-unit', group, 'string');
        
        const sourcesSection = this.addExpanderRow({title: _('Data Sources')}, group);
        const sensorsSources = [
            {value: 'auto', text: _('Auto')},
            {value: 'hwmon', text: 'Hwmon'},
            {value: 'lm-sensors', text: 'Lm-sensors', disabled: !Utils.hasLmSensors()},
        ];
        this.addComboRow({title: _('Sensors'), tabs: 1}, sensorsSources, 'sensors-source', sourcesSection, 'string', 'auto');
        
        sensorsPage.add(group);
        
        /* Header */
        group = new Adw.PreferencesGroup({title: _('Header')});
        
        const orderSection = this.addExpanderRow({title: _('Indicators Order')}, group);
        Utils.getIndicatorsOrder('sensors');
        this.addOrderingRows('sensors-indicators-order', orderSection);
        
        const iconSection = this.addExpanderRow({title: _('Icon')}, group);
        this.addSwitchRow({title: _('Show Icon'), tabs: 1}, 'sensors-header-icon', iconSection);
        this.addTextInputRow({
            title: _('Icon Name'),
            subtitle: _('Set icon name (ie: \'temperature-symbolic\')') + '\n' + _('Set to empty to disable icon override'),
            tabs: 1
        }, 'sensors-header-icon-custom', iconSection, '');
        this.addColorRow({title: _('Icon Color'), tabs: 1}, 'sensors-header-icon-color', iconSection, '');
        this.addColorRow({title: _('Icon Alert Color'), tabs: 1}, 'sensors-header-icon-alert-color', iconSection, 'rgba(235, 64, 52, 1)');
        this.addSpinRow({
            title: _('Icon Size'),
            subtitle: _('Experimental feature: may require to disable/enable the extension.'),
            icon_name: 'am-dialog-warning-symbolic',
            tabs: 1
        }, 'sensors-header-icon-size', iconSection, {min: 8, max: 30, digits: 0, step: 1, page: 1}, true, 18);
        
        const generateSensorSources = async () => {
            // wait for the hwmon devices to be cached
            await Utils.getCachedHwmonDevicesAsync();
            
            const sources = Utils.getSensorSources();
            const choicesSource = [{value: '', text: _('None')}];
            for(const source of sources)
                choicesSource.push({value: source.value, text: source.text});
            return choicesSource;
        };
        
        const sources = generateSensorSources();
        
        const sensor1Section = this.addExpanderRow({title: _('Sensor 1')}, group);
        this.addSwitchRow({title: _('Show'), tabs: 1}, 'sensors-header-sensor1-show', sensor1Section);
        this.addDropRow({
            title: _('Source'),
            tabs: 1,
            use_markup: true
        }, sources, 'sensors-header-sensor1', sensor1Section, 'json');
        this.addSpinRow({
            title: _('Value Digits'),
            subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
            tabs: 1
        }, 'sensors-header-sensor1-digits', sensor1Section, {min: -1, max: 3, digits: 0, step: 1, page: 1}, true, -1);
        
        const sensor2Section = this.addExpanderRow({title: _('Sensor 2')}, group);
        this.addSwitchRow({title: _('Show'), tabs: 1}, 'sensors-header-sensor2-show', sensor2Section);
        
        const layouts = [
            {value: 'vertical', text: _('Vertical')},
            {value: 'horizontal', text: _('Horizontal')},
        ];
        this.addComboRow({title: _('Sensor 2 Layout'), tabs: 1}, layouts, 'sensors-header-sensor2-layout', sensor2Section, 'string', 'vertical');
        
        this.addDropRow({
            title: _('Source'),
            tabs: 1,
            use_markup: true
        }, sources, 'sensors-header-sensor2', sensor2Section, 'json');
        this.addSpinRow({
            title: _('Value Digits'),
            subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
            tabs: 1
        }, 'sensors-header-sensor2-digits', sensor2Section, {min: -1, max: 3, digits: 0, step: 1, page: 1}, true, -1);
        sensorsPage.add(group);
        
        /* Tooltip */
        group = new Adw.PreferencesGroup({title: _('Tooltip')});
        this.addSwitchRow({title: _('Show Tooltip'), tabs: 0}, 'sensors-header-tooltip', group);
        
        const tooltipSensor1Section = this.addExpanderRow({title: _('Tooltip Sensor 1')}, group);
        this.addDropRow({
            title: _('Source'),
            tabs: 1,
            use_markup: true
        }, sources, 'sensors-header-tooltip-sensor1', tooltipSensor1Section, 'json', '""');
        this.addTextInputRow({
            title: _('Short Name'),
            subtitle: _('Short name to display in the tooltip.'),
            tabs: 1
        }, 'sensors-header-tooltip-sensor1-name', tooltipSensor1Section, '');
        this.addSpinRow({
            title: _('Value Digits'),
            subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
            tabs: 1
        }, 'sensors-header-tooltip-sensor1-digits', tooltipSensor1Section, {min: -1, max: 3, digits: 0, step: 1, page: 1}, true, -1);
        
        const tooltipSensor2Section = this.addExpanderRow({title: _('Tooltip Sensor 2')}, group);
        this.addDropRow({
            title: _('Source'),
            tabs: 1,
            use_markup: true
        }, sources, 'sensors-header-tooltip-sensor2', tooltipSensor2Section, 'json', '""');
        this.addTextInputRow({
            title: _('Short Name'),
            subtitle: _('Short name to display in the tooltip.'),
            tabs: 1
        }, 'sensors-header-tooltip-sensor2-name', tooltipSensor2Section, '');
        this.addSpinRow({
            title: _('Value Digits'),
            subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
            tabs: 1
        }, 'sensors-header-tooltip-sensor2-digits', tooltipSensor2Section, {min: -1, max: 3, digits: 0, step: 1, page: 1}, true, -1);
        
        const tooltipSensor3Section = this.addExpanderRow({title: _('Tooltip Sensor 3')}, group);
        this.addDropRow({
            title: _('Source'),
            tabs: 1,
            use_markup: true
        }, sources, 'sensors-header-tooltip-sensor3', tooltipSensor3Section, 'json', '""');
        this.addTextInputRow({
            title: _('Short Name'),
            subtitle: _('Short name to display in the tooltip.'),
            tabs: 1
        }, 'sensors-header-tooltip-sensor3-name', tooltipSensor3Section, '');
        this.addSpinRow({
            title: _('Value Digits'),
            subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
            tabs: 1
        }, 'sensors-header-tooltip-sensor3-digits', tooltipSensor3Section, {min: -1, max: 3, digits: 0, step: 1, page: 1}, true, -1);
        
        const tooltipSensor4Section = this.addExpanderRow({title: _('Tooltip Sensor 4')}, group);
        this.addDropRow({
            title: _('Source'),
            tabs: 1,
            use_markup: true
        }, sources, 'sensors-header-tooltip-sensor4', tooltipSensor4Section, 'json', '""');
        this.addTextInputRow({
            title: _('Short Name'),
            subtitle: _('Short name to display in the tooltip.'),
            tabs: 1
        }, 'sensors-header-tooltip-sensor4-name', tooltipSensor4Section, '');
        this.addSpinRow({
            title: _('Value Digits'),
            subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
            tabs: 1
        }, 'sensors-header-tooltip-sensor4-digits', tooltipSensor4Section, {min: -1, max: 3, digits: 0, step: 1, page: 1}, true, -1);
        
        const tooltipSensor5Section = this.addExpanderRow({title: _('Tooltip Sensor 5')}, group);
        this.addDropRow({
            title: _('Source'),
            tabs: 1,
            use_markup: true
        }, sources, 'sensors-header-tooltip-sensor5', tooltipSensor5Section, 'json', '""');
        this.addTextInputRow({
            title: _('Short Name'),
            subtitle: _('Short name to display in the tooltip.'),
            tabs: 1
        }, 'sensors-header-tooltip-sensor5-name', tooltipSensor5Section, '');
        this.addSpinRow({
            title: _('Value Digits'),
            subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
            tabs: 1
        }, 'sensors-header-tooltip-sensor5-digits', tooltipSensor5Section, {min: -1, max: 3, digits: 0, step: 1, page: 1}, true, -1);
        
        sensorsPage.add(group);
        
        return sensorsPage;
    }
    
    private setupAbout(window: Adw.PreferencesWindow) {
        const aboutPage = new Adw.PreferencesPage({title: _('About'), icon_name: 'am-dialog-info-symbolic'});
        
        let group = new Adw.PreferencesGroup({title: _('Info')});
        
        let version;
        const metadata = this.metadata;
        if(metadata['version-name'] === metadata['version'])
            version = 'v' + metadata['version'];
        else if(metadata['version-name'])
            version = metadata['version-name'] + ' (EGOv' + metadata['version'] + ')';
        else
            version = 'EGOv' + metadata['version'];
        
        this.addLabelRow({title: _('Version')}, version, group);
        this.addLinkRow({title: _('GitHub')}, 'https://github.com/AstraExt/astra-monitor', group);
        this.addLinkRow({title: _('Changelog')}, 'https://github.com/AstraExt/astra-monitor/blob/main/RELEASES.md', group);
        this.addLinkRow({title: _('Roadmap')}, 'https://github.com/AstraExt/astra-monitor#roadmap', group);
        this.addLinkRow({title: _('Report a bug or suggest new feature')}, 'https://github.com/AstraExt/astra-monitor/issues/new/choose', group);
        this.addLinkRow({title: _('GNOME Extensions page')}, 'https://extensions.gnome.org/extension/6682/astra-monitor/', group);
        this.addLinkRow({title: '<span color="#FFB000">★ ' + _('Support us on Ko-Fi') + '</span>'}, 'https://ko-fi.com/astraext', group);
        this.addLinkRow({title: '<span color="#FFB000">★ ' + _('Buy us a coffee') + '</span>'}, 'https://www.buymeacoffee.com/astra.ext', group);
        this.addLinkRow({title: '<span color="#FFB000">★ ' + _('Become a patron') + '</span>'}, 'https://www.patreon.com/AstraExt', group);
        
        aboutPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Utility')});
        
        this.addButtonRow({title: _('Export Settings')}, group, () => {
            const dialog = new Gtk.FileChooserDialog({
                title: _('Export Settings'),
                action: Gtk.FileChooserAction.SAVE,
                transient_for: window,
                modal: true,
            });
            dialog.set_current_name('astra-monitor-settings.json');
            
            const filter = new Gtk.FileFilter();
            filter.set_name('JSON Files');
            filter.add_mime_type('application/json');
            filter.add_pattern('*.json');
            dialog.add_filter(filter);
            
            dialog.add_button(_('Save'), Gtk.ResponseType.OK);
            dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
            dialog.show();
            
            dialog.connect('response', (dialog, id) => {
                if(id == Gtk.ResponseType.OK) {
                    const path = dialog.get_file().get_path();
                    const file = Gio.file_new_for_path(path);
                    const stream = file.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
                    const settings = this.exportSettings();
                    const data: Uint8Array = new TextEncoder().encode(settings);
                    stream.write_all(data, null);
                    stream.close(null);
                }
                dialog.destroy();
            });
        });
        
        this.addButtonRow({title: _('Import Settings')}, group, () => {
            const dialog = new Gtk.FileChooserDialog({
                title: _('Import Settings'),
                action: Gtk.FileChooserAction.OPEN,
                transient_for: window,
                modal: true,
            });
            
            const filter = new Gtk.FileFilter();
            filter.set_name('JSON Files');
            filter.add_mime_type('application/json');
            filter.add_pattern('*.json');
            dialog.add_filter(filter);
            
            dialog.add_button(_('Open'), Gtk.ResponseType.OK);
            dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
            dialog.show();
            
            dialog.connect('response', (dialog, id) => {
                if(id == Gtk.ResponseType.OK) {
                    try {
                        const path = dialog.get_file().get_path();
                        Utils.readFileAsync(path).then(data => {
                            this.importSettings(data);
                            window.close();
                        }).catch(e => {
                            Utils.error(e.message);
                        });
                    }
                    catch(e:any) {
                        Utils.error(e.message);
                    }
                }
                dialog.destroy();
            });
        });
        
        this.addButtonRow({title: _('Reset Settings')}, group, () => {
            const dialog = new Gtk.MessageDialog({
                title: _('Reset Settings'),
                text: _('Are you sure you want to reset all preferences?'),
                buttons: Gtk.ButtonsType.YES_NO,
                message_type: Gtk.MessageType.WARNING,
                transient_for: window,
                modal: true,
            });
            dialog.connect('response', (_dialog, response) => {
                if(response === Gtk.ResponseType.YES) {
                    this.resetSettings();
                    window.close();
                }
                dialog.close();
            });
            dialog.show();
        });
        
        this.addSwitchRow({
            title: _('Debug Mode'),
            subtitle: _('Warning: may affect performance, use only if you know what you are doing.'),
        }, 'debug-mode', group);
        aboutPage.add(group);
        
        return aboutPage;
    }
    
    private setAllColors(color:string, category:ColorCategory) {
        if(category === ColorCategory.MAIN) {
            const mainColors = [
                'processor-header-graph-color1',
                'processor-header-bars-color1',
                'processor-menu-gpu-color',
                'memory-header-graph-color1',
                'memory-header-bars-color1',
                'memory-menu-swap-color',
                'storage-header-bars-color1',
                'storage-header-io-bars-color1',
                'storage-header-io-graph-color1',
                'storage-menu-arrow-color1',
                'storage-menu-device-color',
                'network-header-io-bars-color1',
                'network-header-io-graph-color1',
                'network-menu-arrow-color1'
            ];
            
            for(const colorPref of mainColors)
                Config.set(colorPref, color, 'string');
            
            // Memory secondary colors are the same as main colors with 0.3 alpha
            const colorParsed = new Gdk.RGBA();
            colorParsed.parse(color);
            colorParsed.alpha = 0.3;
            Config.set('memory-header-graph-color2', colorParsed.to_string(), 'string');
            Config.set('memory-header-bars-color2', colorParsed.to_string(), 'string');
        }
        else if(category === ColorCategory.SECONDARY) {
            const secondaryColors = [
                'processor-header-graph-color2',
                'processor-header-bars-color2',
                'storage-header-io-bars-color2',
                'storage-header-io-graph-color2',
                'storage-menu-arrow-color2',
                'network-header-io-bars-color2',
                'network-header-io-graph-color2',
                'network-menu-arrow-color2'
            ];
            
            for(const colorPref of secondaryColors)
                Config.set(colorPref, color, 'string');
        }
    }
    
    private addExpanderRow(props: RowProps, group: Adw.PreferencesGroup|Adw.ExpanderRow) {
        const tabs = props.tabs;
        delete props.tabs;
        
        const data: any = {
            ...props,
            use_markup: true
        };
        
        const section = new Adw.ExpanderRow(data);
        if(tabs)
            section.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
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
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(section);
        else
            (group as Adw.ExpanderRow).add_row(section);
        return section;
    }
    
    addLabelRow(props: RowProps, label: string, group: Adw.PreferencesGroup|Adw.ExpanderRow) {
        const tabs = props.tabs;
        delete props.tabs;
        
        const row = new Adw.ActionRow(props);
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
        
        const labelWidget = new Gtk.Label({label});
        row.add_suffix(labelWidget);
    }
    
    addTextInputRow(props: RowProps, setting: string, group: Adw.PreferencesGroup|Adw.ExpanderRow, reset?: string) {
        const tabs = props.tabs;
        delete props.tabs;
        
        const row = new Adw.ActionRow(props);
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
        
        const entry = new Gtk.Entry({
            text: Config.get_string(setting),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        let timeoutId: GLib.Source;
        
        entry.connect('changed', widget => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                Config.set(setting, widget.get_text(), 'string');
            }, 1000);
        });
        
        if(reset !== undefined) {
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
    
    addButtonRow(props: RowProps, group: Adw.PreferencesGroup|Adw.ExpanderRow, callback: (...args: any[]) => void) {
        const tabs = props.tabs;
        delete props.tabs;
        
        const row = new Adw.ActionRow(props);
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
        
        row.activatable = true;
        row.connect('activated', callback);
    }
    
    addLinkRow(props: RowProps, url: string, group: Adw.PreferencesGroup|Adw.ExpanderRow) {
        const tabs = props.tabs;
        delete props.tabs;
        
        const row = new Adw.ActionRow({
            ...props,
            use_markup: true
        });
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
        
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
    
    addStatusLabel(props: RowProps, iconName: string, group: Adw.PreferencesGroup|Adw.ExpanderRow) {
        const tabs = props.tabs;
        delete props.tabs;
        
        const row = new Adw.ActionRow(props);
        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        const icon = new Gtk.Image({ icon_name: iconName });
        icon.set_margin_end(10);
        box.append(icon);
        row.add_prefix(box);
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
        
        return {
            row: row,
            icon: icon
        };
    }
    
    addSwitchRow(props: RowProps, setting: string, group: Adw.PreferencesGroup|Adw.ExpanderRow) {
        const tabs = props.tabs;
        delete props.tabs;
        
        const row = new Adw.ActionRow(props);
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
        
        const toggle = new Gtk.Switch({
            active: Config.get_boolean(setting),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        Config.bind(setting, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);

        row.add_suffix(toggle);
        row.activatable_widget = toggle;
    }
    
    addColorRow(props: RowProps, setting: string|ColorCallback, group: Adw.PreferencesGroup|Adw.ExpanderRow, reset?: string) {
        const tabs = props.tabs;
        delete props.tabs;
        
        if(props.icon_name) {
            if(props.title)
                props.title = '  ' + props.title;
            if(props.subtitle)
                props.subtitle = '  ' + props.subtitle.replace('\n', '\n  ');
        }
        
        const isCallback = typeof setting === 'function';
        
        const row = new Adw.ActionRow(props);
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
        
        const button = new Gtk.ColorButton();
        const rgba = new Gdk.RGBA();
        if(isCallback)
            rgba.parse('rgba(0,0,0,0)');
        else
            rgba.parse(Config.get_string(setting) || 'rgba(0,0,0,0)');
        button.useAlpha = true;
        button.set_rgba(rgba);
        
        button.connect('color-set', widget => {
            if(isCallback)
                setting(widget.get_rgba().to_string() || '');
            else
                Config.set(setting, widget.get_rgba().to_string(), 'string');
        });
        
        if(!isCallback) {
            Config.connect(this, 'changed::' + setting, () => {
                const rgba = new Gdk.RGBA();
                rgba.parse(Config.get_string(setting) || 'rgba(0,0,0,0)');
                button.set_rgba(rgba);
            });
        }
        
        if(reset !== undefined) {
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
                if(isCallback)
                    setting(reset);
                else
                    Config.set(setting, reset, 'string');
                
                const rgba = new Gdk.RGBA();
                rgba.parse(reset);
                button.set_rgba(rgba);
            });
        }
        
        row.add_suffix(button);
        row.activatable_widget = button;
    }
    
    addDropRow(props: RowProps, choices: Choice[]|Promise<Choice[]>, setting: string, group: Adw.PreferencesGroup|Adw.ExpanderRow, type: TypeEnumStr = 'int', reset?: string) {
        const tabs = props.tabs;
        delete props.tabs;
        
        let selected = -1;
        let savedValue: any;
        
        switch(type) {
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
                savedValue = Config.get_string(setting);
                break;
            default:
                savedValue = Config.get_value(setting);
                break;
        }
        
        const row = new Adw.ActionRow(props);
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
            if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
        
        const addChoices = (choices: Choice[]) => {
            const stringList = new Gtk.StringList();
            
            for(const choice of choices)
                stringList.append(choice.text);
            
            choices.forEach((choice, index) => {
                let value = choice.value;
                if(type === 'json')
                    value = JSON.stringify(value);
                if(value === savedValue)
                    selected = index;
            });
            
            const select = new Gtk.DropDown({
                model: stringList,
                selected,
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
            });
            
            if(reset !== undefined) {
                const resetButton = new Gtk.Button({
                    halign: Gtk.Align.END,
                    valign: Gtk.Align.CENTER,
                    hexpand: false,
                    vexpand: false,
                    icon_name: 'edit-undo-symbolic',
                    sensitive: true,
                });
                resetButton.connect('clicked', () => {
                    choices.forEach((choice, index) => {
                        let value = choice.value;
                        if(type === 'json')
                            value = JSON.stringify(value);
                        if(value === reset)
                            selected = index;
                    });
                    select.selected = selected;
                    const selectedChoice = choices[selected];
                    if(selectedChoice !== undefined) {
                        if(type === 'json')
                            Config.set(setting, JSON.stringify(selectedChoice.value), 'string');
                        else
                            Config.set(setting, selectedChoice.value, type);
                    }
                });
                row.add_suffix(resetButton);
            }
            
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
        };
        
        if(choices instanceof Promise)
            choices.then(addChoices);
        else
            addChoices(choices);
    }
    
    addComboRow(props: RowProps, choices: Choice[]|Promise<Choice[]>, setting: string, group: Adw.PreferencesGroup|Adw.ExpanderRow, type: TypeEnumStr = 'int', reset?: string) {
        const tabs = props.tabs;
        delete props.tabs;
        
        let selected = -1;
        let savedValue: any;
        
        switch(type) {
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
                savedValue = Config.get_string(setting);
                break;
            default:
                savedValue = Config.get_value(setting);
                break;
        }
        
        const row = new Adw.ActionRow(props);
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
        
        const addChoices = (choices: Choice[]) => {
            const store = new Gtk.ListStore();
            store.set_column_types([GObject.TYPE_STRING, GObject.TYPE_BOOLEAN]);
            
            for(const choice of choices) {
                const iter = store.append();
                store.set(iter, [0, 1], [choice.text, choice.disabled !== true]);
            }
            choices.forEach((choice, index) => {
                let value = choice.value;
                if(type === 'json')
                    value = JSON.stringify(value);
                if(value === savedValue)
                    selected = index;
            });
            
            const select = new Gtk.ComboBox({
                model: store,
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                vexpand: false,
            });
            select.set_active(selected);
            
            const renderer = new Gtk.CellRendererText();
            select.pack_start(renderer, true);
            select.add_attribute(renderer, 'text', 0);
            select.add_attribute(renderer, 'sensitive', 1);
            
            if(reset !== undefined) {
                const resetButton = new Gtk.Button({
                    halign: Gtk.Align.END,
                    valign: Gtk.Align.CENTER,
                    hexpand: false,
                    vexpand: false,
                    icon_name: 'edit-undo-symbolic',
                    sensitive: true,
                });
                resetButton.connect('clicked', () => {
                    for(let index = 0; index < choices.length; index++) {
                        const choice = choices[index];
                        let value = choice.value;
                        if(type === 'json')
                            value = JSON.stringify(value);
                        
                        if(value === reset) {
                            selected = index;
                            break;
                        }
                    }
                    select.set_active(selected);
                    const selectedChoice = choices[selected];
                    if(selectedChoice !== undefined) {
                        if(type === 'json')
                            Config.set(setting, JSON.stringify(selectedChoice.value), 'string');
                        else
                            Config.set(setting, selectedChoice.value, type);
                    }
                });
                row.add_suffix(resetButton);
            }
            
            row.add_suffix(select);
            row.activatable_widget = select;
            
            if(choices[selected] && choices[selected].text)
                select.set_tooltip_text(choices[selected].text);
            select.connect('notify::active', () => {
                const selectedIndex = select.get_active();
                const selectedChoice = choices[selectedIndex];
                if(selectedChoice !== undefined) {
                    row.set_tooltip_text(selectedChoice.text);
                    
                    if(type === 'json')
                        Config.set(setting, JSON.stringify(selectedChoice.value), 'string');
                    else
                        Config.set(setting, selectedChoice.value, type);
                }
            });
        };
        
        if(choices instanceof Promise)
            choices.then(addChoices);
        else
            addChoices(choices);
    }
    
    addSpinRow(props: RowProps, setting: string, group: Adw.PreferencesGroup|Adw.ExpanderRow, adj: AdjustamentProps, numeric: boolean = true, reset?: number) {
        const tabs = props.tabs;
        delete props.tabs;
        
        if(props.icon_name) {
            if(props.title)
                props.title = '  ' + props.title;
            if(props.subtitle)
                props.subtitle = '  ' + props.subtitle.replace('\n', '\n  ');
        }
        
        const adjustment = new Gtk.Adjustment({
            lower: adj.min,
            upper: adj.max,
            step_increment: adj.step ?? 1,
            page_increment: adj.page ?? 10,
            value: (adj.digits || 0) === 0 ? Config.get_int(setting) : Config.get_double(setting)
        });
        
        const row = new Adw.ActionRow(props);
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
        const spinButton = new Gtk.SpinButton({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
            xalign: 0.5,
            adjustment,
            digits: adj.digits || 0,
            numeric
        });
        
        if(reset !== undefined) {
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
        
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
    }
    
    addFontRow(props: RowProps, setting: string, group: Adw.PreferencesGroup|Adw.ExpanderRow, reset?: string) {
        if(!Utils.metadata)
            throw new Error('Metadata not found');
        
        const tabs = props.tabs;
        delete props.tabs;
        
        if(props.icon_name) {
            if(props.title)
                props.title = '  ' + props.title;
            if(props.subtitle)
                props.subtitle = '  ' + props.subtitle.replace('\n', '\n  ');
        }
            
        const row = new Adw.ActionRow(props);
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
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
        
        if(reset !== undefined) {
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
        
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
    }
    
    addOrderingRows(config: string, group: Adw.PreferencesGroup|Adw.ExpanderRow, tabs: number = 0) {
        const monitors = Config.get_json(config);
        for(let index = 0; index < monitors.length; index++) {
            const item = monitors[index] || '';
            this.OrderingItem(item, index, monitors.length, config, group, tabs + 1);
        }
    }
    
    OrderingItem(item: string, index: number, count: number, config: string, group: Adw.PreferencesGroup|Adw.ExpanderRow, tabs: number = 0) {
        const row = new Adw.ActionRow({title: `${index+1}. ${Utils.capitalize(item, false)}` });
        if(tabs)
            row.add_prefix(new Gtk.Box({marginStart: tabs * 20}));
        
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
            row.title = `${index+1}. ${Utils.capitalize(newItem, false)}`;
        });
        
        if((group as any).add)
            (group as Adw.PreferencesGroup).add(row);
        else
            (group as Adw.ExpanderRow).add_row(row);
    }
    
    private exportSettings() {
        const settings = Config.settings;
        const exported: any = {};
        
        if(!settings)
            return JSON.stringify(exported);
        
        const keys = settings.list_keys();
        
        for(const key of keys) {
            const value = settings.get_value(key);
            const schema = settings.settings_schema.get_key(key);
            const type = schema.get_value_type();
            
            if(type.equal(new GLib.VariantType('s')))
                exported[key] = value.get_string()[0];
            else if(type.equal(new GLib.VariantType('b')))
                exported[key] = value.get_boolean();
            else if(type.equal(new GLib.VariantType('i')))
                exported[key] = value.get_int32();
            else if(type.equal(new GLib.VariantType('d')))
                exported[key] = Utils.roundFloatingPointNumber(value.get_double());
            else
                Utils.log('Unsupported type: ' + type);
        }
        
        //order keys alphabetically
        const ordered: any = {};
        Object.keys(exported).sort().forEach(key => {
            ordered[key] = exported[key];
        });
        return JSON.stringify(ordered);
    }
    
    private importSettings(data: string) {
        if(!data)
            return;
        
        const imported = JSON.parse(data);
        if(!imported)
            return;
        
        //Reset settings before importing
        this.resetSettings();
        
        const settings = Config.settings;
        if(!settings)
            return;
        
        const keys = Object.keys(imported);
        for(const key of keys) {
            const value = imported[key];
            
            const schema = settings.settings_schema.get_key(key);
            const type = schema.get_value_type();
            
            if(type.equal(new GLib.VariantType('s')))
                Config.set(key, value, 'string');
            else if(type.equal(new GLib.VariantType('b')))
                Config.set(key, value, 'boolean');
            else if(type.equal(new GLib.VariantType('i')))
                Config.set(key, value, 'int');
            else if(type.equal(new GLib.VariantType('d')))
                Config.set(key, value, 'number');
            else
                Utils.log('Unsupported type: ' + type);
        }
    }
    
    private resetSettings() {
        const settings = Config.settings;
        if(!settings)
            return;
        
        const keys = settings.list_keys();
        for(const key of keys) {
            const schema = settings.settings_schema.get_key(key);
            const type = schema.get_value_type();
            
            if(type.equal(new GLib.VariantType('s')))
                Config.set(key, schema.get_default_value().get_string()[0], 'string');
            else if(type.equal(new GLib.VariantType('b')))
                Config.set(key, schema.get_default_value().get_boolean(), 'boolean');
            else if(type.equal(new GLib.VariantType('i')))
                Config.set(key, schema.get_default_value().get_int32(), 'int');
            else if(type.equal(new GLib.VariantType('d')))
                Config.set(key, schema.get_default_value().get_double(), 'number');
            else
                Utils.log('Unsupported type: ' + type);
        }
    }
    
    // @ts-expect-error never used
    private static applyCssToWidget(widget: Gtk.Widget, cssString: string) {
        const cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_data(cssString, cssString.length);
        widget.get_style_context().add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }
}
