(function(continuum){

var utility          = continuum.utility,
    Feeder           = utility.Feeder,
    uid              = utility.uid,
    fname            = utility.fname,
    hasOwn           = utility.hasOwn,
    define           = utility.define,
    isObject         = utility.isObject,
    isExtensible     = utility.isExtensible,
    ownProperties    = utility.properties,
    getPrototypeOf   = utility.getPrototypeOf,
    getBrandOf       = utility.getBrandOf,
    describeProperty = utility.describeProperty,
    defineProperty   = utility.defineProperty,
    block            = continuum.block,
    createPanel      = continuum.createPanel,
    render           = continuum.render,
    _                = continuum._;


var body         = _(document.body),
    input        = createPanel('editor'),
    stdout       = createPanel('console'),
    inspector    = createPanel('inspector'),
    instructions = createPanel('instructions');

void function(){
  var main = createPanel('panel', null, {
    name: 'container',
    top: {
      left: {
        size: 250,
        top: {
          size: .7,
          label: 'Instructions',
          name: 'instructions',
          content: instructions,
          scroll: true
        },
        bottom: {
          label: 'stdout',
          name: 'output',
          content: stdout,
          scroll: true
        },
      },
      right: {
        label: 'Inspector',
        name: 'view',
        content: inspector,
        scroll: true
      },
    },
    bottom: {
      name: 'input',
      size: .3,
      content: input
    }
  });

  instructions.children.shift();

  var scroll = _(document.querySelector('.CodeMirror-scroll')),
      scrollbar = input.append(createPanel('scrollbar', scroll)),
      child = input.child();

  scroll.removeClass('scrolled');
  child.removeClass('scroll-container');
  child.style('right', null);
  scrollbar.right(0);
  scrollbar.width(scrollbar.width() + 2);
  main.splitter.right(0);
}();


function inspect(o){
  var tree = inspector.append(createPanel('result', render('normal', o)));
  inspector.element.scrollTop = inspector.element.scrollHeight;
  inspector.refresh();
  return tree;
}


 realm = continuum.createRealm();

var ops = new Feeder(function(op){
  instructions.addInstruction(op);
});

input.on('entry', function(evt){
  realm.evaluateAsync(evt.value, inspect);
});


realm.on('write', function(args){
  stdout.write.apply(stdout, args);
});

realm.on('clear', function(){
  stdout.clear();
});

realm.on('backspace', function(n){
  stdout.backspace(n);
});

realm.on('pause', function(){
  var overlay = body.append(block('.overlay')),
      unpause = body.append(createPanel('button', 'Unpause', 'unpause'));

  body.addClass('paused');
  input.disable();
  unpause.once('click', function(){
    body.removeClass('paused');
    input.enable();
    unpause.remove();
    overlay.remove();
    realm.resume();
  });
});

setTimeout(function(){
  realm.on('op', function(op){
    ops.push(op);
  });
}, 100);


setTimeout(function(){ inspect(realm.evaluate('this')).expand() }, 10);

if (location.hash === '#experimental') {
  var wrap = (function(){
    var id = uid();

    var map = (function(){
      if (typeof Map === 'function') {
        var weakmap = new Map;
        return {
          set: function set(key, value){
            try { weakmap.set(key, value) } catch (e) { console.log(e) }
          },
          get: function get(key){
            try { return weakmap.get(key) } catch (e) { console.log(e) }
          },
          has: function has(key){
            try { return weakmap.has(key) } catch (e) { console.log(e) }
          },
          remove: function remove(key){
            try { return weakmap['delete'](key) } catch (e) { console.log(e) }
          }
        };
      } else {
        var keys = [],
            vals = [];

        return {
          set: function set(key, value){
            if (isExtensible(key)) {
              define(key, id, value);
            } else {
              var index = key === this.lastKey ? this.lastIndex : keys.indexOf(key);
              if (~index) {
                keys[index] = key;
                vals[index] = value;
              } else {
                keys.push(key);
                vals.push(value);
              }
            }
          },
          get: function get(key){
            if (isExtensible(key)) {
              return key[id];
            } else {
              var index = key === this.lastKey ? this.lastIndex : keys.indexOf(key);
              if (~index) {
                return vals[index];
              }
            }
          },
          has: function has(key){
            if (isExtensible(key)) {
              return hasOwn(key, id);
            } else {
              var lastIndex = keys.indexOf(key);
              if (~lastIndex) {
                this.lastIndex = lastIndex;
                this.lastKey = key;
                return true;
              }
            }
            return false;
          },
          remove: function remove(key){
            if (isExtensible(key)) {
              if (hasOwn(key, id)) {
                delete key[id];
                return true;
              }
            } else {
              var index = keys.indexOf(key);
              if (!index) {
                keys.splice(index, 1);
                vals.splice(index, 1);
                return true;
              }
            }
            return false;
          }
        };
      }
    })();

    function unwrap(value){
      if (isObject(value)) {
        if (value.object) {
          value = value.object;
        }
      }
      return value;
    }

    function wrap(value){
      if (isObject(value)) {
        if (value instanceof $ExoticObject) {
          return value;
        }

        if (map.has(value)) {
          return map.get(value);
        }

        var wrapper = typeof value === 'function' ? new $ExoticFunction(value) : new $ExoticObject(value);

        map.set(value, wrapper);
        return wrapper;

      } else if (typeof value === 'string' && value.length > 100) {
        value = value.slice(0, 100);
      }
      return value;
    }

    function attrsToDesc(attr){
      if (attr < 0) {
        var val = false;
        attr = ~attr;
      } else {
        var val = true;
      }
      var desc = {
        enumerable: (attr & 1) ? val : !val,
        configurable: (attr & 2) ? val : !val
      };
      if (attr & 4) {
        desc.writable = val;
      }
      return desc;
    }

    function descToAttrs(desc){
      if (desc) {
        var attrs = desc.enumerable | (desc.configurable << 1) | (desc.writable << 2);
        if ('get' in desc || 'set' in desc) {
         attrs |= 0x08;
        }
        return attrs;
      }
    }

    function getDescriptor(o, key){
      if (hasOwn(o, key)) {
        try {
          return describeProperty(o, key);
        } catch (e) {
        }
      }
    }

    var handlers = [
      function init(object){
        this.object = object;
        this.Extensible = isExtensible(object);
        this.Prototype = wrap(getPrototypeOf(object));

        if (object !== location) {
          var ctor = object.constructor;
          if (ctor) {
            if (ctor.prototype === object) {
              this.IsProto = true;
            }
            this.ConstructorName = fname(ctor) || getBrandOf(ctor);
          }
        }

        if (!this.ConstructorName) {
          this.ConstructorName = getBrandOf(object);
        }

        if (typeof object === 'function') {
          try { fname(object) } catch (e) {}
        }
      },
      function remove(key){
        delete this.object[key];
      },
      function describe(key){
        if (key === id) return;
        var desc = getDescriptor(this.object, key);
        if (desc) {
          var attrs = descToAttrs(desc);
          if ('value' in desc) {
            var val = wrap(desc.value);
          } else if ('get' in desc || 'set' in desc) {
            var val = { Get: wrap(desc.get),
                        Set: wrap(desc.set) };
          }
          var prop = [key, val, attrs];
          return prop;
        }
      },
      function define(key, value, attrs){
        this.object[key] = unwrap(value);
        return;
        var desc = attrsToDesc(attrs);
        desc.value = unwrap(value);
        defineProperty(this.object, key, desc);
      },
      function has(key){
        if (key === id) return false;
        return key in this.object;
      },
      function each(callback){
        var keys = ownProperties(this.object);
        for (var i=0; i < keys.length; i++) {
          if (keys[i] === id) continue;

          var val = this.describe(keys[i]);
          if (typeof val === 'object' && val !== null) {
            callback(val);
          }
        }
      },
      function get(key){
        try {
          return wrap(this.object[key]);
        } catch (e) { console.log(e) }
      },
      function set(key, value){
        this.object[key] = unwrap(value);
      },
      function query(key){
        var desc = describeProperty(this.object, key);
        if (desc) {
          return descToAttrs(desc);
        }
      },
      function update(key, attr){
        defineProperty(this.object, key, attrsToDesc(attr));
      }
    ]

    var applyNew = continuum.utility.applyNew;
    var $ExoticObject = continuum.createExotic('Object', handlers);
    var $ExoticFunction = continuum.createExotic('Function', handlers);


    $ExoticFunction.prototype.Call = function Call(receiver, args){
      try {
        return wrap(this.call.apply(unwrap(receiver), args.map(unwrap)));
      } catch (e) {
        console.log(e);
      }
    };

    $ExoticFunction.prototype.Construct = function Construct(args){
      return wrap(applyNew(this.call, args.map(unwrap)));
    };

    return wrap;
  })();


  var oproto = wrap(Object.prototype);
  oproto.properties.setProperty(['__proto__', null, 6, {
    Get: { Call: function(r){ return r.getPrototype() } },
    Set: { Call: function(r, a){ return r.setPrototype(a[0]) } }
  }]);

  realm.global.Put('document', wrap(document));
  realm.global.Put('window', wrap(window));
}
})(continuum);
