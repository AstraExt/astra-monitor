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

type AstraMonitorPrefs = import('../../prefs.js').default;

export default class About {
    private about!: Adw.NavigationPage;

    constructor(prefs: AstraMonitorPrefs) {
        this.setupAbout(prefs);
    }

    public get page() {
        return this.about;
    }

    private setupAbout(prefs: AstraMonitorPrefs) {
        this.about = new Adw.NavigationPage({
            title: _('About'),
            tag: 'about',
        });
        const toolbar = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        header.showTitle = true;
        toolbar.add_top_bar(header);

        const aboutPage = this.getAboutPage(prefs);
        toolbar.set_content(aboutPage);
        this.about.set_child(toolbar);
    }

    private getAboutPage(prefs: AstraMonitorPrefs) {
        const aboutPage = new Adw.PreferencesPage({
            title: _('About'),
            iconName: 'am-settings-symbolic',
        });

        const group = new Adw.PreferencesGroup({ title: _('Info') });

        let version;

        const metadata = prefs.metadata;
        if(metadata['version-name'] === metadata['version']) version = 'v' + metadata['version'];
        else if(metadata['version-name'])
            version = metadata['version-name'] + ' (EGOv' + metadata['version'] + ')';
        else version = 'EGOv' + metadata['version'];

        PrefsUtils.addLabelRow({ title: _('Version') }, version, group);
        PrefsUtils.addLinkRow(
            { title: _('GitHub') },
            'https://github.com/AstraExt/astra-monitor',
            group
        );
        PrefsUtils.addLinkRow(
            { title: _('Changelog') },
            'https://github.com/AstraExt/astra-monitor/blob/main/RELEASES.md',
            group
        );
        PrefsUtils.addLinkRow(
            { title: _('Roadmap') },
            'https://github.com/AstraExt/astra-monitor/blob/main/ROADMAP.md',
            group
        );
        PrefsUtils.addLinkRow(
            { title: _('Report a bug or suggest new feature') },
            'https://github.com/AstraExt/astra-monitor/issues/new/choose',
            group
        );
        PrefsUtils.addLinkRow(
            { title: _('GNOME Extensions page') },
            'https://extensions.gnome.org/extension/6682/astra-monitor/',
            group
        );

        aboutPage.add(group);
        return aboutPage;
    }
}
