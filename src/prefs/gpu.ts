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
import Utils, { GpuInfo } from '../utils/utils.js';
import Config from '../config.js';

type AstraMonitorPrefs = import('../../prefs.js').default;

export default class Gpu {
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
            title: _('GPU'),
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
            title: _('GPU'),
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
            title: _('GPU'),
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

        let group = new Adw.PreferencesGroup({ title: _('General') });
        PrefsUtils.addSwitchRow(
            {
                title: _('Show'),
                subtitle:
                    _('Showing GPU info in the panel requires continuous GPU monitoring.') +
                    '\n' +
                    'This may have a (minor) performance impact.' +
                    '\n' +
                    _("Hint: You can instead choose to show GPU stats in Processors' menu."),
                iconName: 'am-dialog-warning-symbolic',
            },
            'gpu-header-show',
            group
        );
        PrefsUtils.addSpinRow(
            { title: _('Update frequency (seconds)') },
            'gpu-update',
            group,
            { min: 1, max: 10, digits: 1, step: 0.1, page: 1 },
            true,
            1.5
        );

        const gpus = Utils.getGPUsList();
        const choicesSource = [{ value: '', text: _('None') }];
        for(const gpu of gpus) {
            const keysToKeep = ['domain', 'bus', 'slot', 'vendorId', 'productId'];
            const data = Object.keys(gpu)
                .filter(key => keysToKeep.includes(key))
                .reduce((obj: any, key: string) => {
                    obj[key] = gpu[key as keyof GpuInfo];
                    return obj;
                }, {});
            choicesSource.push({ value: data, text: Utils.getGPUModelName(gpu) });
        }
        PrefsUtils.addDropRow(
            { title: _('Main GPU'), subtitle: _('May require a restart.') },
            choicesSource,
            'gpu-main',
            group,
            'json'
        );

        generalPage.add(group);

        group = new Adw.PreferencesGroup({ title: _('GPU') });

