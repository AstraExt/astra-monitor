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

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import PrefsUtils from './prefsUtils.js';
import Utils from '../utils/utils.js';

type AstraMonitorPrefs = import('../../prefs.js').default;

export default class Memory {
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
            title: _('Memory'),
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
            title: _('Memory'),
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
            title: _('Memory'),
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

        const group = new Adw.PreferencesGroup({ title: _('Memory') });
        PrefsUtils.addSwitchRow({ title: _('Show') }, 'memory-header-show', group);
        PrefsUtils.addSpinRow(
            { title: _('Update frequency (seconds)') },
            'memory-update',
            group,
            { min: 0.1, max: 10, digits: 1, step: 0.1, page: 1 },
            true,
            3.0
        );

        let choicesPanel = [
            { value: 'kB-kiB', text: _('kB (as kiB)') },
            { value: 'kB-KB', text: _('kB (as KB)') },
            { value: 'kiB', text: _('kiB') },
            { value: 'KiB', text: _('KiB') },
            { value: 'KB', text: _('KB') },
            { value: 'k ', text: _('k (as kB)') },
            { value: 'Ki', text: _('Ki (as Ki)') },
        ];
        PrefsUtils.addComboRow(
            { title: _('Data Unit') },
            choicesPanel,
            'memory-unit',
            group,
            'string',
            'kB-kiB'
        );

        choicesPanel = [
            {
                value: 'total-free-buffers-cached',
                text: _('Used = Total - Free - Buffers - Cached'),
            },
            { value: 'total-free', text: _('Used = Total - Free') },
            { value: 'total-available', text: _('Used = Total - Available') },
            { value: 'active', text: _('Used = Active') },
        ];
        PrefsUtils.addComboRow(
            { title: _('Used Memory') },
            choicesPanel,
            'memory-used',
            group,
            'string',
            'total-free-buffers-cached'
        );

        const sourcesSection = PrefsUtils.addExpanderRow(
            { title: _('Data Sources') },
            group,
            'memory'
        );

