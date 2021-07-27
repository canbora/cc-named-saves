/*jshint esversion: 8 */

var supportedLangs = ["en_US"];

var defaultLabels = {
    "sc.gui.menu.hotkeys.renameSlot": "Rename",
    "sc.gui.menu.save-menu.rename-info-title": "\\c[3]Renaming Save Files\\c[0]",
    "sc.gui.menu.save-menu.rename-info-content-save": "Hover over a slot, press \\i[help4] and enter the new save name in the pop-up to rename the slot. You can also close the pop-up without submitting to retain the former save name, or submit empty text to revert the save name to the original number.",
    "sc.gui.menu.save-menu.rename-info-content-load": "Hover over a slot, press \\i[help3] and enter the new save name in the pop-up to rename the slot. You can also close the pop-up without submitting to retain the former save name, or submit empty text to revert the save name to the original number.",
    "sc.gui.menu.save-menu.rename-popup-title": "Enter new save name",
    "sc.gui.menu.save-menu.rename-popup-submit": "Submit"
};

// same as ig.lang but defaults if language is unsupported
function getLabel(address) {
    if (supportedLangs.includes(ig.currentLang)) {
        return ig.lang.get(address);
    } else {
        return defaultLabels[address];
    }
}

// spawns the popup that asks for the new word
function spawnPopup(selectedSlot) {
    var prevName = selectedSlot.slotOver.saveName || "";
    var slotNum = selectedSlot.slot;
    if(window.ig && window.ig.system) {
        // I've chosen the gamecodeMessage overlay because it's in the format I want
        var overlay = ig.dom.html(`<div class="gameOverlayBox gamecodeMessage" ><h3>${getLabel("sc.gui.menu.save-menu.rename-popup-title")}</h3></div>`);
        var form = ig.dom.html(`<form><input type="text" name="newName" value="${prevName}" /><input type="submit" name="send" value="${getLabel("sc.gui.menu.save-menu.rename-popup-submit")}" /><form>`);
        overlay.append(form);
        form.submit(function(){
            return renameAndSave(selectedSlot, form[0].newName.value);
        });

        $(document.body).append(overlay);
        window.setTimeout(function(){
            overlay.addClass("shown");
        }, 20);
        ig.system.setFocusLost();

        var close = function(){
            ig.system.removeFocusListener(close);
            overlay.remove();
        };
        ig.system.addFocusListener(close);
        form.find("input[type=text]").focus();
    }
}

function renameAndSave(selectedSlot, newName) {
    var slotNum = selectedSlot.slot;
    var save = ig.storage.getSlot(slotNum <= -2 ? -1 : slotNum);
    if (save && save.data) {
        if (newName === "") {
            delete save.data.saveName;
        } else {
            save.data.saveName = newName;
        }
        var renamedSave = new ig.SaveSlot(save.data);
        ig.storage.slots[slotNum] = renamedSave;
        ig.system.regainFocus();
        selectedSlot.setSlotOver(slotNum);
        ig.storage._saveToStorage();
    } else {
        console.log(`Save or save data missing in slot ${slotNum}. save:`, save);
        ig.system.regainFocus();
    }
    return false;
}

sc.SaveSlotButtonHighlight.inject({

	init: function() {
        this.parent();
        this.setPos(2, 1);
        this.setSize(446, 38);
    },

	setSlot: function(a) {
        var save = ig.storage.getSlot(a <= -2 ? -1 : a);

        if (!save || !save.data || !save.data.saveName) {
            delete this.saveName;
            if (this.slotGui instanceof sc.TextGui) {
                this.slotGui.remove();
                this.slotGui = null;
            }
            return this.parent(a);
        }

        var slotChanged = this.slot != a;
        var nameChanged = this.saveName != save.data.saveName;

        if ((slotChanged || nameChanged) && this.slotGui) {
            this.slotGui.remove();
            this.slotGui = null;
        }

        this.slot = a == undefined ? -1 : a;
        this.saveName = save.data.saveName;
        this.newgame = this.slot != -1 && save.data.newGamePlus && save.data.newGamePlus.active;

        if (!this.slotGui) {
            this.saveName = save.data.saveName;
            this.slotGui = new sc.TextGui(this.saveName);
            this.slotGui.setPos(5, -2);
            this.addChildGui(this.slotGui);
            this.textSize = this.slotGui.textBlock.size.x-2;
        }
    },

    updateDrawables: function(a) {
        /*
            Draw steps of the highlight, in order:
            0: left of left part                 addGfx() in ninepatch.draw()
            1: right of left part                addGfx() in ninepatch.draw()
            2: middle of left part               addPattern() in ninepatch.draw()
            3: top line except the left part     first addColor() in updateDrawables()
            4: bottom line except the left part  second addColor() in updateDrawables()
            5: right few pixels                  second last addGfx() in updateDrawables()
            6: yellow plus                       last addGfx() in updateDrawables() if ng+
        */
        this.parent(a);
        if (!this.saveName) {
            return;
        }
        var steps = ig.gui.renderer.drawSteps;
        var stepOffset; // index of first relevant draw step
        var newGame = this.newgame && this.slotGui;
        var boxSize = this.textSize;
        if (newGame) {
            stepOffset = steps.length - 7;
            boxSize += 8;
        } else {
            stepOffset = steps.length - 6;
        }
        steps[stepOffset+1].pos.x = 6+boxSize;
        steps[stepOffset+2].size.x = boxSize;
        steps[stepOffset+3].pos.x = 13+boxSize;
        steps[stepOffset+3].size.x = 426-boxSize;
        steps[stepOffset+4].pos.x = 13+boxSize;
        steps[stepOffset+4].size.x = 426-boxSize;
    }

});

