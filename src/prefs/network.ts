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

export default class Network {
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
            title: _('Network'),
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
            title: _('Network'),
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
            title: _('Network'),
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

        const group = new Adw.PreferencesGroup({ title: _('Network') });
        PrefsUtils.addSwitchRow({ title: _('Show') }, 'network-header-show', group);
        PrefsUtils.addSpinRow(
            { title: _('Update frequency (seconds)') },
            'network-update',
            group,
            { min: 0.1, max: 10, digits: 1, step: 0.1, page: 1 },
            true,
            1.5
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
            'network-io-unit',
            group,
            'string',
            'kB/s'
        );

        const ignoredSection = PrefsUtils.addExpanderRow(
            { title: _('Ignored Network Interfaces') },
            group,
            'network'
        );

        PrefsUtils.addTextInputRow(
            {
                title: _('Regex'),
                subtitle:
                    _('Interfaces matching this regex will be ignored.') +
                    '\n' +
                    _('Leave empty to disable. Usage example: ') +
                    "'veth\\w{3,16}'",
                tabs: 1,
            },
            'network-ignored-regex',
            ignoredSection,
            ''
        );

        const devices = Utils.getNetworkInterfacesSync();
        let ignoredDevices = Config.get_json('network-ignored');
        if(ignoredDevices === null || !Array.isArray(ignoredDevices)) ignoredDevices = [];

        for(const [name] of devices.entries()) {
            const status = !ignoredDevices.includes(name);

            const subtitle = status ? _('Active') : _('Ignored');

            const row = new Adw.ActionRow({ title: name, subtitle });
            ignoredSection.add_row(row);

            const iconName = status ? 'am-dialog-ok-symbolic' : 'am-dialog-error-symbolic';

            const icon = new Gtk.Image({ iconName: iconName });
            icon.set_margin_start(15);
            icon.set_margin_end(10);
            row.add_prefix(icon);

            const toggle = new Gtk.Switch({
                active: !status,
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
            });

            toggle.connect('state-set', (_switchObj, state) => {
                let ignored = Config.get_json('network-ignored');
                if(ignored === null || !Array.isArray(ignoredDevices)) ignored = [];

                if(state) {
                    row.subtitle = _('Ignored');
                    icon.iconName = 'am-dialog-error-symbolic';
                    if(!ignored.includes(name)) {
                        ignored.push(name);
                    }
                    Config.set('network-ignored', JSON.stringify(ignored), 'string');
                } else {
                    row.subtitle = _('Active');
                    icon.iconName = 'am-dialog-ok-symbolic';

                    if(ignored.includes(name)) {
                        ignored = ignored.filter((deviceName: string) => deviceName !== name);
                    }
                    Config.set('network-ignored', JSON.stringify(ignored), 'string');
                }
            });

            row.add_suffix(toggle);
            row.activatableWidget = toggle;
        }