        const memoryUsageSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'GTop', text: 'GTop' },
            { value: 'proc', text: '/proc/meminfo' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Memory Usage'), tabs: 1 },
            memoryUsageSources,
            'memory-source-memory-usage',
            sourcesSection,
            'string',
            'auto'
        );

        const memoryTopProcessesSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'GTop', text: 'GTop' },
            { value: 'proc', text: 'ps + /proc/[pid]' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Top Processes'), tabs: 1 },
            memoryTopProcessesSources,
            'memory-source-top-processes',
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
            'memory'
        );
        Utils.getIndicatorsOrder('memory');
        PrefsUtils.addOrderingRows('memory-indicators-order', orderSection);

        const iconSection = PrefsUtils.addExpanderRow({ title: _('Icon') }, group, 'memory');
        PrefsUtils.addSwitchRow(
            { title: _('Show Icon'), tabs: 1 },
            'memory-header-icon',
            iconSection
        );
        PrefsUtils.addTextInputRow(
            {
                title: _('Icon Name'),
                subtitle:
                    _("Set icon name (ie: 'memory-symbolic')") +
                    '\n' +
                    _('Set to empty to disable icon override'),
                tabs: 1,
            },
            'memory-header-icon-custom',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Color'), tabs: 1 },
            'memory-header-icon-color',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Alert Color'), tabs: 1 },
            'memory-header-icon-alert-color',
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
            'memory-header-icon-size',
            iconSection,
            { min: 8, max: 30, digits: 0, step: 1, page: 1 },
            true,
            18
        );

        const percentageSection = PrefsUtils.addExpanderRow(
            { title: _('Usage Percentage') },
            group,
            'memory'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Usage Percentage'), tabs: 1 },
            'memory-header-percentage',
            percentageSection
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Icon Alert'),
                subtitle: _('Set 0 to disable. Value is percentage of ram usage.'),
                tabs: 1,
            },
            'memory-header-percentage-icon-alert-threshold',
            percentageSection,
            { min: 0, max: 100, digits: 0, step: 1, page: 10 },
            true,
            0
        );

        const valueSection = PrefsUtils.addExpanderRow(
            { title: _('Usage Value') },
            group,
            'memory'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Usage Value'), tabs: 1 },
            'memory-header-value',
            valueSection
        );
        PrefsUtils.addSpinRow(
            { title: _('Usage Value Max Number of Figures'), tabs: 1 },
            'memory-header-value-figures',
            valueSection,
            { min: 2, max: 4, digits: 0, step: 1, page: 1 },
            true,
            3
        );

        const freeSection = PrefsUtils.addExpanderRow({ title: _('Free Value') }, group, 'memory');
        PrefsUtils.addSwitchRow(
            { title: _('Show Free Value'), tabs: 1 },
            'memory-header-free',
            freeSection
        );
        PrefsUtils.addSpinRow(
            { title: _('Free Value Max Number of Figures'), tabs: 1 },
            'memory-header-free-figures',
            freeSection,
            { min: 2, max: 4, digits: 0, step: 1, page: 1 },
            true,
            3
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Icon Alert'),
                subtitle: _('Set 0 to disable. Value is free MB of ram.'),
                tabs: 1,
            },
            'memory-header-free-icon-alert-threshold',
            freeSection,
            { min: 0, max: 100000, digits: 0, step: 100, page: 1000 },
            true,
            0
        );

        const graphSection = PrefsUtils.addExpanderRow(
            { title: _('History Graph') },
            group,
            'memory'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show History Graph'), tabs: 1 },
            'memory-header-graph',
            graphSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Main Color'),
                subtitle: _('<b>Used</b> memory color.'),
                tabs: 1,
            },
            'memory-header-graph-color1',
            graphSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addSwitchRow(
            { title: _('History Graph Breakdown'), tabs: 1 },
            'memory-header-graph-breakdown',
            graphSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Alt Color'),
                subtitle: _('<b>Allocated <u>unused</u></b> memory color.'),
                tabs: 1,
            },
            'memory-header-graph-color2',
            graphSection,
            'rgba(29,172,214,0.3)'
        );
        PrefsUtils.addSpinRow(
            { title: _('History Graph Width'), tabs: 1 },
            'memory-header-graph-width',
            graphSection,
            { min: 10, max: 500, digits: 0, step: 1, page: 10 },
            true,
            30
        );

        const barsSection = PrefsUtils.addExpanderRow(
            { title: _('Realtime Bar') },
            group,
            'memory'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Realtime Bar'), tabs: 1 },
            'memory-header-bars',
            barsSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Main Color'),
                subtitle: _('<b>Used</b> memory color.'),
                tabs: 1,
            },
            'memory-header-bars-color1',
            barsSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Realtime Bar Breakdown'), tabs: 1 },
            'memory-header-bars-breakdown',
            barsSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Alt Color'),
                subtitle: _('<b>Allocated <u>unused</u></b> memory color.'),
                tabs: 1,
            },
            'memory-header-bars-color2',
            barsSection,
            'rgba(29,172,214,0.3)'
        );
        headerPage.add(group);

        /* Tooltip */
        group = new Adw.PreferencesGroup({ title: _('Tooltip') });
        PrefsUtils.addSwitchRow(
            { title: _('Show Tooltip'), tabs: 0 },
            'memory-header-tooltip',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('Usage Percentage'), tabs: 0 },
            'memory-header-tooltip-percentage',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('Usage Value'), tabs: 0 },
            'memory-header-tooltip-value',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('Free Value'), tabs: 0 },
            'memory-header-tooltip-free',
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

        const memorySection = PrefsUtils.addExpanderRow({ title: _('Memory') }, group, 'memory');
        PrefsUtils.addSwitchRow(
            { title: _('History Graph Breakdown'), tabs: 1 },
            'memory-menu-graph-breakdown',
            memorySection
        );

        const swapSection = PrefsUtils.addExpanderRow({ title: _('Swap') }, group, 'memory');
        PrefsUtils.addColorRow(
            {
                title: _('Swap Bar Color'),
                subtitle: _('Swap bar main color.'),
                tabs: 1,
            },
            'memory-menu-swap-color',
            swapSection,
            'rgba(29,172,214,1.0)'
        );

        menuPage.add(group);
        return menuPage;
    }
}
