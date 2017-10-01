"use strict";

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext.domain("org.gnome.shell.extensions.gsconnect");
const _ = Gettext.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const GSettingsWidget = Me.imports.widgets.gsettings;
const KeybindingsWidget = Me.imports.widgets.keybindings;
const PluginsWidget = Me.imports.widgets.plugins;
const Client = Me.imports.client;
const Common = imports.common;


/** A composite widget resembling A Gnome Control Center panel. */
var PrefsPage = new Lang.Class({
    Name: "PrefsPage",
    Extends: Gtk.ScrolledWindow,
    
    _init: function (params={}) {
        params = Object.assign({
            height_request: 400,
            can_focus: true,
            visible: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER
        }, params);
        this.parent(params);
        
        this.box = new Gtk.Box({
            visible: true,
            can_focus: false,
            margin_left: 80,
            margin_right: 80,
            margin_top: 18,
            margin_bottom: 18,
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 18
        });
        this.add(this.box);
    },
    
    /**
     * Add and return a new section widget. If @title is given, a bold title
     * will be placed above the section.
     *
     * @param {String} title - Optional bold label placed above the section
     * @return {Gtk.Frame} section - The new Section object.
     */
    add_section: function (title) {
        if (title) {
            let label = new Gtk.Label({
                visible: true,
                can_focus: false,
                margin_start: 3,
                xalign: 0,
                use_markup: true,
                label: "<b>" + title + "</b>"
            });
            this.box.pack_start(label, false, true, 0);
        }
        
        let section = new Gtk.Frame({
            visible: true,
            can_focus: false,
            margin_bottom: 12,
            hexpand: true,
            label_xalign: 0,
            shadow_type: Gtk.ShadowType.IN
        });
        this.box.add(section);
        
        section.list = new Gtk.ListBox({
            visible: true,
            can_focus: false,
            hexpand: true,
            selection_mode: Gtk.SelectionMode.NONE,
            activate_on_single_click: false
        });
        section.add(section.list);
        
        return section;
    },
    
    /**
     * Add and return new row with a Gtk.Grid child
     *
     * @param {Gtk.Frame} section - The section widget to attach to
     * @return {Gtk.ListBoxRow} row - The new row
     */
    addRow: function (section) {
        // Row
        let row = new Gtk.ListBoxRow({
            visible: true,
            can_focus: true,
            activatable: false,
            selectable: false
        });
        section.list.add(row);
        
        // Row Layout
        row.grid = new Gtk.Grid({
            visible: true,
            can_focus: false,
            column_spacing: 16,
            row_spacing: 0,
            margin_left: 12,
            margin_top: 6,
            margin_bottom: 6,
            margin_right: 12
        });
        row.add(row.grid);
        
        return row;
    },
    
    /**
     * Add a new row to @section and return the row. @summary will be placed on
     * top of @description (dimmed) on the left, @widget to the right of them. 
     *
     * @param {Gtk.Frame} section - The section widget to attach to
     * @param {String} summary - A short summary for the item
     * @param {String} description - A short description for the item
     * @return {Gtk.ListBoxRow} row - The new row
     */
    addItem: function (section, summary, description, widget) {
        let row = this.addRow(section);
        
        // Setting Summary
        let summaryLabel = new Gtk.Label({
            visible: true,
            can_focus: false,
            xalign: 0,
            hexpand: true,
            label: summary
        });
        row.grid.attach(summaryLabel, 0, 0, 1, 1);
        
        // Setting Description
        if (description !== undefined) {
            let descriptionLabel = new Gtk.Label({
                visible: true,
                can_focus: false,
                xalign: 0,
                hexpand: true,
                label: description,
                wrap: true
            });
            descriptionLabel.get_style_context().add_class("dim-label");
            row.grid.attach(descriptionLabel, 0, 1, 1, 1);
        }
        
        let widgetHeight = (description !== null) ? 2 : 1;
        row.grid.attach(widget, 1, 0, 1, widgetHeight);
        
        return row;
    },
    
    /**
     * Add a new row to @section, populated from the Schema for @setting. An
     * Gtk.Widget will be chosen for @setting based on it's type, unless
     * @widget is given which will have @setting passed to it's constructor.
     *
     * @param {Gtk.Frame} section - The section widget to attach to
     * @param {String} keyName - The GSettings key name
     * @param {Gtk.Widget} widget - An override widget
     * @return {Gtk.ListBoxRow} row - The new row
     */
    addSetting: function (section, keyName, widget) {
        let key = Common.Settings.settings_schema.get_key(keyName);
        let range = key.get_range().deep_unpack()[0];
        let type = key.get_value_type().dup_string();
        type = (range !== "type") ? range : type;
        
        if (widget !== undefined) {
            widget = new widget(Common.Settings, keyName);
        } else if (type === "b") {
            widget = new GSettingsWidget.BoolSetting(Common.Settings, keyName);
        } else if (type === "enum") {
            widget = new GSettingsWidget.EnumSetting(Common.Settings, keyName);
        } else if (type === "flags") {
            widget = new GSettingsWidget.FlagsSetting(Common.Settings, keyName);
        } else if (type === "mb") {
            widget = new GSettingsWidget.MaybeSetting(Common.Settings, keyName);
        } else if (type.length === 1 && "ynqiuxthd".indexOf(type) > -1) {
            widget = new GSettingsWidget.NumberSetting(Common.Settings, keyName, type);
        } else if (type === "range") {
            widget = new GSettingsWidget.RangeSetting(Common.Settings, keyName);
        } else if (type.length === 1 && "sog".indexOf(type) > -1) {
            widget = new GSettingsWidget.StringSetting(Common.Settings, keyName);
        } else {
            widget = new GSettingsWidget.OtherSetting(Common.Settings, keyName);
        }
        
        return this.addItem(
            section,
            key.get_summary(),
            key.get_description(),
            widget
        );
    }
});


