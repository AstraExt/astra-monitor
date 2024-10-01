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

export default class Processors {
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
            title: _('Processors'),
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
            title: _('Processors'),
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
            title: _('Processors'),
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

        const group = new Adw.PreferencesGroup({ title: _('General') });
        PrefsUtils.addSwitchRow({ title: _('Show') }, 'processor-header-show', group);
        PrefsUtils.addSpinRow(
            { title: _('Update frequency (seconds)') },
            'processor-update',
            group,
            { min: 0.1, max: 10, digits: 1, step: 0.1, page: 1 },
            true,
            1.5
        );

        const sourcesSection = PrefsUtils.addExpanderRow(
            { title: _('Data Sources') },
            group,
            'processors'
        );

        const cpuUsageSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'GTop', text: 'GTop' },
            { value: 'proc', text: '/proc/stat' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Cpu Usage'), tabs: 1 },
            cpuUsageSources,
            'processor-source-cpu-usage',
            sourcesSection,
            'string',
            'auto'
        );

        const cpuCoresUsageSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'GTop', text: 'GTop' },
            { value: 'proc', text: '/proc/stat' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Cpu Cores Usage'), tabs: 1 },
            cpuCoresUsageSources,
            'processor-source-cpu-cores-usage',
            sourcesSection,
            'string',
            'auto'
        );

        const cpuTopProcessesSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'GTop', text: 'GTop' },
            { value: 'proc', text: '/proc/[pid]/stat' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Top Processes'), tabs: 1 },
            cpuTopProcessesSources,
            'processor-source-top-processes',
            sourcesSection,
            'string',
            'auto'
        );

        const cpuLoadAverageSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'proc', text: '/proc/loadavg' },
        ];
        PrefsUtils.addComboRow(
            { title: _('Load Average'), tabs: 1 },
            cpuLoadAverageSources,
            'processor-source-load-avg',
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
            'processors'
        );
        Utils.getIndicatorsOrder('processor');
        PrefsUtils.addOrderingRows('processor-indicators-order', orderSection);

        const iconSection = PrefsUtils.addExpanderRow({ title: _('Icon') }, group, 'processors');
        PrefsUtils.addSwitchRow(
            { title: _('Show Icon'), tabs: 1 },
            'processor-header-icon',
            iconSection
        );
        PrefsUtils.addTextInputRow(
            {
                title: _('Icon Name'),
                subtitle:
                    _("Set icon name (ie: 'cpu-symbolic')") +
                    '\n' +
                    _('Set to empty to disable icon override'),
                tabs: 1,
            },
            'processor-header-icon-custom',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Color'), tabs: 1 },
            'processor-header-icon-color',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Alert Color'), tabs: 1 },
            'processor-header-icon-alert-color',
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
            'processor-header-icon-size',
            iconSection,
            { min: 8, max: 30, digits: 0, step: 1, page: 1 },
            true,
            18
        );

        const percentageSection = PrefsUtils.addExpanderRow(
            { title: _('Percentage') },
            group,
            'processors'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Percentage'), tabs: 1 },
            'processor-header-percentage',
            percentageSection
        );
        PrefsUtils.addSwitchRow(
            { title: _('Single Core Percentage'), tabs: 1 },
            'processor-header-percentage-core',
            percentageSection
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Icon Alert'),
                subtitle: _('Set 0 to disable. Value is percentage of total cpu usage.'),
                tabs: 1,
            },
            'processor-header-percentage-icon-alert-threshold',
            percentageSection,
            { min: 0, max: 100, digits: 0, step: 1, page: 10 },
            true,
            0
        );

        const frequencySection = PrefsUtils.addExpanderRow(
            { title: _('Frequency') },
            group,
            'processors'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Frequency'), tabs: 1 },
            'processor-header-frequency',
            frequencySection
        );
        PrefsUtils.addSpinRow(
            { title: _('Frequency Max Number of Figures'), tabs: 1 },
            'processor-header-frequency-figures',
            frequencySection,
            { min: 2, max: 4, digits: 0, step: 1, page: 1 },
            true,
            3
        );
        const frequencyMode = [
            { value: 'average', text: _('Average') },
            { value: 'max', text: _('Max') },
        ];
        PrefsUtils.addComboRow(
            { title: _('Frequency Mode'), tabs: 1 },
            frequencyMode,
            'processor-header-frequency-mode',
            frequencySection,
            'string',
            'average'
        );

        const graphSection = PrefsUtils.addExpanderRow(
            { title: _('History Graph') },
            group,
            'processors'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show History Graph'), tabs: 1 },
            'processor-header-graph',
            graphSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Main Color'),
                subtitle: _(
                    '<b>Total usage</b> color (<b>User usage</b> when breakdown is enabled).'
                ),
                tabs: 1,
            },
            'processor-header-graph-color1',
            graphSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addSwitchRow(
            { title: _('History Graph Breakdown'), tabs: 1 },
            'processor-header-graph-breakdown',
            graphSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Secondary Color'),
                subtitle: _('<b>System usage</b> color.'),
                tabs: 1,
            },
            'processor-header-graph-color2',
            graphSection,
            'rgba(214,29,29,1.0)'
        );
        PrefsUtils.addSpinRow(
            { title: _('History Graph Width'), tabs: 1 },
            'processor-header-graph-width',
            graphSection,
            { min: 10, max: 500, digits: 0, step: 1, page: 10 },
            true,
            30
        );

        const barsSection = PrefsUtils.addExpanderRow(
            { title: _('Realtime Bar') },
            group,
            'processors'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Realtime Bar'), tabs: 1 },
            'processor-header-bars',
            barsSection
        );
        PrefsUtils.addSwitchRow(
            { title: _('Realtime per-core Bars'), tabs: 1 },
            'processor-header-bars-core',
            barsSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Main Color'),
                subtitle: _(
                    '<b>Total usage</b> color (<b>User usage</b> when breakdown is enabled).'
                ),
                tabs: 1,
            },
            'processor-header-bars-color1',
            barsSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Realtime Bar Breakdown'), tabs: 1 },
            'processor-header-bars-breakdown',
            barsSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Secondary Color'),
                subtitle: _('<b>System usage</b> color.'),
                tabs: 1,
            },
            'processor-header-bars-color2',
            barsSection,
            'rgba(214,29,29,1.0)'
        );
        headerPage.add(group);

        /* Tooltip */
        group = new Adw.PreferencesGroup({ title: _('Tooltip') });
        PrefsUtils.addSwitchRow(
            { title: _('Show Tooltip'), tabs: 0 },
            'processor-header-tooltip',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('Percentage'), tabs: 0 },
            'processor-header-tooltip-percentage',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('Single Core Percentage'), tabs: 0 },
            'processor-header-tooltip-percentage-core',
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
        const cpuSection = PrefsUtils.addExpanderRow({ title: _('CPU') }, group, 'processors');
        PrefsUtils.addSwitchRow(
            { title: _('Realtime Bars Breakdown'), tabs: 1 },
            'processor-menu-bars-breakdown',
            cpuSection
        );
        PrefsUtils.addSwitchRow(
            { title: _('History Graph Breakdown'), tabs: 1 },
            'processor-menu-graph-breakdown',
            cpuSection
        );
        PrefsUtils.addSwitchRow(
            { title: _('Core Bars Breakdown'), tabs: 1 },
            'processor-menu-core-bars-breakdown',
            cpuSection
        );
        PrefsUtils.addSwitchRow(
            { title: _('Top Processes Single Core'), tabs: 1 },
            'processor-menu-top-processes-percentage-core',
            cpuSection
        );

        const gpuSection = PrefsUtils.addExpanderRow({ title: _('GPU') }, group, 'processors');

        PrefsUtils.addSwitchRow(
            {
                title: _('Show GPU info'),
                subtitle: _('Only works if GPU header is disabled.'),
                tabs: 1,
            },
            'processor-gpu',
            gpuSection
        );

        menuPage.add(group);
        return menuPage;
    }
}
