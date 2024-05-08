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
import Gio from 'gi://Gio';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import PrefsUtils, { Choice } from './prefsUtils.js';
import Utils from '../utils/utils.js';
import Config from '../config.js';

type AstraMonitorPrefs = import('../../prefs.js').default;

export default class Profiles {
    private profiles!: Adw.NavigationPage;

    constructor(prefs: AstraMonitorPrefs) {
        this.setupProfiles(prefs);
    }

    public get page() {
        return this.profiles;
    }

    private setupProfiles(_prefs: AstraMonitorPrefs) {
        this.profiles = new Adw.NavigationPage({
            title: _('Profiles'),
            tag: 'profiles',
        });
        const toolbar = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        header.showTitle = true;
        toolbar.add_top_bar(header);

        const profilesPage = this.getProfilesPage();
        toolbar.set_content(profilesPage);
        this.profiles.set_child(toolbar);
    }

    private getProfilesPage() {
        const profilesPage = new Adw.PreferencesPage({
            title: _('Profiles'),
            iconName: 'am-settings-symbolic',
        });

        const group = new Adw.PreferencesGroup({});

        const getProfiles = async () => {
            const profiles: Choice[] = [];
            const profilesData = Config.get_json('profiles');
            for(const profile in profilesData) {
                profiles.push({ value: profile, text: profile });
            }
            return profiles;
        };

        const profilesSelector = PrefsUtils.addDropRow(
            {
                title: _('Current profile'),
            },
            getProfiles,
            'current-profile',
            group,
            'string'
        );

        let profilesCache: string[];
        let currentCache: string;
        const updateProfilesCache = () => {
            const profiles = Config.get_json('profiles') || {};
            profilesCache = Object.keys(profiles);
        };
        updateProfilesCache();

        const updateCurrentCache = () => {
            currentCache = Config.get_string('current-profile') || 'default';
        };
        updateCurrentCache();

        const refreshProfiles = () => {
            const profiles = Config.get_json('profiles') || {};
            if(JSON.stringify(profilesCache) !== JSON.stringify(Object.keys(profiles))) {
                updateProfilesCache();
                profilesSelector.update();
            }

            const current = Config.get_string('current-profile') || 'default';
            if(currentCache !== current) {
                updateCurrentCache();
                Utils.lowPriorityTask(Config.syncCurrentProfile);
            }
        };

        Config.connect(this, 'changed::profiles', refreshProfiles.bind(this));
        Config.connect(this, 'changed::current-profile', refreshProfiles.bind(this));

        this.addRenameProfile(group);
        this.addResetProfile(group);
        this.addCloneProfile(group);
        this.addDeleteProfile(group);

        profilesPage.add(group);
        return profilesPage;
    }

    private addRenameProfile(group: Adw.PreferencesGroup) {
        const renameProfile = new Adw.ActionRow({
            title: _('Rename profile'),
        });

        const entry = new Gtk.Entry({
            text: Config.get_string('current-profile') || 'default',
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            maxLength: 30,
        });
        Config.bind('current-profile', entry, 'text', Gio.SettingsBindFlags.GET);

        renameProfile.add_suffix(entry);
        renameProfile.activatableWidget = entry;

        const button = new Gtk.Button({
            label: _('Apply'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            marginStart: 15,
        });
        renameProfile.add_suffix(button);

        button.connect('clicked', () => {
            const profiles = Config.get_json('profiles') || {};
            const currentProfile = Config.get_string('current-profile') || 'default';
            const newProfile = entry.text;

            if(!newProfile || newProfile === currentProfile || !profiles[currentProfile]) return;

            profiles[newProfile] = profiles[currentProfile];
            delete profiles[currentProfile];

            Config.delay();
            Config.set('current-profile', newProfile, 'string');
            Config.set('profiles', profiles, 'json');
            Config.apply();
        });

        group.add(renameProfile);
    }

    private addResetProfile(group: Adw.PreferencesGroup) {
        const resetProfile = new Adw.ActionRow({
            title: _('Reset profile'),
            subtitle: _('Warning: this will reset the current profile to default settings.'),
        });

        const button = new Gtk.Button({
            label: _('Reset'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        resetProfile.add_suffix(button);

        button.connect('clicked', Config.resetProfile);

        group.add(resetProfile);
    }

    private addCloneProfile(group: Adw.PreferencesGroup) {
        const cloneProfile = new Adw.ActionRow({
            title: _('Clone profile'),
            subtitle: _('Create a copy of the current profile.'),
        });

        const button = new Gtk.Button({
            label: _('Clone'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        cloneProfile.add_suffix(button);

        button.connect('clicked', () => {
            const profiles = Config.get_json('profiles') || {};
            const currentProfile = Config.get_string('current-profile') || 'default';

            let newProfile = currentProfile + ' (copy)';
            let num = 1;
            while(profiles[newProfile]) {
                newProfile = currentProfile + ` (copy${num++})`;
            }

            if(!newProfile || !profiles[currentProfile]) return;
            profiles[newProfile] = profiles[currentProfile];

            Config.delay();
            Config.set('profiles', profiles, 'json');
            Config.set('current-profile', newProfile, 'string');
            Config.apply();
        });

        group.add(cloneProfile);
    }

    private addDeleteProfile(group: Adw.PreferencesGroup) {
        const deleteProfile = new Adw.ActionRow({
            title: _('Delete profile'),
            subtitle: _('Warning: this operation is irreversible.'),
        });

        const button = new Gtk.Button({
            label: _('Delete'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        deleteProfile.add_suffix(button);

        button.connect('clicked', () => {
            const profiles = Config.get_json('profiles') || {};
            let currentProfile = Config.get_string('current-profile') || 'default';

            // Check if this is the only profile
            if(Object.keys(profiles).length === 1) {
                return;
            }

            if(!profiles[currentProfile]) return;
            delete profiles[currentProfile];

            currentProfile = Object.keys(profiles)[0];

            Config.delay();
            Config.set('profiles', profiles, 'json');
            Config.set('current-profile', currentProfile, 'string');
            Config.apply();
        });

        group.add(deleteProfile);
    }
}