        for(const gpu of gpus) {
            const gpuSection = PrefsUtils.addExpanderRow(
                { title: Utils.getGPUModelName(gpu) },
                group,
                'gpu'
            );

            if(!Utils.canMonitorGpu(gpu)) {
                PrefsUtils.addLabelRow(
                    {
                        title: _(
                            'Monitoring of this GPU is not supported or a dependency is missing.'
                        ),
                    },
                    '',
                    gpuSection
                );
                continue;
            }

            const gpuMonitorValue = {
                watch: 'gpu-data',
                get: () => {
                    const gpusData = Config.get_json('gpu-data');
                    for(const gpuData of gpusData) {
                        if(Utils.isSameGpu(gpu, gpuData)) {
                            return gpuData.monitor;
                        }
                    }
                    return false;
                },
                set: (value: boolean) => {
                    let changed = false;

                    const gpusData = Config.get_json('gpu-data');
                    if(value) {
                        let found = false;
                        for(const gpuData of gpusData) {
                            if(Utils.isSameGpu(gpu, gpuData)) {
                                found = true;
                                break;
                            }
                        }
                        if(!found) {
                            gpusData.push({
                                domain: gpu.domain,
                                bus: gpu.bus,
                                slot: gpu.slot,
                                vendorId: gpu.vendorId,
                                productId: gpu.productId,
                                monitor: true,
                            });
                            changed = true;
                        }
                    } else {
                        for(const gpuData of gpusData) {
                            if(
                                gpuData.domain === gpu.domain &&
                                gpuData.bus === gpu.bus &&
                                gpuData.slot === gpu.slot
                            ) {
                                gpusData.splice(gpusData.indexOf(gpuData), 1);
                                changed = true;
                                break;
                            }
                        }
                    }
                    if(changed) Config.set('gpu-data', gpusData, 'json');
                },
            };

            PrefsUtils.addSwitchRow({ title: _('Monitor'), tabs: 1 }, gpuMonitorValue, gpuSection);
        }

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
            'gpu'
        );
        Utils.getIndicatorsOrder('gpu');
        PrefsUtils.addOrderingRows('gpu-indicators-order', orderSection);

        const iconSection = PrefsUtils.addExpanderRow({ title: _('Icon') }, group, 'gpu');
        PrefsUtils.addSwitchRow({ title: _('Show Icon'), tabs: 1 }, 'gpu-header-icon', iconSection);
        PrefsUtils.addTextInputRow(
            {
                title: _('Icon Name'),
                subtitle:
                    _("Set icon name (ie: 'gpu-symbolic')") +
                    '\n' +
                    _('Set to empty to disable icon override'),
                tabs: 1,
            },
            'gpu-header-icon-custom',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Color'), tabs: 1 },
            'gpu-header-icon-color',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Alert Color'), tabs: 1 },
            'gpu-header-icon-alert-color',
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
            'gpu-header-icon-size',
            iconSection,
            { min: 8, max: 30, digits: 0, step: 1, page: 1 },
            true,
            18
        );
        headerPage.add(group);

        const activityPercentageSection = PrefsUtils.addExpanderRow(
            { title: _('Activity Percentage') },
            group,
            'gpu'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Activity Percentage'), tabs: 1 },
            'gpu-header-activity-percentage',
            activityPercentageSection
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Icon Alert'),
                subtitle: _('Set 0 to disable. Value is percentage of total GPU Activity usage.'),
                tabs: 1,
            },
            'gpu-header-activity-percentage-icon-alert-threshold',
            activityPercentageSection,
            { min: 0, max: 100, digits: 0, step: 1, page: 10 },
            true,
            0
        );

        const activityGraphSection = PrefsUtils.addExpanderRow(
            { title: _('Activity History Graph') },
            group,
            'gpu'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Activity History Graph'), tabs: 1 },
            'gpu-header-activity-graph',
            activityGraphSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Main Color'),
                subtitle: _('<b>Total usage</b> color.'),
                tabs: 1,
            },
            'gpu-header-activity-graph-color1',
            activityGraphSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addSpinRow(
            { title: _('History Graph Width'), tabs: 1 },
            'gpu-header-activity-graph-width',
            activityGraphSection,
            { min: 10, max: 500, digits: 0, step: 1, page: 10 },
            true,
            30
        );

        const activityBarsSection = PrefsUtils.addExpanderRow(
            { title: _('Realtime Activity Bar') },
            group,
            'gpu'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Activity Bar'), tabs: 1 },
            'gpu-header-activity-bar',
            activityBarsSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Bar Color'),
                subtitle: _('GPU bar main color.'),
                tabs: 1,
            },
            'gpu-header-activity-bar-color1',
            activityBarsSection,
            'rgba(29,172,214,1.0)'
        );

        const memoryPercentageSection = PrefsUtils.addExpanderRow(
            { title: _('Memory Percentage') },
            group,
            'gpu'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Memory Percentage'), tabs: 1 },
            'gpu-header-memory-percentage',
            memoryPercentageSection
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Icon Alert'),
                subtitle: _('Set 0 to disable. Value is percentage of total GPU Memory usage.'),
                tabs: 1,
            },
            'gpu-header-memory-percentage-icon-alert-threshold',
            memoryPercentageSection,
            { min: 0, max: 100, digits: 0, step: 1, page: 10 },
            true,
            0
        );

        const memoryGraphSection = PrefsUtils.addExpanderRow(
            { title: _('Memory History Graph') },
            group,
            'gpu'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Memory History Graph'), tabs: 1 },
            'gpu-header-memory-graph',
            memoryGraphSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Main Color'),
                subtitle: _('<b>Total usage</b> color.'),
                tabs: 1,
            },
            'gpu-header-memory-graph-color1',
            memoryGraphSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addSpinRow(
            { title: _('History Graph Width'), tabs: 1 },
            'gpu-header-memory-graph-width',
            memoryGraphSection,
            { min: 10, max: 500, digits: 0, step: 1, page: 10 },
            true,
            30
        );

        const memoryBarsSection = PrefsUtils.addExpanderRow(
            { title: _('Realtime Memory Bar') },
            group,
            'gpu'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show Memory Bar'), tabs: 1 },
            'gpu-header-memory-bar',
            memoryBarsSection
        );
        PrefsUtils.addColorRow(
            {
                title: _('Bar Color'),
                subtitle: _('GPU bar main color.'),
                tabs: 1,
            },
            'gpu-header-memory-bar-color1',
            memoryBarsSection,
            'rgba(29,172,214,1.0)'
        );

        /* Tooltip */
        group = new Adw.PreferencesGroup({ title: _('Tooltip') });
        PrefsUtils.addSwitchRow({ title: _('Show Tooltip'), tabs: 0 }, 'gpu-header-tooltip', group);
        PrefsUtils.addSwitchRow(
            { title: _('Activity Percentage'), tabs: 0 },
            'gpu-header-tooltip-activity-percentage',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('Memory Percentage'), tabs: 0 },
            'gpu-header-tooltip-memory-percentage',
            group
        );
        PrefsUtils.addSwitchRow(
            { title: _('Memory Value'), tabs: 0 },
            'gpu-header-tooltip-memory-value',
            group
        );
        headerPage.add(group);
        return headerPage;
    }

    private getMenuPage() {
        const menuPage = new Adw.PreferencesPage({
            title: _('Menu'),
        });

        const group = new Adw.PreferencesGroup({});
        menuPage.add(group);

        PrefsUtils.addLabelRow(
            {
                title: _('Empty for now'),
            },
            '',
            group
        );

        return menuPage;
    }
}
