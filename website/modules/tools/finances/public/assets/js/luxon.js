var luxon = (function (e) {
    'use strict';
    function t(e, t) {
        for (var n = 0; n < t.length; n++) {
            var r = t[n];
            (r.enumerable = r.enumerable || !1),
                (r.configurable = !0),
                'value' in r && (r.writable = !0),
                Object.defineProperty(e, r.key, r);
        }
    }
    function n(e, n, r) {
        return n && t(e.prototype, n), r && t(e, r), e;
    }
    function r(e, t) {
        (e.prototype = Object.create(t.prototype)),
            (e.prototype.constructor = e),
            (e.__proto__ = t);
    }
    function i(e) {
        return (i = Object.setPrototypeOf
            ? Object.getPrototypeOf
            : function (e) {
                  return e.__proto__ || Object.getPrototypeOf(e);
              })(e);
    }
    function o(e, t) {
        return (o =
            Object.setPrototypeOf ||
            function (e, t) {
                return (e.__proto__ = t), e;
            })(e, t);
    }
    function a(e, t, n) {
        return (a = (function () {
            if ('undefined' == typeof Reflect || !Reflect.construct) return !1;
            if (Reflect.construct.sham) return !1;
            if ('function' == typeof Proxy) return !0;
            try {
                return (
                    Date.prototype.toString.call(
                        Reflect.construct(Date, [], function () {})
                    ),
                    !0
                );
            } catch (e) {
                return !1;
            }
        })()
            ? Reflect.construct
            : function (e, t, n) {
                  var r = [null];
                  r.push.apply(r, t);
                  var i = new (Function.bind.apply(e, r))();
                  return n && o(i, n.prototype), i;
              }).apply(null, arguments);
    }
    function u(e) {
        var t = 'function' == typeof Map ? new Map() : void 0;
        return (u = function (e) {
            if (
                null === e ||
                ((n = e),
                -1 === Function.toString.call(n).indexOf('[native code]'))
            )
                return e;
            var n;
            if ('function' != typeof e)
                throw new TypeError(
                    'Super expression must either be null or a function'
                );
            if (void 0 !== t) {
                if (t.has(e)) return t.get(e);
                t.set(e, r);
            }
            function r() {
                return a(e, arguments, i(this).constructor);
            }
            return (
                (r.prototype = Object.create(e.prototype, {
                    constructor: {
                        value: r,
                        enumerable: !1,
                        writable: !0,
                        configurable: !0,
                    },
                })),
                o(r, e)
            );
        })(e);
    }
    function s(e, t) {
        (null == t || t > e.length) && (t = e.length);
        for (var n = 0, r = new Array(t); n < t; n++) r[n] = e[n];
        return r;
    }
    function c(e) {
        var t = 0;
        if ('undefined' == typeof Symbol || null == e[Symbol.iterator]) {
            if (
                Array.isArray(e) ||
                (e = (function (e, t) {
                    if (e) {
                        if ('string' == typeof e) return s(e, t);
                        var n = Object.prototype.toString.call(e).slice(8, -1);
                        return (
                            'Object' === n &&
                                e.constructor &&
                                (n = e.constructor.name),
                            'Map' === n || 'Set' === n
                                ? Array.from(n)
                                : 'Arguments' === n ||
                                  /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(
                                      n
                                  )
                                ? s(e, t)
                                : void 0
                        );
                    }
                })(e))
            )
                return function () {
                    return t >= e.length
                        ? { done: !0 }
                        : { done: !1, value: e[t++] };
                };
            throw new TypeError(
                'Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
            );
        }
        return (t = e[Symbol.iterator]()).next.bind(t);
    }
    var l = (function (e) {
            function t() {
                return e.apply(this, arguments) || this;
            }
            return r(t, e), t;
        })(u(Error)),
        f = (function (e) {
            function t(t) {
                return (
                    e.call(this, 'Invalid DateTime: ' + t.toMessage()) || this
                );
            }
            return r(t, e), t;
        })(l),
        d = (function (e) {
            function t(t) {
                return (
                    e.call(this, 'Invalid Interval: ' + t.toMessage()) || this
                );
            }
            return r(t, e), t;
        })(l),
        h = (function (e) {
            function t(t) {
                return (
                    e.call(this, 'Invalid Duration: ' + t.toMessage()) || this
                );
            }
            return r(t, e), t;
        })(l),
        m = (function (e) {
            function t() {
                return e.apply(this, arguments) || this;
            }
            return r(t, e), t;
        })(l),
        y = (function (e) {
            function t(t) {
                return e.call(this, 'Invalid unit ' + t) || this;
            }
            return r(t, e), t;
        })(l),
        v = (function (e) {
            function t() {
                return e.apply(this, arguments) || this;
            }
            return r(t, e), t;
        })(l),
        g = (function (e) {
            function t() {
                return e.call(this, 'Zone is an abstract class') || this;
            }
            return r(t, e), t;
        })(l),
        p = 'numeric',
        w = 'short',
        k = 'long',
        b = { year: p, month: p, day: p },
        S = { year: p, month: w, day: p },
        O = { year: p, month: w, day: p, weekday: w },
        T = { year: p, month: k, day: p },
        M = { year: p, month: k, day: p, weekday: k },
        N = { hour: p, minute: p },
        E = { hour: p, minute: p, second: p },
        D = { hour: p, minute: p, second: p, timeZoneName: w },
        I = { hour: p, minute: p, second: p, timeZoneName: k },
        V = { hour: p, minute: p, hour12: !1 },
        L = { hour: p, minute: p, second: p, hour12: !1 },
        x = { hour: p, minute: p, second: p, hour12: !1, timeZoneName: w },
        F = { hour: p, minute: p, second: p, hour12: !1, timeZoneName: k },
        C = { year: p, month: p, day: p, hour: p, minute: p },
        Z = { year: p, month: p, day: p, hour: p, minute: p, second: p },
        j = { year: p, month: w, day: p, hour: p, minute: p },
        A = { year: p, month: w, day: p, hour: p, minute: p, second: p },
        z = { year: p, month: w, day: p, weekday: w, hour: p, minute: p },
        _ = { year: p, month: k, day: p, hour: p, minute: p, timeZoneName: w },
        q = {
            year: p,
            month: k,
            day: p,
            hour: p,
            minute: p,
            second: p,
            timeZoneName: w,
        },
        H = {
            year: p,
            month: k,
            day: p,
            weekday: k,
            hour: p,
            minute: p,
            timeZoneName: k,
        },
        U = {
            year: p,
            month: k,
            day: p,
            weekday: k,
            hour: p,
            minute: p,
            second: p,
            timeZoneName: k,
        };
    function R(e) {
        return void 0 === e;
    }
    function P(e) {
        return 'number' == typeof e;
    }
    function W(e) {
        return 'number' == typeof e && e % 1 == 0;
    }
    function J() {
        try {
            return 'undefined' != typeof Intl && Intl.DateTimeFormat;
        } catch (e) {
            return !1;
        }
    }
    function Y() {
        return !R(Intl.DateTimeFormat.prototype.formatToParts);
    }
    function G() {
        try {
            return 'undefined' != typeof Intl && !!Intl.RelativeTimeFormat;
        } catch (e) {
            return !1;
        }
    }
    function $(e, t, n) {
        if (0 !== e.length)
            return e.reduce(function (e, r) {
                var i = [t(r), r];
                return e && n(e[0], i[0]) === e[0] ? e : i;
            }, null)[1];
    }
    function B(e, t) {
        return t.reduce(function (t, n) {
            return (t[n] = e[n]), t;
        }, {});
    }
    function Q(e, t) {
        return Object.prototype.hasOwnProperty.call(e, t);
    }
    function K(e, t, n) {
        return W(e) && e >= t && e <= n;
    }
    function X(e, t) {
        void 0 === t && (t = 2);
        var n = e < 0 ? '-' : '',
            r = n ? -1 * e : e;
        return (
            '' +
            n +
            (r.toString().length < t
                ? ('0'.repeat(t) + r).slice(-t)
                : r.toString())
        );
    }
    function ee(e) {
        return R(e) || null === e || '' === e ? void 0 : parseInt(e, 10);
    }
    function te(e) {
        if (!R(e) && null !== e && '' !== e) {
            var t = 1e3 * parseFloat('0.' + e);
            return Math.floor(t);
        }
    }
    function ne(e, t, n) {
        void 0 === n && (n = !1);
        var r = Math.pow(10, t);
        return (n ? Math.trunc : Math.round)(e * r) / r;
    }
    function re(e) {
        return e % 4 == 0 && (e % 100 != 0 || e % 400 == 0);
    }
    function ie(e) {
        return re(e) ? 366 : 365;
    }
    function oe(e, t) {
        var n,
            r,
            i = (n = t - 1) - (r = 12) * Math.floor(n / r) + 1;
        return 2 === i
            ? re(e + (t - i) / 12)
                ? 29
                : 28
            : [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i - 1];
    }
    function ae(e) {
        var t = Date.UTC(
            e.year,
            e.month - 1,
            e.day,
            e.hour,
            e.minute,
            e.second,
            e.millisecond
        );
        return (
            e.year < 100 &&
                e.year >= 0 &&
                (t = new Date(t)).setUTCFullYear(t.getUTCFullYear() - 1900),
            +t
        );
    }
    function ue(e) {
        var t =
                (e +
                    Math.floor(e / 4) -
                    Math.floor(e / 100) +
                    Math.floor(e / 400)) %
                7,
            n = e - 1,
            r =
                (n +
                    Math.floor(n / 4) -
                    Math.floor(n / 100) +
                    Math.floor(n / 400)) %
                7;
        return 4 === t || 3 === r ? 53 : 52;
    }
    function se(e) {
        return e > 99 ? e : e > 60 ? 1900 + e : 2e3 + e;
    }
    function ce(e, t, n, r) {
        void 0 === r && (r = null);
        var i = new Date(e),
            o = {
                hour12: !1,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            };
        r && (o.timeZone = r);
        var a = Object.assign({ timeZoneName: t }, o),
            u = J();
        if (u && Y()) {
            var s = new Intl.DateTimeFormat(n, a)
                .formatToParts(i)
                .find(function (e) {
                    return 'timezonename' === e.type.toLowerCase();
                });
            return s ? s.value : null;
        }
        if (u) {
            var c = new Intl.DateTimeFormat(n, o).format(i);
            return new Intl.DateTimeFormat(n, a)
                .format(i)
                .substring(c.length)
                .replace(/^[, \u200e]+/, '');
        }
        return null;
    }
    function le(e, t) {
        var n = parseInt(e, 10);
        Number.isNaN(n) && (n = 0);
        var r = parseInt(t, 10) || 0;
        return 60 * n + (n < 0 || Object.is(n, -0) ? -r : r);
    }
    function fe(e) {
        var t = Number(e);
        if ('boolean' == typeof e || '' === e || Number.isNaN(t))
            throw new v('Invalid unit value ' + e);
        return t;
    }
    function de(e, t, n) {
        var r = {};
        for (var i in e)
            if (Q(e, i)) {
                if (n.indexOf(i) >= 0) continue;
                var o = e[i];
                if (void 0 === o || null === o) continue;
                r[t(i)] = fe(o);
            }
        return r;
    }
    function he(e, t) {
        var n = Math.trunc(Math.abs(e / 60)),
            r = Math.trunc(Math.abs(e % 60)),
            i = e >= 0 ? '+' : '-';
        switch (t) {
            case 'short':
                return '' + i + X(n, 2) + ':' + X(r, 2);
            case 'narrow':
                return '' + i + n + (r > 0 ? ':' + r : '');
            case 'techie':
                return '' + i + X(n, 2) + X(r, 2);
            default:
                throw new RangeError(
                    'Value format ' + t + ' is out of range for property format'
                );
        }
    }
    function me(e) {
        return B(e, ['hour', 'minute', 'second', 'millisecond']);
    }
    var ye =
        /[A-Za-z_+-]{1,256}(:?\/[A-Za-z_+-]{1,256}(\/[A-Za-z_+-]{1,256})?)?/;
    function ve(e) {
        return JSON.stringify(e, Object.keys(e).sort());
    }
    var ge = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December',
        ],
        pe = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
        ],
        we = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    function ke(e) {
        switch (e) {
            case 'narrow':
                return we;
            case 'short':
                return pe;
            case 'long':
                return ge;
            case 'numeric':
                return [
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                    '6',
                    '7',
                    '8',
                    '9',
                    '10',
                    '11',
                    '12',
                ];
            case '2-digit':
                return [
                    '01',
                    '02',
                    '03',
                    '04',
                    '05',
                    '06',
                    '07',
                    '08',
                    '09',
                    '10',
                    '11',
                    '12',
                ];
            default:
                return null;
        }
    }
    var be = [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
        ],
        Se = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        Oe = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    function Te(e) {
        switch (e) {
            case 'narrow':
                return Oe;
            case 'short':
                return Se;
            case 'long':
                return be;
            case 'numeric':
                return ['1', '2', '3', '4', '5', '6', '7'];
            default:
                return null;
        }
    }
    var Me = ['AM', 'PM'],
        Ne = ['Before Christ', 'Anno Domini'],
        Ee = ['BC', 'AD'],
        De = ['B', 'A'];
    function Ie(e) {
        switch (e) {
            case 'narrow':
                return De;
            case 'short':
                return Ee;
            case 'long':
                return Ne;
            default:
                return null;
        }
    }
    function Ve(e, t) {
        for (var n, r = '', i = c(e); !(n = i()).done; ) {
            var o = n.value;
            o.literal ? (r += o.val) : (r += t(o.val));
        }
        return r;
    }
    var Le = {
            D: b,
            DD: S,
            DDD: T,
            DDDD: M,
            t: N,
            tt: E,
            ttt: D,
            tttt: I,
            T: V,
            TT: L,
            TTT: x,
            TTTT: F,
            f: C,
            ff: j,
            fff: _,
            ffff: H,
            F: Z,
            FF: A,
            FFF: q,
            FFFF: U,
        },
        xe = (function () {
            function e(e, t) {
                (this.opts = t), (this.loc = e), (this.systemLoc = null);
            }
            (e.create = function (t, n) {
                return void 0 === n && (n = {}), new e(t, n);
            }),
                (e.parseFormat = function (e) {
                    for (
                        var t = null, n = '', r = !1, i = [], o = 0;
                        o < e.length;
                        o++
                    ) {
                        var a = e.charAt(o);
                        "'" === a
                            ? (n.length > 0 && i.push({ literal: r, val: n }),
                              (t = null),
                              (n = ''),
                              (r = !r))
                            : r
                            ? (n += a)
                            : a === t
                            ? (n += a)
                            : (n.length > 0 && i.push({ literal: !1, val: n }),
                              (n = a),
                              (t = a));
                    }
                    return n.length > 0 && i.push({ literal: r, val: n }), i;
                }),
                (e.macroTokenToFormatOpts = function (e) {
                    return Le[e];
                });
            var t = e.prototype;
            return (
                (t.formatWithSystemDefault = function (e, t) {
                    return (
                        null === this.systemLoc &&
                            (this.systemLoc = this.loc.redefaultToSystem()),
                        this.systemLoc
                            .dtFormatter(e, Object.assign({}, this.opts, t))
                            .format()
                    );
                }),
                (t.formatDateTime = function (e, t) {
                    return (
                        void 0 === t && (t = {}),
                        this.loc
                            .dtFormatter(e, Object.assign({}, this.opts, t))
                            .format()
                    );
                }),
                (t.formatDateTimeParts = function (e, t) {
                    return (
                        void 0 === t && (t = {}),
                        this.loc
                            .dtFormatter(e, Object.assign({}, this.opts, t))
                            .formatToParts()
                    );
                }),
                (t.resolvedOptions = function (e, t) {
                    return (
                        void 0 === t && (t = {}),
                        this.loc
                            .dtFormatter(e, Object.assign({}, this.opts, t))
                            .resolvedOptions()
                    );
                }),
                (t.num = function (e, t) {
                    if ((void 0 === t && (t = 0), this.opts.forceSimple))
                        return X(e, t);
                    var n = Object.assign({}, this.opts);
                    return (
                        t > 0 && (n.padTo = t),
                        this.loc.numberFormatter(n).format(e)
                    );
                }),
                (t.formatDateTimeFromString = function (t, n) {
                    var r = this,
                        i = 'en' === this.loc.listingMode(),
                        o =
                            this.loc.outputCalendar &&
                            'gregory' !== this.loc.outputCalendar &&
                            Y(),
                        a = function (e, n) {
                            return r.loc.extract(t, e, n);
                        },
                        u = function (e) {
                            return t.isOffsetFixed && 0 === t.offset && e.allowZ
                                ? 'Z'
                                : t.isValid
                                ? t.zone.formatOffset(t.ts, e.format)
                                : '';
                        },
                        s = function () {
                            return i
                                ? (function (e) {
                                      return Me[e.hour < 12 ? 0 : 1];
                                  })(t)
                                : a(
                                      { hour: 'numeric', hour12: !0 },
                                      'dayperiod'
                                  );
                        },
                        c = function (e, n) {
                            return i
                                ? (function (e, t) {
                                      return ke(t)[e.month - 1];
                                  })(t, e)
                                : a(
                                      n
                                          ? { month: e }
                                          : { month: e, day: 'numeric' },
                                      'month'
                                  );
                        },
                        l = function (e, n) {
                            return i
                                ? (function (e, t) {
                                      return Te(t)[e.weekday - 1];
                                  })(t, e)
                                : a(
                                      n
                                          ? { weekday: e }
                                          : {
                                                weekday: e,
                                                month: 'long',
                                                day: 'numeric',
                                            },
                                      'weekday'
                                  );
                        },
                        f = function (e) {
                            return i
                                ? (function (e, t) {
                                      return Ie(t)[e.year < 0 ? 0 : 1];
                                  })(t, e)
                                : a({ era: e }, 'era');
                        };
                    return Ve(e.parseFormat(n), function (n) {
                        switch (n) {
                            case 'S':
                                return r.num(t.millisecond);
                            case 'u':
                            case 'SSS':
                                return r.num(t.millisecond, 3);
                            case 's':
                                return r.num(t.second);
                            case 'ss':
                                return r.num(t.second, 2);
                            case 'm':
                                return r.num(t.minute);
                            case 'mm':
                                return r.num(t.minute, 2);
                            case 'h':
                                return r.num(
                                    t.hour % 12 == 0 ? 12 : t.hour % 12
                                );
                            case 'hh':
                                return r.num(
                                    t.hour % 12 == 0 ? 12 : t.hour % 12,
                                    2
                                );
                            case 'H':
                                return r.num(t.hour);
                            case 'HH':
                                return r.num(t.hour, 2);
                            case 'Z':
                                return u({
                                    format: 'narrow',
                                    allowZ: r.opts.allowZ,
                                });
                            case 'ZZ':
                                return u({
                                    format: 'short',
                                    allowZ: r.opts.allowZ,
                                });
                            case 'ZZZ':
                                return u({
                                    format: 'techie',
                                    allowZ: r.opts.allowZ,
                                });
                            case 'ZZZZ':
                                return t.zone.offsetName(t.ts, {
                                    format: 'short',
                                    locale: r.loc.locale,
                                });
                            case 'ZZZZZ':
                                return t.zone.offsetName(t.ts, {
                                    format: 'long',
                                    locale: r.loc.locale,
                                });
                            case 'z':
                                return t.zoneName;
                            case 'a':
                                return s();
                            case 'd':
                                return o
                                    ? a({ day: 'numeric' }, 'day')
                                    : r.num(t.day);
                            case 'dd':
                                return o
                                    ? a({ day: '2-digit' }, 'day')
                                    : r.num(t.day, 2);
                            case 'c':
                                return r.num(t.weekday);
                            case 'ccc':
                                return l('short', !0);
                            case 'cccc':
                                return l('long', !0);
                            case 'ccccc':
                                return l('narrow', !0);
                            case 'E':
                                return r.num(t.weekday);
                            case 'EEE':
                                return l('short', !1);
                            case 'EEEE':
                                return l('long', !1);
                            case 'EEEEE':
                                return l('narrow', !1);
                            case 'L':
                                return o
                                    ? a(
                                          { month: 'numeric', day: 'numeric' },
                                          'month'
                                      )
                                    : r.num(t.month);
                            case 'LL':
                                return o
                                    ? a(
                                          { month: '2-digit', day: 'numeric' },
                                          'month'
                                      )
                                    : r.num(t.month, 2);
                            case 'LLL':
                                return c('short', !0);
                            case 'LLLL':
                                return c('long', !0);
                            case 'LLLLL':
                                return c('narrow', !0);
                            case 'M':
                                return o
                                    ? a({ month: 'numeric' }, 'month')
                                    : r.num(t.month);
                            case 'MM':
                                return o
                                    ? a({ month: '2-digit' }, 'month')
                                    : r.num(t.month, 2);
                            case 'MMM':
                                return c('short', !1);
                            case 'MMMM':
                                return c('long', !1);
                            case 'MMMMM':
                                return c('narrow', !1);
                            case 'y':
                                return o
                                    ? a({ year: 'numeric' }, 'year')
                                    : r.num(t.year);
                            case 'yy':
                                return o
                                    ? a({ year: '2-digit' }, 'year')
                                    : r.num(t.year.toString().slice(-2), 2);
                            case 'yyyy':
                                return o
                                    ? a({ year: 'numeric' }, 'year')
                                    : r.num(t.year, 4);
                            case 'yyyyyy':
                                return o
                                    ? a({ year: 'numeric' }, 'year')
                                    : r.num(t.year, 6);
                            case 'G':
                                return f('short');
                            case 'GG':
                                return f('long');
                            case 'GGGGG':
                                return f('narrow');
                            case 'kk':
                                return r.num(
                                    t.weekYear.toString().slice(-2),
                                    2
                                );
                            case 'kkkk':
                                return r.num(t.weekYear, 4);
                            case 'W':
                                return r.num(t.weekNumber);
                            case 'WW':
                                return r.num(t.weekNumber, 2);
                            case 'o':
                                return r.num(t.ordinal);
                            case 'ooo':
                                return r.num(t.ordinal, 3);
                            case 'q':
                                return r.num(t.quarter);
                            case 'qq':
                                return r.num(t.quarter, 2);
                            case 'X':
                                return r.num(Math.floor(t.ts / 1e3));
                            case 'x':
                                return r.num(t.ts);
                            default:
                                return (function (n) {
                                    var i = e.macroTokenToFormatOpts(n);
                                    return i
                                        ? r.formatWithSystemDefault(t, i)
                                        : n;
                                })(n);
                        }
                    });
                }),
                (t.formatDurationFromString = function (t, n) {
                    var r,
                        i = this,
                        o = function (e) {
                            switch (e[0]) {
                                case 'S':
                                    return 'millisecond';
                                case 's':
                                    return 'second';
                                case 'm':
                                    return 'minute';
                                case 'h':
                                    return 'hour';
                                case 'd':
                                    return 'day';
                                case 'M':
                                    return 'month';
                                case 'y':
                                    return 'year';
                                default:
                                    return null;
                            }
                        },
                        a = e.parseFormat(n),
                        u = a.reduce(function (e, t) {
                            var n = t.literal,
                                r = t.val;
                            return n ? e : e.concat(r);
                        }, []),
                        s = t.shiftTo.apply(
                            t,
                            u.map(o).filter(function (e) {
                                return e;
                            })
                        );
                    return Ve(
                        a,
                        ((r = s),
                        function (e) {
                            var t = o(e);
                            return t ? i.num(r.get(t), e.length) : e;
                        })
                    );
                }),
                e
            );
        })(),
        Fe = (function () {
            function e(e, t) {
                (this.reason = e), (this.explanation = t);
            }
            return (
                (e.prototype.toMessage = function () {
                    return this.explanation
                        ? this.reason + ': ' + this.explanation
                        : this.reason;
                }),
                e
            );
        })(),
        Ce = (function () {
            function e() {}
            var t = e.prototype;
            return (
                (t.offsetName = function (e, t) {
                    throw new g();
                }),
                (t.formatOffset = function (e, t) {
                    throw new g();
                }),
                (t.offset = function (e) {
                    throw new g();
                }),
                (t.equals = function (e) {
                    throw new g();
                }),
                n(e, [
                    {
                        key: 'type',
                        get: function () {
                            throw new g();
                        },
                    },
                    {
                        key: 'name',
                        get: function () {
                            throw new g();
                        },
                    },
                    {
                        key: 'universal',
                        get: function () {
                            throw new g();
                        },
                    },
                    {
                        key: 'isValid',
                        get: function () {
                            throw new g();
                        },
                    },
                ]),
                e
            );
        })(),
        Ze = null,
        je = (function (e) {
            function t() {
                return e.apply(this, arguments) || this;
            }
            r(t, e);
            var i = t.prototype;
            return (
                (i.offsetName = function (e, t) {
                    return ce(e, t.format, t.locale);
                }),
                (i.formatOffset = function (e, t) {
                    return he(this.offset(e), t);
                }),
                (i.offset = function (e) {
                    return -new Date(e).getTimezoneOffset();
                }),
                (i.equals = function (e) {
                    return 'local' === e.type;
                }),
                n(
                    t,
                    [
                        {
                            key: 'type',
                            get: function () {
                                return 'local';
                            },
                        },
                        {
                            key: 'name',
                            get: function () {
                                return J()
                                    ? new Intl.DateTimeFormat().resolvedOptions()
                                          .timeZone
                                    : 'local';
                            },
                        },
                        {
                            key: 'universal',
                            get: function () {
                                return !1;
                            },
                        },
                        {
                            key: 'isValid',
                            get: function () {
                                return !0;
                            },
                        },
                    ],
                    [
                        {
                            key: 'instance',
                            get: function () {
                                return null === Ze && (Ze = new t()), Ze;
                            },
                        },
                    ]
                ),
                t
            );
        })(Ce),
        Ae = RegExp('^' + ye.source + '$'),
        ze = {};
    var _e = { year: 0, month: 1, day: 2, hour: 3, minute: 4, second: 5 };
    var qe = {},
        He = (function (e) {
            function t(n) {
                var r;
                return (
                    ((r = e.call(this) || this).zoneName = n),
                    (r.valid = t.isValidZone(n)),
                    r
                );
            }
            r(t, e),
                (t.create = function (e) {
                    return qe[e] || (qe[e] = new t(e)), qe[e];
                }),
                (t.resetCache = function () {
                    (qe = {}), (ze = {});
                }),
                (t.isValidSpecifier = function (e) {
                    return !(!e || !e.match(Ae));
                }),
                (t.isValidZone = function (e) {
                    try {
                        return (
                            new Intl.DateTimeFormat('en-US', {
                                timeZone: e,
                            }).format(),
                            !0
                        );
                    } catch (e) {
                        return !1;
                    }
                }),
                (t.parseGMTOffset = function (e) {
                    if (e) {
                        var t = e.match(/^Etc\/GMT([+-]\d{1,2})$/i);
                        if (t) return -60 * parseInt(t[1]);
                    }
                    return null;
                });
            var i = t.prototype;
            return (
                (i.offsetName = function (e, t) {
                    return ce(e, t.format, t.locale, this.name);
                }),
                (i.formatOffset = function (e, t) {
                    return he(this.offset(e), t);
                }),
                (i.offset = function (e) {
                    var t,
                        n = new Date(e),
                        r =
                            ((t = this.name),
                            ze[t] ||
                                (ze[t] = new Intl.DateTimeFormat('en-US', {
                                    hour12: !1,
                                    timeZone: t,
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                })),
                            ze[t]),
                        i = r.formatToParts
                            ? (function (e, t) {
                                  for (
                                      var n = e.formatToParts(t), r = [], i = 0;
                                      i < n.length;
                                      i++
                                  ) {
                                      var o = n[i],
                                          a = o.type,
                                          u = o.value,
                                          s = _e[a];
                                      R(s) || (r[s] = parseInt(u, 10));
                                  }
                                  return r;
                              })(r, n)
                            : (function (e, t) {
                                  var n = e.format(t).replace(/\u200E/g, ''),
                                      r =
                                          /(\d+)\/(\d+)\/(\d+),? (\d+):(\d+):(\d+)/.exec(
                                              n
                                          ),
                                      i = r[1],
                                      o = r[2];
                                  return [r[3], i, o, r[4], r[5], r[6]];
                              })(r, n),
                        o = i[0],
                        a = i[1],
                        u = i[2],
                        s = i[3],
                        c = i[4],
                        l = i[5],
                        f = +n,
                        d = f % 1e3;
                    return (
                        (ae({
                            year: o,
                            month: a,
                            day: u,
                            hour: 24 === s ? 0 : s,
                            minute: c,
                            second: l,
                            millisecond: 0,
                        }) -
                            (f -= d >= 0 ? d : 1e3 + d)) /
                        6e4
                    );
                }),
                (i.equals = function (e) {
                    return 'iana' === e.type && e.name === this.name;
                }),
                n(t, [
                    {
                        key: 'type',
                        get: function () {
                            return 'iana';
                        },
                    },
                    {
                        key: 'name',
                        get: function () {
                            return this.zoneName;
                        },
                    },
                    {
                        key: 'universal',
                        get: function () {
                            return !1;
                        },
                    },
                    {
                        key: 'isValid',
                        get: function () {
                            return this.valid;
                        },
                    },
                ]),
                t
            );
        })(Ce),
        Ue = null,
        Re = (function (e) {
            function t(t) {
                var n;
                return ((n = e.call(this) || this).fixed = t), n;
            }
            r(t, e),
                (t.instance = function (e) {
                    return 0 === e ? t.utcInstance : new t(e);
                }),
                (t.parseSpecifier = function (e) {
                    if (e) {
                        var n = e.match(
                            /^utc(?:([+-]\d{1,2})(?::(\d{2}))?)?$/i
                        );
                        if (n) return new t(le(n[1], n[2]));
                    }
                    return null;
                }),
                n(t, null, [
                    {
                        key: 'utcInstance',
                        get: function () {
                            return null === Ue && (Ue = new t(0)), Ue;
                        },
                    },
                ]);
            var i = t.prototype;
            return (
                (i.offsetName = function () {
                    return this.name;
                }),
                (i.formatOffset = function (e, t) {
                    return he(this.fixed, t);
                }),
                (i.offset = function () {
                    return this.fixed;
                }),
                (i.equals = function (e) {
                    return 'fixed' === e.type && e.fixed === this.fixed;
                }),
                n(t, [
                    {
                        key: 'type',
                        get: function () {
                            return 'fixed';
                        },
                    },
                    {
                        key: 'name',
                        get: function () {
                            return 0 === this.fixed
                                ? 'UTC'
                                : 'UTC' + he(this.fixed, 'narrow');
                        },
                    },
                    {
                        key: 'universal',
                        get: function () {
                            return !0;
                        },
                    },
                    {
                        key: 'isValid',
                        get: function () {
                            return !0;
                        },
                    },
                ]),
                t
            );
        })(Ce),
        Pe = (function (e) {
            function t(t) {
                var n;
                return ((n = e.call(this) || this).zoneName = t), n;
            }
            r(t, e);
            var i = t.prototype;
            return (
                (i.offsetName = function () {
                    return null;
                }),
                (i.formatOffset = function () {
                    return '';
                }),
                (i.offset = function () {
                    return NaN;
                }),
                (i.equals = function () {
                    return !1;
                }),
                n(t, [
                    {
                        key: 'type',
                        get: function () {
                            return 'invalid';
                        },
                    },
                    {
                        key: 'name',
                        get: function () {
                            return this.zoneName;
                        },
                    },
                    {
                        key: 'universal',
                        get: function () {
                            return !1;
                        },
                    },
                    {
                        key: 'isValid',
                        get: function () {
                            return !1;
                        },
                    },
                ]),
                t
            );
        })(Ce);
    function We(e, t) {
        var n;
        if (R(e) || null === e) return t;
        if (e instanceof Ce) return e;
        if ('string' == typeof e) {
            var r = e.toLowerCase();
            return 'local' === r
                ? t
                : 'utc' === r || 'gmt' === r
                ? Re.utcInstance
                : null != (n = He.parseGMTOffset(e))
                ? Re.instance(n)
                : He.isValidSpecifier(r)
                ? He.create(e)
                : Re.parseSpecifier(r) || new Pe(e);
        }
        return P(e)
            ? Re.instance(e)
            : 'object' == typeof e && e.offset && 'number' == typeof e.offset
            ? e
            : new Pe(e);
    }
    var Je = function () {
            return Date.now();
        },
        Ye = null,
        Ge = null,
        $e = null,
        Be = null,
        Qe = !1,
        Ke = (function () {
            function e() {}
            return (
                (e.resetCaches = function () {
                    ct.resetCache(), He.resetCache();
                }),
                n(e, null, [
                    {
                        key: 'now',
                        get: function () {
                            return Je;
                        },
                        set: function (e) {
                            Je = e;
                        },
                    },
                    {
                        key: 'defaultZoneName',
                        get: function () {
                            return e.defaultZone.name;
                        },
                        set: function (e) {
                            Ye = e ? We(e) : null;
                        },
                    },
                    {
                        key: 'defaultZone',
                        get: function () {
                            return Ye || je.instance;
                        },
                    },
                    {
                        key: 'defaultLocale',
                        get: function () {
                            return Ge;
                        },
                        set: function (e) {
                            Ge = e;
                        },
                    },
                    {
                        key: 'defaultNumberingSystem',
                        get: function () {
                            return $e;
                        },
                        set: function (e) {
                            $e = e;
                        },
                    },
                    {
                        key: 'defaultOutputCalendar',
                        get: function () {
                            return Be;
                        },
                        set: function (e) {
                            Be = e;
                        },
                    },
                    {
                        key: 'throwOnInvalid',
                        get: function () {
                            return Qe;
                        },
                        set: function (e) {
                            Qe = e;
                        },
                    },
                ]),
                e
            );
        })(),
        Xe = {};
    function et(e, t) {
        void 0 === t && (t = {});
        var n = JSON.stringify([e, t]),
            r = Xe[n];
        return r || ((r = new Intl.DateTimeFormat(e, t)), (Xe[n] = r)), r;
    }
    var tt = {};
    var nt = {};
    function rt(e, t) {
        void 0 === t && (t = {});
        var n = t,
            r =
                (n.base,
                (function (e, t) {
                    if (null == e) return {};
                    var n,
                        r,
                        i = {},
                        o = Object.keys(e);
                    for (r = 0; r < o.length; r++)
                        (n = o[r]), t.indexOf(n) >= 0 || (i[n] = e[n]);
                    return i;
                })(n, ['base'])),
            i = JSON.stringify([e, r]),
            o = nt[i];
        return o || ((o = new Intl.RelativeTimeFormat(e, t)), (nt[i] = o)), o;
    }
    var it = null;
    function ot(e, t, n, r, i) {
        var o = e.listingMode(n);
        return 'error' === o ? null : 'en' === o ? r(t) : i(t);
    }
    var at = (function () {
            function e(e, t, n) {
                if (
                    ((this.padTo = n.padTo || 0),
                    (this.floor = n.floor || !1),
                    !t && J())
                ) {
                    var r = { useGrouping: !1 };
                    n.padTo > 0 && (r.minimumIntegerDigits = n.padTo),
                        (this.inf = (function (e, t) {
                            void 0 === t && (t = {});
                            var n = JSON.stringify([e, t]),
                                r = tt[n];
                            return (
                                r ||
                                    ((r = new Intl.NumberFormat(e, t)),
                                    (tt[n] = r)),
                                r
                            );
                        })(e, r));
                }
            }
            return (
                (e.prototype.format = function (e) {
                    if (this.inf) {
                        var t = this.floor ? Math.floor(e) : e;
                        return this.inf.format(t);
                    }
                    return X(this.floor ? Math.floor(e) : ne(e, 3), this.padTo);
                }),
                e
            );
        })(),
        ut = (function () {
            function e(e, t, n) {
                var r;
                if (
                    ((this.opts = n),
                    (this.hasIntl = J()),
                    e.zone.universal && this.hasIntl)
                ) {
                    var i = (e.offset / 60) * -1;
                    i >= -14 && i <= 12 && i % 1 == 0
                        ? ((r = i >= 0 ? 'Etc/GMT+' + i : 'Etc/GMT' + i),
                          (this.dt = e))
                        : ((r = 'UTC'),
                          n.timeZoneName
                              ? (this.dt = e)
                              : (this.dt =
                                    0 === e.offset
                                        ? e
                                        : sr.fromMillis(
                                              e.ts + 60 * e.offset * 1e3
                                          )));
                } else
                    'local' === e.zone.type
                        ? (this.dt = e)
                        : ((this.dt = e), (r = e.zone.name));
                if (this.hasIntl) {
                    var o = Object.assign({}, this.opts);
                    r && (o.timeZone = r), (this.dtf = et(t, o));
                }
            }
            var t = e.prototype;
            return (
                (t.format = function () {
                    if (this.hasIntl)
                        return this.dtf.format(this.dt.toJSDate());
                    var e = (function (e) {
                            switch (
                                ve(
                                    B(e, [
                                        'weekday',
                                        'era',
                                        'year',
                                        'month',
                                        'day',
                                        'hour',
                                        'minute',
                                        'second',
                                        'timeZoneName',
                                        'hour12',
                                    ])
                                )
                            ) {
                                case ve(b):
                                    return 'M/d/yyyy';
                                case ve(S):
                                    return 'LLL d, yyyy';
                                case ve(O):
                                    return 'EEE, LLL d, yyyy';
                                case ve(T):
                                    return 'LLLL d, yyyy';
                                case ve(M):
                                    return 'EEEE, LLLL d, yyyy';
                                case ve(N):
                                    return 'h:mm a';
                                case ve(E):
                                    return 'h:mm:ss a';
                                case ve(D):
                                case ve(I):
                                    return 'h:mm a';
                                case ve(V):
                                    return 'HH:mm';
                                case ve(L):
                                    return 'HH:mm:ss';
                                case ve(x):
                                case ve(F):
                                    return 'HH:mm';
                                case ve(C):
                                    return 'M/d/yyyy, h:mm a';
                                case ve(j):
                                    return 'LLL d, yyyy, h:mm a';
                                case ve(_):
                                    return 'LLLL d, yyyy, h:mm a';
                                case ve(H):
                                    return 'EEEE, LLLL d, yyyy, h:mm a';
                                case ve(Z):
                                    return 'M/d/yyyy, h:mm:ss a';
                                case ve(A):
                                    return 'LLL d, yyyy, h:mm:ss a';
                                case ve(z):
                                    return 'EEE, d LLL yyyy, h:mm a';
                                case ve(q):
                                    return 'LLLL d, yyyy, h:mm:ss a';
                                case ve(U):
                                    return 'EEEE, LLLL d, yyyy, h:mm:ss a';
                                default:
                                    return 'EEEE, LLLL d, yyyy, h:mm a';
                            }
                        })(this.opts),
                        t = ct.create('en-US');
                    return xe.create(t).formatDateTimeFromString(this.dt, e);
                }),
                (t.formatToParts = function () {
                    return this.hasIntl && Y()
                        ? this.dtf.formatToParts(this.dt.toJSDate())
                        : [];
                }),
                (t.resolvedOptions = function () {
                    return this.hasIntl
                        ? this.dtf.resolvedOptions()
                        : {
                              locale: 'en-US',
                              numberingSystem: 'latn',
                              outputCalendar: 'gregory',
                          };
                }),
                e
            );
        })(),
        st = (function () {
            function e(e, t, n) {
                (this.opts = Object.assign({ style: 'long' }, n)),
                    !t && G() && (this.rtf = rt(e, n));
            }
            var t = e.prototype;
            return (
                (t.format = function (e, t) {
                    return this.rtf
                        ? this.rtf.format(e, t)
                        : (function (e, t, n, r) {
                              void 0 === n && (n = 'always'),
                                  void 0 === r && (r = !1);
                              var i = {
                                      years: ['year', 'yr.'],
                                      quarters: ['quarter', 'qtr.'],
                                      months: ['month', 'mo.'],
                                      weeks: ['week', 'wk.'],
                                      days: ['day', 'day', 'days'],
                                      hours: ['hour', 'hr.'],
                                      minutes: ['minute', 'min.'],
                                      seconds: ['second', 'sec.'],
                                  },
                                  o =
                                      -1 ===
                                      ['hours', 'minutes', 'seconds'].indexOf(
                                          e
                                      );
                              if ('auto' === n && o) {
                                  var a = 'days' === e;
                                  switch (t) {
                                      case 1:
                                          return a
                                              ? 'tomorrow'
                                              : 'next ' + i[e][0];
                                      case -1:
                                          return a
                                              ? 'yesterday'
                                              : 'last ' + i[e][0];
                                      case 0:
                                          return a
                                              ? 'today'
                                              : 'this ' + i[e][0];
                                  }
                              }
                              var u = Object.is(t, -0) || t < 0,
                                  s = Math.abs(t),
                                  c = 1 === s,
                                  l = i[e],
                                  f = r
                                      ? c
                                          ? l[1]
                                          : l[2] || l[1]
                                      : c
                                      ? i[e][0]
                                      : e;
                              return u
                                  ? s + ' ' + f + ' ago'
                                  : 'in ' + s + ' ' + f;
                          })(
                              t,
                              e,
                              this.opts.numeric,
                              'long' !== this.opts.style
                          );
                }),
                (t.formatToParts = function (e, t) {
                    return this.rtf ? this.rtf.formatToParts(e, t) : [];
                }),
                e
            );
        })(),
        ct = (function () {
            function e(e, t, n, r) {
                var i = (function (e) {
                        var t = e.indexOf('-u-');
                        if (-1 === t) return [e];
                        var n,
                            r = e.substring(0, t);
                        try {
                            n = et(e).resolvedOptions();
                        } catch (e) {
                            n = et(r).resolvedOptions();
                        }
                        var i = n;
                        return [r, i.numberingSystem, i.calendar];
                    })(e),
                    o = i[0],
                    a = i[1],
                    u = i[2];
                (this.locale = o),
                    (this.numberingSystem = t || a || null),
                    (this.outputCalendar = n || u || null),
                    (this.intl = (function (e, t, n) {
                        return J()
                            ? n || t
                                ? ((e += '-u'),
                                  n && (e += '-ca-' + n),
                                  t && (e += '-nu-' + t),
                                  e)
                                : e
                            : [];
                    })(this.locale, this.numberingSystem, this.outputCalendar)),
                    (this.weekdaysCache = { format: {}, standalone: {} }),
                    (this.monthsCache = { format: {}, standalone: {} }),
                    (this.meridiemCache = null),
                    (this.eraCache = {}),
                    (this.specifiedLocale = r),
                    (this.fastNumbersCached = null);
            }
            (e.fromOpts = function (t) {
                return e.create(
                    t.locale,
                    t.numberingSystem,
                    t.outputCalendar,
                    t.defaultToEN
                );
            }),
                (e.create = function (t, n, r, i) {
                    void 0 === i && (i = !1);
                    var o = t || Ke.defaultLocale;
                    return new e(
                        o ||
                            (i
                                ? 'en-US'
                                : (function () {
                                      if (it) return it;
                                      if (J()) {
                                          var e =
                                              new Intl.DateTimeFormat().resolvedOptions()
                                                  .locale;
                                          return (it =
                                              e && 'und' !== e ? e : 'en-US');
                                      }
                                      return (it = 'en-US');
                                  })()),
                        n || Ke.defaultNumberingSystem,
                        r || Ke.defaultOutputCalendar,
                        o
                    );
                }),
                (e.resetCache = function () {
                    (it = null), (Xe = {}), (tt = {}), (nt = {});
                }),
                (e.fromObject = function (t) {
                    var n = void 0 === t ? {} : t,
                        r = n.locale,
                        i = n.numberingSystem,
                        o = n.outputCalendar;
                    return e.create(r, i, o);
                });
            var t = e.prototype;
            return (
                (t.listingMode = function (e) {
                    void 0 === e && (e = !0);
                    var t = J() && Y(),
                        n = this.isEnglish(),
                        r = !(
                            (null !== this.numberingSystem &&
                                'latn' !== this.numberingSystem) ||
                            (null !== this.outputCalendar &&
                                'gregory' !== this.outputCalendar)
                        );
                    return t || (n && r) || e
                        ? !t || (n && r)
                            ? 'en'
                            : 'intl'
                        : 'error';
                }),
                (t.clone = function (t) {
                    return t && 0 !== Object.getOwnPropertyNames(t).length
                        ? e.create(
                              t.locale || this.specifiedLocale,
                              t.numberingSystem || this.numberingSystem,
                              t.outputCalendar || this.outputCalendar,
                              t.defaultToEN || !1
                          )
                        : this;
                }),
                (t.redefaultToEN = function (e) {
                    return (
                        void 0 === e && (e = {}),
                        this.clone(Object.assign({}, e, { defaultToEN: !0 }))
                    );
                }),
                (t.redefaultToSystem = function (e) {
                    return (
                        void 0 === e && (e = {}),
                        this.clone(Object.assign({}, e, { defaultToEN: !1 }))
                    );
                }),
                (t.months = function (e, t, n) {
                    var r = this;
                    return (
                        void 0 === t && (t = !1),
                        void 0 === n && (n = !0),
                        ot(this, e, n, ke, function () {
                            var n = t
                                    ? { month: e, day: 'numeric' }
                                    : { month: e },
                                i = t ? 'format' : 'standalone';
                            return (
                                r.monthsCache[i][e] ||
                                    (r.monthsCache[i][e] = (function (e) {
                                        for (var t = [], n = 1; n <= 12; n++) {
                                            var r = sr.utc(2016, n, 1);
                                            t.push(e(r));
                                        }
                                        return t;
                                    })(function (e) {
                                        return r.extract(e, n, 'month');
                                    })),
                                r.monthsCache[i][e]
                            );
                        })
                    );
                }),
                (t.weekdays = function (e, t, n) {
                    var r = this;
                    return (
                        void 0 === t && (t = !1),
                        void 0 === n && (n = !0),
                        ot(this, e, n, Te, function () {
                            var n = t
                                    ? {
                                          weekday: e,
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric',
                                      }
                                    : { weekday: e },
                                i = t ? 'format' : 'standalone';
                            return (
                                r.weekdaysCache[i][e] ||
                                    (r.weekdaysCache[i][e] = (function (e) {
                                        for (var t = [], n = 1; n <= 7; n++) {
                                            var r = sr.utc(2016, 11, 13 + n);
                                            t.push(e(r));
                                        }
                                        return t;
                                    })(function (e) {
                                        return r.extract(e, n, 'weekday');
                                    })),
                                r.weekdaysCache[i][e]
                            );
                        })
                    );
                }),
                (t.meridiems = function (e) {
                    var t = this;
                    return (
                        void 0 === e && (e = !0),
                        ot(
                            this,
                            void 0,
                            e,
                            function () {
                                return Me;
                            },
                            function () {
                                if (!t.meridiemCache) {
                                    var e = { hour: 'numeric', hour12: !0 };
                                    t.meridiemCache = [
                                        sr.utc(2016, 11, 13, 9),
                                        sr.utc(2016, 11, 13, 19),
                                    ].map(function (n) {
                                        return t.extract(n, e, 'dayperiod');
                                    });
                                }
                                return t.meridiemCache;
                            }
                        )
                    );
                }),
                (t.eras = function (e, t) {
                    var n = this;
                    return (
                        void 0 === t && (t = !0),
                        ot(this, e, t, Ie, function () {
                            var t = { era: e };
                            return (
                                n.eraCache[e] ||
                                    (n.eraCache[e] = [
                                        sr.utc(-40, 1, 1),
                                        sr.utc(2017, 1, 1),
                                    ].map(function (e) {
                                        return n.extract(e, t, 'era');
                                    })),
                                n.eraCache[e]
                            );
                        })
                    );
                }),
                (t.extract = function (e, t, n) {
                    var r = this.dtFormatter(e, t)
                        .formatToParts()
                        .find(function (e) {
                            return e.type.toLowerCase() === n;
                        });
                    return r ? r.value : null;
                }),
                (t.numberFormatter = function (e) {
                    return (
                        void 0 === e && (e = {}),
                        new at(this.intl, e.forceSimple || this.fastNumbers, e)
                    );
                }),
                (t.dtFormatter = function (e, t) {
                    return void 0 === t && (t = {}), new ut(e, this.intl, t);
                }),
                (t.relFormatter = function (e) {
                    return (
                        void 0 === e && (e = {}),
                        new st(this.intl, this.isEnglish(), e)
                    );
                }),
                (t.isEnglish = function () {
                    return (
                        'en' === this.locale ||
                        'en-us' === this.locale.toLowerCase() ||
                        (J() &&
                            new Intl.DateTimeFormat(this.intl)
                                .resolvedOptions()
                                .locale.startsWith('en-us'))
                    );
                }),
                (t.equals = function (e) {
                    return (
                        this.locale === e.locale &&
                        this.numberingSystem === e.numberingSystem &&
                        this.outputCalendar === e.outputCalendar
                    );
                }),
                n(e, [
                    {
                        key: 'fastNumbers',
                        get: function () {
                            var e;
                            return (
                                null == this.fastNumbersCached &&
                                    (this.fastNumbersCached =
                                        (!(e = this).numberingSystem ||
                                            'latn' === e.numberingSystem) &&
                                        ('latn' === e.numberingSystem ||
                                            !e.locale ||
                                            e.locale.startsWith('en') ||
                                            (J() &&
                                                'latn' ===
                                                    new Intl.DateTimeFormat(
                                                        e.intl
                                                    ).resolvedOptions()
                                                        .numberingSystem))),
                                this.fastNumbersCached
                            );
                        },
                    },
                ]),
                e
            );
        })();
    function lt() {
        for (var e = arguments.length, t = new Array(e), n = 0; n < e; n++)
            t[n] = arguments[n];
        var r = t.reduce(function (e, t) {
            return e + t.source;
        }, '');
        return RegExp('^' + r + '$');
    }
    function ft() {
        for (var e = arguments.length, t = new Array(e), n = 0; n < e; n++)
            t[n] = arguments[n];
        return function (e) {
            return t
                .reduce(
                    function (t, n) {
                        var r = t[0],
                            i = t[1],
                            o = t[2],
                            a = n(e, o),
                            u = a[0],
                            s = a[1],
                            c = a[2];
                        return [Object.assign(r, u), i || s, c];
                    },
                    [{}, null, 1]
                )
                .slice(0, 2);
        };
    }
    function dt(e) {
        if (null == e) return [null, null];
        for (
            var t = arguments.length, n = new Array(t > 1 ? t - 1 : 0), r = 1;
            r < t;
            r++
        )
            n[r - 1] = arguments[r];
        for (var i = 0, o = n; i < o.length; i++) {
            var a = o[i],
                u = a[0],
                s = a[1],
                c = u.exec(e);
            if (c) return s(c);
        }
        return [null, null];
    }
    function ht() {
        for (var e = arguments.length, t = new Array(e), n = 0; n < e; n++)
            t[n] = arguments[n];
        return function (e, n) {
            var r,
                i = {};
            for (r = 0; r < t.length; r++) i[t[r]] = ee(e[n + r]);
            return [i, null, n + r];
        };
    }
    var mt = /(?:(Z)|([+-]\d\d)(?::?(\d\d))?)/,
        yt = /(\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d{1,30}))?)?)?/,
        vt = RegExp('' + yt.source + mt.source + '?'),
        gt = RegExp('(?:T' + vt.source + ')?'),
        pt = ht('weekYear', 'weekNumber', 'weekDay'),
        wt = ht('year', 'ordinal'),
        kt = RegExp(yt.source + ' ?(?:' + mt.source + '|(' + ye.source + '))?'),
        bt = RegExp('(?: ' + kt.source + ')?');
    function St(e, t, n) {
        var r = e[t];
        return R(r) ? n : ee(r);
    }
    function Ot(e, t) {
        return [
            { year: St(e, t), month: St(e, t + 1, 1), day: St(e, t + 2, 1) },
            null,
            t + 3,
        ];
    }
    function Tt(e, t) {
        return [
            {
                hours: St(e, t, 0),
                minutes: St(e, t + 1, 0),
                seconds: St(e, t + 2, 0),
                milliseconds: te(e[t + 3]),
            },
            null,
            t + 4,
        ];
    }
    function Mt(e, t) {
        var n = !e[t] && !e[t + 1],
            r = le(e[t + 1], e[t + 2]);
        return [{}, n ? null : Re.instance(r), t + 3];
    }
    function Nt(e, t) {
        return [{}, e[t] ? He.create(e[t]) : null, t + 1];
    }
    var Et = RegExp('^T?' + yt.source + '$'),
        Dt =
            /^-?P(?:(?:(-?\d{1,9})Y)?(?:(-?\d{1,9})M)?(?:(-?\d{1,9})W)?(?:(-?\d{1,9})D)?(?:T(?:(-?\d{1,9})H)?(?:(-?\d{1,9})M)?(?:(-?\d{1,20})(?:[.,](-?\d{1,9}))?S)?)?)$/;
    function It(e) {
        var t = e[0],
            n = e[1],
            r = e[2],
            i = e[3],
            o = e[4],
            a = e[5],
            u = e[6],
            s = e[7],
            c = e[8],
            l = '-' === t[0],
            f = function (e) {
                return e && l ? -e : e;
            };
        return [
            {
                years: f(ee(n)),
                months: f(ee(r)),
                weeks: f(ee(i)),
                days: f(ee(o)),
                hours: f(ee(a)),
                minutes: f(ee(u)),
                seconds: f(ee(s)),
                milliseconds: f(te(c)),
            },
        ];
    }
    var Vt = {
        GMT: 0,
        EDT: -240,
        EST: -300,
        CDT: -300,
        CST: -360,
        MDT: -360,
        MST: -420,
        PDT: -420,
        PST: -480,
    };
    function Lt(e, t, n, r, i, o, a) {
        var u = {
            year: 2 === t.length ? se(ee(t)) : ee(t),
            month: pe.indexOf(n) + 1,
            day: ee(r),
            hour: ee(i),
            minute: ee(o),
        };
        return (
            a && (u.second = ee(a)),
            e &&
                (u.weekday =
                    e.length > 3 ? be.indexOf(e) + 1 : Se.indexOf(e) + 1),
            u
        );
    }
    var xt =
        /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|(?:([+-]\d\d)(\d\d)))$/;
    function Ft(e) {
        var t,
            n = e[1],
            r = e[2],
            i = e[3],
            o = e[4],
            a = e[5],
            u = e[6],
            s = e[7],
            c = e[8],
            l = e[9],
            f = e[10],
            d = e[11],
            h = Lt(n, o, i, r, a, u, s);
        return (t = c ? Vt[c] : l ? 0 : le(f, d)), [h, new Re(t)];
    }
    var Ct =
            /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d\d) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d\d):(\d\d):(\d\d) GMT$/,
        Zt =
            /^(Monday|Tuesday|Wedsday|Thursday|Friday|Saturday|Sunday), (\d\d)-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d\d) (\d\d):(\d\d):(\d\d) GMT$/,
        jt =
            /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( \d|\d\d) (\d\d):(\d\d):(\d\d) (\d{4})$/;
    function At(e) {
        var t = e[1],
            n = e[2],
            r = e[3];
        return [Lt(t, e[4], r, n, e[5], e[6], e[7]), Re.utcInstance];
    }
    function zt(e) {
        var t = e[1],
            n = e[2],
            r = e[3],
            i = e[4],
            o = e[5],
            a = e[6];
        return [Lt(t, e[7], n, r, i, o, a), Re.utcInstance];
    }
    var _t = lt(/([+-]\d{6}|\d{4})(?:-?(\d\d)(?:-?(\d\d))?)?/, gt),
        qt = lt(/(\d{4})-?W(\d\d)(?:-?(\d))?/, gt),
        Ht = lt(/(\d{4})-?(\d{3})/, gt),
        Ut = lt(vt),
        Rt = ft(Ot, Tt, Mt),
        Pt = ft(pt, Tt, Mt),
        Wt = ft(wt, Tt),
        Jt = ft(Tt, Mt);
    var Yt = ft(Tt);
    var Gt = lt(/(\d{4})-(\d\d)-(\d\d)/, bt),
        $t = lt(kt),
        Bt = ft(Ot, Tt, Mt, Nt),
        Qt = ft(Tt, Mt, Nt);
    var Kt = {
            weeks: {
                days: 7,
                hours: 168,
                minutes: 10080,
                seconds: 604800,
                milliseconds: 6048e5,
            },
            days: {
                hours: 24,
                minutes: 1440,
                seconds: 86400,
                milliseconds: 864e5,
            },
            hours: { minutes: 60, seconds: 3600, milliseconds: 36e5 },
            minutes: { seconds: 60, milliseconds: 6e4 },
            seconds: { milliseconds: 1e3 },
        },
        Xt = Object.assign(
            {
                years: {
                    quarters: 4,
                    months: 12,
                    weeks: 52,
                    days: 365,
                    hours: 8760,
                    minutes: 525600,
                    seconds: 31536e3,
                    milliseconds: 31536e6,
                },
                quarters: {
                    months: 3,
                    weeks: 13,
                    days: 91,
                    hours: 2184,
                    minutes: 131040,
                    seconds: 7862400,
                    milliseconds: 78624e5,
                },
                months: {
                    weeks: 4,
                    days: 30,
                    hours: 720,
                    minutes: 43200,
                    seconds: 2592e3,
                    milliseconds: 2592e6,
                },
            },
            Kt
        ),
        en = Object.assign(
            {
                years: {
                    quarters: 4,
                    months: 12,
                    weeks: 52.1775,
                    days: 365.2425,
                    hours: 8765.82,
                    minutes: 525949.2,
                    seconds: 525949.2 * 60,
                    milliseconds: 525949.2 * 60 * 1e3,
                },
                quarters: {
                    months: 3,
                    weeks: 13.044375,
                    days: 91.310625,
                    hours: 2191.455,
                    minutes: 131487.3,
                    seconds: (525949.2 * 60) / 4,
                    milliseconds: 7889237999.999999,
                },
                months: {
                    weeks: 30.436875 / 7,
                    days: 30.436875,
                    hours: 730.485,
                    minutes: 43829.1,
                    seconds: 2629746,
                    milliseconds: 2629746e3,
                },
            },
            Kt
        ),
        tn = [
            'years',
            'quarters',
            'months',
            'weeks',
            'days',
            'hours',
            'minutes',
            'seconds',
            'milliseconds',
        ],
        nn = tn.slice(0).reverse();
    function rn(e, t, n) {
        void 0 === n && (n = !1);
        var r = {
            values: n ? t.values : Object.assign({}, e.values, t.values || {}),
            loc: e.loc.clone(t.loc),
            conversionAccuracy: t.conversionAccuracy || e.conversionAccuracy,
        };
        return new an(r);
    }
    function on(e, t, n, r, i) {
        var o,
            a = e[i][n],
            u = t[n] / a,
            s =
                !(Math.sign(u) === Math.sign(r[i])) &&
                0 !== r[i] &&
                Math.abs(u) <= 1
                    ? (o = u) < 0
                        ? Math.floor(o)
                        : Math.ceil(o)
                    : Math.trunc(u);
        (r[i] += s), (t[n] -= s * a);
    }
    var an = (function () {
        function e(e) {
            var t = 'longterm' === e.conversionAccuracy || !1;
            (this.values = e.values),
                (this.loc = e.loc || ct.create()),
                (this.conversionAccuracy = t ? 'longterm' : 'casual'),
                (this.invalid = e.invalid || null),
                (this.matrix = t ? en : Xt),
                (this.isLuxonDuration = !0);
        }
        (e.fromMillis = function (t, n) {
            return e.fromObject(Object.assign({ milliseconds: t }, n));
        }),
            (e.fromObject = function (t) {
                if (null == t || 'object' != typeof t)
                    throw new v(
                        'Duration.fromObject: argument expected to be an object, got ' +
                            (null === t ? 'null' : typeof t)
                    );
                return new e({
                    values: de(t, e.normalizeUnit, [
                        'locale',
                        'numberingSystem',
                        'conversionAccuracy',
                        'zone',
                    ]),
                    loc: ct.fromObject(t),
                    conversionAccuracy: t.conversionAccuracy,
                });
            }),
            (e.fromISO = function (t, n) {
                var r = dt(t, [Dt, It])[0];
                if (r) {
                    var i = Object.assign(r, n);
                    return e.fromObject(i);
                }
                return e.invalid(
                    'unparsable',
                    'the input "' + t + '" can\'t be parsed as ISO 8601'
                );
            }),
            (e.fromISOTime = function (t, n) {
                var r = dt(t, [Et, Yt])[0];
                if (r) {
                    var i = Object.assign(r, n);
                    return e.fromObject(i);
                }
                return e.invalid(
                    'unparsable',
                    'the input "' + t + '" can\'t be parsed as ISO 8601'
                );
            }),
            (e.invalid = function (t, n) {
                if ((void 0 === n && (n = null), !t))
                    throw new v(
                        'need to specify a reason the Duration is invalid'
                    );
                var r = t instanceof Fe ? t : new Fe(t, n);
                if (Ke.throwOnInvalid) throw new h(r);
                return new e({ invalid: r });
            }),
            (e.normalizeUnit = function (e) {
                var t = {
                    year: 'years',
                    years: 'years',
                    quarter: 'quarters',
                    quarters: 'quarters',
                    month: 'months',
                    months: 'months',
                    week: 'weeks',
                    weeks: 'weeks',
                    day: 'days',
                    days: 'days',
                    hour: 'hours',
                    hours: 'hours',
                    minute: 'minutes',
                    minutes: 'minutes',
                    second: 'seconds',
                    seconds: 'seconds',
                    millisecond: 'milliseconds',
                    milliseconds: 'milliseconds',
                }[e ? e.toLowerCase() : e];
                if (!t) throw new y(e);
                return t;
            }),
            (e.isDuration = function (e) {
                return (e && e.isLuxonDuration) || !1;
            });
        var t = e.prototype;
        return (
            (t.toFormat = function (e, t) {
                void 0 === t && (t = {});
                var n = Object.assign({}, t, {
                    floor: !1 !== t.round && !1 !== t.floor,
                });
                return this.isValid
                    ? xe.create(this.loc, n).formatDurationFromString(this, e)
                    : 'Invalid Duration';
            }),
            (t.toObject = function (e) {
                if ((void 0 === e && (e = {}), !this.isValid)) return {};
                var t = Object.assign({}, this.values);
                return (
                    e.includeConfig &&
                        ((t.conversionAccuracy = this.conversionAccuracy),
                        (t.numberingSystem = this.loc.numberingSystem),
                        (t.locale = this.loc.locale)),
                    t
                );
            }),
            (t.toISO = function () {
                if (!this.isValid) return null;
                var e = 'P';
                return (
                    0 !== this.years && (e += this.years + 'Y'),
                    (0 === this.months && 0 === this.quarters) ||
                        (e += this.months + 3 * this.quarters + 'M'),
                    0 !== this.weeks && (e += this.weeks + 'W'),
                    0 !== this.days && (e += this.days + 'D'),
                    (0 === this.hours &&
                        0 === this.minutes &&
                        0 === this.seconds &&
                        0 === this.milliseconds) ||
                        (e += 'T'),
                    0 !== this.hours && (e += this.hours + 'H'),
                    0 !== this.minutes && (e += this.minutes + 'M'),
                    (0 === this.seconds && 0 === this.milliseconds) ||
                        (e +=
                            ne(this.seconds + this.milliseconds / 1e3, 3) +
                            'S'),
                    'P' === e && (e += 'T0S'),
                    e
                );
            }),
            (t.toISOTime = function (e) {
                if ((void 0 === e && (e = {}), !this.isValid)) return null;
                var t = this.toMillis();
                if (t < 0 || t >= 864e5) return null;
                e = Object.assign(
                    {
                        suppressMilliseconds: !1,
                        suppressSeconds: !1,
                        includePrefix: !1,
                        format: 'extended',
                    },
                    e
                );
                var n = this.shiftTo(
                        'hours',
                        'minutes',
                        'seconds',
                        'milliseconds'
                    ),
                    r = 'basic' === e.format ? 'hhmm' : 'hh:mm';
                (e.suppressSeconds &&
                    0 === n.seconds &&
                    0 === n.milliseconds) ||
                    ((r += 'basic' === e.format ? 'ss' : ':ss'),
                    (e.suppressMilliseconds && 0 === n.milliseconds) ||
                        (r += '.SSS'));
                var i = n.toFormat(r);
                return e.includePrefix && (i = 'T' + i), i;
            }),
            (t.toJSON = function () {
                return this.toISO();
            }),
            (t.toString = function () {
                return this.toISO();
            }),
            (t.toMillis = function () {
                return this.as('milliseconds');
            }),
            (t.valueOf = function () {
                return this.toMillis();
            }),
            (t.plus = function (e) {
                if (!this.isValid) return this;
                for (var t, n = un(e), r = {}, i = c(tn); !(t = i()).done; ) {
                    var o = t.value;
                    (Q(n.values, o) || Q(this.values, o)) &&
                        (r[o] = n.get(o) + this.get(o));
                }
                return rn(this, { values: r }, !0);
            }),
            (t.minus = function (e) {
                if (!this.isValid) return this;
                var t = un(e);
                return this.plus(t.negate());
            }),
            (t.mapUnits = function (e) {
                if (!this.isValid) return this;
                for (
                    var t = {}, n = 0, r = Object.keys(this.values);
                    n < r.length;
                    n++
                ) {
                    var i = r[n];
                    t[i] = fe(e(this.values[i], i));
                }
                return rn(this, { values: t }, !0);
            }),
            (t.get = function (t) {
                return this[e.normalizeUnit(t)];
            }),
            (t.set = function (t) {
                return this.isValid
                    ? rn(this, {
                          values: Object.assign(
                              this.values,
                              de(t, e.normalizeUnit, [])
                          ),
                      })
                    : this;
            }),
            (t.reconfigure = function (e) {
                var t = void 0 === e ? {} : e,
                    n = t.locale,
                    r = t.numberingSystem,
                    i = t.conversionAccuracy,
                    o = {
                        loc: this.loc.clone({ locale: n, numberingSystem: r }),
                    };
                return i && (o.conversionAccuracy = i), rn(this, o);
            }),
            (t.as = function (e) {
                return this.isValid ? this.shiftTo(e).get(e) : NaN;
            }),
            (t.normalize = function () {
                if (!this.isValid) return this;
                var e = this.toObject();
                return (
                    (function (e, t) {
                        nn.reduce(function (n, r) {
                            return R(t[r]) ? n : (n && on(e, t, n, t, r), r);
                        }, null);
                    })(this.matrix, e),
                    rn(this, { values: e }, !0)
                );
            }),
            (t.shiftTo = function () {
                for (
                    var t = arguments.length, n = new Array(t), r = 0;
                    r < t;
                    r++
                )
                    n[r] = arguments[r];
                if (!this.isValid) return this;
                if (0 === n.length) return this;
                n = n.map(function (t) {
                    return e.normalizeUnit(t);
                });
                for (
                    var i, o, a = {}, u = {}, s = this.toObject(), l = c(tn);
                    !(o = l()).done;

                ) {
                    var f = o.value;
                    if (n.indexOf(f) >= 0) {
                        i = f;
                        var d = 0;
                        for (var h in u)
                            (d += this.matrix[h][f] * u[h]), (u[h] = 0);
                        P(s[f]) && (d += s[f]);
                        var m = Math.trunc(d);
                        for (var y in ((a[f] = m), (u[f] = d - m), s))
                            tn.indexOf(y) > tn.indexOf(f) &&
                                on(this.matrix, s, y, a, f);
                    } else P(s[f]) && (u[f] = s[f]);
                }
                for (var v in u)
                    0 !== u[v] &&
                        (a[i] += v === i ? u[v] : u[v] / this.matrix[i][v]);
                return rn(this, { values: a }, !0).normalize();
            }),
            (t.negate = function () {
                if (!this.isValid) return this;
                for (
                    var e = {}, t = 0, n = Object.keys(this.values);
                    t < n.length;
                    t++
                ) {
                    var r = n[t];
                    e[r] = -this.values[r];
                }
                return rn(this, { values: e }, !0);
            }),
            (t.equals = function (e) {
                if (!this.isValid || !e.isValid) return !1;
                if (!this.loc.equals(e.loc)) return !1;
                for (var t, n = c(tn); !(t = n()).done; ) {
                    var r = t.value;
                    if (
                        ((i = this.values[r]),
                        (o = e.values[r]),
                        !(void 0 === i || 0 === i
                            ? void 0 === o || 0 === o
                            : i === o))
                    )
                        return !1;
                }
                var i, o;
                return !0;
            }),
            n(e, [
                {
                    key: 'locale',
                    get: function () {
                        return this.isValid ? this.loc.locale : null;
                    },
                },
                {
                    key: 'numberingSystem',
                    get: function () {
                        return this.isValid ? this.loc.numberingSystem : null;
                    },
                },
                {
                    key: 'years',
                    get: function () {
                        return this.isValid ? this.values.years || 0 : NaN;
                    },
                },
                {
                    key: 'quarters',
                    get: function () {
                        return this.isValid ? this.values.quarters || 0 : NaN;
                    },
                },
                {
                    key: 'months',
                    get: function () {
                        return this.isValid ? this.values.months || 0 : NaN;
                    },
                },
                {
                    key: 'weeks',
                    get: function () {
                        return this.isValid ? this.values.weeks || 0 : NaN;
                    },
                },
                {
                    key: 'days',
                    get: function () {
                        return this.isValid ? this.values.days || 0 : NaN;
                    },
                },
                {
                    key: 'hours',
                    get: function () {
                        return this.isValid ? this.values.hours || 0 : NaN;
                    },
                },
                {
                    key: 'minutes',
                    get: function () {
                        return this.isValid ? this.values.minutes || 0 : NaN;
                    },
                },
                {
                    key: 'seconds',
                    get: function () {
                        return this.isValid ? this.values.seconds || 0 : NaN;
                    },
                },
                {
                    key: 'milliseconds',
                    get: function () {
                        return this.isValid
                            ? this.values.milliseconds || 0
                            : NaN;
                    },
                },
                {
                    key: 'isValid',
                    get: function () {
                        return null === this.invalid;
                    },
                },
                {
                    key: 'invalidReason',
                    get: function () {
                        return this.invalid ? this.invalid.reason : null;
                    },
                },
                {
                    key: 'invalidExplanation',
                    get: function () {
                        return this.invalid ? this.invalid.explanation : null;
                    },
                },
            ]),
            e
        );
    })();
    function un(e) {
        if (P(e)) return an.fromMillis(e);
        if (an.isDuration(e)) return e;
        if ('object' == typeof e) return an.fromObject(e);
        throw new v('Unknown duration argument ' + e + ' of type ' + typeof e);
    }
    var sn = 'Invalid Interval';
    function cn(e, t) {
        return e && e.isValid
            ? t && t.isValid
                ? t < e
                    ? ln.invalid(
                          'end before start',
                          'The end of an interval must be after its start, but you had start=' +
                              e.toISO() +
                              ' and end=' +
                              t.toISO()
                      )
                    : null
                : ln.invalid('missing or invalid end')
            : ln.invalid('missing or invalid start');
    }
    var ln = (function () {
            function e(e) {
                (this.s = e.start),
                    (this.e = e.end),
                    (this.invalid = e.invalid || null),
                    (this.isLuxonInterval = !0);
            }
            (e.invalid = function (t, n) {
                if ((void 0 === n && (n = null), !t))
                    throw new v(
                        'need to specify a reason the Interval is invalid'
                    );
                var r = t instanceof Fe ? t : new Fe(t, n);
                if (Ke.throwOnInvalid) throw new d(r);
                return new e({ invalid: r });
            }),
                (e.fromDateTimes = function (t, n) {
                    var r = cr(t),
                        i = cr(n),
                        o = cn(r, i);
                    return null == o ? new e({ start: r, end: i }) : o;
                }),
                (e.after = function (t, n) {
                    var r = un(n),
                        i = cr(t);
                    return e.fromDateTimes(i, i.plus(r));
                }),
                (e.before = function (t, n) {
                    var r = un(n),
                        i = cr(t);
                    return e.fromDateTimes(i.minus(r), i);
                }),
                (e.fromISO = function (t, n) {
                    var r = (t || '').split('/', 2),
                        i = r[0],
                        o = r[1];
                    if (i && o) {
                        var a, u, s, c;
                        try {
                            u = (a = sr.fromISO(i, n)).isValid;
                        } catch (o) {
                            u = !1;
                        }
                        try {
                            c = (s = sr.fromISO(o, n)).isValid;
                        } catch (o) {
                            c = !1;
                        }
                        if (u && c) return e.fromDateTimes(a, s);
                        if (u) {
                            var l = an.fromISO(o, n);
                            if (l.isValid) return e.after(a, l);
                        } else if (c) {
                            var f = an.fromISO(i, n);
                            if (f.isValid) return e.before(s, f);
                        }
                    }
                    return e.invalid(
                        'unparsable',
                        'the input "' + t + '" can\'t be parsed as ISO 8601'
                    );
                }),
                (e.isInterval = function (e) {
                    return (e && e.isLuxonInterval) || !1;
                });
            var t = e.prototype;
            return (
                (t.length = function (e) {
                    return (
                        void 0 === e && (e = 'milliseconds'),
                        this.isValid
                            ? this.toDuration.apply(this, [e]).get(e)
                            : NaN
                    );
                }),
                (t.count = function (e) {
                    if ((void 0 === e && (e = 'milliseconds'), !this.isValid))
                        return NaN;
                    var t = this.start.startOf(e),
                        n = this.end.startOf(e);
                    return Math.floor(n.diff(t, e).get(e)) + 1;
                }),
                (t.hasSame = function (e) {
                    return (
                        !!this.isValid &&
                        (this.isEmpty() || this.e.minus(1).hasSame(this.s, e))
                    );
                }),
                (t.isEmpty = function () {
                    return this.s.valueOf() === this.e.valueOf();
                }),
                (t.isAfter = function (e) {
                    return !!this.isValid && this.s > e;
                }),
                (t.isBefore = function (e) {
                    return !!this.isValid && this.e <= e;
                }),
                (t.contains = function (e) {
                    return !!this.isValid && this.s <= e && this.e > e;
                }),
                (t.set = function (t) {
                    var n = void 0 === t ? {} : t,
                        r = n.start,
                        i = n.end;
                    return this.isValid
                        ? e.fromDateTimes(r || this.s, i || this.e)
                        : this;
                }),
                (t.splitAt = function () {
                    var t = this;
                    if (!this.isValid) return [];
                    for (
                        var n = arguments.length, r = new Array(n), i = 0;
                        i < n;
                        i++
                    )
                        r[i] = arguments[i];
                    for (
                        var o = r
                                .map(cr)
                                .filter(function (e) {
                                    return t.contains(e);
                                })
                                .sort(),
                            a = [],
                            u = this.s,
                            s = 0;
                        u < this.e;

                    ) {
                        var c = o[s] || this.e,
                            l = +c > +this.e ? this.e : c;
                        a.push(e.fromDateTimes(u, l)), (u = l), (s += 1);
                    }
                    return a;
                }),
                (t.splitBy = function (t) {
                    var n = un(t);
                    if (
                        !this.isValid ||
                        !n.isValid ||
                        0 === n.as('milliseconds')
                    )
                        return [];
                    for (var r, i, o = this.s, a = []; o < this.e; )
                        (i = +(r = o.plus(n)) > +this.e ? this.e : r),
                            a.push(e.fromDateTimes(o, i)),
                            (o = i);
                    return a;
                }),
                (t.divideEqually = function (e) {
                    return this.isValid
                        ? this.splitBy(this.length() / e).slice(0, e)
                        : [];
                }),
                (t.overlaps = function (e) {
                    return this.e > e.s && this.s < e.e;
                }),
                (t.abutsStart = function (e) {
                    return !!this.isValid && +this.e == +e.s;
                }),
                (t.abutsEnd = function (e) {
                    return !!this.isValid && +e.e == +this.s;
                }),
                (t.engulfs = function (e) {
                    return !!this.isValid && this.s <= e.s && this.e >= e.e;
                }),
                (t.equals = function (e) {
                    return (
                        !(!this.isValid || !e.isValid) &&
                        this.s.equals(e.s) &&
                        this.e.equals(e.e)
                    );
                }),
                (t.intersection = function (t) {
                    if (!this.isValid) return this;
                    var n = this.s > t.s ? this.s : t.s,
                        r = this.e < t.e ? this.e : t.e;
                    return n > r ? null : e.fromDateTimes(n, r);
                }),
                (t.union = function (t) {
                    if (!this.isValid) return this;
                    var n = this.s < t.s ? this.s : t.s,
                        r = this.e > t.e ? this.e : t.e;
                    return e.fromDateTimes(n, r);
                }),
                (e.merge = function (e) {
                    var t = e
                            .sort(function (e, t) {
                                return e.s - t.s;
                            })
                            .reduce(
                                function (e, t) {
                                    var n = e[0],
                                        r = e[1];
                                    return r
                                        ? r.overlaps(t) || r.abutsStart(t)
                                            ? [n, r.union(t)]
                                            : [n.concat([r]), t]
                                        : [n, t];
                                },
                                [[], null]
                            ),
                        n = t[0],
                        r = t[1];
                    return r && n.push(r), n;
                }),
                (e.xor = function (t) {
                    for (
                        var n,
                            r,
                            i = null,
                            o = 0,
                            a = [],
                            u = t.map(function (e) {
                                return [
                                    { time: e.s, type: 's' },
                                    { time: e.e, type: 'e' },
                                ];
                            }),
                            s = c(
                                (n = Array.prototype).concat
                                    .apply(n, u)
                                    .sort(function (e, t) {
                                        return e.time - t.time;
                                    })
                            );
                        !(r = s()).done;

                    ) {
                        var l = r.value;
                        1 === (o += 's' === l.type ? 1 : -1)
                            ? (i = l.time)
                            : (i &&
                                  +i != +l.time &&
                                  a.push(e.fromDateTimes(i, l.time)),
                              (i = null));
                    }
                    return e.merge(a);
                }),
                (t.difference = function () {
                    for (
                        var t = this,
                            n = arguments.length,
                            r = new Array(n),
                            i = 0;
                        i < n;
                        i++
                    )
                        r[i] = arguments[i];
                    return e
                        .xor([this].concat(r))
                        .map(function (e) {
                            return t.intersection(e);
                        })
                        .filter(function (e) {
                            return e && !e.isEmpty();
                        });
                }),
                (t.toString = function () {
                    return this.isValid
                        ? '[' + this.s.toISO() + ' – ' + this.e.toISO() + ')'
                        : sn;
                }),
                (t.toISO = function (e) {
                    return this.isValid
                        ? this.s.toISO(e) + '/' + this.e.toISO(e)
                        : sn;
                }),
                (t.toISODate = function () {
                    return this.isValid
                        ? this.s.toISODate() + '/' + this.e.toISODate()
                        : sn;
                }),
                (t.toISOTime = function (e) {
                    return this.isValid
                        ? this.s.toISOTime(e) + '/' + this.e.toISOTime(e)
                        : sn;
                }),
                (t.toFormat = function (e, t) {
                    var n = (void 0 === t ? {} : t).separator,
                        r = void 0 === n ? ' – ' : n;
                    return this.isValid
                        ? '' + this.s.toFormat(e) + r + this.e.toFormat(e)
                        : sn;
                }),
                (t.toDuration = function (e, t) {
                    return this.isValid
                        ? this.e.diff(this.s, e, t)
                        : an.invalid(this.invalidReason);
                }),
                (t.mapEndpoints = function (t) {
                    return e.fromDateTimes(t(this.s), t(this.e));
                }),
                n(e, [
                    {
                        key: 'start',
                        get: function () {
                            return this.isValid ? this.s : null;
                        },
                    },
                    {
                        key: 'end',
                        get: function () {
                            return this.isValid ? this.e : null;
                        },
                    },
                    {
                        key: 'isValid',
                        get: function () {
                            return null === this.invalidReason;
                        },
                    },
                    {
                        key: 'invalidReason',
                        get: function () {
                            return this.invalid ? this.invalid.reason : null;
                        },
                    },
                    {
                        key: 'invalidExplanation',
                        get: function () {
                            return this.invalid
                                ? this.invalid.explanation
                                : null;
                        },
                    },
                ]),
                e
            );
        })(),
        fn = (function () {
            function e() {}
            return (
                (e.hasDST = function (e) {
                    void 0 === e && (e = Ke.defaultZone);
                    var t = sr.now().setZone(e).set({ month: 12 });
                    return (
                        !e.universal && t.offset !== t.set({ month: 6 }).offset
                    );
                }),
                (e.isValidIANAZone = function (e) {
                    return He.isValidSpecifier(e) && He.isValidZone(e);
                }),
                (e.normalizeZone = function (e) {
                    return We(e, Ke.defaultZone);
                }),
                (e.months = function (e, t) {
                    void 0 === e && (e = 'long');
                    var n = void 0 === t ? {} : t,
                        r = n.locale,
                        i = void 0 === r ? null : r,
                        o = n.numberingSystem,
                        a = void 0 === o ? null : o,
                        u = n.outputCalendar,
                        s = void 0 === u ? 'gregory' : u;
                    return ct.create(i, a, s).months(e);
                }),
                (e.monthsFormat = function (e, t) {
                    void 0 === e && (e = 'long');
                    var n = void 0 === t ? {} : t,
                        r = n.locale,
                        i = void 0 === r ? null : r,
                        o = n.numberingSystem,
                        a = void 0 === o ? null : o,
                        u = n.outputCalendar,
                        s = void 0 === u ? 'gregory' : u;
                    return ct.create(i, a, s).months(e, !0);
                }),
                (e.weekdays = function (e, t) {
                    void 0 === e && (e = 'long');
                    var n = void 0 === t ? {} : t,
                        r = n.locale,
                        i = void 0 === r ? null : r,
                        o = n.numberingSystem,
                        a = void 0 === o ? null : o;
                    return ct.create(i, a, null).weekdays(e);
                }),
                (e.weekdaysFormat = function (e, t) {
                    void 0 === e && (e = 'long');
                    var n = void 0 === t ? {} : t,
                        r = n.locale,
                        i = void 0 === r ? null : r,
                        o = n.numberingSystem,
                        a = void 0 === o ? null : o;
                    return ct.create(i, a, null).weekdays(e, !0);
                }),
                (e.meridiems = function (e) {
                    var t = (void 0 === e ? {} : e).locale,
                        n = void 0 === t ? null : t;
                    return ct.create(n).meridiems();
                }),
                (e.eras = function (e, t) {
                    void 0 === e && (e = 'short');
                    var n = (void 0 === t ? {} : t).locale,
                        r = void 0 === n ? null : n;
                    return ct.create(r, null, 'gregory').eras(e);
                }),
                (e.features = function () {
                    var e = !1,
                        t = !1,
                        n = !1,
                        r = !1;
                    if (J()) {
                        (e = !0), (t = Y()), (r = G());
                        try {
                            n =
                                'America/New_York' ===
                                new Intl.DateTimeFormat('en', {
                                    timeZone: 'America/New_York',
                                }).resolvedOptions().timeZone;
                        } catch (e) {
                            n = !1;
                        }
                    }
                    return { intl: e, intlTokens: t, zones: n, relative: r };
                }),
                e
            );
        })();
    function dn(e, t) {
        var n = function (e) {
                return e
                    .toUTC(0, { keepLocalTime: !0 })
                    .startOf('day')
                    .valueOf();
            },
            r = n(t) - n(e);
        return Math.floor(an.fromMillis(r).as('days'));
    }
    function hn(e, t, n, r) {
        var i = (function (e, t, n) {
                for (
                    var r,
                        i,
                        o = {},
                        a = 0,
                        u = [
                            [
                                'years',
                                function (e, t) {
                                    return t.year - e.year;
                                },
                            ],
                            [
                                'quarters',
                                function (e, t) {
                                    return t.quarter - e.quarter;
                                },
                            ],
                            [
                                'months',
                                function (e, t) {
                                    return (
                                        t.month -
                                        e.month +
                                        12 * (t.year - e.year)
                                    );
                                },
                            ],
                            [
                                'weeks',
                                function (e, t) {
                                    var n = dn(e, t);
                                    return (n - (n % 7)) / 7;
                                },
                            ],
                            ['days', dn],
                        ];
                    a < u.length;
                    a++
                ) {
                    var s = u[a],
                        c = s[0],
                        l = s[1];
                    if (n.indexOf(c) >= 0) {
                        var f;
                        r = c;
                        var d,
                            h = l(e, t);
                        (i = e.plus((((f = {})[c] = h), f))) > t
                            ? ((e = e.plus((((d = {})[c] = h - 1), d))),
                              (h -= 1))
                            : (e = i),
                            (o[c] = h);
                    }
                }
                return [e, o, i, r];
            })(e, t, n),
            o = i[0],
            a = i[1],
            u = i[2],
            s = i[3],
            c = t - o,
            l = n.filter(function (e) {
                return (
                    ['hours', 'minutes', 'seconds', 'milliseconds'].indexOf(
                        e
                    ) >= 0
                );
            });
        if (0 === l.length) {
            var f;
            if (u < t) u = o.plus((((f = {})[s] = 1), f));
            u !== o && (a[s] = (a[s] || 0) + c / (u - o));
        }
        var d,
            h = an.fromObject(Object.assign(a, r));
        return l.length > 0
            ? (d = an.fromMillis(c, r)).shiftTo.apply(d, l).plus(h)
            : h;
    }
    var mn = {
            arab: '[٠-٩]',
            arabext: '[۰-۹]',
            bali: '[᭐-᭙]',
            beng: '[০-৯]',
            deva: '[०-९]',
            fullwide: '[０-９]',
            gujr: '[૦-૯]',
            hanidec: '[〇|一|二|三|四|五|六|七|八|九]',
            khmr: '[០-៩]',
            knda: '[೦-೯]',
            laoo: '[໐-໙]',
            limb: '[᥆-᥏]',
            mlym: '[൦-൯]',
            mong: '[᠐-᠙]',
            mymr: '[၀-၉]',
            orya: '[୦-୯]',
            tamldec: '[௦-௯]',
            telu: '[౦-౯]',
            thai: '[๐-๙]',
            tibt: '[༠-༩]',
            latn: '\\d',
        },
        yn = {
            arab: [1632, 1641],
            arabext: [1776, 1785],
            bali: [6992, 7001],
            beng: [2534, 2543],
            deva: [2406, 2415],
            fullwide: [65296, 65303],
            gujr: [2790, 2799],
            khmr: [6112, 6121],
            knda: [3302, 3311],
            laoo: [3792, 3801],
            limb: [6470, 6479],
            mlym: [3430, 3439],
            mong: [6160, 6169],
            mymr: [4160, 4169],
            orya: [2918, 2927],
            tamldec: [3046, 3055],
            telu: [3174, 3183],
            thai: [3664, 3673],
            tibt: [3872, 3881],
        },
        vn = mn.hanidec.replace(/[\[|\]]/g, '').split('');
    function gn(e, t) {
        var n = e.numberingSystem;
        return void 0 === t && (t = ''), new RegExp('' + mn[n || 'latn'] + t);
    }
    var pn = 'missing Intl.DateTimeFormat.formatToParts support';
    function wn(e, t) {
        return (
            void 0 === t &&
                (t = function (e) {
                    return e;
                }),
            {
                regex: e,
                deser: function (e) {
                    var n = e[0];
                    return t(
                        (function (e) {
                            var t = parseInt(e, 10);
                            if (isNaN(t)) {
                                t = '';
                                for (var n = 0; n < e.length; n++) {
                                    var r = e.charCodeAt(n);
                                    if (-1 !== e[n].search(mn.hanidec))
                                        t += vn.indexOf(e[n]);
                                    else
                                        for (var i in yn) {
                                            var o = yn[i],
                                                a = o[0],
                                                u = o[1];
                                            r >= a && r <= u && (t += r - a);
                                        }
                                }
                                return parseInt(t, 10);
                            }
                            return t;
                        })(n)
                    );
                },
            }
        );
    }
    var kn = '( |' + String.fromCharCode(160) + ')',
        bn = new RegExp(kn, 'g');
    function Sn(e) {
        return e.replace(/\./g, '\\.?').replace(bn, kn);
    }
    function On(e) {
        return e.replace(/\./g, '').replace(bn, ' ').toLowerCase();
    }
    function Tn(e, t) {
        return null === e
            ? null
            : {
                  regex: RegExp(e.map(Sn).join('|')),
                  deser: function (n) {
                      var r = n[0];
                      return (
                          e.findIndex(function (e) {
                              return On(r) === On(e);
                          }) + t
                      );
                  },
              };
    }
    function Mn(e, t) {
        return {
            regex: e,
            deser: function (e) {
                return le(e[1], e[2]);
            },
            groups: t,
        };
    }
    function Nn(e) {
        return {
            regex: e,
            deser: function (e) {
                return e[0];
            },
        };
    }
    var En = {
        year: { '2-digit': 'yy', numeric: 'yyyyy' },
        month: { numeric: 'M', '2-digit': 'MM', short: 'MMM', long: 'MMMM' },
        day: { numeric: 'd', '2-digit': 'dd' },
        weekday: { short: 'EEE', long: 'EEEE' },
        dayperiod: 'a',
        dayPeriod: 'a',
        hour: { numeric: 'h', '2-digit': 'hh' },
        minute: { numeric: 'm', '2-digit': 'mm' },
        second: { numeric: 's', '2-digit': 'ss' },
    };
    var Dn = null;
    function In(e, t) {
        if (e.literal) return e;
        var n = xe.macroTokenToFormatOpts(e.val);
        if (!n) return e;
        var r = xe
            .create(t, n)
            .formatDateTimeParts(
                (Dn || (Dn = sr.fromMillis(1555555555555)), Dn)
            )
            .map(function (e) {
                return (function (e, t, n) {
                    var r = e.type,
                        i = e.value;
                    if ('literal' === r) return { literal: !0, val: i };
                    var o = n[r],
                        a = En[r];
                    return (
                        'object' == typeof a && (a = a[o]),
                        a ? { literal: !1, val: a } : void 0
                    );
                })(e, 0, n);
            });
        return r.includes(void 0) ? e : r;
    }
    function Vn(e, t, n) {
        var r = (function (e, t) {
                var n;
                return (n = Array.prototype).concat.apply(
                    n,
                    e.map(function (e) {
                        return In(e, t);
                    })
                );
            })(xe.parseFormat(n), e),
            i = r.map(function (t) {
                return (
                    (n = t),
                    (i = gn((r = e))),
                    (o = gn(r, '{2}')),
                    (a = gn(r, '{3}')),
                    (u = gn(r, '{4}')),
                    (s = gn(r, '{6}')),
                    (c = gn(r, '{1,2}')),
                    (l = gn(r, '{1,3}')),
                    (f = gn(r, '{1,6}')),
                    (d = gn(r, '{1,9}')),
                    (h = gn(r, '{2,4}')),
                    (m = gn(r, '{4,6}')),
                    (y = function (e) {
                        return {
                            regex: RegExp(
                                ((t = e.val),
                                t.replace(
                                    /[\-\[\]{}()*+?.,\\\^$|#\s]/g,
                                    '\\$&'
                                ))
                            ),
                            deser: function (e) {
                                return e[0];
                            },
                            literal: !0,
                        };
                        var t;
                    }),
                    ((v = (function (e) {
                        if (n.literal) return y(e);
                        switch (e.val) {
                            case 'G':
                                return Tn(r.eras('short', !1), 0);
                            case 'GG':
                                return Tn(r.eras('long', !1), 0);
                            case 'y':
                                return wn(f);
                            case 'yy':
                                return wn(h, se);
                            case 'yyyy':
                                return wn(u);
                            case 'yyyyy':
                                return wn(m);
                            case 'yyyyyy':
                                return wn(s);
                            case 'M':
                                return wn(c);
                            case 'MM':
                                return wn(o);
                            case 'MMM':
                                return Tn(r.months('short', !0, !1), 1);
                            case 'MMMM':
                                return Tn(r.months('long', !0, !1), 1);
                            case 'L':
                                return wn(c);
                            case 'LL':
                                return wn(o);
                            case 'LLL':
                                return Tn(r.months('short', !1, !1), 1);
                            case 'LLLL':
                                return Tn(r.months('long', !1, !1), 1);
                            case 'd':
                                return wn(c);
                            case 'dd':
                                return wn(o);
                            case 'o':
                                return wn(l);
                            case 'ooo':
                                return wn(a);
                            case 'HH':
                                return wn(o);
                            case 'H':
                                return wn(c);
                            case 'hh':
                                return wn(o);
                            case 'h':
                                return wn(c);
                            case 'mm':
                                return wn(o);
                            case 'm':
                            case 'q':
                                return wn(c);
                            case 'qq':
                                return wn(o);
                            case 's':
                                return wn(c);
                            case 'ss':
                                return wn(o);
                            case 'S':
                                return wn(l);
                            case 'SSS':
                                return wn(a);
                            case 'u':
                                return Nn(d);
                            case 'a':
                                return Tn(r.meridiems(), 0);
                            case 'kkkk':
                                return wn(u);
                            case 'kk':
                                return wn(h, se);
                            case 'W':
                                return wn(c);
                            case 'WW':
                                return wn(o);
                            case 'E':
                            case 'c':
                                return wn(i);
                            case 'EEE':
                                return Tn(r.weekdays('short', !1, !1), 1);
                            case 'EEEE':
                                return Tn(r.weekdays('long', !1, !1), 1);
                            case 'ccc':
                                return Tn(r.weekdays('short', !0, !1), 1);
                            case 'cccc':
                                return Tn(r.weekdays('long', !0, !1), 1);
                            case 'Z':
                            case 'ZZ':
                                return Mn(
                                    new RegExp(
                                        '([+-]' +
                                            c.source +
                                            ')(?::(' +
                                            o.source +
                                            '))?'
                                    ),
                                    2
                                );
                            case 'ZZZ':
                                return Mn(
                                    new RegExp(
                                        '([+-]' +
                                            c.source +
                                            ')(' +
                                            o.source +
                                            ')?'
                                    ),
                                    2
                                );
                            case 'z':
                                return Nn(/[a-z_+-/]{1,256}?/i);
                            default:
                                return y(e);
                        }
                    })(n) || { invalidReason: pn }).token = n),
                    v
                );
                var n, r, i, o, a, u, s, c, l, f, d, h, m, y, v;
            }),
            o = i.find(function (e) {
                return e.invalidReason;
            });
        if (o) return { input: t, tokens: r, invalidReason: o.invalidReason };
        var a = (function (e) {
                return [
                    '^' +
                        e
                            .map(function (e) {
                                return e.regex;
                            })
                            .reduce(function (e, t) {
                                return e + '(' + t.source + ')';
                            }, '') +
                        '$',
                    e,
                ];
            })(i),
            u = a[0],
            s = a[1],
            c = RegExp(u, 'i'),
            l = (function (e, t, n) {
                var r = e.match(t);
                if (r) {
                    var i = {},
                        o = 1;
                    for (var a in n)
                        if (Q(n, a)) {
                            var u = n[a],
                                s = u.groups ? u.groups + 1 : 1;
                            !u.literal &&
                                u.token &&
                                (i[u.token.val[0]] = u.deser(
                                    r.slice(o, o + s)
                                )),
                                (o += s);
                        }
                    return [r, i];
                }
                return [r, {}];
            })(t, c, s),
            f = l[0],
            d = l[1],
            h = d
                ? (function (e) {
                      var t;
                      return (
                          (t = R(e.Z)
                              ? R(e.z)
                                  ? null
                                  : He.create(e.z)
                              : new Re(e.Z)),
                          R(e.q) || (e.M = 3 * (e.q - 1) + 1),
                          R(e.h) ||
                              (e.h < 12 && 1 === e.a
                                  ? (e.h += 12)
                                  : 12 === e.h && 0 === e.a && (e.h = 0)),
                          0 === e.G && e.y && (e.y = -e.y),
                          R(e.u) || (e.S = te(e.u)),
                          [
                              Object.keys(e).reduce(function (t, n) {
                                  var r = (function (e) {
                                      switch (e) {
                                          case 'S':
                                              return 'millisecond';
                                          case 's':
                                              return 'second';
                                          case 'm':
                                              return 'minute';
                                          case 'h':
                                          case 'H':
                                              return 'hour';
                                          case 'd':
                                              return 'day';
                                          case 'o':
                                              return 'ordinal';
                                          case 'L':
                                          case 'M':
                                              return 'month';
                                          case 'y':
                                              return 'year';
                                          case 'E':
                                          case 'c':
                                              return 'weekday';
                                          case 'W':
                                              return 'weekNumber';
                                          case 'k':
                                              return 'weekYear';
                                          case 'q':
                                              return 'quarter';
                                          default:
                                              return null;
                                      }
                                  })(n);
                                  return r && (t[r] = e[n]), t;
                              }, {}),
                              t,
                          ]
                      );
                  })(d)
                : [null, null],
            y = h[0],
            v = h[1];
        if (Q(d, 'a') && Q(d, 'H'))
            throw new m(
                "Can't include meridiem when specifying 24-hour format"
            );
        return {
            input: t,
            tokens: r,
            regex: c,
            rawMatches: f,
            matches: d,
            result: y,
            zone: v,
        };
    }
    var Ln = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
        xn = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
    function Fn(e, t) {
        return new Fe(
            'unit out of range',
            'you specified ' +
                t +
                ' (of type ' +
                typeof t +
                ') as a ' +
                e +
                ', which is invalid'
        );
    }
    function Cn(e, t, n) {
        var r = new Date(Date.UTC(e, t - 1, n)).getUTCDay();
        return 0 === r ? 7 : r;
    }
    function Zn(e, t, n) {
        return n + (re(e) ? xn : Ln)[t - 1];
    }
    function jn(e, t) {
        var n = re(e) ? xn : Ln,
            r = n.findIndex(function (e) {
                return e < t;
            });
        return { month: r + 1, day: t - n[r] };
    }
    function An(e) {
        var t,
            n = e.year,
            r = e.month,
            i = e.day,
            o = Zn(n, r, i),
            a = Cn(n, r, i),
            u = Math.floor((o - a + 10) / 7);
        return (
            u < 1
                ? (u = ue((t = n - 1)))
                : u > ue(n)
                ? ((t = n + 1), (u = 1))
                : (t = n),
            Object.assign({ weekYear: t, weekNumber: u, weekday: a }, me(e))
        );
    }
    function zn(e) {
        var t,
            n = e.weekYear,
            r = e.weekNumber,
            i = e.weekday,
            o = Cn(n, 1, 4),
            a = ie(n),
            u = 7 * r + i - o - 3;
        u < 1
            ? (u += ie((t = n - 1)))
            : u > a
            ? ((t = n + 1), (u -= ie(n)))
            : (t = n);
        var s = jn(t, u),
            c = s.month,
            l = s.day;
        return Object.assign({ year: t, month: c, day: l }, me(e));
    }
    function _n(e) {
        var t = e.year,
            n = Zn(t, e.month, e.day);
        return Object.assign({ year: t, ordinal: n }, me(e));
    }
    function qn(e) {
        var t = e.year,
            n = jn(t, e.ordinal),
            r = n.month,
            i = n.day;
        return Object.assign({ year: t, month: r, day: i }, me(e));
    }
    function Hn(e) {
        var t = W(e.year),
            n = K(e.month, 1, 12),
            r = K(e.day, 1, oe(e.year, e.month));
        return t
            ? n
                ? !r && Fn('day', e.day)
                : Fn('month', e.month)
            : Fn('year', e.year);
    }
    function Un(e) {
        var t = e.hour,
            n = e.minute,
            r = e.second,
            i = e.millisecond,
            o = K(t, 0, 23) || (24 === t && 0 === n && 0 === r && 0 === i),
            a = K(n, 0, 59),
            u = K(r, 0, 59),
            s = K(i, 0, 999);
        return o
            ? a
                ? u
                    ? !s && Fn('millisecond', i)
                    : Fn('second', r)
                : Fn('minute', n)
            : Fn('hour', t);
    }
    function Rn(e) {
        return new Fe(
            'unsupported zone',
            'the zone "' + e.name + '" is not supported'
        );
    }
    function Pn(e) {
        return null === e.weekData && (e.weekData = An(e.c)), e.weekData;
    }
    function Wn(e, t) {
        var n = {
            ts: e.ts,
            zone: e.zone,
            c: e.c,
            o: e.o,
            loc: e.loc,
            invalid: e.invalid,
        };
        return new sr(Object.assign({}, n, t, { old: n }));
    }
    function Jn(e, t, n) {
        var r = e - 60 * t * 1e3,
            i = n.offset(r);
        if (t === i) return [r, t];
        r -= 60 * (i - t) * 1e3;
        var o = n.offset(r);
        return i === o
            ? [r, i]
            : [e - 60 * Math.min(i, o) * 1e3, Math.max(i, o)];
    }
    function Yn(e, t) {
        var n = new Date((e += 60 * t * 1e3));
        return {
            year: n.getUTCFullYear(),
            month: n.getUTCMonth() + 1,
            day: n.getUTCDate(),
            hour: n.getUTCHours(),
            minute: n.getUTCMinutes(),
            second: n.getUTCSeconds(),
            millisecond: n.getUTCMilliseconds(),
        };
    }
    function Gn(e, t, n) {
        return Jn(ae(e), t, n);
    }
    function $n(e, t) {
        var n = e.o,
            r = e.c.year + Math.trunc(t.years),
            i = e.c.month + Math.trunc(t.months) + 3 * Math.trunc(t.quarters),
            o = Object.assign({}, e.c, {
                year: r,
                month: i,
                day:
                    Math.min(e.c.day, oe(r, i)) +
                    Math.trunc(t.days) +
                    7 * Math.trunc(t.weeks),
            }),
            a = an
                .fromObject({
                    years: t.years - Math.trunc(t.years),
                    quarters: t.quarters - Math.trunc(t.quarters),
                    months: t.months - Math.trunc(t.months),
                    weeks: t.weeks - Math.trunc(t.weeks),
                    days: t.days - Math.trunc(t.days),
                    hours: t.hours,
                    minutes: t.minutes,
                    seconds: t.seconds,
                    milliseconds: t.milliseconds,
                })
                .as('milliseconds'),
            u = Jn(ae(o), n, e.zone),
            s = u[0],
            c = u[1];
        return 0 !== a && ((s += a), (c = e.zone.offset(s))), { ts: s, o: c };
    }
    function Bn(e, t, n, r, i) {
        var o = n.setZone,
            a = n.zone;
        if (e && 0 !== Object.keys(e).length) {
            var u = t || a,
                s = sr.fromObject(
                    Object.assign(e, n, { zone: u, setZone: void 0 })
                );
            return o ? s : s.setZone(a);
        }
        return sr.invalid(
            new Fe(
                'unparsable',
                'the input "' + i + '" can\'t be parsed as ' + r
            )
        );
    }
    function Qn(e, t, n) {
        return (
            void 0 === n && (n = !0),
            e.isValid
                ? xe
                      .create(ct.create('en-US'), {
                          allowZ: n,
                          forceSimple: !0,
                      })
                      .formatDateTimeFromString(e, t)
                : null
        );
    }
    function Kn(e, t) {
        var n = t.suppressSeconds,
            r = void 0 !== n && n,
            i = t.suppressMilliseconds,
            o = void 0 !== i && i,
            a = t.includeOffset,
            u = t.includePrefix,
            s = void 0 !== u && u,
            c = t.includeZone,
            l = void 0 !== c && c,
            f = t.spaceZone,
            d = void 0 !== f && f,
            h = t.format,
            m = void 0 === h ? 'extended' : h,
            y = 'basic' === m ? 'HHmm' : 'HH:mm';
        (r && 0 === e.second && 0 === e.millisecond) ||
            ((y += 'basic' === m ? 'ss' : ':ss'),
            (o && 0 === e.millisecond) || (y += '.SSS')),
            (l || a) && d && (y += ' '),
            l ? (y += 'z') : a && (y += 'basic' === m ? 'ZZZ' : 'ZZ');
        var v = Qn(e, y);
        return s && (v = 'T' + v), v;
    }
    var Xn = {
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
        },
        er = {
            weekNumber: 1,
            weekday: 1,
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
        },
        tr = { ordinal: 1, hour: 0, minute: 0, second: 0, millisecond: 0 },
        nr = [
            'year',
            'month',
            'day',
            'hour',
            'minute',
            'second',
            'millisecond',
        ],
        rr = [
            'weekYear',
            'weekNumber',
            'weekday',
            'hour',
            'minute',
            'second',
            'millisecond',
        ],
        ir = ['year', 'ordinal', 'hour', 'minute', 'second', 'millisecond'];
    function or(e) {
        var t = {
            year: 'year',
            years: 'year',
            month: 'month',
            months: 'month',
            day: 'day',
            days: 'day',
            hour: 'hour',
            hours: 'hour',
            minute: 'minute',
            minutes: 'minute',
            quarter: 'quarter',
            quarters: 'quarter',
            second: 'second',
            seconds: 'second',
            millisecond: 'millisecond',
            milliseconds: 'millisecond',
            weekday: 'weekday',
            weekdays: 'weekday',
            weeknumber: 'weekNumber',
            weeksnumber: 'weekNumber',
            weeknumbers: 'weekNumber',
            weekyear: 'weekYear',
            weekyears: 'weekYear',
            ordinal: 'ordinal',
        }[e.toLowerCase()];
        if (!t) throw new y(e);
        return t;
    }
    function ar(e, t) {
        for (var n, r = c(nr); !(n = r()).done; ) {
            var i = n.value;
            R(e[i]) && (e[i] = Xn[i]);
        }
        var o = Hn(e) || Un(e);
        if (o) return sr.invalid(o);
        var a = Ke.now(),
            u = Gn(e, t.offset(a), t),
            s = u[0],
            l = u[1];
        return new sr({ ts: s, zone: t, o: l });
    }
    function ur(e, t, n) {
        var r = !!R(n.round) || n.round,
            i = function (e, i) {
                return (
                    (e = ne(e, r || n.calendary ? 0 : 2, !0)),
                    t.loc.clone(n).relFormatter(n).format(e, i)
                );
            },
            o = function (r) {
                return n.calendary
                    ? t.hasSame(e, r)
                        ? 0
                        : t.startOf(r).diff(e.startOf(r), r).get(r)
                    : t.diff(e, r).get(r);
            };
        if (n.unit) return i(o(n.unit), n.unit);
        for (var a, u = c(n.units); !(a = u()).done; ) {
            var s = a.value,
                l = o(s);
            if (Math.abs(l) >= 1) return i(l, s);
        }
        return i(0, n.units[n.units.length - 1]);
    }
    var sr = (function () {
        function e(e) {
            var t = e.zone || Ke.defaultZone,
                n =
                    e.invalid ||
                    (Number.isNaN(e.ts) ? new Fe('invalid input') : null) ||
                    (t.isValid ? null : Rn(t));
            this.ts = R(e.ts) ? Ke.now() : e.ts;
            var r = null,
                i = null;
            if (!n)
                if (e.old && e.old.ts === this.ts && e.old.zone.equals(t)) {
                    var o = [e.old.c, e.old.o];
                    (r = o[0]), (i = o[1]);
                } else {
                    var a = t.offset(this.ts);
                    (r = Yn(this.ts, a)),
                        (r = (n = Number.isNaN(r.year)
                            ? new Fe('invalid input')
                            : null)
                            ? null
                            : r),
                        (i = n ? null : a);
                }
            (this._zone = t),
                (this.loc = e.loc || ct.create()),
                (this.invalid = n),
                (this.weekData = null),
                (this.c = r),
                (this.o = i),
                (this.isLuxonDateTime = !0);
        }
        (e.now = function () {
            return new e({});
        }),
            (e.local = function (t, n, r, i, o, a, u) {
                return R(t)
                    ? new e({})
                    : ar(
                          {
                              year: t,
                              month: n,
                              day: r,
                              hour: i,
                              minute: o,
                              second: a,
                              millisecond: u,
                          },
                          Ke.defaultZone
                      );
            }),
            (e.utc = function (t, n, r, i, o, a, u) {
                return R(t)
                    ? new e({ ts: Ke.now(), zone: Re.utcInstance })
                    : ar(
                          {
                              year: t,
                              month: n,
                              day: r,
                              hour: i,
                              minute: o,
                              second: a,
                              millisecond: u,
                          },
                          Re.utcInstance
                      );
            }),
            (e.fromJSDate = function (t, n) {
                void 0 === n && (n = {});
                var r,
                    i =
                        ((r = t),
                        '[object Date]' === Object.prototype.toString.call(r)
                            ? t.valueOf()
                            : NaN);
                if (Number.isNaN(i)) return e.invalid('invalid input');
                var o = We(n.zone, Ke.defaultZone);
                return o.isValid
                    ? new e({ ts: i, zone: o, loc: ct.fromObject(n) })
                    : e.invalid(Rn(o));
            }),
            (e.fromMillis = function (t, n) {
                if ((void 0 === n && (n = {}), P(t)))
                    return t < -864e13 || t > 864e13
                        ? e.invalid('Timestamp out of range')
                        : new e({
                              ts: t,
                              zone: We(n.zone, Ke.defaultZone),
                              loc: ct.fromObject(n),
                          });
                throw new v(
                    'fromMillis requires a numerical input, but received a ' +
                        typeof t +
                        ' with value ' +
                        t
                );
            }),
            (e.fromSeconds = function (t, n) {
                if ((void 0 === n && (n = {}), P(t)))
                    return new e({
                        ts: 1e3 * t,
                        zone: We(n.zone, Ke.defaultZone),
                        loc: ct.fromObject(n),
                    });
                throw new v('fromSeconds requires a numerical input');
            }),
            (e.fromObject = function (t) {
                var n = We(t.zone, Ke.defaultZone);
                if (!n.isValid) return e.invalid(Rn(n));
                var r = Ke.now(),
                    i = n.offset(r),
                    o = de(t, or, [
                        'zone',
                        'locale',
                        'outputCalendar',
                        'numberingSystem',
                    ]),
                    a = !R(o.ordinal),
                    u = !R(o.year),
                    s = !R(o.month) || !R(o.day),
                    l = u || s,
                    f = o.weekYear || o.weekNumber,
                    d = ct.fromObject(t);
                if ((l || a) && f)
                    throw new m(
                        "Can't mix weekYear/weekNumber units with year/month/day or ordinals"
                    );
                if (s && a)
                    throw new m("Can't mix ordinal dates with month/day");
                var h,
                    y,
                    v = f || (o.weekday && !l),
                    g = Yn(r, i);
                v
                    ? ((h = rr), (y = er), (g = An(g)))
                    : a
                    ? ((h = ir), (y = tr), (g = _n(g)))
                    : ((h = nr), (y = Xn));
                for (var p, w = !1, k = c(h); !(p = k()).done; ) {
                    var b = p.value;
                    R(o[b]) ? (o[b] = w ? y[b] : g[b]) : (w = !0);
                }
                var S =
                    (v
                        ? (function (e) {
                              var t = W(e.weekYear),
                                  n = K(e.weekNumber, 1, ue(e.weekYear)),
                                  r = K(e.weekday, 1, 7);
                              return t
                                  ? n
                                      ? !r && Fn('weekday', e.weekday)
                                      : Fn('week', e.week)
                                  : Fn('weekYear', e.weekYear);
                          })(o)
                        : a
                        ? (function (e) {
                              var t = W(e.year),
                                  n = K(e.ordinal, 1, ie(e.year));
                              return t
                                  ? !n && Fn('ordinal', e.ordinal)
                                  : Fn('year', e.year);
                          })(o)
                        : Hn(o)) || Un(o);
                if (S) return e.invalid(S);
                var O = Gn(v ? zn(o) : a ? qn(o) : o, i, n),
                    T = new e({ ts: O[0], zone: n, o: O[1], loc: d });
                return o.weekday && l && t.weekday !== T.weekday
                    ? e.invalid(
                          'mismatched weekday',
                          "you can't specify both a weekday of " +
                              o.weekday +
                              ' and a date of ' +
                              T.toISO()
                      )
                    : T;
            }),
            (e.fromISO = function (e, t) {
                void 0 === t && (t = {});
                var n = dt(e, [_t, Rt], [qt, Pt], [Ht, Wt], [Ut, Jt]);
                return Bn(n[0], n[1], t, 'ISO 8601', e);
            }),
            (e.fromRFC2822 = function (e, t) {
                void 0 === t && (t = {});
                var n = dt(
                    (function (e) {
                        return e
                            .replace(/\([^)]*\)|[\n\t]/g, ' ')
                            .replace(/(\s\s+)/g, ' ')
                            .trim();
                    })(e),
                    [xt, Ft]
                );
                return Bn(n[0], n[1], t, 'RFC 2822', e);
            }),
            (e.fromHTTP = function (e, t) {
                void 0 === t && (t = {});
                var n = dt(e, [Ct, At], [Zt, At], [jt, zt]);
                return Bn(n[0], n[1], t, 'HTTP', t);
            }),
            (e.fromFormat = function (t, n, r) {
                if ((void 0 === r && (r = {}), R(t) || R(n)))
                    throw new v(
                        'fromFormat requires an input string and a format'
                    );
                var i = r,
                    o = i.locale,
                    a = void 0 === o ? null : o,
                    u = i.numberingSystem,
                    s = void 0 === u ? null : u,
                    c = (function (e, t, n) {
                        var r = Vn(e, t, n);
                        return [r.result, r.zone, r.invalidReason];
                    })(
                        ct.fromOpts({
                            locale: a,
                            numberingSystem: s,
                            defaultToEN: !0,
                        }),
                        t,
                        n
                    ),
                    l = c[0],
                    f = c[1],
                    d = c[2];
                return d ? e.invalid(d) : Bn(l, f, r, 'format ' + n, t);
            }),
            (e.fromString = function (t, n, r) {
                return void 0 === r && (r = {}), e.fromFormat(t, n, r);
            }),
            (e.fromSQL = function (e, t) {
                void 0 === t && (t = {});
                var n = dt(e, [Gt, Bt], [$t, Qt]);
                return Bn(n[0], n[1], t, 'SQL', e);
            }),
            (e.invalid = function (t, n) {
                if ((void 0 === n && (n = null), !t))
                    throw new v(
                        'need to specify a reason the DateTime is invalid'
                    );
                var r = t instanceof Fe ? t : new Fe(t, n);
                if (Ke.throwOnInvalid) throw new f(r);
                return new e({ invalid: r });
            }),
            (e.isDateTime = function (e) {
                return (e && e.isLuxonDateTime) || !1;
            });
        var t = e.prototype;
        return (
            (t.get = function (e) {
                return this[e];
            }),
            (t.resolvedLocaleOpts = function (e) {
                void 0 === e && (e = {});
                var t = xe.create(this.loc.clone(e), e).resolvedOptions(this);
                return {
                    locale: t.locale,
                    numberingSystem: t.numberingSystem,
                    outputCalendar: t.calendar,
                };
            }),
            (t.toUTC = function (e, t) {
                return (
                    void 0 === e && (e = 0),
                    void 0 === t && (t = {}),
                    this.setZone(Re.instance(e), t)
                );
            }),
            (t.toLocal = function () {
                return this.setZone(Ke.defaultZone);
            }),
            (t.setZone = function (t, n) {
                var r = void 0 === n ? {} : n,
                    i = r.keepLocalTime,
                    o = void 0 !== i && i,
                    a = r.keepCalendarTime,
                    u = void 0 !== a && a;
                if ((t = We(t, Ke.defaultZone)).equals(this.zone)) return this;
                if (t.isValid) {
                    var s = this.ts;
                    if (o || u) {
                        var c = t.offset(this.ts);
                        s = Gn(this.toObject(), c, t)[0];
                    }
                    return Wn(this, { ts: s, zone: t });
                }
                return e.invalid(Rn(t));
            }),
            (t.reconfigure = function (e) {
                var t = void 0 === e ? {} : e,
                    n = t.locale,
                    r = t.numberingSystem,
                    i = t.outputCalendar;
                return Wn(this, {
                    loc: this.loc.clone({
                        locale: n,
                        numberingSystem: r,
                        outputCalendar: i,
                    }),
                });
            }),
            (t.setLocale = function (e) {
                return this.reconfigure({ locale: e });
            }),
            (t.set = function (e) {
                if (!this.isValid) return this;
                var t,
                    n = de(e, or, []);
                !R(n.weekYear) || !R(n.weekNumber) || !R(n.weekday)
                    ? (t = zn(Object.assign(An(this.c), n)))
                    : R(n.ordinal)
                    ? ((t = Object.assign(this.toObject(), n)),
                      R(n.day) &&
                          (t.day = Math.min(oe(t.year, t.month), t.day)))
                    : (t = qn(Object.assign(_n(this.c), n)));
                var r = Gn(t, this.o, this.zone);
                return Wn(this, { ts: r[0], o: r[1] });
            }),
            (t.plus = function (e) {
                return this.isValid ? Wn(this, $n(this, un(e))) : this;
            }),
            (t.minus = function (e) {
                return this.isValid ? Wn(this, $n(this, un(e).negate())) : this;
            }),
            (t.startOf = function (e) {
                if (!this.isValid) return this;
                var t = {},
                    n = an.normalizeUnit(e);
                switch (n) {
                    case 'years':
                        t.month = 1;
                    case 'quarters':
                    case 'months':
                        t.day = 1;
                    case 'weeks':
                    case 'days':
                        t.hour = 0;
                    case 'hours':
                        t.minute = 0;
                    case 'minutes':
                        t.second = 0;
                    case 'seconds':
                        t.millisecond = 0;
                }
                if (('weeks' === n && (t.weekday = 1), 'quarters' === n)) {
                    var r = Math.ceil(this.month / 3);
                    t.month = 3 * (r - 1) + 1;
                }
                return this.set(t);
            }),
            (t.endOf = function (e) {
                var t;
                return this.isValid
                    ? this.plus(((t = {}), (t[e] = 1), t))
                          .startOf(e)
                          .minus(1)
                    : this;
            }),
            (t.toFormat = function (e, t) {
                return (
                    void 0 === t && (t = {}),
                    this.isValid
                        ? xe
                              .create(this.loc.redefaultToEN(t))
                              .formatDateTimeFromString(this, e)
                        : 'Invalid DateTime'
                );
            }),
            (t.toLocaleString = function (e) {
                return (
                    void 0 === e && (e = b),
                    this.isValid
                        ? xe.create(this.loc.clone(e), e).formatDateTime(this)
                        : 'Invalid DateTime'
                );
            }),
            (t.toLocaleParts = function (e) {
                return (
                    void 0 === e && (e = {}),
                    this.isValid
                        ? xe
                              .create(this.loc.clone(e), e)
                              .formatDateTimeParts(this)
                        : []
                );
            }),
            (t.toISO = function (e) {
                return (
                    void 0 === e && (e = {}),
                    this.isValid
                        ? this.toISODate(e) + 'T' + this.toISOTime(e)
                        : null
                );
            }),
            (t.toISODate = function (e) {
                var t = (void 0 === e ? {} : e).format,
                    n =
                        'basic' === (void 0 === t ? 'extended' : t)
                            ? 'yyyyMMdd'
                            : 'yyyy-MM-dd';
                return this.year > 9999 && (n = '+' + n), Qn(this, n);
            }),
            (t.toISOWeekDate = function () {
                return Qn(this, "kkkk-'W'WW-c");
            }),
            (t.toISOTime = function (e) {
                var t = void 0 === e ? {} : e,
                    n = t.suppressMilliseconds,
                    r = void 0 !== n && n,
                    i = t.suppressSeconds,
                    o = void 0 !== i && i,
                    a = t.includeOffset,
                    u = void 0 === a || a,
                    s = t.includePrefix,
                    c = void 0 !== s && s,
                    l = t.format;
                return Kn(this, {
                    suppressSeconds: o,
                    suppressMilliseconds: r,
                    includeOffset: u,
                    includePrefix: c,
                    format: void 0 === l ? 'extended' : l,
                });
            }),
            (t.toRFC2822 = function () {
                return Qn(this, 'EEE, dd LLL yyyy HH:mm:ss ZZZ', !1);
            }),
            (t.toHTTP = function () {
                return Qn(this.toUTC(), "EEE, dd LLL yyyy HH:mm:ss 'GMT'");
            }),
            (t.toSQLDate = function () {
                return Qn(this, 'yyyy-MM-dd');
            }),
            (t.toSQLTime = function (e) {
                var t = void 0 === e ? {} : e,
                    n = t.includeOffset,
                    r = void 0 === n || n,
                    i = t.includeZone;
                return Kn(this, {
                    includeOffset: r,
                    includeZone: void 0 !== i && i,
                    spaceZone: !0,
                });
            }),
            (t.toSQL = function (e) {
                return (
                    void 0 === e && (e = {}),
                    this.isValid
                        ? this.toSQLDate() + ' ' + this.toSQLTime(e)
                        : null
                );
            }),
            (t.toString = function () {
                return this.isValid ? this.toISO() : 'Invalid DateTime';
            }),
            (t.valueOf = function () {
                return this.toMillis();
            }),
            (t.toMillis = function () {
                return this.isValid ? this.ts : NaN;
            }),
            (t.toSeconds = function () {
                return this.isValid ? this.ts / 1e3 : NaN;
            }),
            (t.toJSON = function () {
                return this.toISO();
            }),
            (t.toBSON = function () {
                return this.toJSDate();
            }),
            (t.toObject = function (e) {
                if ((void 0 === e && (e = {}), !this.isValid)) return {};
                var t = Object.assign({}, this.c);
                return (
                    e.includeConfig &&
                        ((t.outputCalendar = this.outputCalendar),
                        (t.numberingSystem = this.loc.numberingSystem),
                        (t.locale = this.loc.locale)),
                    t
                );
            }),
            (t.toJSDate = function () {
                return new Date(this.isValid ? this.ts : NaN);
            }),
            (t.diff = function (e, t, n) {
                if (
                    (void 0 === t && (t = 'milliseconds'),
                    void 0 === n && (n = {}),
                    !this.isValid || !e.isValid)
                )
                    return an.invalid(
                        this.invalid || e.invalid,
                        'created by diffing an invalid DateTime'
                    );
                var r,
                    i = Object.assign(
                        {
                            locale: this.locale,
                            numberingSystem: this.numberingSystem,
                        },
                        n
                    ),
                    o = ((r = t), Array.isArray(r) ? r : [r]).map(
                        an.normalizeUnit
                    ),
                    a = e.valueOf() > this.valueOf(),
                    u = hn(a ? this : e, a ? e : this, o, i);
                return a ? u.negate() : u;
            }),
            (t.diffNow = function (t, n) {
                return (
                    void 0 === t && (t = 'milliseconds'),
                    void 0 === n && (n = {}),
                    this.diff(e.now(), t, n)
                );
            }),
            (t.until = function (e) {
                return this.isValid ? ln.fromDateTimes(this, e) : this;
            }),
            (t.hasSame = function (e, t) {
                if (!this.isValid) return !1;
                var n = e.valueOf(),
                    r = this.setZone(e.zone, { keepLocalTime: !0 });
                return r.startOf(t) <= n && n <= r.endOf(t);
            }),
            (t.equals = function (e) {
                return (
                    this.isValid &&
                    e.isValid &&
                    this.valueOf() === e.valueOf() &&
                    this.zone.equals(e.zone) &&
                    this.loc.equals(e.loc)
                );
            }),
            (t.toRelative = function (t) {
                if ((void 0 === t && (t = {}), !this.isValid)) return null;
                var n = t.base || e.fromObject({ zone: this.zone }),
                    r = t.padding ? (this < n ? -t.padding : t.padding) : 0;
                return ur(
                    n,
                    this.plus(r),
                    Object.assign(t, {
                        numeric: 'always',
                        units: [
                            'years',
                            'months',
                            'days',
                            'hours',
                            'minutes',
                            'seconds',
                        ],
                    })
                );
            }),
            (t.toRelativeCalendar = function (t) {
                return (
                    void 0 === t && (t = {}),
                    this.isValid
                        ? ur(
                              t.base || e.fromObject({ zone: this.zone }),
                              this,
                              Object.assign(t, {
                                  numeric: 'auto',
                                  units: ['years', 'months', 'days'],
                                  calendary: !0,
                              })
                          )
                        : null
                );
            }),
            (e.min = function () {
                for (
                    var t = arguments.length, n = new Array(t), r = 0;
                    r < t;
                    r++
                )
                    n[r] = arguments[r];
                if (!n.every(e.isDateTime))
                    throw new v('min requires all arguments be DateTimes');
                return $(
                    n,
                    function (e) {
                        return e.valueOf();
                    },
                    Math.min
                );
            }),
            (e.max = function () {
                for (
                    var t = arguments.length, n = new Array(t), r = 0;
                    r < t;
                    r++
                )
                    n[r] = arguments[r];
                if (!n.every(e.isDateTime))
                    throw new v('max requires all arguments be DateTimes');
                return $(
                    n,
                    function (e) {
                        return e.valueOf();
                    },
                    Math.max
                );
            }),
            (e.fromFormatExplain = function (e, t, n) {
                void 0 === n && (n = {});
                var r = n,
                    i = r.locale,
                    o = void 0 === i ? null : i,
                    a = r.numberingSystem,
                    u = void 0 === a ? null : a;
                return Vn(
                    ct.fromOpts({
                        locale: o,
                        numberingSystem: u,
                        defaultToEN: !0,
                    }),
                    e,
                    t
                );
            }),
            (e.fromStringExplain = function (t, n, r) {
                return void 0 === r && (r = {}), e.fromFormatExplain(t, n, r);
            }),
            n(
                e,
                [
                    {
                        key: 'isValid',
                        get: function () {
                            return null === this.invalid;
                        },
                    },
                    {
                        key: 'invalidReason',
                        get: function () {
                            return this.invalid ? this.invalid.reason : null;
                        },
                    },
                    {
                        key: 'invalidExplanation',
                        get: function () {
                            return this.invalid
                                ? this.invalid.explanation
                                : null;
                        },
                    },
                    {
                        key: 'locale',
                        get: function () {
                            return this.isValid ? this.loc.locale : null;
                        },
                    },
                    {
                        key: 'numberingSystem',
                        get: function () {
                            return this.isValid
                                ? this.loc.numberingSystem
                                : null;
                        },
                    },
                    {
                        key: 'outputCalendar',
                        get: function () {
                            return this.isValid
                                ? this.loc.outputCalendar
                                : null;
                        },
                    },
                    {
                        key: 'zone',
                        get: function () {
                            return this._zone;
                        },
                    },
                    {
                        key: 'zoneName',
                        get: function () {
                            return this.isValid ? this.zone.name : null;
                        },
                    },
                    {
                        key: 'year',
                        get: function () {
                            return this.isValid ? this.c.year : NaN;
                        },
                    },
                    {
                        key: 'quarter',
                        get: function () {
                            return this.isValid
                                ? Math.ceil(this.c.month / 3)
                                : NaN;
                        },
                    },
                    {
                        key: 'month',
                        get: function () {
                            return this.isValid ? this.c.month : NaN;
                        },
                    },
                    {
                        key: 'day',
                        get: function () {
                            return this.isValid ? this.c.day : NaN;
                        },
                    },
                    {
                        key: 'hour',
                        get: function () {
                            return this.isValid ? this.c.hour : NaN;
                        },
                    },
                    {
                        key: 'minute',
                        get: function () {
                            return this.isValid ? this.c.minute : NaN;
                        },
                    },
                    {
                        key: 'second',
                        get: function () {
                            return this.isValid ? this.c.second : NaN;
                        },
                    },
                    {
                        key: 'millisecond',
                        get: function () {
                            return this.isValid ? this.c.millisecond : NaN;
                        },
                    },
                    {
                        key: 'weekYear',
                        get: function () {
                            return this.isValid ? Pn(this).weekYear : NaN;
                        },
                    },
                    {
                        key: 'weekNumber',
                        get: function () {
                            return this.isValid ? Pn(this).weekNumber : NaN;
                        },
                    },
                    {
                        key: 'weekday',
                        get: function () {
                            return this.isValid ? Pn(this).weekday : NaN;
                        },
                    },
                    {
                        key: 'ordinal',
                        get: function () {
                            return this.isValid ? _n(this.c).ordinal : NaN;
                        },
                    },
                    {
                        key: 'monthShort',
                        get: function () {
                            return this.isValid
                                ? fn.months('short', { locale: this.locale })[
                                      this.month - 1
                                  ]
                                : null;
                        },
                    },
                    {
                        key: 'monthLong',
                        get: function () {
                            return this.isValid
                                ? fn.months('long', { locale: this.locale })[
                                      this.month - 1
                                  ]
                                : null;
                        },
                    },
                    {
                        key: 'weekdayShort',
                        get: function () {
                            return this.isValid
                                ? fn.weekdays('short', { locale: this.locale })[
                                      this.weekday - 1
                                  ]
                                : null;
                        },
                    },
                    {
                        key: 'weekdayLong',
                        get: function () {
                            return this.isValid
                                ? fn.weekdays('long', { locale: this.locale })[
                                      this.weekday - 1
                                  ]
                                : null;
                        },
                    },
                    {
                        key: 'offset',
                        get: function () {
                            return this.isValid ? +this.o : NaN;
                        },
                    },
                    {
                        key: 'offsetNameShort',
                        get: function () {
                            return this.isValid
                                ? this.zone.offsetName(this.ts, {
                                      format: 'short',
                                      locale: this.locale,
                                  })
                                : null;
                        },
                    },
                    {
                        key: 'offsetNameLong',
                        get: function () {
                            return this.isValid
                                ? this.zone.offsetName(this.ts, {
                                      format: 'long',
                                      locale: this.locale,
                                  })
                                : null;
                        },
                    },
                    {
                        key: 'isOffsetFixed',
                        get: function () {
                            return this.isValid ? this.zone.universal : null;
                        },
                    },
                    {
                        key: 'isInDST',
                        get: function () {
                            return (
                                !this.isOffsetFixed &&
                                (this.offset > this.set({ month: 1 }).offset ||
                                    this.offset > this.set({ month: 5 }).offset)
                            );
                        },
                    },
                    {
                        key: 'isInLeapYear',
                        get: function () {
                            return re(this.year);
                        },
                    },
                    {
                        key: 'daysInMonth',
                        get: function () {
                            return oe(this.year, this.month);
                        },
                    },
                    {
                        key: 'daysInYear',
                        get: function () {
                            return this.isValid ? ie(this.year) : NaN;
                        },
                    },
                    {
                        key: 'weeksInWeekYear',
                        get: function () {
                            return this.isValid ? ue(this.weekYear) : NaN;
                        },
                    },
                ],
                [
                    {
                        key: 'DATE_SHORT',
                        get: function () {
                            return b;
                        },
                    },
                    {
                        key: 'DATE_MED',
                        get: function () {
                            return S;
                        },
                    },
                    {
                        key: 'DATE_MED_WITH_WEEKDAY',
                        get: function () {
                            return O;
                        },
                    },
                    {
                        key: 'DATE_FULL',
                        get: function () {
                            return T;
                        },
                    },
                    {
                        key: 'DATE_HUGE',
                        get: function () {
                            return M;
                        },
                    },
                    {
                        key: 'TIME_SIMPLE',
                        get: function () {
                            return N;
                        },
                    },
                    {
                        key: 'TIME_WITH_SECONDS',
                        get: function () {
                            return E;
                        },
                    },
                    {
                        key: 'TIME_WITH_SHORT_OFFSET',
                        get: function () {
                            return D;
                        },
                    },
                    {
                        key: 'TIME_WITH_LONG_OFFSET',
                        get: function () {
                            return I;
                        },
                    },
                    {
                        key: 'TIME_24_SIMPLE',
                        get: function () {
                            return V;
                        },
                    },
                    {
                        key: 'TIME_24_WITH_SECONDS',
                        get: function () {
                            return L;
                        },
                    },
                    {
                        key: 'TIME_24_WITH_SHORT_OFFSET',
                        get: function () {
                            return x;
                        },
                    },
                    {
                        key: 'TIME_24_WITH_LONG_OFFSET',
                        get: function () {
                            return F;
                        },
                    },
                    {
                        key: 'DATETIME_SHORT',
                        get: function () {
                            return C;
                        },
                    },
                    {
                        key: 'DATETIME_SHORT_WITH_SECONDS',
                        get: function () {
                            return Z;
                        },
                    },
                    {
                        key: 'DATETIME_MED',
                        get: function () {
                            return j;
                        },
                    },
                    {
                        key: 'DATETIME_MED_WITH_SECONDS',
                        get: function () {
                            return A;
                        },
                    },
                    {
                        key: 'DATETIME_MED_WITH_WEEKDAY',
                        get: function () {
                            return z;
                        },
                    },
                    {
                        key: 'DATETIME_FULL',
                        get: function () {
                            return _;
                        },
                    },
                    {
                        key: 'DATETIME_FULL_WITH_SECONDS',
                        get: function () {
                            return q;
                        },
                    },
                    {
                        key: 'DATETIME_HUGE',
                        get: function () {
                            return H;
                        },
                    },
                    {
                        key: 'DATETIME_HUGE_WITH_SECONDS',
                        get: function () {
                            return U;
                        },
                    },
                ]
            ),
            e
        );
    })();
    function cr(e) {
        if (sr.isDateTime(e)) return e;
        if (e && e.valueOf && P(e.valueOf())) return sr.fromJSDate(e);
        if (e && 'object' == typeof e) return sr.fromObject(e);
        throw new v(
            'Unknown datetime argument: ' + e + ', of type ' + typeof e
        );
    }
    return (
        (e.DateTime = sr),
        (e.Duration = an),
        (e.FixedOffsetZone = Re),
        (e.IANAZone = He),
        (e.Info = fn),
        (e.Interval = ln),
        (e.InvalidZone = Pe),
        (e.LocalZone = je),
        (e.Settings = Ke),
        (e.VERSION = '1.26.0'),
        (e.Zone = Ce),
        e
    );
})({});