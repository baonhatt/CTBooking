var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
  }
});

// ../node_modules/bcryptjs/index.js
var import_crypto = __toESM(require_crypto(), 1);
var randomFallback = null;
function randomBytes(len) {
  try {
    return crypto.getRandomValues(new Uint8Array(len));
  } catch {
  }
  try {
    return import_crypto.default.randomBytes(len);
  } catch {
  }
  if (!randomFallback) {
    throw Error(
      "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
    );
  }
  return randomFallback(len);
}
__name(randomBytes, "randomBytes");
function setRandomFallback(random) {
  randomFallback = random;
}
__name(setRandomFallback, "setRandomFallback");
function genSaltSync(rounds, seed_length) {
  rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof rounds !== "number")
    throw Error(
      "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
    );
  if (rounds < 4) rounds = 4;
  else if (rounds > 31) rounds = 31;
  var salt = [];
  salt.push("$2b$");
  if (rounds < 10) salt.push("0");
  salt.push(rounds.toString());
  salt.push("$");
  salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
  return salt.join("");
}
__name(genSaltSync, "genSaltSync");
function genSalt(rounds, seed_length, callback) {
  if (typeof seed_length === "function")
    callback = seed_length, seed_length = void 0;
  if (typeof rounds === "function") callback = rounds, rounds = void 0;
  if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
  else if (typeof rounds !== "number")
    throw Error("illegal arguments: " + typeof rounds);
  function _async(callback2) {
    nextTick(function() {
      try {
        callback2(null, genSaltSync(rounds));
      } catch (err) {
        callback2(err);
      }
    });
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(genSalt, "genSalt");
function hashSync(password, salt) {
  if (typeof salt === "undefined") salt = GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof salt === "number") salt = genSaltSync(salt);
  if (typeof password !== "string" || typeof salt !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof salt);
  return _hash(password, salt);
}
__name(hashSync, "hashSync");
function hash(password, salt, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password === "string" && typeof salt === "number")
      genSalt(salt, function(err, salt2) {
        _hash(password, salt2, callback2, progressCallback);
      });
    else if (typeof password === "string" && typeof salt === "string")
      _hash(password, salt, callback2, progressCallback);
    else
      nextTick(
        callback2.bind(
          this,
          Error("Illegal arguments: " + typeof password + ", " + typeof salt)
        )
      );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(hash, "hash");
function safeStringCompare(known, unknown) {
  var diff = known.length ^ unknown.length;
  for (var i = 0; i < known.length; ++i) {
    diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
  }
  return diff === 0;
}
__name(safeStringCompare, "safeStringCompare");
function compareSync(password, hash2) {
  if (typeof password !== "string" || typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof hash2);
  if (hash2.length !== 60) return false;
  return safeStringCompare(
    hashSync(password, hash2.substring(0, hash2.length - 31)),
    hash2
  );
}
__name(compareSync, "compareSync");
function compare(password, hashValue, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password !== "string" || typeof hashValue !== "string") {
      nextTick(
        callback2.bind(
          this,
          Error(
            "Illegal arguments: " + typeof password + ", " + typeof hashValue
          )
        )
      );
      return;
    }
    if (hashValue.length !== 60) {
      nextTick(callback2.bind(this, null, false));
      return;
    }
    hash(
      password,
      hashValue.substring(0, 29),
      function(err, comp) {
        if (err) callback2(err);
        else callback2(null, safeStringCompare(comp, hashValue));
      },
      progressCallback
    );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(compare, "compare");
function getRounds(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  return parseInt(hash2.split("$")[2], 10);
}
__name(getRounds, "getRounds");
function getSalt(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  if (hash2.length !== 60)
    throw Error("Illegal hash length: " + hash2.length + " != 60");
  return hash2.substring(0, 29);
}
__name(getSalt, "getSalt");
function truncates(password) {
  if (typeof password !== "string")
    throw Error("Illegal arguments: " + typeof password);
  return utf8Length(password) > 72;
}
__name(truncates, "truncates");
var nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function utf8Length(string) {
  var len = 0, c = 0;
  for (var i = 0; i < string.length; ++i) {
    c = string.charCodeAt(i);
    if (c < 128) len += 1;
    else if (c < 2048) len += 2;
    else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
      ++i;
      len += 4;
    } else len += 3;
  }
  return len;
}
__name(utf8Length, "utf8Length");
function utf8Array(string) {
  var offset = 0, c1, c2;
  var buffer = new Array(utf8Length(string));
  for (var i = 0, k = string.length; i < k; ++i) {
    c1 = string.charCodeAt(i);
    if (c1 < 128) {
      buffer[offset++] = c1;
    } else if (c1 < 2048) {
      buffer[offset++] = c1 >> 6 | 192;
      buffer[offset++] = c1 & 63 | 128;
    } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
      c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
      ++i;
      buffer[offset++] = c1 >> 18 | 240;
      buffer[offset++] = c1 >> 12 & 63 | 128;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    } else {
      buffer[offset++] = c1 >> 12 | 224;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    }
  }
  return buffer;
}
__name(utf8Array, "utf8Array");
var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
var BASE64_INDEX = [
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  1,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  -1,
  -1,
  -1,
  -1,
  -1
];
function base64_encode(b, len) {
  var off = 0, rs = [], c1, c2;
  if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
  while (off < len) {
    c1 = b[off++] & 255;
    rs.push(BASE64_CODE[c1 >> 2 & 63]);
    c1 = (c1 & 3) << 4;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 4 & 15;
    rs.push(BASE64_CODE[c1 & 63]);
    c1 = (c2 & 15) << 2;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 6 & 3;
    rs.push(BASE64_CODE[c1 & 63]);
    rs.push(BASE64_CODE[c2 & 63]);
  }
  return rs.join("");
}
__name(base64_encode, "base64_encode");
function base64_decode(s, len) {
  var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
  if (len <= 0) throw Error("Illegal len: " + len);
  while (off < slen - 1 && olen < len) {
    code = s.charCodeAt(off++);
    c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    code = s.charCodeAt(off++);
    c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c1 == -1 || c2 == -1) break;
    o = c1 << 2 >>> 0;
    o |= (c2 & 48) >> 4;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1) break;
    o = (c2 & 15) << 4 >>> 0;
    o |= (c3 & 60) >> 2;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o = (c3 & 3) << 6 >>> 0;
    o |= c4;
    rs.push(String.fromCharCode(o));
    ++olen;
  }
  var res = [];
  for (off = 0; off < olen; off++) res.push(rs[off].charCodeAt(0));
  return res;
}
__name(base64_decode, "base64_decode");
var BCRYPT_SALT_LEN = 16;
var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
var BLOWFISH_NUM_ROUNDS = 16;
var MAX_EXECUTION_TIME = 100;
var P_ORIG = [
  608135816,
  2242054355,
  320440878,
  57701188,
  2752067618,
  698298832,
  137296536,
  3964562569,
  1160258022,
  953160567,
  3193202383,
  887688300,
  3232508343,
  3380367581,
  1065670069,
  3041331479,
  2450970073,
  2306472731
];
var S_ORIG = [
  3509652390,
  2564797868,
  805139163,
  3491422135,
  3101798381,
  1780907670,
  3128725573,
  4046225305,
  614570311,
  3012652279,
  134345442,
  2240740374,
  1667834072,
  1901547113,
  2757295779,
  4103290238,
  227898511,
  1921955416,
  1904987480,
  2182433518,
  2069144605,
  3260701109,
  2620446009,
  720527379,
  3318853667,
  677414384,
  3393288472,
  3101374703,
  2390351024,
  1614419982,
  1822297739,
  2954791486,
  3608508353,
  3174124327,
  2024746970,
  1432378464,
  3864339955,
  2857741204,
  1464375394,
  1676153920,
  1439316330,
  715854006,
  3033291828,
  289532110,
  2706671279,
  2087905683,
  3018724369,
  1668267050,
  732546397,
  1947742710,
  3462151702,
  2609353502,
  2950085171,
  1814351708,
  2050118529,
  680887927,
  999245976,
  1800124847,
  3300911131,
  1713906067,
  1641548236,
  4213287313,
  1216130144,
  1575780402,
  4018429277,
  3917837745,
  3693486850,
  3949271944,
  596196993,
  3549867205,
  258830323,
  2213823033,
  772490370,
  2760122372,
  1774776394,
  2652871518,
  566650946,
  4142492826,
  1728879713,
  2882767088,
  1783734482,
  3629395816,
  2517608232,
  2874225571,
  1861159788,
  326777828,
  3124490320,
  2130389656,
  2716951837,
  967770486,
  1724537150,
  2185432712,
  2364442137,
  1164943284,
  2105845187,
  998989502,
  3765401048,
  2244026483,
  1075463327,
  1455516326,
  1322494562,
  910128902,
  469688178,
  1117454909,
  936433444,
  3490320968,
  3675253459,
  1240580251,
  122909385,
  2157517691,
  634681816,
  4142456567,
  3825094682,
  3061402683,
  2540495037,
  79693498,
  3249098678,
  1084186820,
  1583128258,
  426386531,
  1761308591,
  1047286709,
  322548459,
  995290223,
  1845252383,
  2603652396,
  3431023940,
  2942221577,
  3202600964,
  3727903485,
  1712269319,
  422464435,
  3234572375,
  1170764815,
  3523960633,
  3117677531,
  1434042557,
  442511882,
  3600875718,
  1076654713,
  1738483198,
  4213154764,
  2393238008,
  3677496056,
  1014306527,
  4251020053,
  793779912,
  2902807211,
  842905082,
  4246964064,
  1395751752,
  1040244610,
  2656851899,
  3396308128,
  445077038,
  3742853595,
  3577915638,
  679411651,
  2892444358,
  2354009459,
  1767581616,
  3150600392,
  3791627101,
  3102740896,
  284835224,
  4246832056,
  1258075500,
  768725851,
  2589189241,
  3069724005,
  3532540348,
  1274779536,
  3789419226,
  2764799539,
  1660621633,
  3471099624,
  4011903706,
  913787905,
  3497959166,
  737222580,
  2514213453,
  2928710040,
  3937242737,
  1804850592,
  3499020752,
  2949064160,
  2386320175,
  2390070455,
  2415321851,
  4061277028,
  2290661394,
  2416832540,
  1336762016,
  1754252060,
  3520065937,
  3014181293,
  791618072,
  3188594551,
  3933548030,
  2332172193,
  3852520463,
  3043980520,
  413987798,
  3465142937,
  3030929376,
  4245938359,
  2093235073,
  3534596313,
  375366246,
  2157278981,
  2479649556,
  555357303,
  3870105701,
  2008414854,
  3344188149,
  4221384143,
  3956125452,
  2067696032,
  3594591187,
  2921233993,
  2428461,
  544322398,
  577241275,
  1471733935,
  610547355,
  4027169054,
  1432588573,
  1507829418,
  2025931657,
  3646575487,
  545086370,
  48609733,
  2200306550,
  1653985193,
  298326376,
  1316178497,
  3007786442,
  2064951626,
  458293330,
  2589141269,
  3591329599,
  3164325604,
  727753846,
  2179363840,
  146436021,
  1461446943,
  4069977195,
  705550613,
  3059967265,
  3887724982,
  4281599278,
  3313849956,
  1404054877,
  2845806497,
  146425753,
  1854211946,
  1266315497,
  3048417604,
  3681880366,
  3289982499,
  290971e4,
  1235738493,
  2632868024,
  2414719590,
  3970600049,
  1771706367,
  1449415276,
  3266420449,
  422970021,
  1963543593,
  2690192192,
  3826793022,
  1062508698,
  1531092325,
  1804592342,
  2583117782,
  2714934279,
  4024971509,
  1294809318,
  4028980673,
  1289560198,
  2221992742,
  1669523910,
  35572830,
  157838143,
  1052438473,
  1016535060,
  1802137761,
  1753167236,
  1386275462,
  3080475397,
  2857371447,
  1040679964,
  2145300060,
  2390574316,
  1461121720,
  2956646967,
  4031777805,
  4028374788,
  33600511,
  2920084762,
  1018524850,
  629373528,
  3691585981,
  3515945977,
  2091462646,
  2486323059,
  586499841,
  988145025,
  935516892,
  3367335476,
  2599673255,
  2839830854,
  265290510,
  3972581182,
  2759138881,
  3795373465,
  1005194799,
  847297441,
  406762289,
  1314163512,
  1332590856,
  1866599683,
  4127851711,
  750260880,
  613907577,
  1450815602,
  3165620655,
  3734664991,
  3650291728,
  3012275730,
  3704569646,
  1427272223,
  778793252,
  1343938022,
  2676280711,
  2052605720,
  1946737175,
  3164576444,
  3914038668,
  3967478842,
  3682934266,
  1661551462,
  3294938066,
  4011595847,
  840292616,
  3712170807,
  616741398,
  312560963,
  711312465,
  1351876610,
  322626781,
  1910503582,
  271666773,
  2175563734,
  1594956187,
  70604529,
  3617834859,
  1007753275,
  1495573769,
  4069517037,
  2549218298,
  2663038764,
  504708206,
  2263041392,
  3941167025,
  2249088522,
  1514023603,
  1998579484,
  1312622330,
  694541497,
  2582060303,
  2151582166,
  1382467621,
  776784248,
  2618340202,
  3323268794,
  2497899128,
  2784771155,
  503983604,
  4076293799,
  907881277,
  423175695,
  432175456,
  1378068232,
  4145222326,
  3954048622,
  3938656102,
  3820766613,
  2793130115,
  2977904593,
  26017576,
  3274890735,
  3194772133,
  1700274565,
  1756076034,
  4006520079,
  3677328699,
  720338349,
  1533947780,
  354530856,
  688349552,
  3973924725,
  1637815568,
  332179504,
  3949051286,
  53804574,
  2852348879,
  3044236432,
  1282449977,
  3583942155,
  3416972820,
  4006381244,
  1617046695,
  2628476075,
  3002303598,
  1686838959,
  431878346,
  2686675385,
  1700445008,
  1080580658,
  1009431731,
  832498133,
  3223435511,
  2605976345,
  2271191193,
  2516031870,
  1648197032,
  4164389018,
  2548247927,
  300782431,
  375919233,
  238389289,
  3353747414,
  2531188641,
  2019080857,
  1475708069,
  455242339,
  2609103871,
  448939670,
  3451063019,
  1395535956,
  2413381860,
  1841049896,
  1491858159,
  885456874,
  4264095073,
  4001119347,
  1565136089,
  3898914787,
  1108368660,
  540939232,
  1173283510,
  2745871338,
  3681308437,
  4207628240,
  3343053890,
  4016749493,
  1699691293,
  1103962373,
  3625875870,
  2256883143,
  3830138730,
  1031889488,
  3479347698,
  1535977030,
  4236805024,
  3251091107,
  2132092099,
  1774941330,
  1199868427,
  1452454533,
  157007616,
  2904115357,
  342012276,
  595725824,
  1480756522,
  206960106,
  497939518,
  591360097,
  863170706,
  2375253569,
  3596610801,
  1814182875,
  2094937945,
  3421402208,
  1082520231,
  3463918190,
  2785509508,
  435703966,
  3908032597,
  1641649973,
  2842273706,
  3305899714,
  1510255612,
  2148256476,
  2655287854,
  3276092548,
  4258621189,
  236887753,
  3681803219,
  274041037,
  1734335097,
  3815195456,
  3317970021,
  1899903192,
  1026095262,
  4050517792,
  356393447,
  2410691914,
  3873677099,
  3682840055,
  3913112168,
  2491498743,
  4132185628,
  2489919796,
  1091903735,
  1979897079,
  3170134830,
  3567386728,
  3557303409,
  857797738,
  1136121015,
  1342202287,
  507115054,
  2535736646,
  337727348,
  3213592640,
  1301675037,
  2528481711,
  1895095763,
  1721773893,
  3216771564,
  62756741,
  2142006736,
  835421444,
  2531993523,
  1442658625,
  3659876326,
  2882144922,
  676362277,
  1392781812,
  170690266,
  3921047035,
  1759253602,
  3611846912,
  1745797284,
  664899054,
  1329594018,
  3901205900,
  3045908486,
  2062866102,
  2865634940,
  3543621612,
  3464012697,
  1080764994,
  553557557,
  3656615353,
  3996768171,
  991055499,
  499776247,
  1265440854,
  648242737,
  3940784050,
  980351604,
  3713745714,
  1749149687,
  3396870395,
  4211799374,
  3640570775,
  1161844396,
  3125318951,
  1431517754,
  545492359,
  4268468663,
  3499529547,
  1437099964,
  2702547544,
  3433638243,
  2581715763,
  2787789398,
  1060185593,
  1593081372,
  2418618748,
  4260947970,
  69676912,
  2159744348,
  86519011,
  2512459080,
  3838209314,
  1220612927,
  3339683548,
  133810670,
  1090789135,
  1078426020,
  1569222167,
  845107691,
  3583754449,
  4072456591,
  1091646820,
  628848692,
  1613405280,
  3757631651,
  526609435,
  236106946,
  48312990,
  2942717905,
  3402727701,
  1797494240,
  859738849,
  992217954,
  4005476642,
  2243076622,
  3870952857,
  3732016268,
  765654824,
  3490871365,
  2511836413,
  1685915746,
  3888969200,
  1414112111,
  2273134842,
  3281911079,
  4080962846,
  172450625,
  2569994100,
  980381355,
  4109958455,
  2819808352,
  2716589560,
  2568741196,
  3681446669,
  3329971472,
  1835478071,
  660984891,
  3704678404,
  4045999559,
  3422617507,
  3040415634,
  1762651403,
  1719377915,
  3470491036,
  2693910283,
  3642056355,
  3138596744,
  1364962596,
  2073328063,
  1983633131,
  926494387,
  3423689081,
  2150032023,
  4096667949,
  1749200295,
  3328846651,
  309677260,
  2016342300,
  1779581495,
  3079819751,
  111262694,
  1274766160,
  443224088,
  298511866,
  1025883608,
  3806446537,
  1145181785,
  168956806,
  3641502830,
  3584813610,
  1689216846,
  3666258015,
  3200248200,
  1692713982,
  2646376535,
  4042768518,
  1618508792,
  1610833997,
  3523052358,
  4130873264,
  2001055236,
  3610705100,
  2202168115,
  4028541809,
  2961195399,
  1006657119,
  2006996926,
  3186142756,
  1430667929,
  3210227297,
  1314452623,
  4074634658,
  4101304120,
  2273951170,
  1399257539,
  3367210612,
  3027628629,
  1190975929,
  2062231137,
  2333990788,
  2221543033,
  2438960610,
  1181637006,
  548689776,
  2362791313,
  3372408396,
  3104550113,
  3145860560,
  296247880,
  1970579870,
  3078560182,
  3769228297,
  1714227617,
  3291629107,
  3898220290,
  166772364,
  1251581989,
  493813264,
  448347421,
  195405023,
  2709975567,
  677966185,
  3703036547,
  1463355134,
  2715995803,
  1338867538,
  1343315457,
  2802222074,
  2684532164,
  233230375,
  2599980071,
  2000651841,
  3277868038,
  1638401717,
  4028070440,
  3237316320,
  6314154,
  819756386,
  300326615,
  590932579,
  1405279636,
  3267499572,
  3150704214,
  2428286686,
  3959192993,
  3461946742,
  1862657033,
  1266418056,
  963775037,
  2089974820,
  2263052895,
  1917689273,
  448879540,
  3550394620,
  3981727096,
  150775221,
  3627908307,
  1303187396,
  508620638,
  2975983352,
  2726630617,
  1817252668,
  1876281319,
  1457606340,
  908771278,
  3720792119,
  3617206836,
  2455994898,
  1729034894,
  1080033504,
  976866871,
  3556439503,
  2881648439,
  1522871579,
  1555064734,
  1336096578,
  3548522304,
  2579274686,
  3574697629,
  3205460757,
  3593280638,
  3338716283,
  3079412587,
  564236357,
  2993598910,
  1781952180,
  1464380207,
  3163844217,
  3332601554,
  1699332808,
  1393555694,
  1183702653,
  3581086237,
  1288719814,
  691649499,
  2847557200,
  2895455976,
  3193889540,
  2717570544,
  1781354906,
  1676643554,
  2592534050,
  3230253752,
  1126444790,
  2770207658,
  2633158820,
  2210423226,
  2615765581,
  2414155088,
  3127139286,
  673620729,
  2805611233,
  1269405062,
  4015350505,
  3341807571,
  4149409754,
  1057255273,
  2012875353,
  2162469141,
  2276492801,
  2601117357,
  993977747,
  3918593370,
  2654263191,
  753973209,
  36408145,
  2530585658,
  25011837,
  3520020182,
  2088578344,
  530523599,
  2918365339,
  1524020338,
  1518925132,
  3760827505,
  3759777254,
  1202760957,
  3985898139,
  3906192525,
  674977740,
  4174734889,
  2031300136,
  2019492241,
  3983892565,
  4153806404,
  3822280332,
  352677332,
  2297720250,
  60907813,
  90501309,
  3286998549,
  1016092578,
  2535922412,
  2839152426,
  457141659,
  509813237,
  4120667899,
  652014361,
  1966332200,
  2975202805,
  55981186,
  2327461051,
  676427537,
  3255491064,
  2882294119,
  3433927263,
  1307055953,
  942726286,
  933058658,
  2468411793,
  3933900994,
  4215176142,
  1361170020,
  2001714738,
  2830558078,
  3274259782,
  1222529897,
  1679025792,
  2729314320,
  3714953764,
  1770335741,
  151462246,
  3013232138,
  1682292957,
  1483529935,
  471910574,
  1539241949,
  458788160,
  3436315007,
  1807016891,
  3718408830,
  978976581,
  1043663428,
  3165965781,
  1927990952,
  4200891579,
  2372276910,
  3208408903,
  3533431907,
  1412390302,
  2931980059,
  4132332400,
  1947078029,
  3881505623,
  4168226417,
  2941484381,
  1077988104,
  1320477388,
  886195818,
  18198404,
  3786409e3,
  2509781533,
  112762804,
  3463356488,
  1866414978,
  891333506,
  18488651,
  661792760,
  1628790961,
  3885187036,
  3141171499,
  876946877,
  2693282273,
  1372485963,
  791857591,
  2686433993,
  3759982718,
  3167212022,
  3472953795,
  2716379847,
  445679433,
  3561995674,
  3504004811,
  3574258232,
  54117162,
  3331405415,
  2381918588,
  3769707343,
  4154350007,
  1140177722,
  4074052095,
  668550556,
  3214352940,
  367459370,
  261225585,
  2610173221,
  4209349473,
  3468074219,
  3265815641,
  314222801,
  3066103646,
  3808782860,
  282218597,
  3406013506,
  3773591054,
  379116347,
  1285071038,
  846784868,
  2669647154,
  3771962079,
  3550491691,
  2305946142,
  453669953,
  1268987020,
  3317592352,
  3279303384,
  3744833421,
  2610507566,
  3859509063,
  266596637,
  3847019092,
  517658769,
  3462560207,
  3443424879,
  370717030,
  4247526661,
  2224018117,
  4143653529,
  4112773975,
  2788324899,
  2477274417,
  1456262402,
  2901442914,
  1517677493,
  1846949527,
  2295493580,
  3734397586,
  2176403920,
  1280348187,
  1908823572,
  3871786941,
  846861322,
  1172426758,
  3287448474,
  3383383037,
  1655181056,
  3139813346,
  901632758,
  1897031941,
  2986607138,
  3066810236,
  3447102507,
  1393639104,
  373351379,
  950779232,
  625454576,
  3124240540,
  4148612726,
  2007998917,
  544563296,
  2244738638,
  2330496472,
  2058025392,
  1291430526,
  424198748,
  50039436,
  29584100,
  3605783033,
  2429876329,
  2791104160,
  1057563949,
  3255363231,
  3075367218,
  3463963227,
  1469046755,
  985887462
];
var C_ORIG = [
  1332899944,
  1700884034,
  1701343084,
  1684370003,
  1668446532,
  1869963892
];
function _encipher(lr, off, P, S) {
  var n, l = lr[off], r = lr[off + 1];
  l ^= P[0];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[1];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[2];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[3];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[4];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[5];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[6];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[7];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[8];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[9];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[10];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[11];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[12];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[13];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[14];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[15];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[16];
  lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
  lr[off + 1] = l;
  return lr;
}
__name(_encipher, "_encipher");
function _streamtoword(data, offp) {
  for (var i = 0, word = 0; i < 4; ++i)
    word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
  return { key: word, offp };
}
__name(_streamtoword, "_streamtoword");
function _key(key, P, S) {
  var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
  for (i = 0; i < plen; i += 2)
    lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
__name(_key, "_key");
function _ekskey(data, key, P, S) {
  var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
  offp = 0;
  for (i = 0; i < plen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
__name(_ekskey, "_ekskey");
function _crypt(b, salt, rounds, callback, progressCallback) {
  var cdata = C_ORIG.slice(), clen = cdata.length, err;
  if (rounds < 4 || rounds > 31) {
    err = Error("Illegal number of rounds (4-31): " + rounds);
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.length !== BCRYPT_SALT_LEN) {
    err = Error(
      "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
    );
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  rounds = 1 << rounds >>> 0;
  var P, S, i = 0, j;
  if (typeof Int32Array === "function") {
    P = new Int32Array(P_ORIG);
    S = new Int32Array(S_ORIG);
  } else {
    P = P_ORIG.slice();
    S = S_ORIG.slice();
  }
  _ekskey(salt, b, P, S);
  function next() {
    if (progressCallback) progressCallback(i / rounds);
    if (i < rounds) {
      var start = Date.now();
      for (; i < rounds; ) {
        i = i + 1;
        _key(b, P, S);
        _key(salt, P, S);
        if (Date.now() - start > MAX_EXECUTION_TIME) break;
      }
    } else {
      for (i = 0; i < 64; i++)
        for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
      var ret = [];
      for (i = 0; i < clen; i++)
        ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
      if (callback) {
        callback(null, ret);
        return;
      } else return ret;
    }
    if (callback) nextTick(next);
  }
  __name(next, "next");
  if (typeof callback !== "undefined") {
    next();
  } else {
    var res;
    while (true) if (typeof (res = next()) !== "undefined") return res || [];
  }
}
__name(_crypt, "_crypt");
function _hash(password, salt, callback, progressCallback) {
  var err;
  if (typeof password !== "string" || typeof salt !== "string") {
    err = Error("Invalid string / salt: Not a string");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var minor, offset;
  if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
    err = Error("Invalid salt version: " + salt.substring(0, 2));
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.charAt(2) === "$") minor = String.fromCharCode(0), offset = 3;
  else {
    minor = salt.charAt(2);
    if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
      err = Error("Invalid salt revision: " + salt.substring(2, 4));
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else throw err;
    }
    offset = 4;
  }
  if (salt.charAt(offset + 2) > "$") {
    err = Error("Missing salt rounds");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
  password += minor >= "a" ? "\0" : "";
  var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
  function finish(bytes) {
    var res = [];
    res.push("$2");
    if (minor >= "a") res.push(minor);
    res.push("$");
    if (rounds < 10) res.push("0");
    res.push(rounds.toString());
    res.push("$");
    res.push(base64_encode(saltb, saltb.length));
    res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
    return res.join("");
  }
  __name(finish, "finish");
  if (typeof callback == "undefined")
    return finish(_crypt(passwordb, saltb, rounds));
  else {
    _crypt(
      passwordb,
      saltb,
      rounds,
      function(err2, bytes) {
        if (err2) callback(err2, null);
        else callback(null, finish(bytes));
      },
      progressCallback
    );
  }
}
__name(_hash, "_hash");
function encodeBase64(bytes, length) {
  return base64_encode(bytes, length);
}
__name(encodeBase64, "encodeBase64");
function decodeBase64(string, length) {
  return base64_decode(string, length);
}
__name(decodeBase64, "decodeBase64");
var bcryptjs_default = {
  setRandomFallback,
  genSaltSync,
  genSalt,
  hashSync,
  hash,
  compareSync,
  compare,
  getRounds,
  getSalt,
  truncates,
  encodeBase64,
  decodeBase64
};

// src/index.ts
var attempts = /* @__PURE__ */ new Map();
var RL_MAX = 5;
var RL_WINDOW_MS = 6e4;
async function hmacHex(algo, key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: algo }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  const bytes = new Uint8Array(signature);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacHex, "hmacHex");
async function sendMail(env, toEmail, subject, html) {
  const fromEmail = String(env.GMAIL_SENDER_EMAIL || env.GMAIL_USER || "no-reply@example.com");
  const fromName = String(env.GMAIL_SENDER_NAME || "CTBOOKING");
  const payload = {
    personalizations: [{ to: [{ email: toEmail }] }],
    from: { email: fromEmail, name: fromName },
    subject,
    content: [{ type: "text/html", value: html }]
  };
  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.ok;
}
__name(sendMail, "sendMail");
var index_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = /* @__PURE__ */ new Set([
      "https://cinesphere.com.vn",
      "https://www.cinesphere.com.vn",
      "https://cinema-pages.pages.dev"
    ]);
    const allowOrigin = origin && allowed.has(origin) ? origin : "https://cinesphere.com.vn";
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "Content-Type,Authorization,Accept,Origin,Referer",
      "Access-Control-Expose-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "unsafe-none"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const json = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...cors } }), "json");
    const notFound = /* @__PURE__ */ __name(() => new Response("Not found", { status: 404, headers: cors }), "notFound");
    const badRequest = /* @__PURE__ */ __name((message = "Bad Request") => json({ message }, 400), "badRequest");
    const methodNotAllowed = /* @__PURE__ */ __name(() => json({ message: "Method Not Allowed" }, 405), "methodNotAllowed");
    const noStoreHeaders = { ...cors, "Cache-Control": "no-store" };
    const rlKey = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateLimitCheck = /* @__PURE__ */ __name((max = RL_MAX, windowMs = RL_WINDOW_MS) => {
      const now = Date.now();
      const list = attempts.get(rlKey) ?? [];
      const filtered = list.filter((ts) => now - ts < windowMs);
      if (filtered.length >= max) {
        return { ok: false, remaining: 0, windowMs };
      }
      filtered.push(now);
      attempts.set(rlKey, filtered);
      const remaining = Math.max(0, max - filtered.length);
      return { ok: true, remaining, windowMs };
    }, "rateLimitCheck");
    if (url.pathname === "/") return json({ ok: true, service: "cinema-worker", time: Date.now() });
    if (url.pathname === "/api/ping" && request.method === "GET") return json({ message: "ping" });
    if (url.pathname === "/api/getActiveMovies" && request.method === "POST") {
      const stmt = env.cinema_db.prepare(
        `SELECT id, title, description, cover_image, detail_images, genres, rating, duration_min, release_date, is_active FROM movies WHERE is_active = 1 ORDER BY release_date DESC;`
      );
      const result = await stmt.all();
      const rows = Array.isArray(result.results) ? result.results : [];
      const activeMovies = rows.map((m) => ({
        id: Number(m.id),
        title: String(m.title || ""),
        description: m.description ?? "",
        cover_image: m.cover_image ?? "",
        detail_images: (() => {
          const v = m.detail_images;
          if (v === null || v === void 0) return "[]";
          try {
            return typeof v === "string" ? v : JSON.stringify(v);
          } catch {
            return "[]";
          }
        })(),
        genres: (() => {
          const v = m.genres;
          if (v === null || v === void 0) return "[]";
          try {
            return typeof v === "string" ? v : JSON.stringify(v);
          } catch {
            return "[]";
          }
        })(),
        rating: (() => {
          try {
            const r = m.rating;
            return r === null || r === void 0 ? "0" : String(r);
          } catch {
            return "0";
          }
        })(),
        duration_min: (() => {
          try {
            return Number(m.duration_min ?? 0);
          } catch {
            return 0;
          }
        })(),
        release_date: m.release_date ?? null,
        price: 0
      }));
      return json({ activeMovies });
    }
    if (url.pathname === "/api/movies" && request.method === "GET") {
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 10);
      const q = String(url.searchParams.get("q") || "");
      const sortKeyRaw = String(url.searchParams.get("sort") || "updated_at").toLowerCase();
      const dir = String(url.searchParams.get("dir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
      const offset = (page - 1) * pageSize;
      const allowedSort = /* @__PURE__ */ new Set(["updated_at", "release_date", "title", "rating"]);
      const sortKey = allowedSort.has(sortKeyRaw) ? sortKeyRaw : "updated_at";
      const whereParts = [];
      const bind = [];
      if (q) {
        whereParts.push(`(title LIKE ? OR description LIKE ?)`);
        const like = `%${q}%`;
        bind.push(like, like);
      }
      const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
      const totalRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM movies ${where}`).bind(...bind).first();
      const total = Number(totalRow?.c || 0);
      const rows = await env.cinema_db.prepare(`SELECT id, title, description, cover_image, genres, rating, duration_min, is_active, release_date, created_at, updated_at FROM movies ${where} ORDER BY ${sortKey} ${dir} LIMIT ? OFFSET ?`).bind(...bind, pageSize, offset).all();
      const items = Array.isArray(rows.results) ? rows.results.map((m) => {
        const ci = m?.cover_image;
        return {
          ...m,
          cover_image: typeof ci === "string" && ci.startsWith("/uploads/") ? `${url.origin}${ci}` : ci
        };
      }) : [];
      return json({ items, page, pageSize, total });
    }
    if (url.pathname === "/api/movies" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.title) return badRequest("Thi\u1EBFu ti\xEAu \u0111\u1EC1 phim");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const savedCover = await (async () => {
        try {
          if (env.r2_cinemastore && typeof body.cover_image_base64 === "string" && body.cover_image_base64.startsWith("data:")) {
            const m = body.cover_image_base64.match(/^data:(.+);base64,(.+)$/);
            if (!m) return body.cover_image ?? null;
            const mime = String(m[1] || "application/octet-stream").toLowerCase();
            const raw = String(m[2] || "");
            const bstr = atob(raw);
            const bytes = new Uint8Array(bstr.length);
            for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);
            const ext = mime.includes("webp") ? "webp" : mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpeg" : mime.includes("jpg") ? "jpg" : "bin";
            const key = `uploads/movies/movie_${Date.now()}.${ext}`;
            await env.r2_cinemastore.put(key, bytes, { httpMetadata: { contentType: mime } });
            return `/${key}`;
          }
          return body.cover_image ?? null;
        } catch {
          return body.cover_image ?? null;
        }
      })();
      const stmt = env.cinema_db.prepare(
        `INSERT INTO movies (title, description, cover_image, detail_images, genres, rating, duration_min, is_active, release_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        String(body.title),
        body.description ?? null,
        savedCover,
        typeof body.detail_images === "string" ? body.detail_images : JSON.stringify(body.detail_images ?? []),
        typeof body.genres === "string" ? body.genres : JSON.stringify(body.genres ?? []),
        body.rating ?? null,
        body.duration_min ?? null,
        body.is_active ?? 1,
        body.release_date ?? null,
        now,
        now
      );
      const res = await stmt.run();
      const id = res.success ? Number(res.meta.last_row_id ?? 0) : 0;
      const movie = await env.cinema_db.prepare(`SELECT * FROM movies WHERE id = ?`).bind(id).first();
      return json({ movie }, 201);
    }
    if (/^\/api\/movies\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const movie = await env.cinema_db.prepare(`SELECT * FROM movies WHERE id = ?`).bind(id).first();
      if (!movie) return notFound();
      const ci = movie?.cover_image;
      const mapped = {
        ...movie,
        cover_image: typeof ci === "string" && ci.startsWith("/uploads/") ? `${url.origin}${ci}` : ci
      };
      return json(mapped);
    }
    if (/^\/api\/movies\/\d+$/.test(url.pathname) && request.method === "PUT") {
      const id = Number(url.pathname.split("/").pop());
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const oldRow = await env.cinema_db.prepare(`SELECT cover_image FROM movies WHERE id = ?`).bind(id).first();
      const oldCover = String(oldRow?.cover_image || "");
      const coverUpdate = await (async () => {
        try {
          if (env.r2_cinemastore && typeof body.cover_image_base64 === "string" && body.cover_image_base64.startsWith("data:")) {
            const m = body.cover_image_base64.match(/^data:(.+);base64,(.+)$/);
            if (!m) return body.cover_image ?? null;
            const mime = String(m[1] || "application/octet-stream").toLowerCase();
            const raw = String(m[2] || "");
            const bstr = atob(raw);
            const bytes = new Uint8Array(bstr.length);
            for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);
            const ext = mime.includes("webp") ? "webp" : mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpeg" : mime.includes("jpg") ? "jpg" : "bin";
            const key = `uploads/movies/movie_${Date.now()}.${ext}`;
            await env.r2_cinemastore.put(key, bytes, { httpMetadata: { contentType: mime } });
            return `/${key}`;
          }
          if (body.cover_image !== void 0) return body.cover_image ?? null;
          return void 0;
        } catch {
          return void 0;
        }
      })();
      await env.cinema_db.prepare(
        `UPDATE movies SET title = COALESCE(?, title), description = COALESCE(?, description), cover_image = COALESCE(?, cover_image), detail_images = COALESCE(?, detail_images), genres = COALESCE(?, genres), rating = COALESCE(?, rating), duration_min = COALESCE(?, duration_min), is_active = COALESCE(?, is_active), release_date = COALESCE(?, release_date), updated_at = ? WHERE id = ?`
      ).bind(
        body.title ?? null,
        body.description ?? null,
        coverUpdate === void 0 ? null : coverUpdate,
        typeof body.detail_images === "string" ? body.detail_images : JSON.stringify(body.detail_images ?? null),
        typeof body.genres === "string" ? body.genres : JSON.stringify(body.genres ?? null),
        body.rating ?? null,
        body.duration_min ?? null,
        body.is_active ?? null,
        body.release_date ?? null,
        now,
        id
      ).run();
      if (env.r2_cinemastore && typeof coverUpdate === "string" && coverUpdate !== oldCover && oldCover.startsWith("/uploads/")) {
        const oldKey = oldCover.replace(/^\//, "");
        try {
          await env.r2_cinemastore.delete(oldKey);
        } catch {
        }
      }
      const movie = await env.cinema_db.prepare(`SELECT * FROM movies WHERE id = ?`).bind(id).first();
      return json({ movie });
    }
    if (url.pathname.startsWith("/uploads/") && request.method === "GET") {
      const key = url.pathname.slice(1);
      try {
        const obj = await env.r2_cinemastore.get(key);
        if (!obj) return notFound();
        const ct = obj.httpMetadata?.contentType || "application/octet-stream";
        return new Response(obj.body, { headers: { "content-type": ct, "cache-control": "public, max-age=31536000, immutable" } });
      } catch {
        return notFound();
      }
    }
    if (/^\/api\/movies\/\d+$/.test(url.pathname) && request.method === "DELETE") {
      const id = Number(url.pathname.split("/").pop());
      await env.cinema_db.prepare(`DELETE FROM movies WHERE id = ?`).bind(id).run();
      return json({ ok: true });
    }
    if (/^\/api\/movies\/detail\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const movie = await env.cinema_db.prepare(`SELECT * FROM movies WHERE id = ?`).bind(id).first();
      if (!movie) return notFound();
      const statsRow = await env.cinema_db.prepare(`SELECT SUM(ticket_count) as total_tickets, SUM(total_price) as total_revenue, COUNT(*) as successful_bookings FROM bookings WHERE movie_id = ? AND payment_status IN ('paid')`).bind(id).first();
      const totalTicketsSold = Number(statsRow?.total_tickets || 0);
      const totalRevenue = Number(statsRow?.total_revenue || 0);
      const successfulBookings = Number(statsRow?.successful_bookings || 0);
      const mapped = {
        id: movie.id,
        title: movie.title,
        description: movie.description || "Kh\xF4ng c\xF3 m\xF4 t\u1EA3",
        cover_image: (() => {
          const ci = movie.cover_image || null;
          if (typeof ci === "string" && ci.startsWith("/uploads/")) return `${url.origin}${ci}`;
          return ci;
        })(),
        genres: (() => {
          const v = movie.genres;
          try {
            return typeof v === "string" ? JSON.parse(v) : Array.isArray(v) ? v : [];
          } catch {
            return [];
          }
        })(),
        rating: Number(movie.rating ?? 0),
        duration_min: Number(movie.duration_min ?? 0),
        price: 0,
        is_active: Boolean(movie.is_active !== 0),
        release_date: movie.release_date || null,
        created_at: movie.created_at,
        updated_at: movie.updated_at,
        stats: {
          totalTicketsSold,
          totalRevenue,
          successfulBookings
        }
      };
      return json(mapped);
    }
    if (url.pathname === "/api/tickets" && request.method === "GET") {
      const res = await env.cinema_db.prepare(`SELECT * FROM ticket_packages ORDER BY display_order ASC, price ASC`).all();
      const items = Array.isArray(res.results) ? res.results : [];
      return json({ items });
    }
    if (url.pathname === "/api/tickets/active" && request.method === "GET") {
      const res = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE is_active = 1 ORDER BY display_order ASC, price ASC`).all();
      const items = Array.isArray(res.results) ? res.results : [];
      return json({ items });
    }
    if (/^\/api\/tickets\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const item = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE id = ?`).bind(id).first();
      if (!item) return notFound();
      return json(item);
    }
    if (url.pathname === "/api/tickets" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.name || !body.price) return badRequest("Thi\u1EBFu d\u1EEF li\u1EC7u");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const res = await env.cinema_db.prepare(`INSERT INTO ticket_packages (name, code, description, price, features, type, min_group_size, max_group_size, is_member_only, is_active, display_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        body.name,
        body.code ?? null,
        body.description ?? null,
        body.price,
        typeof body.features === "string" ? body.features : JSON.stringify(body.features ?? null),
        body.type ?? null,
        body.min_group_size ?? null,
        body.max_group_size ?? null,
        body.is_member_only ? 1 : 0,
        body.is_active ? 1 : 1,
        body.display_order ?? 0,
        now,
        now
      ).run();
      const id = Number(res.meta.last_row_id ?? 0);
      const item = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE id = ?`).bind(id).first();
      return json({ item }, 201);
    }
    if (/^\/api\/tickets\/\d+$/.test(url.pathname) && request.method === "PUT") {
      const id = Number(url.pathname.split("/").pop());
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await env.cinema_db.prepare(`UPDATE ticket_packages SET name = COALESCE(?, name), code = COALESCE(?, code), description = COALESCE(?, description), price = COALESCE(?, price), features = COALESCE(?, features), type = COALESCE(?, type), min_group_size = COALESCE(?, min_group_size), max_group_size = COALESCE(?, max_group_size), is_member_only = COALESCE(?, is_member_only), is_active = COALESCE(?, is_active), display_order = COALESCE(?, display_order), updated_at = ? WHERE id = ?`).bind(
        body.name ?? null,
        body.code ?? null,
        body.description ?? null,
        body.price ?? null,
        typeof body.features === "string" ? body.features : JSON.stringify(body.features ?? null),
        body.type ?? null,
        body.min_group_size ?? null,
        body.max_group_size ?? null,
        body.is_member_only == null ? null : body.is_member_only ? 1 : 0,
        body.is_active == null ? null : body.is_active ? 1 : 0,
        body.display_order ?? null,
        now,
        id
      ).run();
      const item = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE id = ?`).bind(id).first();
      return json({ item });
    }
    if (/^\/api\/tickets\/\d+$/.test(url.pathname) && request.method === "DELETE") {
      const id = Number(url.pathname.split("/").pop());
      await env.cinema_db.prepare(`DELETE FROM ticket_packages WHERE id = ?`).bind(id).run();
      return json({ ok: true });
    }
    if (url.pathname === "/api/toys" && request.method === "GET") {
      const res = await env.cinema_db.prepare(`SELECT * FROM toys ORDER BY updated_at DESC, id DESC`).all();
      const items = Array.isArray(res.results) ? res.results : [];
      return json({ items });
    }
    if (url.pathname === "/api/toys/active" && request.method === "GET") {
      const res = await env.cinema_db.prepare(`SELECT * FROM toys WHERE status = 'active' ORDER BY created_at DESC`).all();
      const items = Array.isArray(res.results) ? res.results : [];
      return json({ items });
    }
    if (/^\/api\/toys\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const item = await env.cinema_db.prepare(`SELECT * FROM toys WHERE id = ?`).bind(id).first();
      if (!item) return notFound();
      return json(item);
    }
    if (url.pathname === "/api/toys" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.name) return badRequest("Thi\u1EBFu d\u1EEF li\u1EC7u");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const res = await env.cinema_db.prepare(`INSERT INTO toys (name, category, price, stock, status, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        body.name,
        body.category ?? null,
        body.price ?? 0,
        body.stock ?? 0,
        body.status ?? "active",
        body.image_url ?? null,
        now,
        now
      ).run();
      const id = Number(res.meta.last_row_id ?? 0);
      const item = await env.cinema_db.prepare(`SELECT * FROM toys WHERE id = ?`).bind(id).first();
      return json({ item }, 201);
    }
    if (/^\/api\/toys\/\d+$/.test(url.pathname) && request.method === "PUT") {
      const id = Number(url.pathname.split("/").pop());
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await env.cinema_db.prepare(`UPDATE toys SET name = COALESCE(?, name), category = COALESCE(?, category), price = COALESCE(?, price), stock = COALESCE(?, stock), status = COALESCE(?, status), image_url = COALESCE(?, image_url), updated_at = ? WHERE id = ?`).bind(
        body.name ?? null,
        body.category ?? null,
        body.price ?? null,
        body.stock ?? null,
        body.status ?? null,
        body.image_url ?? null,
        now,
        id
      ).run();
      const item = await env.cinema_db.prepare(`SELECT * FROM toys WHERE id = ?`).bind(id).first();
      return json({ item });
    }
    if (/^\/api\/toys\/\d+$/.test(url.pathname) && request.method === "DELETE") {
      const id = Number(url.pathname.split("/").pop());
      await env.cinema_db.prepare(`DELETE FROM toys WHERE id = ?`).bind(id).run();
      return json({ ok: true });
    }
    if (url.pathname === "/api/forget-password" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const email = body?.email;
      if (!email) return badRequest("Thi\u1EBFu email");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(email).first();
      if (!acc) return json({ status: "error", message: "Email kh\xF4ng t\u1ED3n t\u1EA1i!" }, 400);
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      const token = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
      const expiredAt = new Date(Date.now() + 3600 * 1e3).toISOString();
      await env.cinema_db.prepare(`INSERT INTO tokens (account_id, type, token, expired_at, created_at) VALUES (?, 'reset_password', ?, ?, ?)`).bind(Number(acc.id), token, expiredAt, (/* @__PURE__ */ new Date()).toISOString()).run();
      const base = env.VITE_SERVER_BASE_URL || "https://cinesphere.com.vn";
      const link = `${base}/reset-password?token=${token}`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>\u0110\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u</title></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;"><div style="max-width:600px;margin:20px auto;padding:20px;border:1px solid #ddd;border-radius:8px;"><h2 style="color:#007bff;">Y\xEAu c\u1EA7u \u0110\u1EB7t l\u1EA1i M\u1EADt kh\u1EA9u</h2><p>Ch\xFAng t\xF4i nh\u1EADn \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u cho t\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n.</p><p>Vui l\xF2ng nh\u1EA5p v\xE0o n\xFAt d\u01B0\u1EDBi \u0111\xE2y \u0111\u1EC3 t\u1EA1o m\u1EADt kh\u1EA9u m\u1EDBi. Li\xEAn k\u1EBFt n\xE0y s\u1EBD h\u1EBFt h\u1EA1n sau 1 gi\u1EDD.</p><p style="text-align:center;margin:30px 0;"><a href="${link}" style="display:inline-block;padding:10px 20px;background-color:#dc3545;color:#ffffff;text-decoration:none;border-radius:5px;font-weight:bold;">\u0110\u1EB7t l\u1EA1i M\u1EADt kh\u1EA9u</a></p><p>N\u1EBFu b\u1EA1n kh\xF4ng y\xEAu c\u1EA7u thay \u0111\u1ED5i m\u1EADt kh\u1EA9u, vui l\xF2ng b\u1ECF qua email n\xE0y.</p><p>Tr\xE2n tr\u1ECDng,<br>\u0110\u1ED9i ng\u0169 CTBOOKING</p></div></body></html>`;
      try {
        await sendMail(env, String(email), "\u0110\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u - CTBOOKING", html);
      } catch {
      }
      return json({ status: "success", message: "\u0110\xE3 g\u1EEDi y\xEAu c\u1EA7u \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u", link });
    }
    if (url.pathname === "/api/reset-password" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const token = body?.token;
      const newPassword = body?.newPassword;
      if (!token || !newPassword) return badRequest("Thi\u1EBFu d\u1EEF li\u1EC7u");
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const tokenRecord = await env.cinema_db.prepare(`SELECT * FROM tokens WHERE token = ? AND type = 'reset_password' AND expired_at >= ? LIMIT 1`).bind(token, nowIso).first();
      if (!tokenRecord) return json({ status: "error", message: "Token kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n!" }, 400);
      const hashed = await bcryptjs_default.hash(String(newPassword), 10);
      await env.cinema_db.prepare(`UPDATE accounts SET password = ? WHERE id = ?`).bind(hashed, Number(tokenRecord.account_id)).run();
      await env.cinema_db.prepare(`DELETE FROM tokens WHERE id = ?`).bind(Number(tokenRecord.id)).run();
      return json({ status: "success", message: "M\u1EADt kh\u1EA9u \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u1EB7t l\u1EA1i th\xE0nh c\xF4ng!" });
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.email || !body.password) return badRequest("Thi\u1EBFu th\xF4ng tin \u0111\u0103ng nh\u1EADp");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(body.email).first();
      if (!acc || !acc.password) return json({ status: "error", message: "Email kh\xF4ng t\u1ED3n t\u1EA1i!" }, 400);
      const ok = await bcryptjs_default.compare(String(body.password), String(acc.password));
      if (!ok) return json({ status: "error", message: "M\u1EADt kh\u1EA9u kh\xF4ng \u0111\xFAng!" }, 400);
      const user = await env.cinema_db.prepare(`SELECT * FROM users WHERE id = ?`).bind(Number(acc.user_id)).first();
      return json({ status: "success", message: "\u0110\u0103ng nh\u1EADp th\xE0nh c\xF4ng!", user: { username: user?.fullname ?? null, email: body.email } });
    }
    if (url.pathname === "/api/register" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.email || !body.password) return badRequest("Thi\u1EBFu d\u1EEF li\u1EC7u");
      const existed = await env.cinema_db.prepare(`SELECT id FROM accounts WHERE email = ?`).bind(body.email).first();
      if (existed) return json({ status: "error", message: "Email \u0111\xE3 t\u1ED3n t\u1EA1i!" }, 400);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const userRes = await env.cinema_db.prepare(`INSERT INTO users (fullname, phone, created_at, updated_at) VALUES (?, ?, ?, ?)`).bind(body.name ?? null, body.phone ?? null, now, now).run();
      const userId = Number(userRes.meta.last_row_id ?? 0);
      const hashed = await bcryptjs_default.hash(String(body.password), 10);
      await env.cinema_db.prepare(`INSERT INTO accounts (user_id, email, password, login_type, is_active, created_at, updated_at) VALUES (?, ?, ?, 'email', 1, ?, ?)`).bind(userId, body.email, hashed, now, now).run();
      try {
        const displayName = typeof body.name === "string" && body.name.trim() ? body.name : String(body.email).split("@")[0];
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ch\xE0o m\u1EEBng</title></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;"><div style="max-width:600px;margin:20px auto;padding:20px;border:1px solid #ddd;border-radius:8px;"><h2 style="color:#28a745;">Ch\xE0o m\u1EEBng b\u1EA1n \u0111\u1EBFn CINESPHERE</h2><p>Xin ch\xE0o ${displayName},</p><p>T\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng.</p><p>Ch\xFAc b\u1EA1n c\xF3 tr\u1EA3i nghi\u1EC7m \u0111\u1EB7t v\xE9 tuy\u1EC7t v\u1EDDi!</p><p>Tr\xE2n tr\u1ECDng,<br>\u0110\u1ED9i ng\u0169 CTBOOKING</p></div></body></html>`;
        await sendMail(env, String(body.email), "\u{1F389} Ch\xE0o m\u1EEBng b\u1EA1n \u0111\u1EBFn CINESPHERE", html);
      } catch {
      }
      const username = typeof body.name === "string" && body.name.trim() ? String(body.name).trim() : String(body.email).split("@")[0];
      return json({ status: "success", message: "\u0110\u0103ng k\xFD th\xE0nh c\xF4ng!", user: { id: userId, email: String(body.email), username } }, 201);
    }
    if (url.pathname === "/api/users" && request.method === "GET") {
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
      const q = String(url.searchParams.get("q") ?? "");
      const offset = (page - 1) * pageSize;
      const where = q ? `%${q}%` : null;
      const base = q ? `SELECT u.*, (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) as total_bookings, (SELECT email FROM accounts a WHERE a.user_id = u.id LIMIT 1) as email, (SELECT is_active FROM accounts a WHERE a.user_id = u.id LIMIT 1) as is_active FROM users u WHERE u.fullname LIKE ? OR u.phone LIKE ? ORDER BY u.created_at DESC LIMIT ? OFFSET ?` : `SELECT u.*, (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) as total_bookings, (SELECT email FROM accounts a WHERE a.user_id = u.id LIMIT 1) as email, (SELECT is_active FROM accounts a WHERE a.user_id = u.id LIMIT 1) as is_active FROM users u ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
      const stmt = q ? env.cinema_db.prepare(base).bind(where, where, pageSize, offset) : env.cinema_db.prepare(base).bind(pageSize, offset);
      const res = await stmt.all();
      const items = Array.isArray(res.results) ? res.results : [];
      const countRes = q ? await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM users WHERE fullname LIKE ? OR phone LIKE ?`).bind(where, where).first() : await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM users`).first();
      const total = Number(countRes?.c ?? 0);
      return json({ items, page, pageSize, total });
    }
    if (/^\/api\/users\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const base = await env.cinema_db.prepare(
        `SELECT u.*, 
            (SELECT email FROM accounts a WHERE a.user_id = u.id LIMIT 1) as email,
            (SELECT is_active FROM accounts a WHERE a.user_id = u.id LIMIT 1) as is_active,
            (SELECT login_type FROM accounts a WHERE a.user_id = u.id LIMIT 1) as login_type,
            (SELECT created_at FROM accounts a WHERE a.user_id = u.id LIMIT 1) as account_created_at
          FROM users u WHERE u.id = ?`
      ).bind(id).first();
      if (!base) return notFound();
      const totalRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE user_id = ?`).bind(id).first();
      const bookings = await env.cinema_db.prepare(
        `SELECT b.id, b.ticket_count, b.total_price, b.payment_method, b.payment_status, b.created_at, m.title as movie_title, t.name as ticket_package_name
           FROM bookings b 
           LEFT JOIN movies m ON m.id = b.movie_id 
           LEFT JOIN ticket_packages t ON t.id = b.ticket_package_id 
           WHERE b.user_id = ? 
           ORDER BY b.created_at DESC 
           LIMIT 10`
      ).bind(id).all();
      const recent_bookings = (bookings.results || []).map((b) => ({
        id: b.id,
        movie_title: b.movie_title || "N/A",
        ticket_count: Number(b.ticket_count || 0),
        total_price: Number(b.total_price || 0),
        payment_method: b.payment_method || "",
        payment_status: b.payment_status || "",
        created_at: b.created_at
      }));
      return json({
        id: base.id,
        fullname: base.fullname || "N/A",
        phone: base.phone || "N/A",
        email: base.email || "N/A",
        avatar: base.avatar || null,
        is_active: Boolean(base.is_active ?? true),
        login_type: base.login_type || "email",
        account_created_at: base.account_created_at,
        user_created_at: base.created_at,
        user_updated_at: base.updated_at,
        recent_bookings,
        total_bookings: Number(totalRow?.c || 0)
      });
    }
    if (url.pathname === "/api/users/profile" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.email) return badRequest("Thi\u1EBFu email");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(body.email).first();
      if (!acc) return json({ message: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n" }, 404);
      const normalizedGender = (() => {
        try {
          const g = typeof body.gender === "string" ? body.gender.trim().toLowerCase() : "";
          return g === "male" || g === "female" ? g : null;
        } catch {
          return null;
        }
      })();
      const dobDate = (() => {
        try {
          if (!body.dob) return null;
          const d = new Date(body.dob);
          return isNaN(d.getTime()) ? null : d.toISOString();
        } catch {
          return null;
        }
      })();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await env.cinema_db.prepare(`UPDATE users SET fullname = COALESCE(?, fullname), phone = COALESCE(?, phone), gender = COALESCE(?, gender), dob = COALESCE(?, dob), updated_at = ? WHERE id = ?`).bind(
        typeof body.name === "string" ? body.name : null,
        typeof body.phone === "string" ? body.phone : null,
        normalizedGender,
        dobDate,
        now,
        Number(acc.user_id)
      ).run();
      const user = await env.cinema_db.prepare(`SELECT * FROM users WHERE id = ?`).bind(Number(acc.user_id)).first();
      return json({ ok: true, user: { id: user?.id, fullname: user?.fullname, phone: user?.phone, gender: user?.gender ?? null, dob: user?.dob ?? null, email: body.email } });
    }
    if (url.pathname === "/api/users/password" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.email || !body.password) return badRequest("Thi\u1EBFu d\u1EEF li\u1EC7u");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(body.email).first();
      if (!acc) return json({ message: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n" }, 404);
      const hashed = await bcryptjs_default.hash(String(body.password), 10);
      await env.cinema_db.prepare(`UPDATE accounts SET password = ? WHERE id = ?`).bind(hashed, Number(acc.id)).run();
      return json({ ok: true });
    }
    if (url.pathname === "/api/validate-booking" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const email = body.email;
      const emailBook = body.emailBook;
      const phone = body.phone;
      const name = body.name;
      const movieId = body.movieId ? Number(body.movieId) : null;
      const ticketCount = Number(body.ticketCount);
      const ticketPackageId = body.ticketPackageId ? Number(body.ticketPackageId) : null;
      if (!email || !emailBook || !phone || !name || !ticketCount || ticketCount <= 0) return badRequest("Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 th\xF4ng tin h\u1EE3p l\u1EC7.");
      if (ticketCount > 10) return badRequest("M\u1ED7i l\u01B0\u1EE3t ch\u1EC9 \u0111\u1EB7t t\u1ED1i \u0111a 10 v\xE9.");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(email).first();
      if (!acc) return json({ ok: false, message: "Ng\u01B0\u1EDDi d\xF9ng kh\xF4ng t\u1ED3n t\u1EA1i." }, 404);
      const user = await env.cinema_db.prepare(`SELECT * FROM users WHERE id = ?`).bind(Number(acc.user_id)).first();
      let movie = null;
      if (movieId) {
        movie = await env.cinema_db.prepare(`SELECT * FROM movies WHERE id = ?`).bind(movieId).first();
        if (!movie || Number(movie.is_active) === 0) return json({ ok: false, message: "Phim kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 ng\u1EEBng ho\u1EA1t \u0111\u1ED9ng." }, 404);
      }
      let ticketPackage = null;
      if (ticketPackageId) {
        ticketPackage = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE id = ?`).bind(ticketPackageId).first();
        if (!ticketPackage || Number(ticketPackage.is_active) === 0) return json({ ok: false, message: "G\xF3i v\xE9 kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 t\u1EAFt." }, 404);
      } else {
        const res = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE is_active = 1 ORDER BY display_order ASC, price ASC LIMIT 1`).all();
        ticketPackage = Array.isArray(res.results) && res.results.length ? res.results[0] : null;
        if (!ticketPackage) return json({ ok: false, message: "Kh\xF4ng t\xECm th\u1EA5y g\xF3i v\xE9 kh\u1EA3 d\u1EE5ng." }, 400);
      }
      const unitPrice = Number(ticketPackage.price || 0);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return json({ ok: false, message: "Gi\xE1 v\xE9 kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
      const totalPrice = unitPrice * ticketCount;
      return json({
        ok: true,
        user: { id: Number(user?.id), email: String(email), fullname: user?.fullname ?? null, phone: user?.phone ?? null },
        movie: movie ? { id: Number(movie.id), title: String(movie.title || ""), is_active: Number(movie.is_active) ? true : false, duration_min: Number(movie.duration_min ?? 0) } : void 0,
        ticketPackage: { id: Number(ticketPackage.id), name: String(ticketPackage.name || ""), price: Number(ticketPackage.price || 0) },
        unitPrice,
        totalPrice
      });
    }
    if (url.pathname === "/api/create-booking" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const email = String(body.email || "");
      const emailBook = String(body.emailBook || body.email || "");
      const phone = String(body.phone || "");
      const name = String(body.name || "");
      const movieId = body.movieId ? Number(body.movieId) : null;
      const ticketPackageId = body.ticketPackageId ? Number(body.ticketPackageId) : null;
      const ticketCount = Number(body.ticketCount || 0);
      const paymentMethod = String(body.paymentMethod || "cash").toLowerCase();
      if (!email || !emailBook || !phone || !name || !ticketCount || ticketCount <= 0) return badRequest("Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 th\xF4ng tin h\u1EE3p l\u1EC7.");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(email).first();
      if (!acc) return json({ message: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng" }, 404);
      let unitPrice = 0;
      if (ticketPackageId) {
        const pkg = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE id = ?`).bind(ticketPackageId).first();
        if (!pkg || Number(pkg.is_active ?? 0) === 0) return json({ message: "G\xF3i v\xE9 kh\xF4ng h\u1EE3p l\u1EC7" }, 404);
        unitPrice = Number(pkg.price || 0);
      }
      const totalPrice = Number(body.totalPrice ?? unitPrice * ticketCount);
      if (!Number.isFinite(totalPrice) || totalPrice <= 0) return badRequest("Gi\xE1 tr\u1ECB t\u1ED5ng ti\u1EC1n kh\xF4ng h\u1EE3p l\u1EC7.");
      try {
        const resRun = await env.cinema_db.prepare(
          `INSERT INTO bookings (user_id, movie_id, ticket_package_id, ticket_count, total_price, payment_method, phone, name, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          Number(acc.user_id || 0),
          movieId,
          ticketPackageId,
          ticketCount,
          totalPrice,
          paymentMethod,
          phone,
          name,
          emailBook,
          (/* @__PURE__ */ new Date()).toISOString()
        ).run();
        const bookingId = Number(resRun.meta.last_row_id ?? 0);
        const booking = await env.cinema_db.prepare(`SELECT * FROM bookings WHERE id = ?`).bind(bookingId).first();
        return json({ message: "Kh\u1EDFi t\u1EA1o \u0111\u1EB7t v\xE9 th\xE0nh c\xF4ng", booking }, 201);
      } catch (e) {
        return json({ message: "Kh\xF4ng th\u1EC3 t\u1EA1o \u0111\u1EB7t v\xE9", error: String(e?.message || e) }, 500);
      }
    }
    if (url.pathname === "/api/confirm-booking" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const user_id = Number(body.user_id);
      const payment_id = Number(body.payment_id);
      const payment_status = String(body.payment_status || "");
      const transaction_id = body.transaction_id ?? null;
      const paid_at = body.paid_at ? new Date(body.paid_at).toISOString() : null;
      if (!user_id || !payment_id || !payment_status) return badRequest("Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 th\xF4ng tin h\u1EE3p l\u1EC7.");
      const booking = await env.cinema_db.prepare(`SELECT * FROM bookings WHERE id = ? AND user_id = ?`).bind(payment_id, user_id).first();
      if (!booking) return json({ message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u1EB7t v\xE9." }, 404);
      let bookingCode = booking.booking_code;
      if (payment_status.toLowerCase() === "paid" && !bookingCode) {
        let isUnique = false;
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        while (!isUnique) {
          let code = "";
          for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
          const existed = await env.cinema_db.prepare(`SELECT id FROM bookings WHERE booking_code = ?`).bind(code).first();
          if (!existed) {
            bookingCode = code;
            isUnique = true;
          }
        }
      }
      const expiry = paid_at ? new Date(new Date(paid_at).getTime() + 10 * 24 * 60 * 60 * 1e3).toISOString() : null;
      await env.cinema_db.prepare(`UPDATE bookings SET payment_status = ?, transaction_id = ?, paid_at = ?, expiry_date = ?, booking_code = COALESCE(?, booking_code) WHERE id = ?`).bind(payment_status, transaction_id, paid_at, expiry, bookingCode ?? null, Number(booking.id)).run();
      const updated = await env.cinema_db.prepare(`SELECT * FROM bookings WHERE id = ?`).bind(Number(booking.id)).first();
      try {
        const emailTo = String(updated.email || "");
        if (emailTo) {
          const movie = updated.movie_id ? await env.cinema_db.prepare(`SELECT title FROM movies WHERE id = ?`).bind(Number(updated.movie_id)).first() : null;
          const ticket = updated.ticket_package_id ? await env.cinema_db.prepare(`SELECT name, price FROM ticket_packages WHERE id = ?`).bind(Number(updated.ticket_package_id)).first() : null;
          const code = updated.booking_code || "";
          const qty = Number(updated.ticket_count || 0);
          const amount = Number(updated.total_price || 0);
          const title = movie?.title || "";
          const packageName = ticket?.name || "";
          const paidAtStr = updated.paid_at ? new Date(updated.paid_at).toLocaleString("vi-VN") : "";
          const expiryStr = updated.expiry_date ? new Date(updated.expiry_date).toLocaleDateString("vi-VN") : "";
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>X\xE1c nh\u1EADn thanh to\xE1n</title></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;"><div style="max-width:600px;margin:20px auto;padding:20px;border:1px solid #ddd;border-radius:8px;"><h2 style="color:#007bff;">X\xE1c nh\u1EADn thanh to\xE1n th\xE0nh c\xF4ng</h2><p>M\xE3 v\xE9 c\u1EE7a b\u1EA1n: <strong>${code}</strong></p><ul><li>Phim: ${title}</li><li>G\xF3i v\xE9: ${packageName}</li><li>S\u1ED1 l\u01B0\u1EE3ng: ${qty}</li><li>T\u1ED5ng ti\u1EC1n: ${amount.toLocaleString("vi-VN")} \u0111</li><li>Thanh to\xE1n l\xFAc: ${paidAtStr}</li><li>H\u1EA1n s\u1EED d\u1EE5ng: ${expiryStr}</li></ul><p>Vui l\xF2ng gi\u1EEF m\xE3 v\xE9 \u0111\u1EC3 s\u1EED d\u1EE5ng khi v\xE0o r\u1EA1p.</p><p>Tr\xE2n tr\u1ECDng,<br>\u0110\u1ED9i ng\u0169 CTBOOKING</p></div></body></html>`;
          await sendMail(env, emailTo, "\u2705 Thanh to\xE1n th\xE0nh c\xF4ng - CTBOOKING", html);
        }
      } catch {
      }
      return json({
        message: "Thanh to\xE1n th\xE0nh c\xF4ng",
        booking: {
          id: updated.id,
          user_id: updated.user_id,
          movie_id: updated.movie_id,
          ticket_package_id: updated.ticket_package_id,
          ticket_count: updated.ticket_count,
          total_price: updated.total_price,
          payment_method: updated.payment_method,
          payment_status: updated.payment_status,
          transaction_id: updated.transaction_id,
          created_at: updated.created_at,
          paid_at: updated.paid_at
        }
      });
    }
    if (/^\/api\/bookings\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const booking = await env.cinema_db.prepare(`SELECT id, payment_status, total_price, ticket_count, created_at, name, email, phone, user_id, movie_id, ticket_package_id FROM bookings WHERE id = ?`).bind(id).first();
      if (!booking) return new Response(JSON.stringify({ message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u1EB7t v\xE9" }), { status: 404, headers: cors });
      return json({
        id: booking.id,
        payment_status: booking.payment_status,
        total_price: booking.total_price,
        ticket_count: booking.ticket_count,
        created_at: booking.created_at,
        name: booking.name,
        phone: booking.phone,
        email: booking.email,
        user_id: booking.user_id,
        movie_id: booking.movie_id,
        ticket_package_id: booking.ticket_package_id
      });
    }
    if (url.pathname.startsWith("/api/bookings/code/") && request.method === "GET") {
      const rl = rateLimitCheck();
      if (!rl.ok) {
        const retrySec = Math.ceil(rl.windowMs / 1e3);
        const headers2 = { ...noStoreHeaders, "Retry-After": String(retrySec), "X-RateLimit-Limit": String(RL_MAX), "X-RateLimit-Remaining": "0", "X-RateLimit-WindowMS": String(RL_WINDOW_MS) };
        return new Response(JSON.stringify({ message: `Qu\xE1 nhi\u1EC1u y\xEAu c\u1EA7u, vui l\xF2ng th\u1EED l\u1EA1i sau ${retrySec}s` }), { status: 429, headers: headers2 });
      }
      const code = url.pathname.split("/").pop() || "";
      if (!code.trim()) return badRequest("Vui l\xF2ng nh\u1EADp m\xE3 v\xE9");
      const normalizedCode = code.trim().toUpperCase();
      const booking = await env.cinema_db.prepare(`SELECT b.*, u.fullname as user_fullname FROM bookings b LEFT JOIN users u ON u.id = b.user_id WHERE b.booking_code = ?`).bind(normalizedCode).first();
      if (!booking) {
        const headers2 = { ...noStoreHeaders, "X-RateLimit-Limit": String(RL_MAX), "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-WindowMS": String(RL_WINDOW_MS) };
        return new Response(JSON.stringify({ message: `Kh\xF4ng t\xECm th\u1EA5y v\xE9 v\u1EDBi m\xE3 n\xE0y.` }), { status: 404, headers: headers2 });
      }
      const now = Date.now();
      const paidAt = booking.paid_at ? new Date(booking.paid_at).getTime() : null;
      const expiryAt = booking.expiry_date ? new Date(booking.expiry_date).getTime() : null;
      const isPaid = String(booking.payment_status || "").toLowerCase() === "paid";
      const expired = Boolean(expiryAt && now > expiryAt);
      const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !booking.is_used);
      const can_use = Boolean(valid);
      const daysLeft = expiryAt ? Math.ceil((expiryAt - now) / (1e3 * 60 * 60 * 24)) : null;
      const headers = { ...noStoreHeaders, "X-RateLimit-Limit": String(RL_MAX), "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-WindowMS": String(RL_WINDOW_MS) };
      return new Response(
        JSON.stringify({
          id: booking.id,
          booking_code: booking.booking_code,
          payment_status: booking.payment_status,
          user_id: booking.user_id,
          name: booking.name,
          phone: booking.phone,
          email: booking.email,
          ticket_count: booking.ticket_count,
          total_price: booking.total_price,
          movie_id: booking.movie_id,
          ticket_package_id: booking.ticket_package_id,
          created_at: booking.created_at,
          paid_at: booking.paid_at,
          expiry_date: booking.expiry_date,
          payment_method: booking.payment_method,
          userName: booking.user_fullname || "N/A",
          is_used: Boolean(booking.is_used),
          valid,
          can_use,
          validity_days: daysLeft,
          expired
        }),
        { status: 200, headers }
      );
    }
    if (url.pathname === "/api/bookings/use" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const code = body?.code;
      if (!code || !code.trim()) return badRequest("Vui l\xF2ng nh\u1EADp m\xE3 v\xE9");
      const normalizedCode = code.trim().toUpperCase();
      const booking = await env.cinema_db.prepare(`SELECT * FROM bookings WHERE booking_code = ?`).bind(normalizedCode).first();
      if (!booking) return json({ message: "Kh\xF4ng t\xECm th\u1EA5y v\xE9" }, 404);
      const isPaid = String(booking.payment_status || "").toLowerCase() === "paid";
      const paidAt = booking.paid_at ? new Date(booking.paid_at).getTime() : null;
      const expiryAt = booking.expiry_date ? new Date(booking.expiry_date).getTime() : null;
      const expired = Boolean(expiryAt && Date.now() > expiryAt);
      const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !booking.is_used);
      if (!valid) return json({ message: "V\xE9 kh\xF4ng c\xF2n hi\u1EC7u l\u1EF1c ho\u1EB7c \u0111\xE3 s\u1EED d\u1EE5ng" }, 400);
      await env.cinema_db.prepare(`UPDATE bookings SET is_used = 1 WHERE id = ?`).bind(Number(booking.id)).run();
      const updated = await env.cinema_db.prepare(`SELECT id, is_used FROM bookings WHERE id = ?`).bind(Number(booking.id)).first();
      return json({ ok: true, message: "X\xE1c nh\u1EADn s\u1EED d\u1EE5ng v\xE9 th\xE0nh c\xF4ng", booking: { id: updated.id, is_used: Boolean(updated.is_used) } });
    }
    if (url.pathname === "/api/momo/create-payment" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const amount = Number(body.amount);
      const orderId = String(body.orderId || "");
      const orderInfo = String(body.orderInfo || "");
      const base = String(env.VITE_SERVER_BASE_URL || env.UPSTREAM_BASE || "https://cinesphere.com.vn");
      const redirectPath = String(env.VITE_MOMO_RETURN_URL || env.VITE_VNPAY_RETURN_URL || "/checkout");
      const redirectUrl = `${base}${redirectPath}`;
      const ipnUrl = `${url.origin}/api/momo/ipn`;
      const requestType = String(body.requestType || "captureWallet");
      const extraData = String(body.extraData || "");
      const lang = String(body.lang || "vi");
      const partnerCode = String(env.VITE_MOMO_PARTNER_CODE || body.partnerCode || "");
      const accessKey = String(env.VITE_MOMO_ACCESS_KEY || body.accessKey || "");
      const secretKey = String(env.VITE_MOMO_SECRET_KEY || body.secretKey || "");
      if (!partnerCode || !accessKey || !secretKey) return json({ message: "MOMO configuration missing" }, 400);
      if (!amount || !orderId || !orderInfo || !redirectUrl || !ipnUrl) return json({ message: "Invalid payload" }, 400);
      const requestId = String(body.requestId || Date.now().toString());
      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
      const signature = await hmacHex("SHA-256", secretKey, rawSignature);
      const endpoint = String(env.VITE_MOMO_ENDPOINT || "https://test-payment.momo.vn/v2/gateway/api/create");
      const momoRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerCode, accessKey, requestId, amount, orderId, orderInfo, redirectUrl, ipnUrl, extraData, requestType, signature, lang })
      });
      const data = await momoRes.json().catch(() => ({}));
      if (!momoRes.ok) return new Response(JSON.stringify({ message: data?.message || "MOMO error", data }), { status: momoRes.status, headers: cors });
      return json({ payUrl: data?.payUrl || data?.deeplink || data?.deeplinkWeb || "", data });
    }
    if (url.pathname === "/api/momo/ipn" && request.method === "POST") {
      try {
        return json({ result: true });
      } catch {
        return json({ result: false }, 500);
      }
    }
    if (url.pathname === "/api/vnpay/create-payment" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const amount = Number(body.amount);
      const orderId = String(body.orderId || "");
      const orderInfo = String(body.orderInfo || "");
      const locale = String(body.locale || "vn");
      if (!amount || !orderId || !orderInfo) return json({ message: "Invalid payload" }, 400);
      const tmnCode = String(env.VITE_VNPAY_TMN_CODE || body.tmnCode || "");
      const hashSecret = String(env.VITE_VNPAY_HASH_SECRET || body.hashSecret || "");
      const base = String(env.VITE_SERVER_BASE_URL || env.UPSTREAM_BASE || "https://cinesphere.com.vn");
      const returnPath = String(env.VITE_VNPAY_RETURN_URL || "/checkout");
      const returnUrl = `${base}${returnPath}`;
      if (!tmnCode || !hashSecret || !returnUrl) return json({ message: "VNPay configuration missing" }, 400);
      const vnp_TxnRef = orderId;
      const vnp_Version = "2.1.0";
      const vnp_Command = "pay";
      const vnp_CreateDate = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
      const vnp_IpAddr = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
      const vnp_Amount = amount * 100;
      const params = {
        vnp_Version,
        vnp_Command,
        vnp_TmnCode: tmnCode,
        vnp_Locale: locale,
        vnp_CurrCode: "VND",
        vnp_TxnRef,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: "other",
        vnp_Amount,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr,
        vnp_CreateDate
      };
      const sortedKeys = Object.keys(params).sort();
      const sorted = {};
      for (const k of sortedKeys) sorted[k] = params[k];
      const signData = new URLSearchParams(sorted).toString();
      const vnp_SecureHash = await hmacHex("SHA-512", hashSecret, signData);
      const query = new URLSearchParams({ ...sorted, vnp_SecureHash }).toString();
      const gateway = String(env.VITE_VNPAY_GATEWAY || "");
      const payUrl = `${gateway}?${query}`;
      return json({ payUrl });
    }
    if (url.pathname === "/api/vnpay/ipn" && request.method === "POST") {
      return json({ result: true });
    }
    if (url.pathname === "/api/admin/revenue" && request.method === "GET") {
      const fromStr = String(url.searchParams.get("from") || "");
      const toStr = String(url.searchParams.get("to") || "");
      const status = String(url.searchParams.get("status") || "paid").toLowerCase();
      let where = "1=1";
      const params = [];
      if (status !== "all") {
        where += " AND payment_status IN ('paid')";
      }
      if (fromStr && toStr) {
        where += " AND (paid_at BETWEEN ? AND ? OR created_at BETWEEN ? AND ?)";
        params.push(fromStr, toStr, fromStr, toStr);
      } else if (fromStr) {
        where += " AND (paid_at >= ? OR created_at >= ?)";
        params.push(fromStr, fromStr);
      } else if (toStr) {
        where += " AND (paid_at <= ? OR created_at <= ?)";
        params.push(toStr, toStr);
      }
      const agg = await env.cinema_db.prepare(`SELECT SUM(total_price) AS total, COUNT(*) AS cnt FROM bookings WHERE ${where}`).bind(...params).first();
      const total = Number(agg?.total || 0);
      const count = Number(agg?.cnt || 0);
      return json({ total, count });
    }
    if (url.pathname === "/api/admin/transactions" && request.method === "GET") {
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 10);
      const email = String(url.searchParams.get("email") || "");
      const status = String(url.searchParams.get("status") || "");
      const sortKey = String(url.searchParams.get("sort") || "created_at");
      const dir = String(url.searchParams.get("dir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
      const paymentMethod = String(url.searchParams.get("payment_method") || "");
      const fromStr = String(url.searchParams.get("from") || "");
      const toStr = String(url.searchParams.get("to") || "");
      const offset = (page - 1) * pageSize;
      const whereParts = [];
      const bind = [];
      if (email) {
        whereParts.push(
          `(email LIKE ? OR user_id IN (SELECT id FROM users WHERE id IN (SELECT user_id FROM accounts WHERE email LIKE ?)))`
        );
        bind.push(`%${email}%`, `%${email}%`);
      }
      if (status && status !== "all") {
        whereParts.push(`payment_status = ?`);
        bind.push(status);
      }
      if (paymentMethod) {
        whereParts.push(`payment_method = ?`);
        bind.push(paymentMethod);
      }
      if (fromStr && toStr) {
        whereParts.push(`(created_at BETWEEN ? AND ? OR paid_at BETWEEN ? AND ?)`);
        bind.push(fromStr, toStr, fromStr, toStr);
      } else if (fromStr) {
        whereParts.push(`(created_at >= ? OR paid_at >= ?)`);
        bind.push(fromStr, fromStr);
      } else if (toStr) {
        whereParts.push(`(created_at <= ? OR paid_at <= ?)`);
        bind.push(toStr, toStr);
      }
      const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
      const totalRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings ${where}`).bind(...bind).first();
      const total = Number(totalRow?.c || 0);
      const orderBy = sortKey === "paid_at" ? `paid_at ${dir}` : `created_at ${dir}`;
      const rows = await env.cinema_db.prepare(
        `SELECT b.*, u.fullname as user_fullname, (SELECT email FROM accounts a WHERE a.user_id = b.user_id LIMIT 1) as user_email, (SELECT title FROM movies m WHERE m.id = b.movie_id) as movie_title, (SELECT name FROM ticket_packages t WHERE t.id = b.ticket_package_id) as ticket_package_name FROM bookings b LEFT JOIN users u ON u.id = b.user_id ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
      ).bind(...bind, pageSize, offset).all();
      const items = (rows.results || []).map((tx) => {
        const now = Date.now();
        const expiry = tx.expiry_date ? new Date(tx.expiry_date).getTime() : null;
        const expired = Boolean(expiry && now > expiry);
        const daysLeft = expiry ? Math.ceil((expiry - now) / (1e3 * 60 * 60 * 24)) : null;
        return {
          id: tx.id,
          bookingId: tx.id,
          email: tx.email || tx.user_email || "",
          phone: tx.phone || "",
          name: tx.name || tx.user_fullname || "",
          userName: tx.user_fullname || "",
          movieTitle: tx.movie_title || "",
          ticketPackageName: tx.ticket_package_name || "",
          ticketCount: tx.ticket_count,
          totalPrice: Number(tx.total_price),
          paymentMethod: tx.payment_method,
          paymentStatus: tx.payment_status,
          transactionId: tx.transaction_id,
          createdAt: tx.created_at,
          paidAt: tx.paid_at,
          expiryDate: tx.expiry_date || null,
          expired,
          daysLeft
        };
      });
      return json({ items, page, pageSize, total });
    }
    if (/^\/api\/admin\/transactions\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const row = await env.cinema_db.prepare(
        `SELECT b.*, u.fullname as user_fullname, u.id as u_id, (SELECT email FROM accounts a WHERE a.user_id = b.user_id LIMIT 1) as user_email, (SELECT is_active FROM accounts a WHERE a.user_id = b.user_id LIMIT 1) as user_is_active, (SELECT created_at FROM accounts a WHERE a.user_id = b.user_id LIMIT 1) as account_created_at, (SELECT title FROM movies m WHERE m.id = b.movie_id) as movie_title, (SELECT cover_image FROM movies m WHERE m.id = b.movie_id) as movie_cover_image, (SELECT genres FROM movies m WHERE m.id = b.movie_id) as movie_genres, (SELECT rating FROM movies m WHERE m.id = b.movie_id) as movie_rating, (SELECT duration_min FROM movies m WHERE m.id = b.movie_id) as movie_duration_min, (SELECT name FROM ticket_packages t WHERE t.id = b.ticket_package_id) as ticket_package_name, (SELECT price FROM ticket_packages t WHERE t.id = b.ticket_package_id) as ticket_package_price FROM bookings b LEFT JOIN users u ON u.id = b.user_id WHERE b.id = ?`
      ).bind(id).first();
      if (!row) return json({ message: "Kh\xF4ng t\xECm th\u1EA5y giao d\u1ECBch" }, 404);
      const now = Date.now();
      const expiry = row.expiry_date ? new Date(row.expiry_date).getTime() : null;
      const expired = Boolean(expiry && now > expiry);
      const daysLeft = expiry ? Math.ceil((expiry - now) / (1e3 * 60 * 60 * 24)) : null;
      const mapped = {
        id: row.id,
        user: {
          id: row.u_id,
          fullname: row.user_fullname,
          email: row.email || row.user_email || "N/A",
          phone: row.phone || null,
          is_active: Boolean(row.user_is_active ?? true),
          account_created_at: row.account_created_at
        },
        movie: {
          id: row.movie_id,
          title: row.movie_title,
          cover_image: row.movie_cover_image,
          genres: row.movie_genres,
          rating: row.movie_rating,
          duration_min: row.movie_duration_min
        },
        ticket_package: {
          id: row.ticket_package_id,
          name: row.ticket_package_name,
          price: row.ticket_package_price
        },
        booking_details: {
          ticket_count: row.ticket_count,
          total_price: Number(row.total_price),
          price_per_ticket: Number(row.ticket_count) > 0 ? Number(row.total_price) / Number(row.ticket_count) : 0
        },
        payment_info: {
          payment_method: row.payment_method || "N/A",
          payment_status: row.payment_status || "pending",
          transaction_id: row.transaction_id || "N/A",
          created_at: row.created_at,
          paid_at: row.paid_at,
          expiry_date: row.expiry_date || null,
          expired,
          days_left: daysLeft
        }
      };
      return json(mapped);
    }
    if (url.pathname === "/api/admin/dashboard/metrics" && request.method === "GET") {
      const moviesCount = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM movies WHERE is_active = 1`).first();
      const toysCount = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM toys`).first();
      const usersCount = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM users`).first();
      const txCountPaid = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE payment_status IN ('paid')`).first();
      const now = /* @__PURE__ */ new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const revenueTodayRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE payment_status IN ('paid') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(todayStart.toISOString(), todayEnd.toISOString(), todayStart.toISOString(), todayEnd.toISOString()).first();
      const revenueCashRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE payment_status IN ('paid') AND payment_method IN ('cash','Cash') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(todayStart.toISOString(), todayEnd.toISOString(), todayStart.toISOString(), todayEnd.toISOString()).first();
      const revenueMomoRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE payment_status IN ('paid') AND payment_method IN ('momo','MoMo') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(todayStart.toISOString(), todayEnd.toISOString(), todayStart.toISOString(), todayEnd.toISOString()).first();
      const revenueVnpRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE payment_status IN ('paid') AND payment_method IN ('vnpay','VNPay') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(todayStart.toISOString(), todayEnd.toISOString(), todayStart.toISOString(), todayEnd.toISOString()).first();
      const bookingsTodayRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE payment_status IN ('paid') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(todayStart.toISOString(), todayEnd.toISOString(), todayStart.toISOString(), todayEnd.toISOString()).first();
      const bookingsFutureRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE payment_status IN ('paid') AND created_at > ?`).bind(todayEnd.toISOString()).first();
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 6);
      const weekRows = await env.cinema_db.prepare(`SELECT b.total_price, b.movie_id, m.title as movie_title FROM bookings b LEFT JOIN movies m ON m.id = b.movie_id WHERE b.payment_status IN ('paid') AND ((b.created_at BETWEEN ? AND ?) OR (b.paid_at BETWEEN ? AND ?))`).bind(weekStart.toISOString(), todayEnd.toISOString(), weekStart.toISOString(), todayEnd.toISOString()).all();
      const revMap = /* @__PURE__ */ new Map();
      for (const r of weekRows.results || []) {
        const id = Number(r.movie_id);
        const title = r.movie_title || "";
        const price = Number(r.total_price || 0);
        if (id) {
          const prev = revMap.get(id) || { title, revenue: 0 };
          prev.revenue += price;
          prev.title = title || prev.title;
          revMap.set(id, prev);
        }
      }
      const topMoviesWeek = Array.from(revMap.entries()).map(([id, v]) => ({ id, title: v.title, revenue: v.revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
      return json({
        totalMovies: Number(moviesCount?.c || 0),
        totalToys: Number(toysCount?.c || 0),
        totalUsers: Number(usersCount?.c || 0),
        totalTransactions: Number(txCountPaid?.c || 0),
        revenueTotal: Number(revenueTodayRow?.total || 0),
        revenueByMethod: {
          cash: Number(revenueCashRow?.total || 0),
          momo: Number(revenueMomoRow?.total || 0),
          vnpay: Number(revenueVnpRow?.total || 0)
        },
        totalBookingsToday: Number(bookingsTodayRow?.c || 0),
        totalBookingsFuture: Number(bookingsFutureRow?.c || 0),
        topMoviesWeek
      });
    }
    if (url.pathname === "/api/admin/dashboard/revenue-date" && request.method === "GET") {
      const dateStr = String(url.searchParams.get("date") || "");
      const status = String(url.searchParams.get("status") || "paid").toLowerCase();
      let where = "";
      const params = [];
      if (dateStr && dateStr !== "all") {
        const d = new Date(dateStr);
        const start = new Date(d);
        start.setHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        where += ` AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`;
        params.push(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString());
      }
      if (status !== "all") {
        where += ` AND payment_status IN ('paid')`;
      }
      const totalRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE 1=1 ${where}`).bind(...params).first();
      const countRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE 1=1 ${where}`).bind(...params).first();
      const cashRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE 1=1 ${where} AND payment_method IN ('cash','Cash')`).bind(...params).first();
      const momoRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE 1=1 ${where} AND payment_method IN ('momo','MoMo')`).bind(...params).first();
      const vnpRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE 1=1 ${where} AND payment_method IN ('vnpay','VNPay')`).bind(...params).first();
      return json({
        date: dateStr || "all",
        total: Number(totalRow?.total || 0),
        count: Number(countRow?.c || 0),
        revenueByMethod: {
          cash: Number(cashRow?.total || 0),
          momo: Number(momoRow?.total || 0),
          vnpay: Number(vnpRow?.total || 0)
        }
      });
    }
    if (url.pathname === "/api/admin/dashboard/revenue-7days" && request.method === "GET") {
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const dayDate = new Date(today);
        dayDate.setDate(dayDate.getDate() - i);
        const start = new Date(dayDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dayDate);
        end.setHours(23, 59, 59, 999);
        const row = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE payment_status IN ('paid') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        const monthStr = String(dayDate.getMonth() + 1).padStart(2, "0");
        const dateStr = String(dayDate.getDate()).padStart(2, "0");
        data.push({ day: `${monthStr}-${dateStr}`, revenue: Number(row?.total || 0) });
      }
      return json({ data });
    }
    if (url.pathname === "/api/admin/dashboard/revenue-month" && request.method === "GET") {
      const yearStr = String(url.searchParams.get("year") || "");
      const monthStr = String(url.searchParams.get("month") || "");
      const status = String(url.searchParams.get("status") || "paid").toLowerCase();
      if (monthStr && yearStr) {
        const year = Number(yearStr);
        const month = Number(monthStr);
        const start = new Date(year, month - 1, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(year, month, 0);
        end.setHours(23, 59, 59, 999);
        let where = `((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`;
        if (status !== "all") where += ` AND payment_status IN ('paid')`;
        const totalRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE ${where}`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        const countRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE ${where}`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        const cashRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE ${where} AND payment_method IN ('cash','Cash')`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        const momoRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE ${where} AND payment_method IN ('momo','MoMo')`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        const vnpRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE ${where} AND payment_method IN ('vnpay','VNPay')`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        return json({
          total: Number(totalRow?.total || 0),
          count: Number(countRow?.c || 0),
          revenueByMethod: {
            cash: Number(cashRow?.total || 0),
            momo: Number(momoRow?.total || 0),
            vnpay: Number(vnpRow?.total || 0)
          }
        });
      }
      const targetYear = yearStr ? Number(yearStr) : (/* @__PURE__ */ new Date()).getFullYear();
      const data = [];
      for (let m = 0; m < 12; m++) {
        const start = new Date(targetYear, m, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(targetYear, m + 1, 0);
        end.setHours(23, 59, 59, 999);
        let where = `((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`;
        if (status !== "all") where += ` AND payment_status IN ('paid')`;
        const row = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE ${where}`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        data.push({ month: m + 1, revenue: Number(row?.total || 0) });
      }
      return json({ year: targetYear, data });
    }
    if (url.pathname === "/api/usersprofile/transactions" && request.method === "GET") {
      const emailRaw = String(url.searchParams.get("email") || "");
      const status = String(url.searchParams.get("status") || "paid");
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 10);
      const sortKey = String(url.searchParams.get("sort") || "created_at");
      const dir = String(url.searchParams.get("dir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
      const paymentMethod = String(url.searchParams.get("payment_method") || "");
      const fromStr = String(url.searchParams.get("from") || "");
      const toStr = String(url.searchParams.get("to") || "");
      const offset = (page - 1) * pageSize;
      let email = "";
      try {
        email = decodeURIComponent(emailRaw);
      } catch {
        email = emailRaw;
      }
      if (!email) return json({ items: [], page, pageSize, total: 0 });
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(email).first();
      if (!acc) return json({ items: [], page, pageSize, total: 0 });
      const whereParts = [`user_id = ?`];
      const bind = [Number(acc.user_id)];
      if (status && status.toLowerCase() === "paid") {
        whereParts.push(`payment_status IN ('paid')`);
      }
      if (paymentMethod) {
        whereParts.push(`payment_method = ?`);
        bind.push(paymentMethod);
      }
      if (fromStr && toStr) {
        whereParts.push(`(created_at BETWEEN ? AND ? OR paid_at BETWEEN ? AND ?)`);
        bind.push(fromStr, toStr, fromStr, toStr);
      } else if (fromStr) {
        whereParts.push(`(created_at >= ? OR paid_at >= ?)`);
        bind.push(fromStr, fromStr);
      } else if (toStr) {
        whereParts.push(`(created_at <= ? OR paid_at <= ?)`);
        bind.push(toStr, toStr);
      }
      const where = `WHERE ${whereParts.join(" AND ")}`;
      const totalRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings ${where}`).bind(...bind).first();
      const rows = await env.cinema_db.prepare(
        `SELECT b.*, m.title as movie_title, m.cover_image as poster_url, t.name as ticket_package_name FROM bookings b LEFT JOIN movies m ON m.id = b.movie_id LEFT JOIN ticket_packages t ON t.id = b.ticket_package_id ${where} ORDER BY ${sortKey === "paid_at" ? "b.paid_at" : "b.created_at"} ${dir} LIMIT ? OFFSET ?`
      ).bind(...bind, pageSize, offset).all();
      const items = (rows.results || []).map((b) => {
        const now = Date.now();
        const expiryAt = b?.expiry_date ? new Date(b.expiry_date).getTime() : null;
        const expired = Boolean(expiryAt && now > expiryAt);
        const daysLeft = expiryAt ? Math.ceil((expiryAt - now) / (1e3 * 60 * 60 * 24)) : null;
        const amount = Number(b?.total_price ?? 0);
        return {
          booking_id: b.id,
          booking_code: b.booking_code || null,
          user_id: b.user_id,
          movie: b.movie_title || "",
          ticket_package: b.ticket_package_name || "",
          quantity: Number(b.ticket_count ?? 0),
          amount,
          method: b.payment_method || "",
          payment_status: b.payment_status || "",
          created_at: b.created_at || null,
          paid_at: b.paid_at || null,
          expiry_date: b.expiry_date || null,
          expired,
          days_left: daysLeft,
          is_used: Boolean(b.is_used),
          name: b.name || "",
          phone: b.phone || "",
          email: b.email || email,
          poster_url: b.poster_url || null
        };
      });
      return json({ items, page, pageSize, total: Number(totalRow?.c || 0) });
    }
    if (url.pathname === "/api/debug/mail" && request.method === "GET") {
      const config = {
        provider: "mailchannels",
        endpoint: "https://api.mailchannels.net/tx/v1/send",
        sender_email: String(env.GMAIL_SENDER_EMAIL || "no-reply@example.com"),
        sender_name: String(env.GMAIL_SENDER_NAME || "CTBOOKING"),
        has_sender_email: Boolean(env.GMAIL_SENDER_EMAIL),
        has_sender_name: Boolean(env.GMAIL_SENDER_NAME),
        configured: Boolean(env.GMAIL_SENDER_EMAIL)
      };
      const verify = config.configured ? { ok: true } : { ok: false, message: "Missing GMAIL_SENDER_EMAIL" };
      return json({ config, verify });
    }
    return notFound();
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