/**
 * Plugin stuff FIXME: move to discrete file?
 */
var DevicesStack = new Lang.Class({
    Name: "DevicesStack",
    Extends: Gtk.Grid,
    
    _init: function () {
        this.parent({
            halign: Gtk.Align.FILL,
            valign: Gtk.Align.FILL,
            hexpand: true,
            vexpand: true
        });
        
        this.devices = new Map();
        
        this.stack = new Gtk.Stack({
            transition_type: Gtk.StackTransitionType.SLIDE_UP_DOWN,
            halign: Gtk.Align.FILL,
            valign: Gtk.Align.FILL,
            hexpand: true,
            vexpand: true
        });
        
        this.sidebar = new Gtk.ListBox();
        
        let sidebarScrolledWindow = new Gtk.ScrolledWindow({
            can_focus: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER
        });
        sidebarScrolledWindow.add(this.sidebar);
        
        this.attach(sidebarScrolledWindow, 0, 0, 1, 1);
        this.attach(this.stack, 1, 0, 1, 1);
        
        // Default Page
        let page = new Gtk.Box({
            visible: true,
            can_focus: true,
            margin_left: 12,
            margin_top: 12,
            margin_bottom: 12,
            margin_right: 12,
            spacing: 12,
            valign: Gtk.Align.CENTER,
            orientation: Gtk.Orientation.VERTICAL
        });
        
        let label1 = new Gtk.Label({
            label: _("Ensure that devices are connected on the same local network with ports 1714 to 1764 open. If you wish to connect an Android device, install the KDE Connect Android app <a href=\"https://play.google.com/store/apps/details?id=org.kde.kdeconnect_tp\">Google Play Store</a> or <a href=\"https://f-droid.org/repository/browse/?fdid=org.kde.kdeconnect_tp\">F-Droid</a>."),
            wrap: true,
            use_markup: true,
            vexpand: true,
            xalign: 0
        });
        page.add(label1);
        //https://community.kde.org/KDEConnect
        let label2 = new Gtk.Label({
            label: _("If you are having trouble with this extension, please see the <a href=\"https://github.com/andyholmes/gnome-shell-extension-gsconnect/wiki\">Wiki</a> for help or <a href =\"https://github.com/andyholmes/gnome-shell-extension-gsconnect/issues\">open an issue</a> on Github to report a problem."),
            wrap: true,
            use_markup: true,
            vexpand: true,
            xalign: 0
        });
        page.add(label2);
        
        this.stack.add_titled(page, "default", "Default");
        
        this.sidebar.connect("row-selected", (listbox, row) => {
            if (row === null) {
                this.stack.set_visible_child_name("default");
            } else {
                this.stack.set_visible_child_name(row.device.id);
            }
        });
    },
    
    addDevice: function (manager, dbusPath) {
        let device = manager.devices.get(dbusPath);
        
        // Device Sidebar Entry
        let row = new Gtk.ListBoxRow({
            visible: true,
            can_focus: true
        });
        row.device = device;
        
        row.grid = new Gtk.Grid({
            visible: true,
            can_focus: false,
            column_spacing: 16,
            row_spacing: 0,
            margin_left: 12,
            margin_top: 6,
            margin_bottom: 6,
            margin_right: 12
        });
        row.add(row.grid);
        
        let icon = Gtk.Image.new_from_icon_name(device.type, Gtk.IconSize.LARGE_TOOLBAR);
        row.grid.attach(icon, 0, 0, 1, 2);
        let nameLabel = new Gtk.Label({ label: device.name });
        row.grid.attach(nameLabel, 1, 0, 1, 1);
        let statusLabel = new Gtk.Label({ label: device.type });
        row.grid.attach(statusLabel, 1, 1, 1, 1);
        statusLabel.get_style_context().add_class("dim-label");
        this.sidebar.add(row);
        
        row.show_all();
        
        // Device Page
        let page = new DevicePage(device);
        this.stack.add_titled(page, device.id, device.name);
        
        // Tracking
        this.devices.set(dbusPath, [row, page]);
    },
    
    removeDevice: function (manager, dbusPath) {
        let device = this.devices.get(dbusPath);
        
        this.sidebar.remove(device[0]);
        device[0].destroy();
        
        this.stack.remove(device[1]);
        device[1].destroy();
        
        this.devices.delete(dbusPath);
    }
});


