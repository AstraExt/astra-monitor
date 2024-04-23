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

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import PrefsUtils from './prefsUtils.js';
import Utils from '../utils/utils.js';
import Config from '../config.js';

type AstraMonitorPrefs = import('../../prefs.js').default;

export default class Storage {
    private general!: Adw.NavigationPage;
    private header!: Adw.NavigationPage;
    private menu!: Adw.NavigationPage;

    constructor(prefs: AstraMonitorPrefs) {
        this.setupGeneral(prefs);
        this.setupHeader(prefs);
        this.setupMenu(prefs);
    }

    public get generalPage() {
        return this.general;
    }

    public get headerPage() {
        return this.header;
    }

    public get menuPage() {
        return this.menu;
    }

    private setupGeneral(_prefs: AstraMonitorPrefs) {
        this.general = new Adw.NavigationPage({
            title: _('Storage'),
            tag: 'general',
        });
        const toolbar = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        header.showTitle = true;
        toolbar.add_top_bar(header);

        const generalPage = this.getGeneralPage();
        toolbar.set_content(generalPage);
        this.generalPage.set_child(toolbar);
    }

    private setupHeader(_prefs: AstraMonitorPrefs) {
        this.header = new Adw.NavigationPage({
            title: _('Storage'),
            tag: 'header',
        });
        const toolbar = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        header.showTitle = true;
        toolbar.add_top_bar(header);

        const headerPage = this.getHeaderPage();
        toolbar.set_content(headerPage);
        this.headerPage.set_child(toolbar);
    }

    private setupMenu(_prefs: AstraMonitorPrefs) {
        this.menu = new Adw.NavigationPage({
            title: _('Storage'),
            tag: 'menu',
        });
        const toolbar = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        header.showTitle = true;
        toolbar.add_top_bar(header);

        const menuPage = this.getMenuPage();
        toolbar.set_content(menuPage);
        this.menuPage.set_child(toolbar);
    }

    private getGeneralPage() {
        const generalPage = new Adw.PreferencesPage({
            title: _('General'),
        });

        const group = new Adw.PreferencesGroup({ title: _('Storage') });
        PrefsUtils.addSwitchRow({ title: _('Show') }, 'storage-header-show', group);
        PrefsUtils.addSpinRow(
            { title: _('Update frequency (seconds)') },
            'storage-update',
            group,
            { min: 0.1, max: 10, digits: 1, step: 0.1, page: 1 },
            true,
            3.0
        );

        const choicesPanel = [
            { value: 'kB/s', text: _('kB/s') },
            { value: 'KiB/s', text: _('KiB/s') },
            { value: 'kb/s', text: _('kb/s') },
            { value: 'Kibit/s', text: _('Kibit/s') },
            { value: 'kBps', text: _('kBps') },
            { value: 'KiBps', text: _('KiBps') },
            { value: 'Kibps', text: _('Kibps') },
            { value: 'kbps', text: _('kbps') },
            { value: 'Kibitps', text: _('Kibitps') },
            { value: 'k ', text: _('k (as kB/s)') },
            { value: 'Ki', text: _('Ki (as KiB/s)') },
        ];
        PrefsUtils.addComboRow(
            { title: _('Data Unit') },
            choicesPanel,
            'storage-io-unit',
            group,
            'string',
            'kB/s'
        );

        const storageMain = Config.get_string('storage-main');
        const disks = Utils.listDisksSync();

        if(storageMain === '[default]' || !storageMain || !disks.has(storageMain)) {
            const defaultId = Utils.findDefaultDisk(disks);
            if(defaultId !== null) Config.set('storage-main', defaultId, 'string');
        }

        const choicesSource = [];
        for(const [id, disk] of disks) {
            let text;
            if(disk.label && disk.name) text = disk.label + ' (' + disk.name + ')';
            else if(disk.label) text = disk.label;
            else if(disk.name) text = disk.name;
            else text = id;
            choicesSource.push({ value: id, text: text });
        }
        PrefsUtils.addComboRow(
            { title: _('Main Disk') },
            choicesSource,
            'storage-main',
            group,
            'string'
        );

        const ignoredSection = PrefsUtils.addExpanderRow(
            { title: _('Ignored Storage Devices') },
            group,
            'storage'
        );

        PrefsUtils.addTextInputRow(
            {
                title: _('Regex'),
                subtitle:
                    _('Devices matching this regex will be ignored.') +
                    '\n' +
                    _('Leave empty to disable. Usage example: ') +
                    "'md{1,3}'",
                tabs: 1,
            },
            'storage-ignored-regex',
            ignoredSection,
            ''
        );

        const devices = Utils.getBlockDevicesSync();
        let ignoredDevices = Config.get_json('storage-ignored');
        if(ignoredDevices === null || !Array.isArray(ignoredDevices)) ignoredDevices = [];

        const main = Config.get_string('storage-main');
        for(const [id, device] of devices.entries()) {
            const name = device.kname;
            const status = !ignoredDevices.includes(name);

            let subtitle = status ? _('Active') : _('Ignored');
            if(id === main) subtitle = _('Main');

            const row = new Adw.ActionRow({ title: name, subtitle });
            ignoredSection.add_row(row);

            let icon_name = status ? 'am-dialog-ok-symbolic' : 'am-dialog-error-symbolic';
            if(id === main) icon_name = 'am-star-symbolic';

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
                let ignored = Config.get_json('storage-ignored');
                if(ignored === null || !Array.isArray(ignored)) ignored = [];

                if(state) {
                    row.subtitle = _('Ignored');
                    icon.icon_name = 'am-dialog-error-symbolic';

                    if(!ignored.includes(name)) {
                        ignored.push(name);
                    }
                    Config.set('storage-ignored', JSON.stringify(ignored), 'string');
                } else {
                    row.subtitle = _('Active');
                    icon.icon_name = 'am-dialog-ok-symbolic';

                    if(ignored.includes(name)) {
                        ignored = ignored.filter((deviceName: string) => deviceName !== name);
                    }
                    Config.set('storage-ignored', JSON.stringify(ignoredDevices), 'string');
                }
            });