        const sourcesSection = PrefsUtils.addExpanderRow(
            { title: _('Data Sources') },
            group,
            'network'
        );
        const networkIOSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'GTop', text: 'GTop' },
            { value: 'proc', text: '/proc/net/dev' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Network IO'), tabs: 1 },
            networkIOSources,
            'network-source-network-io',
            sourcesSection,
            'string',
            'auto'
        );

        PrefsUtils.addTextInputRow(
            {
                title: _('Public IPv4 Address'),
                subtitle: _('Set to empty to disable. Address will be regex matched.'),
                tabs: 1,
            },
            'network-source-public-ipv4',
            sourcesSection,
            'https://api.ipify.org'
        );

        PrefsUtils.addTextInputRow(
            {
                title: _('Public IPv6 Address'),
                subtitle: _('Set to empty to disable. Address will be regex matched.'),
                tabs: 1,
            },
            'network-source-public-ipv6',
            sourcesSection,
            'https://api6.ipify.org'
        );

        const networkWirelessSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'iwconfig', text: 'iwconfig' },
            { value: 'iw', text: 'iw' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Wireless Info'), tabs: 1 },
            networkWirelessSources,
            'network-source-wireless',
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

        let group = new Adw.PreferencesGroup({ title: 'Header' });

        const orderSection = PrefsUtils.addExpanderRow(
            { title: _('Indicators Order') },
            group,
            'network'
        );
        Utils.getIndicatorsOrder('network');
        PrefsUtils.addOrderingRows('network-indicators-order', orderSection);

        const iconSection = PrefsUtils.addExpanderRow({ title: _('Icon') }, group, 'network');
        PrefsUtils.addSwitchRow(
            { title: _('Show Icon'), tabs: 1 },
            'network-header-icon',
            iconSection
        );
        PrefsUtils.addTextInputRow(
            {
                title: _('Icon Name'),
                subtitle:
                    _("Set icon name (ie: 'network-wired-symbolic')") +
                    '\n' +
                    _('Set to empty to disable icon override'),
                tabs: 1,
            },
            'network-header-icon-custom',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Color'), tabs: 1 },
            'network-header-icon-color',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Alert Color'), tabs: 1 },
            'network-header-icon-alert-color',
            iconSection,
            'rgba(235, 64, 52, 1)'
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Icon Size'),
                subtitle: _('Experimental feature: may require to disable/enable the extension.'),
                iconName: 'am-dialog-warning-symbolic',
                tabs: 1,
            },
            'network-header-icon-size',
            iconSection,
            { min: 8, max: 30, digits: 0, step: 1, page: 1 },
            true,
            18
        );

        const ioSection = PrefsUtils.addExpanderRow({ title: _('IO') }, group, 'network');

        PrefsUtils.addLabelRow({ title: _('Realtime IO Bar'), tabs: 1 }, '', ioSection);
        PrefsUtils.addSwitchRow(
            { title: _('Show Realtime IO Bar'), tabs: 2 },
            'network-header-bars',
            ioSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Upload Color'),
                subtitle: _('<b>Upload</b> IO Bar color.'),
                tabs: 2,
            },
            'network-header-io-bars-color1',
            ioSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addColorRow(
            {
                title: _('Download Color'),
                subtitle: _('<b>Download</b> IO Bar color.'),
                tabs: 2,
            },
            'network-header-io-bars-color2',
            ioSection,
            'rgba(214,29,29,1.0)'
        );

        PrefsUtils.addLabelRow({ title: _('IO History Graph'), tabs: 1 }, '', ioSection);
        PrefsUtils.addSwitchRow(
            { title: _('Show IO History Graph'), tabs: 2 },
            'network-header-graph',
            ioSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Upload Color'),
                subtitle: _('<b>Upload</b> IO History Graph color.'),
                tabs: 2,
            },
            'network-header-io-graph-color1',
            ioSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addColorRow(
            {
                title: _('Download Color'),
                subtitle: _('<b>Download</b> IO History Graph color.'),
                tabs: 2,
            },
            'network-header-io-graph-color2',
            ioSection,
            'rgba(214,29,29,1.0)'
        );
        PrefsUtils.addSpinRow(
            { title: _('IO History Graph Width'), tabs: 2 },
            'network-header-graph-width',
            ioSection,
            { min: 10, max: 500, digits: 0, step: 1, page: 10 },
            true,
            30
        );

        PrefsUtils.addLabelRow({ title: _('IO Speed'), tabs: 1 }, '', ioSection);
        PrefsUtils.addSwitchRow(
            { title: _('Show IO Speed'), tabs: 2 },
            'network-header-io',
            ioSection
        );

        const layouts = [
            { value: 'vertical', text: _('Vertical') },
            { value: 'horizontal', text: _('Horizontal') },
        ];
        PrefsUtils.addComboRow(
            { title: _('IO Speed Layout'), tabs: 2 },
            layouts,
            'network-header-io-layout',
            ioSection,
            'string',
            'vertical'
        );

        PrefsUtils.addSpinRow(
            { title: _('IO Speed Max Number of Figures'), tabs: 2 },
            'network-header-io-figures',
            ioSection,
            { min: 2, max: 4, digits: 0, step: 1, page: 1 },
            true,
            3
        );
        PrefsUtils.addSpinRow(
            { title: _('IO Speed Threshold'), subtitle: _('in kB/s'), tabs: 2 },
            'network-header-io-threshold',
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
            'network-header-tooltip',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('IO Speed'), tabs: 0 },
            'network-header-tooltip-io',
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

        const ioArrows = PrefsUtils.addExpanderRow({ title: _('IO Arrows') }, group, 'network');
        PrefsUtils.addColorRow(
            {
                title: _('Upload Color'),
                subtitle: _('<b>Upload</b> IO arrow color.'),
                tabs: 2,
            },
            'network-menu-arrow-color1',
            ioArrows,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addColorRow(
            {
                title: _('Download Color'),
                subtitle: _('<b>Download</b> IO arrow color.'),
                tabs: 2,
            },
            'network-menu-arrow-color2',
            ioArrows,
            'rgba(214,29,29,1.0)'
        );

        menuPage.add(group);
        return menuPage;
    }
}
