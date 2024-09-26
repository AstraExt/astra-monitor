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

import PrefsUtils from './prefsUtils.js';
import Utils from '../utils/utils.js';
import Config from '../config.js';

type AstraMonitorPrefs = import('../../prefs.js').default;

export default class Utility {
    private utility!: Adw.NavigationPage;

    constructor(prefs: AstraMonitorPrefs, window: Gtk.Window) {
        this.setupUtility(prefs, window);
    }

    public get page() {
        return this.utility;
    }

    private setupUtility(_prefs: AstraMonitorPrefs, window: Gtk.Window) {
        this.utility = new Adw.NavigationPage({
            title: _('Utility'),
            tag: 'utility',
        });
        const toolbar = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        header.showTitle = true;
        toolbar.add_top_bar(header);

        const utilityPage = this.getUtilityPage(window);
        toolbar.set_content(utilityPage);
        this.utility.set_child(toolbar);
    }

    private getUtilityPage(window: Gtk.Window) {
        const utilityPage = new Adw.PreferencesPage({
            title: _('Utility'),
            iconName: 'am-settings-symbolic',
        });

        const group = new Adw.PreferencesGroup({ title: _('Utility') });

        PrefsUtils.addButtonRow(
            {
                title: _('Export Settings'),
                subtitle: _('Warning: this will export all profiles.'),
            },
            group,
            () => {
                const dialog = new Gtk.FileChooserDialog({
                    title: _('Export Settings'),
                    action: Gtk.FileChooserAction.SAVE,
                    transientFor: window,
                    modal: true,
                });
                dialog.set_current_name('astra-monitor-settings.json');

                const filter = new Gtk.FileFilter();
                filter.set_name('JSON Files');
                filter.add_mime_type('application/json');
                filter.add_pattern('*.json');
                dialog.add_filter(filter);

                dialog.add_button(_('Save'), Gtk.ResponseType.OK);
                dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
                dialog.show();

                dialog.connect('response', (subject, id) => {
                    if(id === Gtk.ResponseType.OK) {
                        const path = subject.get_file().get_path();
                        const file = Gio.file_new_for_path(path);
                        const stream = file.replace(
                            null,
                            false,
                            Gio.FileCreateFlags.REPLACE_DESTINATION,
                            null
                        );
                        const settings = Config.exportSettings();
                        const data: Uint8Array = new TextEncoder().encode(settings);
                        stream.write_all(data, null);
                        stream.close(null);
                    }
                    subject.destroy();
                });
            }
        );

        PrefsUtils.addButtonRow(
            {
                title: _('Import Settings'),
                subtitle: _('Warning: this will overwrite all profiles.'),
            },
            group,
            () => {
                const dialog = new Gtk.FileChooserDialog({
                    title: _('Import Settings'),
                    action: Gtk.FileChooserAction.OPEN,
                    transientFor: window,
                    modal: true,
                });

                const filter = new Gtk.FileFilter();
                filter.set_name('JSON Files');
                filter.add_mime_type('application/json');
                filter.add_pattern('*.json');
                dialog.add_filter(filter);

                dialog.add_button(_('Open'), Gtk.ResponseType.OK);
                dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
                dialog.show();

                dialog.connect('response', (subject, id) => {
                    if(id === Gtk.ResponseType.OK) {
                        try {
                            const path = subject.get_file().get_path();
                            Utils.readFileAsync(path)
                                .then(data => {
                                    Config.importSettings(data);
                                })
                                .catch(e => {
                                    Utils.error('Error running import settings', e);
                                });
                        } catch(e: any) {
                            Utils.error('Error reading import settings file', e);
                        }
                    }
                    subject.destroy();
                });
            }
        );

        PrefsUtils.addButtonRow(
            {
                title: _('Reset Settings'),
                subtitle: _('Warning: this will reset all profiles.'),
            },
            group,
            () => {
                const dialog = new Gtk.MessageDialog({
                    title: _('Reset Settings'),
                    text: _('Are you sure you want to reset all preferences?'),
                    buttons: Gtk.ButtonsType.YES_NO,
                    messageType: Gtk.MessageType.WARNING,
                    transientFor: window,
                    modal: true,
                });
                dialog.connect('response', (_dialog, response) => {
                    if(response === Gtk.ResponseType.YES) {
                        Config.resetSettings();
                    }
                    dialog.close();
                });
                dialog.show();
            }
        );

        PrefsUtils.addSwitchRow(
            {
                title: _('Debug Mode'),
                subtitle: _(
                    'Warning: may affect performance, use only if you know what you are doing.'
                ),
            },
            'debug-mode',
            group
        );
        utilityPage.add(group);
        return utilityPage;
    }
}
