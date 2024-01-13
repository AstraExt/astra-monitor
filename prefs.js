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

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import Utils from './src/utils/utils.js';
import Config from './src/config.js';

export default class AstraMonitorPrefs extends ExtensionPreferences {
    defaultSize = { width: 800, height: 650 };
    
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
        Utils.metadata = this.metadata;
        Config.settings = this.getSettings();
        this.loadCustomTheme();
        
        window.connect('close-request', () => {
            Utils.metadata = null;
            Config.settings = null;
        });
        
        const generalPage = new Adw.PreferencesPage({title: _('General'), iconName: 'am-settings-symbolic'});
        window.add(generalPage);
        
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
        
        const statusLabel = this.addStatusLabel(_('Checking GTop dependency...'), 'am-dialog-info-symbolic', group);
        Utils.hasGTop().then(gTopAvailable => {
            if(!gTopAvailable) {
                statusLabel.updateText(_('GTop not installed, some optional features will be disabled!'));
                statusLabel.updateIcon('am-dialog-warning-symbolic');
            }
        });*/
        
        if(check)
            this.addStatusLabel(_('All dependencies are met!'), 'am-dialog-ok-symbolic', group);
        generalPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Visualization')});
        
        let choicesPanel = [
            {value: 'dark', text: _('Dark')},
            {value: 'light', text: _('Light')}
        ];
        this.addComboRow(_('Shell Theme Style'), choicesPanel, 'theme-style', group, 'string');
        
        choicesPanel = [
            {value: 'left', text: _('Left')},
            {value: 'center', text: _('Center')},
            {value: 'right', text: _('Right')},
        ];
        this.addComboRow(_('Panel Box'), choicesPanel, 'panel-box', group, 'string');
        this.addSpinRow(_('Panel Box Ordering'), 'panel-box-order', group, -10, 10, 0, 1, 1, true);
        
        generalPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Monitor Ordering')});
        this.addMonitorOrderingRow(group);
        generalPage.add(group);
        
        /**
         * Processor
         */
        const processorPage = new Adw.PreferencesPage({title: _('Processors'), icon_name: 'am-cpu-symbolic'});
        window.add(processorPage);
        
        group = new Adw.PreferencesGroup({title: _('Processors')});
        this.addSwitchRow(_('Show'), 'processor-header-show', group);
        this.addSpinRow(_('Update frequency (seconds)'), 'processor-update', group, 0.1, 10, 1, 0.1, 1, true, true);
        
        processorPage.add(group);

        group = new Adw.PreferencesGroup({title: _('Header')});
        this.addSwitchRow(_('Show Icon'), 'processor-header-icon', group);
        this.addSwitchRow(_('Show Percentage'), 'processor-header-percentage', group);
        this.addSwitchRow(_('Show Percentage Single Core'), 'processor-header-percentage-core', group);
        
        this.addSwitchRow(_('Show History Graph'), 'processor-header-graph', group);
        this.addSwitchRow(_('History Graph Breakdown'), 'processor-header-graph-breakdown', group);
        
        this.addSwitchRow(_('Show Realtime Bar'), 'processor-header-bars', group);
        this.addSwitchRow(_('Realtime per-core Bars'), 'processor-header-bars-core', group);
        this.addSwitchRow(_('Realtime Bar Breakdown'), 'processor-header-bars-breakdown', group);
        processorPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Menu')});
        this.addSwitchRow(_('History Graph Breakdown'), 'processor-menu-graph-breakdown', group);
        this.addSwitchRow(_('Core Bars Breakdown'), 'processor-menu-bars-breakdown', group);
        
