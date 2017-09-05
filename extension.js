// jshint esversion: 6
// vim: sw=4 ts=4 sts=4

// The code here is almost exclusively copy-paste from
// ui/SwitcherPopup.js as extracted from libgnome-shell.so.
//
// The "show" method of SwitcherPopup is replaced with a slightly
// modified version to show the popup instantly instead of after a delay
// of 150ms.

const Clutter = imports.gi.Clutter;
const SwitcherPopup = imports.ui.switcherPopup;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

let originalShow;
let originalGetPreferredWidth;
let originalGetPreferredHeight;
let originalAllocate;
let primaryModifier;


function alteredAllocate(actor, box, flags) {
    let childBox = new Clutter.ActorBox();
    let current_monitor = Main.layoutManager.currentMonitor;

    let leftPadding = this.actor.get_theme_node().get_padding(St.Side.LEFT);
    let rightPadding = this.actor.get_theme_node().get_padding(St.Side.RIGHT);
    let hPadding = leftPadding + rightPadding;

    // Allocate the switcherList
    // We select a size based on an icon size that does not overflow the screen
    let [childMinHeight, childNaturalHeight] = this._switcherList.actor.get_preferred_height(current_monitor.width - hPadding);
    let [childMinWidth, childNaturalWidth] = this._switcherList.actor.get_preferred_width(childNaturalHeight);
    childBox.x1 = Math.max(current_monitor.x + leftPadding, current_monitor.x + Math.floor((current_monitor.width - childNaturalWidth) / 2));
    childBox.x2 = Math.min(current_monitor.x + current_monitor.width - rightPadding, childBox.x1 + childNaturalWidth);
    childBox.y1 = current_monitor.y + Math.floor((current_monitor.height - childNaturalHeight) / 2);
    childBox.y2 = childBox.y1 + childNaturalHeight;
    this._switcherList.actor.allocate(childBox, flags);
}

function alteredGetPreferredWidth(actor, forHeight, alloc) {
    let current_monitor = Main.layoutManager.currentMonitor;

    alloc.min_size = current_monitor.width;
    alloc.natural_size = current_monitor.width;
}

function alteredGetPreferredHeight(actor, forHeight, alloc) {
    let current_monitor = Main.layoutManager.currentMonitor;

    alloc.min_size = current_monitor.height;
    alloc.natural_size = current_monitor.height;
}

function alteredShow(backward, binding, mask) {
    if (this._items.length == 0)
        return false;

    if (!Main.pushModal(this.actor)) {
        // Probably someone else has a pointer grab, try again with keyboard only
        if (!Main.pushModal(this.actor, { options: Meta.ModalOptions.POINTER_ALREADY_GRABBED })) {
            return false;
        }
    }
    this._haveModal = true;
    this._modifierMask = primaryModifier(mask);

    this.actor.connect('key-press-event', Lang.bind(this, this._keyPressEvent));
    this.actor.connect('key-release-event', Lang.bind(this, this._keyReleaseEvent));

    this.actor.connect('button-press-event', Lang.bind(this, this._clickedOutside));
    this.actor.connect('scroll-event', Lang.bind(this, this._scrollEvent));

    this.actor.add_actor(this._switcherList.actor);
    this._switcherList.connect('item-activated', Lang.bind(this, this._itemActivated));
    this._switcherList.connect('item-entered', Lang.bind(this, this._itemEntered));

    // Need to force an allocation so we can figure out whether we
    // need to scroll when selecting
    this.actor.opacity = 0;
    this.actor.show();
    this.actor.get_allocation_box();

    this._initialSelection(backward, binding);

    // There's a race condition; if the user released Alt before
    // we got the grab, then we won't be notified. (See
    // https://bugzilla.gnome.org/show_bug.cgi?id=596695 for
    // details.) So we check now. (Have to do this after updating
    // selection.)
    let [x, y, mods] = global.get_pointer();
    if (!(mods & this._modifierMask)) {
        this._finish(global.get_current_time());
        return false;
    }

    // THE FOLLOWING PART WAS MODIFIED FOR THIS EXTENSION
    // ------------------------------------------------------------
    Main.osdWindowManager.hideAll();
    this.actor.opacity = 255;
    // ------------------------------------------------------------
    return true;
}

function init() {
    originalShow = SwitcherPopup.SwitcherPopup.prototype.show;
    originalGetPreferredWidth = SwitcherPopup.SwitcherPopup.prototype._getPreferredWidth;
    originalGetPreferredHeight = SwitcherPopup.SwitcherPopup.prototype._getPreferredHeight;
    originalAllocate = SwitcherPopup.SwitcherPopup.prototype._allocate;
    primaryModifier = SwitcherPopup.primaryModifier;
}

function enable() {
    SwitcherPopup.SwitcherPopup.prototype._allocate = alteredAllocate;
    SwitcherPopup.SwitcherPopup.prototype._getPreferredWidth = alteredGetPreferredWidth;
    SwitcherPopup.SwitcherPopup.prototype._getPreferredHeight = alteredGetPreferredHeight;
    SwitcherPopup.SwitcherPopup.prototype.show = alteredShow;
}

function disable() {
    SwitcherPopup.SwitcherPopup.prototype.show = originalShow;
    SwitcherPopup.SwitcherPopup.prototype._getPreferredWidth = originalGetPreferredWidth;
    SwitcherPopup.SwitcherPopup.prototype._getPreferredHeight = originalGetPreferredHeight;
    SwitcherPopup.SwitcherPopup.prototype._allocate = originalAllocate;
}