sc.SaveMenu.inject({

    init: function() {
        this.parent();
        var buttonText = sc.menu.loadMode ? "\\i[help3]" : "\\i[help4]";
        this.hotkeyRename = new sc.ButtonGui(buttonText + getLabel("sc.gui.menu.hotkeys.renameSlot"), void 0, true, sc.BUTTON_TYPE.SMALL);
        this.hotkeyRename.keepMouseFocus = true;
        this.hotkeyRename.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.EASE
            },
            HIDDEN: {
                state: {
                    offsetY: -this.hotkeyRename.hook.size.y
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.hotkeyRename.onButtonPress = this.onRenameButtonPressed.bind(this);
    },

    onHotkeyRenameCheck: function() {
        if (sc.menu.loadMode) {
            return sc.control.menuHotkeyHelp3();
        } else {
            return sc.control.menuHotkeyHelp4();
        }
    },

    onRenameButtonPressed: function() {
        this.list.onRenameSlot();
    },

    onAddHotkeys: function(a) {
        sc.menu.buttonInteract.addGlobalButton(this.hotkeyHelp, this.onHotkeyHelpCheck.bind(this));
        sc.menu.loadClearFilesOnly || sc.menu.buttonInteract.addGlobalButton(this.hotkeyDelete, this.onHotkeyDeleteCheck.bind(this));
        sc.menu.loadMode || sc.menu.buttonInteract.addGlobalButton(this.hotkeyNew, this.onHotkeyNewCheck.bind(this));
        sc.menu.buttonInteract.addGlobalButton(this.hotkeyRename, this.onHotkeyRenameCheck.bind(this));
        this.commitHotKeysToTopBar(a);
    },

    commitHotKeysToTopBar: function(a) {
        sc.menu.addHotkey(function() {
            return this.hotkeyRename;
        }.bind(this));
        this.parent(a);
    },

});

sc.SaveList.inject({
    // when rename hotkey/button is pressed
    onRenameSlot: function() {
        if (this.selectedSlot && this.selectedSlot.slot >= 0) {
            // Needed for the game to think I've stopped pressing the hotkey
            let hotkey = sc.menu.loadMode ? "help3" : "help4";
            ig.input.locks[hotkey] = false;

            spawnPopup(this.selectedSlot);
        } else {
            var contentAddress = sc.menu.loadMode ? "sc.gui.menu.save-menu.rename-info-content-load" : "sc.gui.menu.save-menu.rename-info-content-save";
            var infoText = getLabel("sc.gui.menu.save-menu.rename-info-title") + "\n\n" + getLabel(contentAddress);
            var infoBox = new sc.CenterMsgBoxGui(infoText, {
                maxWidth: 300,
                speed: ig.TextBlock.SPEED.IMMEDIATE
            }, "black", 0.9);
            infoBox.hook.zIndex = 150000;
            infoBox.hook.pauseGui = true;
            ig.gui.addGuiElement(infoBox);
        }
    },

});

ig.Storage.inject({
    // when a save is writen in a new or previous slot
    save: function(a) {
        var a = a || 0,
            b = {};
        var prevSave = ig.storage.getSlot(a <= -2 ? -1 : a);
        if (prevSave && prevSave.data && prevSave.data.saveName) {
            b.saveName = prevSave.data.saveName;
        }
        this._saveState(b, null, ig.copy(this.checkPointSave.position));
        this.checkPointSave = b;
        var c = new ig.SaveSlot(b);
        this.slots[a] && this.slots.splice(a, 1);
        this.slots.unshift(c);
        this.lastUsedSlot = 0;
        this._saveToStorage();
        ig.debug("Saved Game: %O", b);
    },

});