        const gpus = Utils.getGPUsList();
        let choicesSource = [{value: '', text: _('None')}]
        for(const gpu of gpus) {
            const keysToKeep = ['domain', 'bus', 'slot', 'vendorId', 'productId'];
            const data = Object.keys(gpu)
                .filter(key => keysToKeep.includes(key))
                .reduce((obj, key) => {
                    obj[key] = gpu[key];
                    return obj;
                }, {});
            choicesSource.push({value: data, text: Utils.GPUModelShortify(gpu.model)});
        }
        this.addComboRow(_('GPU'), choicesSource, 'processor-menu-gpu', group, 'json');
        
        processorPage.add(group);
        
        /**
         * Memory
         */
        const memoryPage = new Adw.PreferencesPage({title: _('Memory'), icon_name: 'am-memory-symbolic'});
        window.add(memoryPage);
        
        group = new Adw.PreferencesGroup({title: _('Memory')});
        this.addSwitchRow(_('Show'), 'memory-header-show', group);
        this.addSpinRow(_('Update frequency (seconds)'), 'memory-update', group, 0.1, 10, 1, 0.1, 1, true, true);
        
        choicesPanel = [
            {value: 'total-free-buffers-cached', text: _('Total - Free - Buffers - Cached')},
            {value: 'total-free', text: _('Total - Free')},
            {value: 'total-available', text: _('Total - Available')},
            {value: 'active', text: _('Active')},
        ];
        this.addComboRow(_('Used Memory'), choicesPanel, 'memory-used', group, 'string');
        
        memoryPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Header')});
        this.addSwitchRow(_('Show Icon'), 'memory-header-icon', group);
        this.addSwitchRow(_('Show Percentage'), 'memory-header-percentage', group);
        
        this.addSwitchRow(_('Show History Graph'), 'memory-header-graph', group);
        this.addSwitchRow(_('History Graph Breakdown'), 'memory-header-graph-breakdown', group);
        
        this.addSwitchRow(_('Show Realtime Bar'), 'memory-header-bars', group);
        this.addSwitchRow(_('Realtime Bar Breakdown'), 'memory-header-bars-breakdown', group);
        memoryPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Menu')});
        this.addSwitchRow(_('History Graph Breakdown'), 'memory-menu-graph-breakdown', group);
        
        memoryPage.add(group);
        
        /**
         * Storage
         */
        const storagePage = new Adw.PreferencesPage({title: _('Storage'), icon_name: 'am-harddisk-symbolic'});
        window.add(storagePage);
        
        group = new Adw.PreferencesGroup({title: _('Storage')});
        this.addSwitchRow(_('Show'), 'storage-header-show', group);
        this.addSpinRow(_('Update frequency (seconds)'), 'storage-update', group, 0.1, 10, 1, 0.1, 1, true, true);
        