var DevicePage = new Lang.Class({
    Name: "DevicePage",
    Extends: PrefsPage,
    
    _init: function (device, params={}) {
        this.parent(params);
        this.box.margin_left = 40;
        this.box.margin_right = 40;
        
        this.device = device;
        this.config = Common.readDeviceConfiguration(device.id);
        
        // Status Section FIXME
        let statusSection = this.add_section();
        let statusRow = this.addRow(statusSection);
        
        let deviceIcon = Gtk.Image.new_from_icon_name(
            device.type,
            Gtk.IconSize.DIALOG
        );
        deviceIcon.xalign = 0;
        statusRow.grid.attach(deviceIcon, 0, 0, 1, 2);
        
        let deviceName = new Gtk.Label({ label: device.name, xalign: 0 });
        statusRow.grid.attach(deviceName, 1, 0, 1, 1);
        let deviceType = new Gtk.Label({ label: device.type, xalign: 0 });
        statusRow.grid.attach(deviceType, 1, 1, 1, 1);
        
        let deviceControls = new Gtk.ButtonBox({
            halign: Gtk.Align.END,
            hexpand: true,
            spacing: 12
        });
        statusRow.grid.attach(deviceControls, 2, 0, 1, 2);
        
        let pairButton = new Gtk.Button({ label: "" });
        pairButton.connect("clicked", () => {
            if (this.device.paired) {
                this.device.unpair();
            } else {
                this.device.pair();
            }
        });
        this.device.connect("notify::paired", () => {
            if (this.device.paired) {
                pairButton.label = _("Unpair");
            } else {
                pairButton.label = _("Pair");
            }
        });
        this.device.notify("paired");
        deviceControls.add(pairButton);
        
        // Plugins Section
        let pluginsSection = this.add_section(_("Plugins"));
        
        for (let [pluginName, pluginInfo] of PluginsWidget.PluginMetadata.entries()) {
            let pluginWidget = new PluginsWidget.PluginSetting(this, pluginName);
            
            this.addItem(
                pluginsSection,
                pluginInfo.summary,
                pluginInfo.description,
                pluginWidget
            );
        }
        
        // Keybinding Section
        let keySection = this.add_section(_("Keyboard Shortcuts"));
        let keyRow = this.addRow(keySection);
        let keyView = new KeybindingsWidget.TreeView();
        keyView.addAccel("menu", _("Open Device Menu"), 0, 0);
        keyView.addAccel("sms", _("Open SMS Window"), 0, 0);
        keyView.addAccel("find", _("Locate Device"), 0, 0);
        keyView.addAccel("browse", _("Browse Device"), 0, 0);
        keyView.addAccel("share", _("Share File/URL"), 0, 0);
        
        let deviceAccels = JSON.parse(
            Common.Settings.get_string("device-keybindings")
        );
        
        if (!deviceAccels.hasOwnProperty(this.device.id)) {
            deviceAccels[this.device.id] = {};
            Common.Settings.set_string(
                "device-keybindings",
                JSON.stringify(deviceAccels)
            );
        }
        
        keyView.setAccels(deviceAccels[this.device.id]);
        keyView.setCallback((profile) => {
            deviceAccels[this.device.id] = profile;
            Common.Settings.set_string(
                "device-keybindings",
                JSON.stringify(deviceAccels)
            );
        });
        keyRow.grid.attach(keyView, 0, 0, 1, 1);
        
        this.show_all();
    },
    
    _refresh: function () {
        this.config = Common.readDeviceConfiguration(this.device.id);
    }
});