            row.add_suffix(toggle);
            row.activatable_widget = toggle;
        }

        const sourcesSection = PrefsUtils.addExpanderRow(
            { title: _('Data Sources') },
            group,
            'storage'
        );

        const storageUsageSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'GTop', text: 'GTop' },
            { value: 'proc', text: 'lsblk' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Storage Usage'), tabs: 1 },
            storageUsageSources,
            'storage-source-storage-usage',
            sourcesSection,
            'string',
            'auto'
        );

        const storageTopProcessesSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'GTop', text: 'GTop' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Top Processes'), tabs: 1 },
            storageTopProcessesSources,
            'storage-source-top-processes',
            sourcesSection,
            'string',
            'auto'
        );

        const storageIOSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'proc', text: '/proc/diskstats' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Storage IO'), tabs: 1 },
            storageIOSources,
            'storage-source-storage-io',
            sourcesSection,
            'string',
            'auto'
        );

        generalPage.add(group);
        return generalPage;
    }

    private getHeaderPage() {
        const headerPage = new Adw.PreferencesPage({
            title: _('Header'),
        });

        let group = new Adw.PreferencesGroup({ title: _('Header') });

        const orderSection = PrefsUtils.addExpanderRow(
            { title: _('Indicators Order') },
            group,
            'storage'
        );
        Utils.getIndicatorsOrder('storage');
        PrefsUtils.addOrderingRows('storage-indicators-order', orderSection);

        const iconSection = PrefsUtils.addExpanderRow({ title: _('Icon') }, group, 'storage');
        PrefsUtils.addSwitchRow(
            { title: _('Show Icon'), tabs: 1 },
            'storage-header-icon',
            iconSection
        );
        PrefsUtils.addTextInputRow(
            {
                title: _('Icon Name'),
                subtitle:
                    _("Set icon name (ie: 'drive-harddisk-symbolic')") +
                    '\n' +
                    _('Set to empty to disable icon override'),
                tabs: 1,
            },
            'storage-header-icon-custom',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Color'), tabs: 1 },
            'storage-header-icon-color',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Alert Color'), tabs: 1 },
            'storage-header-icon-alert-color',
            iconSection,
            'rgba(235, 64, 52, 1)'
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Icon Size'),
                subtitle: _('Experimental feature: may require to disable/enable the extension.'),
                icon_name: 'am-dialog-warning-symbolic',
                tabs: 1,
            },
            'storage-header-icon-size',
            iconSection,
            { min: 8, max: 30, digits: 0, step: 1, page: 1 },
            true,
            18
        );

        const mainDiskSection = PrefsUtils.addExpanderRow(
            { title: _('Main Disk') },
            group,
            'storage'
        );

        PrefsUtils.addLabelRow({ title: _('Usage Bar'), tabs: 1 }, '', mainDiskSection);
        PrefsUtils.addSwitchRow(
            { title: _('Show Main Disk Usage Bar'), tabs: 2 },
            'storage-header-bars',
            mainDiskSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Main Color'),
                subtitle: _('<b>Used</b> storage color.'),
                tabs: 2,
            },
            'storage-header-bars-color1',
            mainDiskSection,
            'rgba(29,172,214,1.0)'
        );

        PrefsUtils.addLabelRow({ title: _('Usage Percentage'), tabs: 1 }, '', mainDiskSection);
        PrefsUtils.addSwitchRow(
            { title: _('Show Main Disk Usage Percentage'), tabs: 2 },
            'storage-header-percentage',
            mainDiskSection
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Icon Alert'),
                subtitle: _('Set 0 to disable. Value is percentage of disk usage.'),
                tabs: 2,
            },
            'storage-header-percentage-icon-alert-threshold',
            mainDiskSection,
            { min: 0, max: 100, digits: 0, step: 1, page: 10 },
            true,
            0
        );

        PrefsUtils.addLabelRow({ title: _('Usage Value'), tabs: 1 }, '', mainDiskSection);
        PrefsUtils.addSwitchRow(
            { title: _('Show Main Disk Usage Value'), tabs: 2 },
            'storage-header-value',
            mainDiskSection
        );
        PrefsUtils.addSpinRow(
            { title: _('Usage Value Max Number of Figures'), tabs: 2 },
            'storage-header-value-figures',
            mainDiskSection,
            { min: 2, max: 4, digits: 0, step: 1, page: 1 },
            true,
            3
        );

        PrefsUtils.addLabelRow({ title: _('Free Value'), tabs: 1 }, '', mainDiskSection);
        PrefsUtils.addSwitchRow(
            { title: _('Show Main Disk Free Value'), tabs: 2 },
            'storage-header-free',
            mainDiskSection
        );
        PrefsUtils.addSpinRow(
            { title: _('Free Value Max Number of Figures'), tabs: 2 },
            'storage-header-free-figures',
            mainDiskSection,
            { min: 2, max: 4, digits: 0, step: 1, page: 1 },
            true,
            3
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Icon Alert'),
                subtitle: _('Set 0 to disable. Value is free MB of storage.'),
                tabs: 2,
            },
            'storage-header-free-icon-alert-threshold',
            mainDiskSection,
            { min: 0, max: 100000, digits: 0, step: 100, page: 1000 },
            true,
            0
        );

        const ioSection = PrefsUtils.addExpanderRow({ title: _('IO') }, group, 'storage');

        PrefsUtils.addLabelRow({ title: _('Realtime IO Bar'), tabs: 1 }, '', ioSection);
        PrefsUtils.addSwitchRow(
            { title: _('Show Realtime IO Bar'), tabs: 2 },
            'storage-header-io-bars',
            ioSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Read Color'),
                subtitle: _('<b>Read</b> IO Bar color.'),
                tabs: 2,
            },
            'storage-header-io-bars-color1',
            ioSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addColorRow(
            {
                title: _('Write Color'),
                subtitle: _('<b>Write</b> IO Bar color.'),
                tabs: 2,
            },
            'storage-header-io-bars-color2',
            ioSection,
            'rgba(214,29,29,1.0)'
        );

        PrefsUtils.addLabelRow({ title: _('IO History Graph'), tabs: 1 }, '', ioSection);
        PrefsUtils.addSwitchRow(
            { title: _('Show IO History Graph'), tabs: 2 },
            'storage-header-graph',
            ioSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Read Color'),
                subtitle: _('<b>Read</b> IO History Graph color.'),
                tabs: 2,
            },
            'storage-header-io-graph-color1',
            ioSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addColorRow(
            {
                title: _('Write Color'),
                subtitle: _('<b>Write</b> IO History Graph color.'),
                tabs: 2,
            },
            'storage-header-io-graph-color2',
            ioSection,
            'rgba(214,29,29,1.0)'
        );
        PrefsUtils.addSpinRow(
            { title: _('IO History Graph Width'), tabs: 2 },
            'storage-header-graph-width',
            ioSection,
            { min: 10, max: 500, digits: 0, step: 1, page: 10 },
            true,
            30
        );

        PrefsUtils.addLabelRow({ title: _('IO Speed'), tabs: 1 }, '', ioSection);
        PrefsUtils.addSwitchRow(
            { title: _('Show IO Speed'), tabs: 2 },
            'storage-header-io',
            ioSection
        );

        const layouts = [
            { value: 'vertical', text: _('Vertical') },
            { value: 'horizontal', text: _('Horizontal') },
        ];
        PrefsUtils.addComboRow(
            { title: _('IO Speed Layout'), tabs: 2 },
            layouts,
            'storage-header-io-layout',
            ioSection,
            'string',
            'vertical'
        );

        PrefsUtils.addSpinRow(
            { title: _('IO Speed Max Number of Figures'), tabs: 2 },
            'storage-header-io-figures',
            ioSection,
            { min: 2, max: 4, digits: 0, step: 1, page: 1 },
            true,
            3
        );
        PrefsUtils.addSpinRow(
            { title: _('IO Speed Threshold'), subtitle: _('in kB/s'), tabs: 2 },
            'storage-header-io-threshold',
            ioSection,
            { min: 0, max: 1000000, digits: 0, step: 1000, page: 10000 },
            true,
            0
        );

        headerPage.add(group);

        /* Tooltip */
        group = new Adw.PreferencesGroup({ title: _('Tooltip') });
        PrefsUtils.addSwitchRow(
            { title: _('Show Tooltip'), tabs: 0 },
            'storage-header-tooltip',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('Main Disk Usage Percentage'), tabs: 0 },
            'storage-header-tooltip-percentage',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('Main Disk Usage Value'), tabs: 0 },
            'storage-header-tooltip-value',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('Main Disk Free Value'), tabs: 0 },
            'storage-header-tooltip-free',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('IO Speed'), tabs: 0 },
            'storage-header-tooltip-io',
            group
        );
        headerPage.add(group);
        return headerPage;
    }

    private getMenuPage() {
        const menuPage = new Adw.PreferencesPage({
            title: _('Menu'),
        });

        const group = new Adw.PreferencesGroup({ title: _('Menu') });

        const ioArrows = PrefsUtils.addExpanderRow({ title: _('IO Arrows') }, group, 'storage');
        PrefsUtils.addColorRow(
            {
                title: _('Read Color'),
                subtitle: _('<b>Read</b> IO arrow color.'),
                tabs: 2,
            },
            'storage-menu-arrow-color1',
            ioArrows,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addColorRow(
            {
                title: _('Write Color'),
                subtitle: _('<b>Write</b> IO arrow color.'),
                tabs: 2,
            },
            'storage-menu-arrow-color2',
            ioArrows,
            'rgba(214,29,29,1.0)'
        );

        const devicesSection = PrefsUtils.addExpanderRow({ title: _('Devices') }, group, 'storage');
        PrefsUtils.addColorRow(
            {
                title: _('Device Usage Bar Color'),
                tabs: 1,
            },
            'storage-menu-device-color',
            devicesSection,
            'rgba(29,172,214,1.0)'
        );

        menuPage.add(group);
        return menuPage;
    }
}
