/*
 license: The MIT License, Copyright (c) 2016 YUKI "Piro" Hiroshi
 original:
 http://github.com/piroor/webextensions-lib-options
 */

function Options(aConfigs) {
    this.configs = aConfigs;

    this.onReady = this.onReady.bind(this);
    document.addEventListener('DOMContentLoaded', this.onReady);
}

Options.prototype = {
    configs : null,

    UI_TYPE_UNKNOWN    : 0,
    UI_TYPE_TEXT_FIELD : 1 << 0,
    UI_TYPE_CHECKBOX   : 1 << 1,

    detectUIType : function(aKey)
    {
        var node = document.getElementById(aKey);
        if (!node)
            return this.UI_MISSING;

        if (node.localName == 'textarea')
            return this.UI_TYPE_TEXT_FIELD;

        if (node.localName != 'input')
            return this.UI_TYPE_UNKNOWN;

        switch (node.type)
        {
            case 'text':
            case 'password':
                return this.UI_TYPE_TEXT_FIELD;

            case 'checkbox':
                return this.UI_TYPE_CHECKBOX;

            default:
                return this.UI_TYPE_UNKNOWN;
        }
    },

    throttleTimers : {},
    throttledUpdate : function(aKey, aValue) {
        if (this.throttleTimers[aKey])
            clearTimeout(this.throttleTimers[aKey]);
        this.throttleTimers[aKey] = setTimeout((function() {
            delete this.throttleTimers[aKey];
            this.configs[aKey] = aValue;
        }).bind(this), 250);
    },

    bindToCheckbox : function(aKey)
    {
        var node = document.getElementById(aKey);
        node.checked = this.configs[aKey];
        node.addEventListener('change', (function() {
            this.throttledUpdate(aKey, node.checked);
        }).bind(this));
    },
    bindToTextField : function(aKey)
    {
        var node = document.getElementById(aKey);
        node.value = this.configs[aKey];
        node.addEventListener('input', (function() {
            this.throttledUpdate(aKey, node.value);
        }).bind(this));
    },

    onReady : function()
    {
        document.removeEventListener('DOMContentLoaded', this.onReady);

        if (!this.configs || !this.configs.$loaded)
            throw new Error('you must give configs!');

        this.configs.$loaded
            .then((function() {
                Object.keys(this.configs.$default).forEach(function(aKey) {
                    switch (this.detectUIType(aKey))
                    {
                        case this.UI_TYPE_CHECKBOX:
                            this.bindToCheckbox(aKey);
                            break;

                        case this.UI_TYPE_TEXT_FIELD:
                            this.bindToTextField(aKey);
                            break;

                        case this.UI_MISSING:
                            return;

                        default:
                            throw new Error('unknown type UI element for ' + aKey);
                    }
                }, this);
            }).bind(this));
    }
};


// These configurations (copied from globals.es6) can be binded automatically.
var configs = new Configs({
    switchFocusToNewTab: true,
    showNumberOfLinks: true,
});

new Options(configs);