/** A GtkStack subclass with a pre-attached GtkStackSwitcher */
var PrefsWidget = new Lang.Class({
    Name: "PrefsWidget",
    Extends: Gtk.Stack,
    
    _init: function (params={}) {
        params = Object.assign({
            transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT
        }, params);
        
        this.parent(params);
        this.manager = false;
        
        this.switcher = new Gtk.StackSwitcher({
            halign: Gtk.Align.CENTER,
            stack: this
        });
        this.switcher.show_all();
        
        // Watch for Service Provider
        this.manager = new Client.DeviceManager();
        
        this._build();
        
        this._watchdog = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            Client.BUS_NAME,
            Gio.BusNameWatcherFlags.NONE,
            Lang.bind(this, this._serviceAppeared),
            Lang.bind(this, this._serviceVanished)
        );
    },
    
    // The DBus interface has appeared
    _serviceAppeared: function (conn, name, name_owner, cb_data) {
        Common.debug("extension.SystemIndicator._serviceAppeared()");
        
        if (!this.manager) {
            this.manager = new Client.DeviceManager();
        }
        
        for (let dbusPath of this.manager.devices.keys()) {
            this.devicesStack.addDevice(this.manager, dbusPath);
        }
        
        // Watch for new and removed devices
        this.manager.connect(
            "device::added",
            Lang.bind(this.devicesStack, this.devicesStack.addDevice)
        );
        
        this.manager.connect(
            "device::removed",
            Lang.bind(this.devicesStack, this.devicesStack.removeDevice)
        );
        
        this.manager.bind_property(
            "name",
            this.nameEntry,
            "placeholder_text",
            GObject.BindingFlags.DEFAULT
        );
    },
    
    // The DBus interface has vanished
    _serviceVanished: function (conn, name, name_owner, cb_data) {
        Common.debug("extension.SystemIndicator._serviceVanished()");
        
        if (this.manager) {
            this.manager.destroy();
            this.manager = false;
        }
        
        if (!Settings.get_boolean("debug")) {
            this.manager = new Client.DeviceManager();
        }
    },
    
    addPage: function (id, title) {
        let page = new PrefsPage();
        this.add_titled(page, id, title);
        return page;
    },
    
    removePage: function (id) {
        let page = this.get_child_by_name(id);
        this.remove(page);
        page.destroy();
    },
    
    _build: function () {
        // General Page
        let generalPage = this.addPage("general", _("General"));
        
        // Appearance
        let appearanceSection = generalPage.add_section(_("Appearance"));
        generalPage.addSetting(appearanceSection, "device-indicators");
        generalPage.addSetting(appearanceSection, "device-visibility");
        
        // Files
        let filesSection = generalPage.add_section(_("Files"));
        generalPage.addSetting(filesSection, "nautilus-integration");
        
        // Keyboard Shortcuts
        let keySection = generalPage.add_section(_("Keyboard Shortcuts"));
        let keyRow = generalPage.addRow(keySection);
        let keyView = new KeybindingsWidget.TreeView();
        keyView.addAccel("menu", _("Open Extension Menu"), 0, 0);
        keyView.addAccel("discover", _("Discover Devices"), 0, 0);
        keyView.addAccel("settings", _("Open Extension Settings"), 0, 0);
        keyView.setAccels(
            JSON.parse(
                Common.Settings.get_string("extension-keybindings")
            )
        );
        keyView.setCallback((profile) => {
            Common.Settings.set_string(
                "extension-keybindings",
                JSON.stringify(profile)
            );
        });
        keyRow.grid.attach(keyView, 0, 0, 1, 1);
        
        // Devices Page
        this.devicesStack = new DevicesStack();
        let devicesPage = this.add_titled(this.devicesStack, "devices", _("Devices"));
        
        // Service Page
        let servicePage = this.addPage("service", _("Service"));
        let serviceSection = servicePage.add_section(_("Service"));
        
        this.nameEntry = new Gtk.Entry({
            placeholder_text: this.manager.name,
            valign: Gtk.Align.CENTER
        });
        this.nameEntry.connect("activate", (entry) => {
            this.manager.name = entry.text
            entry.text = "";
            this.get_toplevel().set_focus(null);
        });
        this.nameEntry.connect("changed", (entry) => {
            if (entry.text.length) {
                entry.secondary_icon_name = "edit-undo-symbolic";
            } else {
                entry.text = "";
                entry.secondary_icon_name = "";
                this.get_toplevel().set_focus(null);
            }
        });
        this.nameEntry.connect("icon-release", (entry) => {
            entry.text = "";
            entry.secondary_icon_name = "";
            this.get_toplevel().set_focus(null);
        });
        
        servicePage.addItem(
            serviceSection,
            _("Public Name"),
            _("The name broadcast to other devices"),
            this.nameEntry
        );
        
        servicePage.addSetting(serviceSection, "persistent-discovery");
        
        // About/Advanced
        let advancedPage = this.addPage("advanced", _("Advanced"));
        let develSection = advancedPage.add_section(_("Development"));
        advancedPage.addSetting(develSection, "debug");
    }
});


function init() {
    Common.initConfiguration();
    Common.initTranslations();
}

// Extension Preferences
function buildPrefsWidget() {
    let prefsWidget = new PrefsWidget();
    
    // HeaderBar
    Mainloop.timeout_add(0, () => {
        let headerBar = prefsWidget.get_toplevel().get_titlebar();
        headerBar.custom_title = prefsWidget.switcher;
        return false;
    });
    
    prefsWidget.show_all();
    return prefsWidget;
}