        choicesPanel = [
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
        
        choicesSource = [];
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
        this.addSwitchRow(_('Show Icon'), 'storage-header-icon', group);
        
        this.addSwitchRow(_('Show Storage Usage Bar'), 'storage-header-bars', group);
        this.addSwitchRow(_('Show Storage Usage Percentage'), 'storage-header-percentage', group);
        
        this.addSwitchRow(_('Show IO History Graph'), 'storage-header-graph', group);  
        this.addSwitchRow(_('Show IO Speed'), 'storage-header-io', group);  
        storagePage.add(group);
        
        /**
         * Network
         */
        const networkPage = new Adw.PreferencesPage({title: _('Network'), icon_name: 'am-network-symbolic'});
        window.add(networkPage);
        
        group = new Adw.PreferencesGroup({title: _('Network')});
        this.addSwitchRow(_('Show'), 'network-header-show', group);
        this.addSpinRow(_('Update frequency (seconds)'), 'network-update', group, 0.1, 10, 1, 0.1, 1, true, true);
        
        choicesPanel = [
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
        
        networkPage.add(group);
        
        group = new Adw.PreferencesGroup({title: 'Header'});
        this.addSwitchRow(_('Show Icon'), 'network-header-icon', group);
        
        this.addSwitchRow(_('Show Network Usage Bar'), 'network-header-bars', group);        
        this.addSwitchRow(_('Show IO History Graph'), 'network-header-graph', group);  
        this.addSwitchRow(_('Show IO Speed'), 'network-header-io', group);  
        networkPage.add(group);
        
        /**
         * Sensors
         */
        const sensorsPage = new Adw.PreferencesPage({title: _('Sensors'), icon_name: 'am-temperature-symbolic'});
        window.add(sensorsPage);
        
        group = new Adw.PreferencesGroup({title: _('Sensors')});
        this.addSwitchRow(_('Show'), 'sensors-header-show', group);
        this.addSpinRow(_('Update frequency (seconds)'), 'sensors-update', group, 1, 60, 1, 0.5, 1, true, true);
        
        let choicesUnit = [
            {value: 'celsius', text: _('Celsius')},
            {value: 'fahrenheit', text: _('Fahrenheit')},
        ];
        this.addComboRow(_('Temperature Unit'), choicesUnit, 'sensors-temperature-unit', group, 'string');
        sensorsPage.add(group);
        
        group = new Adw.PreferencesGroup({title: _('Header')});
        this.addSwitchRow(_('Show Icon'), 'sensors-header-icon', group);
        
        const sources = Utils.getSensorSources();
        
        /**
         * @type {{value:string, text:string}[]}
         */
        choicesSource = [{value: '', text: _('None')}]
        for(const source of sources)
            choicesSource.push({value: source.value, text: source.text});
        
        this.addSwitchRow(_('Show Sensor 1'), 'sensors-header-sensor1-show', group);
        this.addComboRow(_('Sensor 1 Source'), choicesSource, 'sensors-header-sensor1', group, 'json');
        this.addSwitchRow(_('Show Sensor 2'), 'sensors-header-sensor2-show', group);
        this.addComboRow(_('Sensor 2 Source'), choicesSource, 'sensors-header-sensor2', group, 'json');
        sensorsPage.add(group);
        
        const aboutPage = new Adw.PreferencesPage({title: 'About', icon_name: 'am-dialog-info-symbolic'});
        window.add(aboutPage);
        
        group = new Adw.PreferencesGroup({title: _('Info')});
        
        let version;
        if(this.metadata['version-name'])
            version = this.metadata['version-name'] + ' (EGOv' + this.metadata['version'] + ')';
        else
            version = 'EGOv' + this.metadata['version'];
        this.addLabelRow(_('Version'), version, group);
        this.addLinkRow(_('Changelog'), 'https://github.com/AstraExt/astra-monitor/blob/main/RELEASES.md', group);
        this.addLinkRow(_('GitHub'), 'https://github.com/AstraExt/astra-monitor', group);
        this.addLinkRow(_('GNOME Extensions page'), 'https://extensions.gnome.org/extension/6682/astra-monitor/', group);
        this.addLinkRow(_('Report a bug or suggest new feature'), 'https://github.com/AstraExt/astra-monitor/issues/new/choose', group);
        this.addLinkRow(_('Buy us a coffee'), 'https://www.buymeacoffee.com/astra.ext', group);
        this.addLinkRow(_('Become a patron'), 'https://www.patreon.com/AstraExt', group);
        aboutPage.add(group);
        
        window.set_default_size(this.defaultSize.width, this.defaultSize.height);
    }
    
    addLabelRow(title, label, group) {
        const row = new Adw.ActionRow({title});
        group.add(row);
        
        const labelWidget = new Gtk.Label({label});
        row.add_suffix(labelWidget);
    }
    
    addButtonRow(title, group, callback) {
        const row = new Adw.ActionRow({title});
        group.add(row);
        
        row.activatable = true;
        row.connect('activate', callback);
    }
    
    addLinkRow(title, url, group) {
        const row = new Adw.ActionRow({title});
        group.add(row);
        
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
        group.add(row);
        
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
        group.add(row);
        
        let toggle = new Gtk.Switch({
            active: Config.get_boolean(setting),
            valign: Gtk.Align.CENTER,
        });
        Config.bind(setting, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);

        row.add_suffix(toggle);
        row.activatable_widget = toggle;
    }
    
    addColorRow(title, setting, group) {
        const row = new Adw.ActionRow({title});
        group.add(row);
        
        const button = new Gtk.ColorButton();
        const rgba = new Gdk.RGBA();
        rgba.parse(Config.get_string(setting));
        button.set_rgba(rgba);
        button.connect('color-set', widget => {
            Config.set(setting, widget.get_rgba().to_string(), 'string');
        });
        
        row.add_suffix(button);
        row.activatable_widget = button;
    }
    
    /**
     * @param {string} title 
     * @param {{value:any, text:string}[]} choices 
     * @param {string} setting 
     * @param {Adw.PreferencesGroup} group 
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
        
        let row = new Adw.ComboRow({title, model: stringList, selected});
        if(choices[selected] && choices[selected].text)
            row.set_tooltip_text(choices[selected].text);
        row.connect('notify::selected', widget => {
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
        
        group.add(row);
    }
    
    addSpinRow(title, setting, group, min, max, digits = 0, step = 1, page = 10, numeric = true, restart = false) {
        const adjustment = new Gtk.Adjustment({
            lower: min,
            upper: max,
            step_increment: step,
            page_increment: page,
            value: digits === 0 ? Config.get_int(setting) : Config.get_double(setting)
        });
        
        //const originalValue = adjustment.value;
        
        const row = new Adw.SpinRow({title, adjustment, digits, numeric });
        row.connect('notify::value', widget => {
            Config.set(setting, widget.value, digits === 0 ? 'int' : 'number');
            
            // Restart should be now handled by the monitor itself
            /*if(restart) {
                if(widget.value !== originalValue) {
                    row.subtitle = _('(Toggle off/on ext. required)');
                }
                else {
                    row.subtitle = '';
                }
            }*/
        });
        group.add(row);
    }
    
    addMonitorOrderingRow(group) {
        let monitors = Utils.getMonitorsOrder();
        
        for(let index = 0; index < monitors.length; index++) {
            this.addMonitorOrderingRowItem(group, index);
        }
    }
    
    addMonitorOrderingRowItem(group, index) {
        const monitors = Config.get_json('monitors-order');
        const monitor = monitors[index] || '';
        
        const row = new Adw.ActionRow({ title: `${index+1}. ${Utils.capitalize(monitor)}` });
        group.add(row);
        
        let buttonUp;
        if(index > 0) {
            buttonUp = new Gtk.Button({label: '↑'});
            buttonUp.connect('clicked', () => {
                const monitors = Config.get_json('monitors-order');
                const monitor = monitors[index];
                monitors.splice(index, 1);
                monitors.splice(index - 1, 0, monitor);
                Config.set('monitors-order', JSON.stringify(monitors), 'string');
            });
        }
        else {
            buttonUp = new Gtk.Button({label: '↑', sensitive: false});
        }
        
        let buttonDown;
        if(index < monitors.length - 1) {
            buttonDown = new Gtk.Button({label: '↓'});
            buttonDown.connect('clicked', () => {
                const monitors = Config.get_json('monitors-order');
                const monitor = monitors[index];
                monitors.splice(index, 1);
                monitors.splice(index + 1, 0, monitor);
                Config.set('monitors-order', JSON.stringify(monitors), 'string');
            });
        }
        else {
            buttonDown = new Gtk.Button({label: '↓', sensitive: false});
        }
        
        if(buttonDown)
            row.add_suffix(buttonDown);
        if(buttonUp)
            row.add_suffix(buttonUp);
        
        Config.connect(this, 'changed::monitors-order', () => {
            const monitors = Config.get_json('monitors-order');
            const monitor = monitors[index] || '';
            row.title = `${index+1}. ${Utils.capitalize(monitor)}`;
        });
    }
};
