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

import {
    gettext as _,
    pgettext,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import PrefsUtils from './prefsUtils.js';
import Utils from '../utils/utils.js';

type AstraMonitorPrefs = import('../../prefs.js').default;

export default class Sensors {
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
            title: _('Sensors'),
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
            title: _('Sensors'),
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
            title: _('Sensors'),
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

        const group = new Adw.PreferencesGroup({ title: _('Sensors') });
        PrefsUtils.addSwitchRow({ title: _('Show') }, 'sensors-header-show', group);
        PrefsUtils.addSpinRow(
            { title: _('Update frequency (seconds)') },
            'sensors-update',
            group,
            { min: 1, max: 60, digits: 1, step: 0.5, page: 1 },
            true,
            3.0
        );

        const choicesUnit = [
            { value: 'celsius', text: pgettext('Celsius unit measure choice', 'Celsius') },
            { value: 'fahrenheit', text: pgettext('Fahrenheit unit measure choice', 'Fahrenheit') },
        ];
        PrefsUtils.addComboRow(
            { title: _('Temperature Unit') },
            choicesUnit,
            'sensors-temperature-unit',
            group,
            'string'
        );

        const ignoredSection = PrefsUtils.addExpanderRow(
            { title: _('Ignored Sensors') },
            group,
            'sensors'
        );

        PrefsUtils.addTextInputRow(
            {
                title: _('Ignored Sensors Regex'),
                subtitle: _('Completely ignore sensors matching this regex'),
                tabs: 1,
            },
            'sensors-ignored-regex',
            ignoredSection,
            ''
        );

        PrefsUtils.addTextInputRow(
            {
                title: _('Ignored Sensors Category Regex'),
                subtitle: _('Categories are like "Package", "Core", "Edge", etc.'),
                tabs: 1,
            },
            'sensors-ignored-category-regex',
            ignoredSection,
            ''
        );

        PrefsUtils.addTextInputRow(
            {
                title: _('Ignored Sensors Attribute Regex'),
                subtitle: _('Attributes are like "Alarm", "Min", "Max", "Crit", etc.'),
                tabs: 1,
            },
            'sensors-ignored-attribute-regex',
            ignoredSection,
            ''
        );

        const sourcesSection = PrefsUtils.addExpanderRow(
            { title: _('Data Sources') },
            group,
            'sensors'
        );
        const sensorsSources = [
            { value: 'auto', text: _('Auto') },
            { value: 'hwmon', text: 'Hwmon' },
            { value: 'lm-sensors', text: 'Lm-sensors', disabled: !Utils.hasLmSensors() },
        ];
        PrefsUtils.addComboRow(
            { title: _('Sensors'), tabs: 1 },
            sensorsSources,
            'sensors-source',
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
            'sensors'
        );
        Utils.getIndicatorsOrder('sensors');
        PrefsUtils.addOrderingRows('sensors-indicators-order', orderSection);

        const iconSection = PrefsUtils.addExpanderRow({ title: _('Icon') }, group, 'sensors');
        PrefsUtils.addSwitchRow(
            { title: _('Show Icon'), tabs: 1 },
            'sensors-header-icon',
            iconSection
        );
        PrefsUtils.addTextInputRow(
            {
                title: _('Icon Name'),
                subtitle:
                    _("Set icon name (ie: 'temperature-symbolic')") +
                    '\n' +
                    _('Set to empty to disable icon override'),
                tabs: 1,
            },
            'sensors-header-icon-custom',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Color'), tabs: 1 },
            'sensors-header-icon-color',
            iconSection,
            ''
        );
        PrefsUtils.addColorRow(
            { title: _('Icon Alert Color'), tabs: 1 },
            'sensors-header-icon-alert-color',
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
            'sensors-header-icon-size',
            iconSection,
            { min: 8, max: 30, digits: 0, step: 1, page: 1 },
            true,
            18
        );

        const generateSensorSources = async () => {
            // wait for the hwmon devices to be cached
            await Utils.getCachedHwmonDevicesAsync();

            const sources = Utils.getSensorSources();
            const choicesSource = [{ value: '', text: _('None') }];
            for(const source of sources)
                choicesSource.push({ value: source.value, text: source.text });
            return choicesSource;
        };

        const sensor1Section = PrefsUtils.addExpanderRow(
            { title: _('Sensor 1') },
            group,
            'sensors'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show'), tabs: 1 },
            'sensors-header-sensor1-show',
            sensor1Section
        );
        PrefsUtils.addDropRow(
            {
                title: _('Source'),
                tabs: 1,
                useMarkup: true,
            },
            generateSensorSources,
            'sensors-header-sensor1',
            sensor1Section,
            'json'
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Value Digits'),
                subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
                tabs: 1,
            },
            'sensors-header-sensor1-digits',
            sensor1Section,
            { min: -1, max: 3, digits: 0, step: 1, page: 1 },
            true,
            -1
        );

        const sensor2Section = PrefsUtils.addExpanderRow(
            { title: _('Sensor 2') },
            group,
            'sensors'
        );
        PrefsUtils.addSwitchRow(
            { title: _('Show'), tabs: 1 },
            'sensors-header-sensor2-show',
            sensor2Section
        );

        const layouts = [
            { value: 'vertical', text: _('Vertical') },
            { value: 'horizontal', text: _('Horizontal') },
        ];
        PrefsUtils.addComboRow(
            { title: _('Sensor 2 Layout'), tabs: 1 },
            layouts,
            'sensors-header-sensor2-layout',
            sensor2Section,
            'string',
            'vertical'
        );

        PrefsUtils.addDropRow(
            {
                title: _('Source'),
                tabs: 1,
                useMarkup: true,
            },
            generateSensorSources,
            'sensors-header-sensor2',
            sensor2Section,
            'json'
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Value Digits'),
                subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
                tabs: 1,
            },
            'sensors-header-sensor2-digits',
            sensor2Section,
            { min: -1, max: 3, digits: 0, step: 1, page: 1 },
            true,
            -1
        );
        headerPage.add(group);

        /* Tooltip */
        group = new Adw.PreferencesGroup({ title: _('Tooltip') });
        PrefsUtils.addSwitchRow(
            { title: _('Show Tooltip'), tabs: 0 },
            'sensors-header-tooltip',
            group
        );

        const tooltipSensor1Section = PrefsUtils.addExpanderRow(
            { title: _('Tooltip Sensor 1') },
            group,
            'sensors'
        );
        PrefsUtils.addDropRow(
            {
                title: _('Source'),
                tabs: 1,
                useMarkup: true,
            },
            generateSensorSources,
            'sensors-header-tooltip-sensor1',
            tooltipSensor1Section,
            'json',
            '""'
        );
        PrefsUtils.addTextInputRow(
            {
                title: _('Short Name'),
                subtitle: _('Short name to display in the tooltip.'),
                tabs: 1,
            },
            'sensors-header-tooltip-sensor1-name',
            tooltipSensor1Section,
            ''
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Value Digits'),
                subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
                tabs: 1,
            },
            'sensors-header-tooltip-sensor1-digits',
            tooltipSensor1Section,
            { min: -1, max: 3, digits: 0, step: 1, page: 1 },
            true,
            -1
        );

        const tooltipSensor2Section = PrefsUtils.addExpanderRow(
            { title: _('Tooltip Sensor 2') },
            group,
            'sensors'
        );
        PrefsUtils.addDropRow(
            {
                title: _('Source'),
                tabs: 1,
                useMarkup: true,
            },
            generateSensorSources,
            'sensors-header-tooltip-sensor2',
            tooltipSensor2Section,
            'json',
            '""'
        );
        PrefsUtils.addTextInputRow(
            {
                title: _('Short Name'),
                subtitle: _('Short name to display in the tooltip.'),
                tabs: 1,
            },
            'sensors-header-tooltip-sensor2-name',
            tooltipSensor2Section,
            ''
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Value Digits'),
                subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
                tabs: 1,
            },
            'sensors-header-tooltip-sensor2-digits',
            tooltipSensor2Section,
            { min: -1, max: 3, digits: 0, step: 1, page: 1 },
            true,
            -1
        );

        const tooltipSensor3Section = PrefsUtils.addExpanderRow(
            { title: _('Tooltip Sensor 3') },
            group,
            'sensors'
        );
        PrefsUtils.addDropRow(
            {
                title: _('Source'),
                tabs: 1,
                useMarkup: true,
            },
            generateSensorSources,
            'sensors-header-tooltip-sensor3',
            tooltipSensor3Section,
            'json',
            '""'
        );
        PrefsUtils.addTextInputRow(
            {
                title: _('Short Name'),
                subtitle: _('Short name to display in the tooltip.'),
                tabs: 1,
            },
            'sensors-header-tooltip-sensor3-name',
            tooltipSensor3Section,
            ''
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Value Digits'),
                subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
                tabs: 1,
            },
            'sensors-header-tooltip-sensor3-digits',
            tooltipSensor3Section,
            { min: -1, max: 3, digits: 0, step: 1, page: 1 },
            true,
            -1
        );

        const tooltipSensor4Section = PrefsUtils.addExpanderRow(
            { title: _('Tooltip Sensor 4') },
            group,
            'sensors'
        );
        PrefsUtils.addDropRow(
            {
                title: _('Source'),
                tabs: 1,
                useMarkup: true,
            },
            generateSensorSources,
            'sensors-header-tooltip-sensor4',
            tooltipSensor4Section,
            'json',
            '""'
        );
        PrefsUtils.addTextInputRow(
            {
                title: _('Short Name'),
                subtitle: _('Short name to display in the tooltip.'),
                tabs: 1,
            },
            'sensors-header-tooltip-sensor4-name',
            tooltipSensor4Section,
            ''
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Value Digits'),
                subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
                tabs: 1,
            },
            'sensors-header-tooltip-sensor4-digits',
            tooltipSensor4Section,
            { min: -1, max: 3, digits: 0, step: 1, page: 1 },
            true,
            -1
        );

        const tooltipSensor5Section = PrefsUtils.addExpanderRow(
            { title: _('Tooltip Sensor 5') },
            group,
            'sensors'
        );
        PrefsUtils.addDropRow(
            {
                title: _('Source'),
                tabs: 1,
                useMarkup: true,
            },
            generateSensorSources,
            'sensors-header-tooltip-sensor5',
            tooltipSensor5Section,
            'json',
            '""'
        );
        PrefsUtils.addTextInputRow(
            {
                title: _('Short Name'),
                subtitle: _('Short name to display in the tooltip.'),
                tabs: 1,
            },
            'sensors-header-tooltip-sensor5-name',
            tooltipSensor5Section,
            ''
        );
        PrefsUtils.addSpinRow(
            {
                title: _('Value Digits'),
                subtitle: _('Set -1 to auto. Number of digits after the decimal point.'),
                tabs: 1,
            },
            'sensors-header-tooltip-sensor5-digits',
            tooltipSensor5Section,
            { min: -1, max: 3, digits: 0, step: 1, page: 1 },
            true,
            -1
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
