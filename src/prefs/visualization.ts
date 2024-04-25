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
import Gdk from 'gi://Gdk';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import PrefsUtils from './prefsUtils.js';
import Utils from '../utils/utils.js';
import Config from '../config.js';

type AstraMonitorPrefs = import('../../prefs.js').default;

// eslint-disable-next-line no-shadow
enum ColorCategory {
    MAIN,
    SECONDARY,
}

export default class Visualization {
    private visualization!: Adw.NavigationPage;

    constructor(prefs: AstraMonitorPrefs) {
        this.setupVisualization(prefs);
    }

    public get page() {
        return this.visualization;
    }

    private setupVisualization(_prefs: AstraMonitorPrefs) {
        this.visualization = new Adw.NavigationPage({
            title: _('Visualization'),
            tag: 'general',
        });
        const toolbar = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        header.showTitle = true;
        toolbar.add_top_bar(header);

        const visualizationPage = this.getVisualizationPage();
        toolbar.set_content(visualizationPage);
        this.visualization.set_child(toolbar);
    }

    private getVisualizationPage() {
        const visualizationPage = new Adw.PreferencesPage({
            title: _('Visualization'),
            iconName: 'am-settings-symbolic',
        });

        let group = new Adw.PreferencesGroup({ title: _('Visualization') });

        const themeSection = PrefsUtils.addExpanderRow(
            { title: _('Theme') },
            group,
            'visualization'
        );
        let choicesPanel = [
            { value: 'dark', text: _('Dark') },
            { value: 'light', text: _('Light') },
        ];
        PrefsUtils.addComboRow(
            {
                title: _('Shell TOPBAR Theme Style'),
                subtitle: _(
                    'Set to "Dark" or "Light" based on your shell TOPBAR theme to improve readability.'
                ),
                tabs: 1,
            },
            choicesPanel,
            'theme-style',
            themeSection,
            'string',
            'dark'
        );

        choicesPanel = [
            { value: 'top', text: _('Top') },
            { value: 'bottom', text: _('Bottom') },
            { value: 'left', text: _('Left') },
            { value: 'right', text: _('Right') },
        ];
        PrefsUtils.addComboRow(
            {
                title: _('Shell TOPBAR/DASH/PANEL Position'),
                subtitle:
                    _(
                        'Set this if you moved your shell to another position to improve the layout.'
                    ) +
                    '\n' +
                    _('Disable/Enable the extension to apply changes.'),
                tabs: 1,
            },
            choicesPanel,
            'shell-bar-position',
            themeSection,
            'string',
            'top'
        );

        PrefsUtils.addColorRow(
            {
                title: _('Main Color'),
                subtitle:
                    _('This is an utility rather than a setting.') +
                    '\n' +
                    _('Changing this will just replace all main colors.'),
                icon_name: 'am-dialog-warning-symbolic',
                tabs: 1,
            },
            (color: string) => {
                if(color) this.setAllColors(color, ColorCategory.MAIN);
            },
            themeSection,
            'rgba(29,172,214,1.0)'
        );
        PrefsUtils.addColorRow(
            {
                title: _('Secondary Color'),
                subtitle:
                    _('This is an utility rather than a setting.') +
                    '\n' +
                    _('Changing this will just replace all secondary colors.'),
                icon_name: 'am-dialog-warning-symbolic',
                tabs: 1,
            },
            (color: string) => {
                if(color) this.setAllColors(color, ColorCategory.SECONDARY);
            },
            themeSection,
            'rgba(214,29,29,1.0)'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show 0 instead of -'), tabs: 1 },
            'explicit-zero',
            themeSection
        );

        const panelSection = PrefsUtils.addExpanderRow(
            { title: _('Panel Box') },
            group,
            'visualization'
        );
        choicesPanel = [
            { value: 'left', text: _('Left') },
            { value: 'center', text: _('Center') },
            { value: 'right', text: _('Right') },
        ];
        PrefsUtils.addComboRow(
            { title: _('Position'), tabs: 1 },
            choicesPanel,
            'panel-box',
            panelSection,
            'string'
        );
        PrefsUtils.addSpinRow(
            { title: _('Order'), tabs: 1 },
            'panel-box-order',
            panelSection,
            { min: -10, max: 10, digits: 0, step: 1, page: 1 },
            true
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Left Margin'),
                subtitle: _('Experimental feature: may not function properly.'),
                icon_name: 'am-dialog-warning-symbolic',
                tabs: 1,
            },
            'panel-margin-left',
            panelSection,
            { min: 0, max: 1000, digits: 0, step: 1, page: 10 },
            true,
            0
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Right Margin'),
                subtitle: _('Experimental feature: may not function properly.'),
                icon_name: 'am-dialog-warning-symbolic',
                tabs: 1,
            },
            'panel-margin-right',
            panelSection,
            { min: 0, max: 1000, digits: 0, step: 1, page: 10 },
            true,
            0
        );

        const headersSection = PrefsUtils.addExpanderRow(
            { title: _('Headers') },
            group,
            'visualization'
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Startup Delay (seconds)'),
                subtitle: _('Increase if the extension is not properly formatted on startup.'),
                icon_name: 'am-dialog-warning-symbolic',
                tabs: 1,
            },
            'startup-delay',
            headersSection,
            { min: 1, max: 10, digits: 1, step: 0.5, page: 1 },
            true,
            2
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Headers Height'),
                subtitle:
                    _('Experimental feature: may require to disable/enable the extension.') +
                    '\n' +
                    _('Set between 15 and 80 to enable height override'),
                icon_name: 'am-dialog-warning-symbolic',
                tabs: 1,
            },
            'headers-height-override',
            headersSection,
            { min: 0, max: 80, digits: 0, step: 1, page: 5 },
            true,
            0
        );
        PrefsUtils.addFontRow(
            {
                title: _('Headers Font'),
                subtitle:
                    _('Experimental feature: may require to disable/enable the extension.') +
                    '\n' +
                    _('Set to empty to disable font override'),
                icon_name: 'am-dialog-warning-symbolic',
                tabs: 1,
            },
            'headers-font-family',
            headersSection,
            ''
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Headers Font Size'),
                subtitle:
                    _('Experimental feature: may require to disable/enable the extension.') +
                    '\n' +
                    _('Set to 0 to disable size override'),
                icon_name: 'am-dialog-warning-symbolic',
                tabs: 1,
            },
            'headers-font-size',
            headersSection,
            { min: 0, max: 30, digits: 0, step: 1, page: 2 },
            true,
            0
        );

        const compactModeSection = PrefsUtils.addExpanderRow(
            { title: _('Compact Mode') },
            group,
            'visualization'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Enable Compact Mode'), tabs: 1 },
            'compact-mode',
            compactModeSection
        );

        choicesPanel = [
            { value: 'both', text: _('Click & Hover') },
            { value: 'click', text: _('Click') },
            { value: 'hover', text: _('Hover') },
        ];
        PrefsUtils.addComboRow(
            {
                title: _('Compact Mode Activation'),
                subtitle: _('Hover will not work for Panel Box Position "Center".'),
                tabs: 1,
            },
            choicesPanel,
            'compact-mode-activation',
            compactModeSection,
            'string'
        );

        PrefsUtils.addSwitchRow(
            { title: _('Start Expanded'), tabs: 1 },
            'compact-mode-start-expanded',
            compactModeSection
        );

        visualizationPage.add(group);

        group = new Adw.PreferencesGroup({ title: _('Monitor Ordering') });
        Utils.getMonitorsOrder();
        PrefsUtils.addOrderingRows('monitors-order', group, -1);
        visualizationPage.add(group);
        return visualizationPage;
    }

    private setAllColors(color: string, category: ColorCategory) {
        if(category === ColorCategory.MAIN) {
            const mainColors = [
                'processor-header-graph-color1',
                'processor-header-bars-color1',
                'gpu-header-activity-bar-color1',
                'gpu-header-activity-graph-color1',
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
                'network-menu-arrow-color1',
            ];

            for(const colorPref of mainColors) Config.set(colorPref, color, 'string');

            // Memory secondary colors are the same as main colors with 0.3 alpha
            const colorParsed = new Gdk.RGBA();
            colorParsed.parse(color);
            colorParsed.alpha = 0.3;
            Config.set('memory-header-graph-color2', colorParsed.to_string(), 'string');
            Config.set('memory-header-bars-color2', colorParsed.to_string(), 'string');
        } else if(category === ColorCategory.SECONDARY) {
            const secondaryColors = [
                'processor-header-graph-color2',
                'processor-header-bars-color2',
                'storage-header-io-bars-color2',
                'storage-header-io-graph-color2',
                'storage-menu-arrow-color2',
                'network-header-io-bars-color2',
                'network-header-io-graph-color2',
                'network-menu-arrow-color2',
            ];

            for(const colorPref of secondaryColors) Config.set(colorPref, color, 'string');
        }
    }
}
